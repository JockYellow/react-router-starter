import { ensureAnimeSurveyOrderingSchema, ANIME_SURVEY_ORDERING_VERSION } from "./anime-survey-ordering.server";
import { ensureAnimeSchema } from "./anime.schema.server";
import { NETFLIX_SEED_RESOLVER_VERSION } from "./netflix-seed.server";

export type AnimeAcceptanceSnapshot = {
  netflix: {
    queueTotal: number;
    queueResolverCurrent: number;
    queueResolverLegacy: number;
    canonicalSourcesTotal: number;
    canonicalMatched: number;
    canonicalAmbiguous: number;
    canonicalUnmatched: number;
    matchedWithoutAnimeId: number;
    matchedWithoutDecision: number;
    matchedWithDecision: number;
  };
  ordering: {
    currentVersion: number;
    tvScopesWithCandidates: number;
    scopesCurrent: number;
    scopesPendingMigration: number;
    scopesWithMigrationError: number;
    scopesWithMissingMetrics: number;
  };
};

type CountRow = { count: number | string | null };

async function count(
  db: D1Database,
  sql: string,
  ...values: unknown[]
): Promise<number> {
  const row = await db.prepare(sql).bind(...values).first<CountRow>();
  return Number(row?.count ?? 0) || 0;
}

/**
 * Read-only acceptance counters for the currently connected D1 database.
 *
 * The function intentionally returns counts only. It does not expose private
 * Netflix titles, notes, ratings, aliases, or source payloads.
 */
export async function getAnimeAcceptanceSnapshot(
  db: D1Database,
): Promise<AnimeAcceptanceSnapshot> {
  await ensureAnimeSchema(db);
  await ensureAnimeSurveyOrderingSchema(db);

  const [
    queueTotal,
    queueResolverCurrent,
    canonicalSourcesTotal,
    canonicalMatched,
    canonicalAmbiguous,
    canonicalUnmatched,
    matchedWithoutAnimeId,
    matchedWithoutDecision,
    matchedWithDecision,
    tvScopesWithCandidates,
    scopesCurrent,
    scopesWithMigrationError,
    scopesWithMissingMetrics,
  ] = await Promise.all([
    count(db, "SELECT COUNT(*) AS count FROM anime_seed_queue WHERE source = 'netflix'"),
    count(
      db,
      `SELECT COUNT(*) AS count
       FROM anime_seed_queue
       WHERE source = 'netflix'
         AND CAST(json_extract(payload_json, '$.resolverVersion') AS INTEGER) = ?`,
      NETFLIX_SEED_RESOLVER_VERSION,
    ),
    count(db, "SELECT COUNT(*) AS count FROM anime_item_sources WHERE source = 'netflix'"),
    count(
      db,
      "SELECT COUNT(*) AS count FROM anime_item_sources WHERE source = 'netflix' AND match_status = 'MATCHED'",
    ),
    count(
      db,
      "SELECT COUNT(*) AS count FROM anime_item_sources WHERE source = 'netflix' AND match_status = 'AMBIGUOUS'",
    ),
    count(
      db,
      "SELECT COUNT(*) AS count FROM anime_item_sources WHERE source = 'netflix' AND match_status = 'UNMATCHED'",
    ),
    count(
      db,
      `SELECT COUNT(*) AS count
       FROM anime_item_sources
       WHERE source = 'netflix'
         AND match_status = 'MATCHED'
         AND anime_id IS NULL`,
    ),
    count(
      db,
      `SELECT COUNT(*) AS count
       FROM anime_item_sources s
       LEFT JOIN anime_user_decisions d ON d.anime_id = s.anime_id
       WHERE s.source = 'netflix'
         AND s.match_status = 'MATCHED'
         AND s.anime_id IS NOT NULL
         AND d.anime_id IS NULL`,
    ),
    count(
      db,
      `SELECT COUNT(*) AS count
       FROM anime_item_sources s
       JOIN anime_user_decisions d ON d.anime_id = s.anime_id
       WHERE s.source = 'netflix'
         AND s.match_status = 'MATCHED'
         AND s.anime_id IS NOT NULL`,
    ),
    count(
      db,
      `SELECT COUNT(*) AS count
       FROM anime_survey_progress p
       WHERE p.scope_type = 'TV_SEASON'
         AND EXISTS (
           SELECT 1 FROM anime_scope_candidates c WHERE c.scope_key = p.scope_key
         )`,
    ),
    count(
      db,
      `SELECT COUNT(*) AS count
       FROM anime_scope_ordering_state
       WHERE ordering_version >= ?`,
      ANIME_SURVEY_ORDERING_VERSION,
    ),
    count(
      db,
      `SELECT COUNT(*) AS count
       FROM anime_scope_ordering_state
       WHERE ordering_version < ?
         AND last_error IS NOT NULL`,
      ANIME_SURVEY_ORDERING_VERSION,
    ),
    count(
      db,
      `SELECT COUNT(*) AS count
       FROM anime_scope_ordering_state
       WHERE ordering_version >= ?
         AND missing_metric_count > 0`,
      ANIME_SURVEY_ORDERING_VERSION,
    ),
  ]);

  return {
    netflix: {
      queueTotal,
      queueResolverCurrent,
      queueResolverLegacy: Math.max(0, queueTotal - queueResolverCurrent),
      canonicalSourcesTotal,
      canonicalMatched,
      canonicalAmbiguous,
      canonicalUnmatched,
      matchedWithoutAnimeId,
      matchedWithoutDecision,
      matchedWithDecision,
    },
    ordering: {
      currentVersion: ANIME_SURVEY_ORDERING_VERSION,
      tvScopesWithCandidates,
      scopesCurrent,
      scopesPendingMigration: Math.max(0, tvScopesWithCandidates - scopesCurrent),
      scopesWithMigrationError,
      scopesWithMissingMetrics,
    },
  };
}
