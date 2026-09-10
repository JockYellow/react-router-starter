import { ensureAnimeSchema } from "./anime.schema.server";
import { parseReviewedNetflixSeed } from "./netflix-seed-input";
import { importReviewedNetflixRow } from "./netflix-seed.server";
import {
  netflixSourceRef,
  type ReviewedNetflixSeedRow,
} from "./netflix-seed";

export const NETFLIX_SEED_QUEUE_STATUSES = [
  "PENDING",
  "MATCHED",
  "AMBIGUOUS",
  "UNMATCHED",
  "SKIPPED",
  "ERROR",
] as const;

export type NetflixSeedQueueStatus = (typeof NETFLIX_SEED_QUEUE_STATUSES)[number];

export type NetflixSeedStageResult = {
  total: number;
  inserted: number;
  reset: number;
  unchanged: number;
};

export type NetflixSeedProcessResult = {
  selected: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
  skipped: number;
  failed: number;
};

export type NetflixSeedQueueSummary = Record<NetflixSeedQueueStatus, number> & {
  total: number;
};

type QueueRow = {
  id: number;
  source_ref: string;
  payload_json: string;
};

type ExistingQueueRow = {
  payload_json: string;
};

type CountRow = {
  queue_status: NetflixSeedQueueStatus;
  count: number;
};

function serializeSeedRow(row: ReviewedNetflixSeedRow): string {
  return JSON.stringify({
    title: row.title,
    category: row.category ?? null,
    format: row.format ?? null,
    viewingRecordCount: row.viewingRecordCount ?? null,
    distinctTitleCount: row.distinctTitleCount ?? null,
    firstWatchedAt: row.firstWatchedAt ?? null,
    lastWatchedAt: row.lastWatchedAt ?? null,
    reviewStatus: row.reviewStatus,
    evidence: row.evidence ?? null,
    verificationStatus: row.verificationStatus ?? null,
    verificationUrl: row.verificationUrl ?? null,
    sourceRowNumber: row.sourceRowNumber ?? null,
  });
}

export async function stageReviewedNetflixSeedRows(
  db: D1Database,
  rows: readonly ReviewedNetflixSeedRow[],
): Promise<NetflixSeedStageResult> {
  await ensureAnimeSchema(db);

  const result: NetflixSeedStageResult = {
    total: rows.length,
    inserted: 0,
    reset: 0,
    unchanged: 0,
  };

  for (const row of rows) {
    const sourceRef = netflixSourceRef(row);
    const payloadJson = serializeSeedRow(row);
    const existing = await db
      .prepare(
        `SELECT payload_json
         FROM anime_seed_queue
         WHERE source = 'netflix' AND source_ref = ?`,
      )
      .bind(sourceRef)
      .first<ExistingQueueRow>();

    if (!existing) {
      const now = Date.now();
      await db
        .prepare(
          `INSERT INTO anime_seed_queue (
            source, source_ref, payload_json, queue_status,
            attempt_count, last_error, created_at, updated_at
          ) VALUES ('netflix', ?, ?, 'PENDING', 0, NULL, ?, ?)`,
        )
        .bind(sourceRef, payloadJson, now, now)
        .run();
      result.inserted += 1;
      continue;
    }

    if (existing.payload_json === payloadJson) {
      result.unchanged += 1;
      continue;
    }

    await db
      .prepare(
        `UPDATE anime_seed_queue
         SET payload_json = ?,
             queue_status = 'PENDING',
             attempt_count = 0,
             last_error = NULL,
             updated_at = ?
         WHERE source = 'netflix' AND source_ref = ?`,
      )
      .bind(payloadJson, Date.now(), sourceRef)
      .run();
    result.reset += 1;
  }

  return result;
}

function outcomeToQueueStatus(
  outcome: Awaited<ReturnType<typeof importReviewedNetflixRow>>,
): NetflixSeedQueueStatus {
  if (outcome === "EXCLUDED") return "SKIPPED";
  return outcome;
}

export async function processReviewedNetflixSeedQueue(
  db: D1Database,
  options: { limit?: number } = {},
): Promise<NetflixSeedProcessResult> {
  await ensureAnimeSchema(db);

  const limit = Math.max(1, Math.min(Math.trunc(options.limit ?? 5), 10));
  const pending = await db
    .prepare(
      `SELECT id, source_ref, payload_json
       FROM anime_seed_queue
       WHERE source = 'netflix' AND queue_status = 'PENDING'
       ORDER BY id ASC
       LIMIT ?`,
    )
    .bind(limit)
    .all<QueueRow>();

  const rows = pending.results ?? [];
  const result: NetflixSeedProcessResult = {
    selected: rows.length,
    matched: 0,
    ambiguous: 0,
    unmatched: 0,
    skipped: 0,
    failed: 0,
  };

  for (const queueRow of rows) {
    try {
      const [seedRow] = parseReviewedNetflixSeed([JSON.parse(queueRow.payload_json)]);
      if (!seedRow) throw new Error("Seed queue row did not contain a valid payload");

      const outcome = await importReviewedNetflixRow(db, seedRow);
      const status = outcomeToQueueStatus(outcome);
      await db
        .prepare(
          `UPDATE anime_seed_queue
           SET queue_status = ?,
               attempt_count = attempt_count + 1,
               last_error = NULL,
               updated_at = ?
           WHERE id = ?`,
        )
        .bind(status, Date.now(), queueRow.id)
        .run();

      if (status === "MATCHED") result.matched += 1;
      else if (status === "AMBIGUOUS") result.ambiguous += 1;
      else if (status === "UNMATCHED") result.unmatched += 1;
      else result.skipped += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown seed processing error";
      await db
        .prepare(
          `UPDATE anime_seed_queue
           SET queue_status = 'ERROR',
               attempt_count = attempt_count + 1,
               last_error = ?,
               updated_at = ?
           WHERE id = ?`,
        )
        .bind(message.slice(0, 1000), Date.now(), queueRow.id)
        .run();
      result.failed += 1;
    }
  }

  return result;
}

export async function retryReviewedNetflixSeedQueue(
  db: D1Database,
  statuses: readonly NetflixSeedQueueStatus[] = ["ERROR"],
): Promise<number> {
  await ensureAnimeSchema(db);
  const accepted = [...new Set(statuses)].filter(
    (status) => status !== "PENDING" && NETFLIX_SEED_QUEUE_STATUSES.includes(status),
  );
  if (!accepted.length) return 0;

  const placeholders = accepted.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `UPDATE anime_seed_queue
       SET queue_status = 'PENDING', last_error = NULL, updated_at = ?
       WHERE source = 'netflix' AND queue_status IN (${placeholders})`,
    )
    .bind(Date.now(), ...accepted)
    .run();
  return result.meta.changes ?? 0;
}

export async function getReviewedNetflixSeedQueueSummary(
  db: D1Database,
): Promise<NetflixSeedQueueSummary> {
  await ensureAnimeSchema(db);
  const result = await db
    .prepare(
      `SELECT queue_status, COUNT(*) AS count
       FROM anime_seed_queue
       WHERE source = 'netflix'
       GROUP BY queue_status`,
    )
    .all<CountRow>();

  const summary: NetflixSeedQueueSummary = {
    total: 0,
    PENDING: 0,
    MATCHED: 0,
    AMBIGUOUS: 0,
    UNMATCHED: 0,
    SKIPPED: 0,
    ERROR: 0,
  };

  for (const row of result.results ?? []) {
    const count = Number(row.count) || 0;
    summary[row.queue_status] = count;
    summary.total += count;
  }
  return summary;
}
