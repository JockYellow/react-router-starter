import { ensureAnimeSchema } from "./anime.schema.server";
import {
  ANIME_EVALUATION_KEYS,
  ANIME_WATCH_DETAILS,
  isAnimeEvaluationTagKey,
  type AnimeEvaluationKey,
  type AnimeEvaluationTagKey,
  type AnimePrimaryStatus,
  type AnimeWatchDetail,
} from "./anime.types";

export type AnimePersonalRecord = {
  anilistId: number;
  status: AnimePrimaryStatus | null;
  detailStatus: AnimeWatchDetail | null;
  rating: AnimeEvaluationKey | null;
  note: string | null;
  tags: AnimeEvaluationTagKey[];
};

type RecordRow = {
  status: AnimePrimaryStatus | null;
  detail_status: AnimeWatchDetail | null;
  rating: AnimeEvaluationKey | null;
  note: string | null;
};

export async function getAnimePersonalRecord(
  db: D1Database,
  anilistId: number,
): Promise<AnimePersonalRecord> {
  await ensureAnimeSchema(db);

  const row = await db
    .prepare(
      `SELECT
        d.status,
        d.detail_status,
        e.rating,
        e.note
      FROM anime_catalog a
      LEFT JOIN anime_decisions d ON d.anilist_id = a.anilist_id
      LEFT JOIN anime_evaluations e ON e.anilist_id = a.anilist_id
      WHERE a.anilist_id = ?`,
    )
    .bind(anilistId)
    .first<RecordRow>();

  const tagResult = await db
    .prepare("SELECT tag_key FROM anime_evaluation_tags WHERE anilist_id = ? ORDER BY created_at ASC")
    .bind(anilistId)
    .all<{ tag_key: string }>();

  return {
    anilistId,
    status: row?.status ?? null,
    detailStatus: row?.detail_status ?? null,
    rating: row?.rating ?? null,
    note: row?.note ?? null,
    tags: (tagResult.results ?? [])
      .map((item) => item.tag_key)
      .filter(isAnimeEvaluationTagKey),
  };
}

export async function savePrimaryDecision(
  db: D1Database,
  anilistId: number,
  status: AnimePrimaryStatus,
): Promise<void> {
  await ensureAnimeSchema(db);
  const now = Date.now();

  if (status === "SEEN") {
    await db
      .prepare(
        `INSERT INTO anime_decisions (
          anilist_id, status, detail_status, decided_at, updated_at
        ) VALUES (?, 'SEEN', NULL, ?, ?)
        ON CONFLICT(anilist_id) DO UPDATE SET
          status = 'SEEN',
          detail_status = CASE
            WHEN anime_decisions.status = 'SEEN' THEN anime_decisions.detail_status
            ELSE NULL
          END,
          updated_at = excluded.updated_at`,
      )
      .bind(anilistId, now, now)
      .run();
    return;
  }

  await db.batch([
    db
      .prepare(
        `INSERT INTO anime_decisions (
          anilist_id, status, detail_status, decided_at, updated_at
        ) VALUES (?, ?, NULL, ?, ?)
        ON CONFLICT(anilist_id) DO UPDATE SET
          status = excluded.status,
          detail_status = NULL,
          updated_at = excluded.updated_at`,
      )
      .bind(anilistId, status, now, now),
    db.prepare("DELETE FROM anime_evaluation_tags WHERE anilist_id = ?").bind(anilistId),
    db.prepare("DELETE FROM anime_evaluations WHERE anilist_id = ?").bind(anilistId),
  ]);
}

