import { ensureAnimeBangumiMetricsSchema } from "./anime-bangumi-metrics.server";
import { compareAnimeSurveyRecognitionRank } from "./anime-survey-ranking";
import { refreshSurveyProgress } from "./anime-survey.server";
import { ensureAnimeSchema } from "./anime.schema.server";
import { animeSurveyScopeKey, type AnimeSurveyScope } from "./anime.types";

export const ANIME_SURVEY_ORDERING_VERSION = 2;

const ORDERING_STATE_TABLE = "anime_scope_ordering_state";
const ORDERING_LOCK_MS = 30_000;
const orderingSchemaPromises = new WeakMap<object, Promise<void>>();

type OrderingStateRow = {
  scope_key: string;
  ordering_version: number;
  candidate_count: number;
  missing_metric_count: number;
  locked_until: number | null;
  last_error: string | null;
  applied_at: number | null;
  updated_at: number;
};

export type AnimeSurveyOrderingRow = {
  animeId: number;
  existingPosition: number;
  bangumiCollectionTotal: number | null;
  bangumiAverageScore: number | null;
  format: string | null;
};

export type AnimeSurveyOrderingStats = {
  candidateCount: number;
  missingMetricCount: number;
  changed: boolean;
};

export type AnimeSurveyOrderingEnsureResult =
  | { status: "NOT_APPLICABLE" | "NO_SCOPE" }
  | { status: "CURRENT" | "MIGRATED" | "BUSY"; version: number; stats: AnimeSurveyOrderingStats | null }
  | { status: "ERROR"; version: number; error: string };

