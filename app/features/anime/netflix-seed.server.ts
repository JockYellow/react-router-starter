import { cacheAniListAnime } from "./anime-catalog.server";
import { ensureAnimeSchema } from "./anime.schema.server";
import {
  mapNetflixReviewStatus,
  netflixSourceRef,
  type ReviewedNetflixSeedRow,
} from "./netflix-seed";
import {
  resolveAniListByTitle,
  type AniListTitleResolution,
} from "./anime-resolver.server";

export type NetflixSeedImportResult = {
  total: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
  excluded: number;
  failed: number;
};

type SourceMatchStatus = "MATCHED" | "AMBIGUOUS" | "UNMATCHED";

function candidateSnapshot(resolution: AniListTitleResolution) {
  return resolution.candidates.slice(0, 10).map((candidate) => ({
    anilistId: candidate.id,
    year: candidate.seasonYear,
    format: candidate.format,
    title: candidate.title,
    synonyms: candidate.synonyms,
  }));
}

async function upsertNetflixSource(
  db: D1Database,
  row: ReviewedNetflixSeedRow,
  options: {
    anilistId: number | null;
    matchStatus: SourceMatchStatus;
    metadata: Record<string, unknown>;
  },
) {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO anime_sources (
        anilist_id,
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
        anilist_id = excluded.anilist_id,
        source_title = excluded.source_title,
        source_status = excluded.source_status,
        source_date = excluded.source_date,
        match_status = excluded.match_status,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at`,
    )
    .bind(
      options.anilistId,
      netflixSourceRef(row),
      row.title.trim(),
      row.reviewStatus.trim(),
      row.lastWatchedAt ?? row.firstWatchedAt ?? null,
      options.matchStatus,
      JSON.stringify({
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
  anilistId: number,
  status: "SEEN" | "WANT" | "NOT_SEEN",
  detailStatus: "COMPLETE" | "SEASON_COMPLETE" | "PARTIAL" | "DROPPED" | "MOVIE_ONLY" | null,
) {
  const now = Date.now();
  await db
    .prepare(
      `INSERT OR IGNORE INTO anime_decisions (
        anilist_id,
        status,
        detail_status,
        decided_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(anilistId, status, detailStatus, now, now)
    .run();
}

export async function importReviewedNetflixRow(
  db: D1Database,
  row: ReviewedNetflixSeedRow,
): Promise<"MATCHED" | "AMBIGUOUS" | "UNMATCHED" | "EXCLUDED"> {
  await ensureAnimeSchema(db);

  const mapping = mapNetflixReviewStatus(row.reviewStatus);
  if (!mapping.include || !mapping.status) return "EXCLUDED";

  const resolution = await resolveAniListByTitle(row.title);

  if (resolution.status === "MATCHED") {
    await cacheAniListAnime(db, resolution.anime, { titleZhTw: row.title });
    await upsertNetflixSource(db, row, {
      anilistId: resolution.anime.id,
      matchStatus: "MATCHED",
      metadata: {
        resolutionReason: resolution.reason,
        candidates: candidateSnapshot(resolution),
      },
    });
    // Seed data fills missing history only. A later manual/survey answer always wins.
    await insertSeedDecisionIfMissing(db, resolution.anime.id, mapping.status, mapping.detailStatus);
    return "MATCHED";
  }

  const matchStatus = resolution.status === "AMBIGUOUS" ? "AMBIGUOUS" : "UNMATCHED";
  await upsertNetflixSource(db, row, {
    anilistId: null,
    matchStatus,
    metadata: {
      resolutionReason: resolution.reason,
      intendedDecision: {
        status: mapping.status,
        detailStatus: mapping.detailStatus,
      },
      candidates: candidateSnapshot(resolution),
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
