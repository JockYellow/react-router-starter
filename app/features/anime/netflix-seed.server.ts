import { cacheAnimeProviderRecord } from "./anime-catalog.server";
import { toTaiwanTraditionalChinese } from "./anime-chinese-title.server";
import {
  looksLikeChineseTitle,
  normalizeAnimeAlias,
} from "./anime-title";
import { ensureAnimeSchema } from "./anime.schema.server";
import {
  resolveBangumiByTitle,
  type BangumiTitleResolution,
} from "./anime-resolver.server";
import {
  fetchBangumiAnimeById,
  type BangumiAnimeCandidate,
} from "./providers/bangumi.server";
import {
  mapNetflixReviewStatus,
  netflixSourceRef,
  type ReviewedNetflixSeedRow,
} from "./netflix-seed";

export const NETFLIX_SEED_RESOLVER_VERSION = 2;

export type NetflixSeedImportResult = {
  total: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
  excluded: number;
  failed: number;
};

type SourceMatchStatus = "MATCHED" | "AMBIGUOUS" | "UNMATCHED";

function candidateSnapshot(candidates: readonly BangumiAnimeCandidate[]) {
  return candidates.slice(0, 10).map((candidate) => ({
    bangumiId: candidate.id,
    date: candidate.date,
    platform: candidate.platform,
    name: candidate.name,
    nameCn: candidate.nameCn,
  }));
}

function netflixChineseTitle(row: ReviewedNetflixSeedRow): string | null {
  const title = row.title.trim();
  if (!title || !looksLikeChineseTitle(title)) return null;
  return toTaiwanTraditionalChinese(title) || title;
}

async function findExistingCanonicalNetflixMatch(
  db: D1Database,
  row: ReviewedNetflixSeedRow,
): Promise<number | null> {
  const source = await db
    .prepare(
      `SELECT s.anime_id
       FROM anime_item_sources s
       JOIN anime_items i ON i.anime_id = s.anime_id
       WHERE s.source = 'netflix'
         AND s.source_ref = ?
         AND s.match_status = 'MATCHED'
         AND s.anime_id IS NOT NULL`,
    )
    .bind(netflixSourceRef(row))
    .first<{ anime_id: number }>();
  return source?.anime_id ?? null;
}

async function upsertNetflixAlias(
  db: D1Database,
  animeId: number,
  row: ReviewedNetflixSeedRow,
): Promise<void> {
  const alias = row.title.trim();
  const normalized = normalizeAnimeAlias(alias);
  if (!normalized) return;

  const titleZhTw = netflixChineseTitle(row);
  const now = Date.now();
  const statements = [
    db
      .prepare(
        `INSERT INTO anime_item_aliases (
          anime_id, alias, normalized_alias, source, language, is_primary, created_at
        ) VALUES (?, ?, ?, 'netflix:title', ?, 0, ?)
        ON CONFLICT(anime_id, normalized_alias, source) DO UPDATE SET
          alias = excluded.alias,
          language = COALESCE(excluded.language, anime_item_aliases.language)`,
      )
      .bind(animeId, alias, normalized, titleZhTw ? "zh-TW" : null, now),
  ];

  if (titleZhTw) {
    statements.push(
      db
        .prepare(
          "UPDATE anime_items SET title_zh_tw = COALESCE(title_zh_tw, ?), updated_at = ? WHERE anime_id = ?",
        )
        .bind(titleZhTw, now, animeId),
    );
  }

  await db.batch(statements);
}