export async function saveSeenDetail(
  db: D1Database,
  anilistId: number,
  detailStatus: AnimeWatchDetail,
): Promise<void> {
  if (!ANIME_WATCH_DETAILS.includes(detailStatus)) {
    throw new Error("Invalid Anime watch detail");
  }

  await ensureAnimeSchema(db);
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO anime_decisions (
        anilist_id, status, detail_status, decided_at, updated_at
      ) VALUES (?, 'SEEN', ?, ?, ?)
      ON CONFLICT(anilist_id) DO UPDATE SET
        status = 'SEEN',
        detail_status = excluded.detail_status,
        updated_at = excluded.updated_at`,
    )
    .bind(anilistId, detailStatus, now, now)
    .run();
}

export async function toggleSeenTag(
  db: D1Database,
  anilistId: number,
  tag: string,
): Promise<void> {
  if (!isAnimeEvaluationTagKey(tag)) throw new Error("Invalid Anime evaluation tag");
  await ensureAnimeSchema(db);

  const existing = await db
    .prepare("SELECT 1 AS found FROM anime_evaluation_tags WHERE anilist_id = ? AND tag_key = ?")
    .bind(anilistId, tag)
    .first<{ found: number }>();

  if (existing) {
    await db
      .prepare("DELETE FROM anime_evaluation_tags WHERE anilist_id = ? AND tag_key = ?")
      .bind(anilistId, tag)
      .run();
    return;
  }

  await db
    .prepare(
      `INSERT INTO anime_evaluation_tags (anilist_id, tag_key, created_at)
      VALUES (?, ?, ?)`,
    )
    .bind(anilistId, tag, Date.now())
    .run();
}

export async function saveSeenNote(
  db: D1Database,
  anilistId: number,
  noteInput: string | null,
): Promise<void> {
  await ensureAnimeSchema(db);
  const note = noteInput?.trim().slice(0, 4000) || null;
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO anime_evaluations (anilist_id, rating, note, updated_at)
      VALUES (?, NULL, ?, ?)
      ON CONFLICT(anilist_id) DO UPDATE SET
        note = excluded.note,
        updated_at = excluded.updated_at`,
    )
    .bind(anilistId, note, now)
    .run();
}

export async function saveSeenRating(
  db: D1Database,
  anilistId: number,
  rating: AnimeEvaluationKey,
): Promise<void> {
  if (!ANIME_EVALUATION_KEYS.includes(rating)) throw new Error("Invalid Anime evaluation");
  await ensureAnimeSchema(db);

  const decision = await db
    .prepare("SELECT status, detail_status FROM anime_decisions WHERE anilist_id = ?")
    .bind(anilistId)
    .first<{ status: AnimePrimaryStatus; detail_status: AnimeWatchDetail | null }>();

  if (!decision || decision.status !== "SEEN" || !decision.detail_status) {
    throw new Error("Viewing detail is required before rating");
  }

  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO anime_evaluations (anilist_id, rating, note, updated_at)
      VALUES (?, ?, NULL, ?)
      ON CONFLICT(anilist_id) DO UPDATE SET
        rating = excluded.rating,
        updated_at = excluded.updated_at`,
    )
    .bind(anilistId, rating, now)
    .run();
}

export async function saveSeenEvaluation(
  db: D1Database,
  input: {
    anilistId: number;
    detailStatus: AnimeWatchDetail;
    rating: AnimeEvaluationKey;
    tags?: readonly string[];
    note?: string | null;
  },
): Promise<void> {
  if (!ANIME_WATCH_DETAILS.includes(input.detailStatus)) {
    throw new Error("Invalid Anime watch detail");
  }
  if (!ANIME_EVALUATION_KEYS.includes(input.rating)) {
    throw new Error("Invalid Anime evaluation");
  }

  const tags = [...new Set(input.tags ?? [])].filter(isAnimeEvaluationTagKey);
  const note = input.note?.trim().slice(0, 4000) || null;

  await ensureAnimeSchema(db);
  const now = Date.now();
  const statements = [
    db
      .prepare(
        `INSERT INTO anime_decisions (
          anilist_id, status, detail_status, decided_at, updated_at
        ) VALUES (?, 'SEEN', ?, ?, ?)
        ON CONFLICT(anilist_id) DO UPDATE SET
          status = 'SEEN',
          detail_status = excluded.detail_status,
          updated_at = excluded.updated_at`,
      )
      .bind(input.anilistId, input.detailStatus, now, now),
    db
      .prepare(
        `INSERT INTO anime_evaluations (anilist_id, rating, note, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(anilist_id) DO UPDATE SET
          rating = excluded.rating,
          note = excluded.note,
          updated_at = excluded.updated_at`,
      )
      .bind(input.anilistId, input.rating, note, now),
    db.prepare("DELETE FROM anime_evaluation_tags WHERE anilist_id = ?").bind(input.anilistId),
    ...tags.map((tag) =>
      db
        .prepare(
          `INSERT INTO anime_evaluation_tags (anilist_id, tag_key, created_at)
          VALUES (?, ?, ?)`,
        )
        .bind(input.anilistId, tag, now),
    ),
  ];

  await db.batch(statements);
}