export async function ensureAnimeSurveyOrderingSchema(db: D1Database): Promise<void> {
  await ensureAnimeSchema(db);
  const key = db as unknown as object;
  const existing = orderingSchemaPromises.get(key);
  if (existing) return existing;

  const pending = db
    .batch([
      db.prepare(
        `CREATE TABLE IF NOT EXISTS ${ORDERING_STATE_TABLE} (
          scope_key TEXT PRIMARY KEY,
          ordering_version INTEGER NOT NULL DEFAULT 0 CHECK (ordering_version >= 0),
          candidate_count INTEGER NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
          missing_metric_count INTEGER NOT NULL DEFAULT 0 CHECK (missing_metric_count >= 0),
          locked_until INTEGER,
          last_error TEXT,
          applied_at INTEGER,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (scope_key) REFERENCES anime_survey_progress(scope_key) ON DELETE CASCADE
        )`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_anime_scope_ordering_state_version
         ON ${ORDERING_STATE_TABLE} (ordering_version, updated_at)`,
      ),
    ])
    .then(() => undefined)
    .catch((error) => {
      orderingSchemaPromises.delete(key);
      throw error;
    });

  orderingSchemaPromises.set(key, pending);
  return pending;
}

async function readOrderingState(
  db: D1Database,
  scopeKey: string,
): Promise<OrderingStateRow | null> {
  return db
    .prepare(
      `SELECT scope_key, ordering_version, candidate_count, missing_metric_count,
              locked_until, last_error, applied_at, updated_at
       FROM ${ORDERING_STATE_TABLE}
       WHERE scope_key = ?`,
    )
    .bind(scopeKey)
    .first<OrderingStateRow>();
}

function stateStats(row: OrderingStateRow): AnimeSurveyOrderingStats {
  return {
    candidateCount: row.candidate_count,
    missingMetricCount: row.missing_metric_count,
    changed: false,
  };
}

export function buildAnimeSurveyRecognitionOrder(
  rows: readonly AnimeSurveyOrderingRow[],
): AnimeSurveyOrderingRow[] {
  return [...rows].sort((left, right) =>
    compareAnimeSurveyRecognitionRank(
      {
        animeId: left.animeId,
        bangumiCollectionTotal: left.bangumiCollectionTotal,
        bangumiAverageScore: left.bangumiAverageScore,
        format: left.format,
        existingPosition: left.existingPosition,
      },
      {
        animeId: right.animeId,
        bangumiCollectionTotal: right.bangumiCollectionTotal,
        bangumiAverageScore: right.bangumiAverageScore,
        format: right.format,
        existingPosition: right.existingPosition,
      },
    ),
  );
}

async function loadOrderingRows(
  db: D1Database,
  scopeKey: string,
): Promise<AnimeSurveyOrderingRow[]> {
  await ensureAnimeBangumiMetricsSchema(db);
  const rows = await db
    .prepare(
      `SELECT
         c.anime_id,
         c.position AS existing_position,
         m.collection_total,
         m.average_score AS bangumi_average_score,
         COALESCE(m.format, i.format) AS format
       FROM anime_scope_candidates c
       JOIN anime_items i ON i.anime_id = c.anime_id
       LEFT JOIN anime_bangumi_metrics m ON m.anime_id = c.anime_id
       WHERE c.scope_key = ?
       ORDER BY c.position ASC`,
    )
    .bind(scopeKey)
    .all<{
      anime_id: number;
      existing_position: number;
      collection_total: number | null;
      bangumi_average_score: number | null;
      format: string | null;
    }>();

  return (rows.results ?? []).map((row) => ({
    animeId: row.anime_id,
    existingPosition: row.existing_position,
    bangumiCollectionTotal: row.collection_total,
    bangumiAverageScore: row.bangumi_average_score,
    format: row.format,
  }));
}

/**
 * Rewrites only scope candidate positions.
 *
 * Membership and all personal records are keyed by anime_id and are deliberately
 * untouched. Missing Bangumi metrics are treated as zero by the shared ranking
 * comparator, so those works keep their previous relative order after candidates
 * with known recognition signals.
 */
export async function applyAnimeSurveyRecognitionOrdering(
  db: D1Database,
  scopeKey: string,
): Promise<AnimeSurveyOrderingStats> {
  const rows = await loadOrderingRows(db, scopeKey);
  const ranked = buildAnimeSurveyRecognitionOrder(rows);
  const missingMetricCount = rows.filter((row) => row.bangumiCollectionTotal == null).length;
  const changed = ranked.some((row, index) => row.existingPosition !== index + 1);

  if (ranked.length && changed) {
    const maxPosition = Math.max(...rows.map((row) => row.existingPosition), ranked.length);
    const temporaryOffset = maxPosition + ranked.length + 1;

    await db.batch([
      db
        .prepare(
          `UPDATE anime_scope_candidates
           SET position = position + ?
           WHERE scope_key = ?`,
        )
        .bind(temporaryOffset, scopeKey),
      ...ranked.map((item, index) =>
        db
          .prepare(
            `UPDATE anime_scope_candidates
             SET position = ?
             WHERE scope_key = ? AND anime_id = ?`,
          )
          .bind(index + 1, scopeKey, item.animeId),
      ),
    ]);
  }

  return {
    candidateCount: ranked.length,
    missingMetricCount,
    changed,
  };
}

export async function markAnimeSurveyOrderingCurrent(
  db: D1Database,
  scopeKey: string,
  stats: AnimeSurveyOrderingStats,
): Promise<void> {
  await ensureAnimeSurveyOrderingSchema(db);
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO ${ORDERING_STATE_TABLE} (
        scope_key, ordering_version, candidate_count, missing_metric_count,
        locked_until, last_error, applied_at, updated_at
      ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)
      ON CONFLICT(scope_key) DO UPDATE SET
        ordering_version = excluded.ordering_version,
        candidate_count = excluded.candidate_count,
        missing_metric_count = excluded.missing_metric_count,
        locked_until = NULL,
        last_error = NULL,
        applied_at = excluded.applied_at,
        updated_at = excluded.updated_at`,
    )
    .bind(
      scopeKey,
      ANIME_SURVEY_ORDERING_VERSION,
      stats.candidateCount,
      stats.missingMetricCount,
      now,
      now,
    )
    .run();
}

/**
 * Lazily upgrades one established TV-season scope to the current ordering version.
 *
 * This can safely be called whenever a ready scope is opened. A short D1 lock stops
 * concurrent tabs from rewriting positions at the same time. Failed migrations
 * release the lock and are retried on a later request without blocking access to
 * the existing scope.
 */
export async function ensureAnimeSurveyOrdering(
  db: D1Database,
  scope: AnimeSurveyScope,
): Promise<AnimeSurveyOrderingEnsureResult> {
  if (scope.type !== "TV_SEASON") return { status: "NOT_APPLICABLE" };

  await ensureAnimeSchema(db);
  await ensureAnimeSurveyOrderingSchema(db);
  const scopeKey = animeSurveyScopeKey(scope);

  const progress = await db
    .prepare("SELECT 1 AS found FROM anime_survey_progress WHERE scope_key = ?")
    .bind(scopeKey)
    .first<{ found: number }>();
  if (!progress) return { status: "NO_SCOPE" };

  const existing = await readOrderingState(db, scopeKey);
  if (existing && existing.ordering_version >= ANIME_SURVEY_ORDERING_VERSION) {
    return {
      status: "CURRENT",
      version: existing.ordering_version,
      stats: stateStats(existing),
    };
  }

  const now = Date.now();
  await db
    .prepare(
      `INSERT OR IGNORE INTO ${ORDERING_STATE_TABLE} (
        scope_key, ordering_version, candidate_count, missing_metric_count,
        locked_until, last_error, applied_at, updated_at
      ) VALUES (?, 0, 0, 0, NULL, NULL, NULL, ?)`,
    )
    .bind(scopeKey, now)
    .run();

  const claim = await db
    .prepare(
      `UPDATE ${ORDERING_STATE_TABLE}
       SET locked_until = ?, last_error = NULL, updated_at = ?
       WHERE scope_key = ?
         AND ordering_version < ?
         AND (locked_until IS NULL OR locked_until < ?)`,
    )
    .bind(
      now + ORDERING_LOCK_MS,
      now,
      scopeKey,
      ANIME_SURVEY_ORDERING_VERSION,
      now,
    )
    .run();

  if ((claim.meta.changes ?? 0) === 0) {
    const current = await readOrderingState(db, scopeKey);
    if (current && current.ordering_version >= ANIME_SURVEY_ORDERING_VERSION) {
      return {
        status: "CURRENT",
        version: current.ordering_version,
        stats: stateStats(current),
      };
    }
    return {
      status: "BUSY",
      version: current?.ordering_version ?? 0,
      stats: current ? stateStats(current) : null,
    };
  }

  try {
    const stats = await applyAnimeSurveyRecognitionOrdering(db, scopeKey);
    const refreshed = await refreshSurveyProgress(db, scope);
    if (!refreshed) throw new Error(`Survey progress ${scopeKey} is missing after ordering migration`);
    await markAnimeSurveyOrderingCurrent(db, scopeKey, stats);
    return {
      status: "MIGRATED",
      version: ANIME_SURVEY_ORDERING_VERSION,
      stats,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown survey ordering migration error";
    await db
      .prepare(
        `UPDATE ${ORDERING_STATE_TABLE}
         SET locked_until = NULL, last_error = ?, updated_at = ?
         WHERE scope_key = ?`,
      )
      .bind(message.slice(0, 1000), Date.now(), scopeKey)
      .run();

    return {
      status: "ERROR",
      version: existing?.ordering_version ?? 0,
      error: message,
    };
  }
}