async function upsertNetflixSource(
  db: D1Database,
  row: ReviewedNetflixSeedRow,
  options: {
    animeId: number | null;
    matchStatus: SourceMatchStatus;
    metadata: Record<string, unknown>;
  },
) {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO anime_item_sources (
        anime_id,
        source,
        source_ref,
        source_title,
        source_status,
        source_date,
        match_status,
        metadata_json,
        created_at,
        updated_at
      ) VALUES (?, 'netflix', ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source, source_ref) DO UPDATE SET
        anime_id = excluded.anime_id,
        source_title = excluded.source_title,
        source_status = excluded.source_status,
        source_date = excluded.source_date,
        match_status = excluded.match_status,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at`,
    )
    .bind(
      options.animeId,
      netflixSourceRef(row),
      row.title.trim(),
      row.reviewStatus.trim(),
      row.lastWatchedAt ?? row.firstWatchedAt ?? null,
      options.matchStatus,
      JSON.stringify({
        resolverVersion: NETFLIX_SEED_RESOLVER_VERSION,
        category: row.category ?? null,
        format: row.format ?? null,
        viewingRecordCount: row.viewingRecordCount ?? null,
        distinctTitleCount: row.distinctTitleCount ?? null,
        firstWatchedAt: row.firstWatchedAt ?? null,
        lastWatchedAt: row.lastWatchedAt ?? null,
        evidence: row.evidence ?? null,
        verificationStatus: row.verificationStatus ?? null,
        verificationUrl: row.verificationUrl ?? null,
        sourceRowNumber: row.sourceRowNumber ?? null,
        ...options.metadata,
      }),
      now,
      now,
    )
    .run();
}

async function insertSeedDecisionIfMissing(
  db: D1Database,
  animeId: number,
  status: "SEEN" | "WANT" | "NOT_SEEN",
  detailStatus: "COMPLETE" | "SEASON_COMPLETE" | "PARTIAL" | "DROPPED" | "MOVIE_ONLY" | null,
) {
  const now = Date.now();
  await db
    .prepare(
      `INSERT OR IGNORE INTO anime_user_decisions (
        anime_id,
        status,
        detail_status,
        decided_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(animeId, status, detailStatus, now, now)
    .run();
}

async function resolveNetflixRowToCanonicalAnime(
  db: D1Database,
  row: ReviewedNetflixSeedRow,
): Promise<
  | {
      status: "MATCHED";
      animeId: number;
      reason: "EXISTING_CANONICAL_SOURCE" | "BANGUMI_EXACT_ALIAS";
      candidates: BangumiAnimeCandidate[];
    }
  | {
      status: "AMBIGUOUS" | "UNMATCHED";
      resolution: Exclude<BangumiTitleResolution, { status: "MATCHED" }>;
    }
> {
  const existingAnimeId = await findExistingCanonicalNetflixMatch(db, row);
  if (existingAnimeId) {
    return {
      status: "MATCHED",
      animeId: existingAnimeId,
      reason: "EXISTING_CANONICAL_SOURCE",
      candidates: [],
    };
  }

  const resolution = await resolveBangumiByTitle(row.title);
  if (resolution.status !== "MATCHED") {
    return { status: resolution.status, resolution };
  }

  const providerRecord = await fetchBangumiAnimeById(resolution.candidate.id);
  const animeId = await cacheAnimeProviderRecord(db, providerRecord, {
    titleZhTw: netflixChineseTitle(row),
  });
  return {
    status: "MATCHED",
    animeId,
    reason: "BANGUMI_EXACT_ALIAS",
    candidates: resolution.candidates,
  };
}

export async function importReviewedNetflixRow(
  db: D1Database,
  row: ReviewedNetflixSeedRow,
): Promise<"MATCHED" | "AMBIGUOUS" | "UNMATCHED" | "EXCLUDED"> {
  await ensureAnimeSchema(db);

  const mapping = mapNetflixReviewStatus(row.reviewStatus);
  if (!mapping.include || !mapping.status) return "EXCLUDED";

  const resolved = await resolveNetflixRowToCanonicalAnime(db, row);

  if (resolved.status === "MATCHED") {
    await upsertNetflixAlias(db, resolved.animeId, row);
    await upsertNetflixSource(db, row, {
      animeId: resolved.animeId,
      matchStatus: "MATCHED",
      metadata: {
        resolutionReason: resolved.reason,
        intendedDecision: {
          status: mapping.status,
          detailStatus: mapping.detailStatus,
        },
        candidates: candidateSnapshot(resolved.candidates),
      },
    });
    // Seed data fills missing history only. A later manual/survey answer always wins.
    await insertSeedDecisionIfMissing(
      db,
      resolved.animeId,
      mapping.status,
      mapping.detailStatus,
    );
    return "MATCHED";
  }

  const matchStatus = resolved.status;
  await upsertNetflixSource(db, row, {
    animeId: null,
    matchStatus,
    metadata: {
      resolutionReason: resolved.resolution.reason,
      intendedDecision: {
        status: mapping.status,
        detailStatus: mapping.detailStatus,
      },
      candidates: candidateSnapshot(resolved.resolution.candidates),
    },
  });

  return matchStatus;
}

export async function importReviewedNetflixRows(
  db: D1Database,
  rows: readonly ReviewedNetflixSeedRow[],
): Promise<NetflixSeedImportResult> {
  const result: NetflixSeedImportResult = {
    total: rows.length,
    matched: 0,
    ambiguous: 0,
    unmatched: 0,
    excluded: 0,
    failed: 0,
  };

  for (const row of rows) {
    try {
      const outcome = await importReviewedNetflixRow(db, row);
      if (outcome === "MATCHED") result.matched += 1;
      else if (outcome === "AMBIGUOUS") result.ambiguous += 1;
      else if (outcome === "UNMATCHED") result.unmatched += 1;
      else result.excluded += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
