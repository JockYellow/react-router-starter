import { animeCoverProxyPath } from "./anime-cover.server";
import {
  isAnimeWatchlistLane,
  type AnimeWatchlistLane,
} from "./anime-watchlist-queue";
import { ensureAnimeSchema } from "./anime.schema.server";
import type { AnimeSeason } from "./anime.types";

export type AnimeWatchlistQueueItem = {
  animeId: number;
  title: string;
  year: number | null;
  season: AnimeSeason | null;
  format: string | null;
  episodes: number | null;
  coverUrl: string | null;
  addedAt: number;
  lane: AnimeWatchlistLane | null;
  position: number | null;
  unavailable: boolean;
};

export type AnimeWatchlistQueueBoard = {
  meal: AnimeWatchlistQueueItem[];
  focus: AnimeWatchlistQueueItem[];
  pending: AnimeWatchlistQueueItem[];
  unavailable: AnimeWatchlistQueueItem[];
};

type QueueItemRow = {
  anime_id: number;
  title_zh_tw: string | null;
  title_native: string | null;
  title_romaji: string | null;
  title_english: string | null;
  year: number | null;
  season: AnimeSeason | null;
  format: string | null;
  episodes: number | null;
  cover_url: string | null;
  added_at: number;
  lane: string | null;
  position: number | null;
  unavailable: number | null;
};

type QueueStateRow = {
  lane: string | null;
  position: number | null;
  unavailable: number;
};

function mapQueueItem(row: QueueItemRow): AnimeWatchlistQueueItem {
  return {
    animeId: row.anime_id,
    title: row.title_zh_tw
      ?? row.title_native
      ?? row.title_romaji
      ?? row.title_english
      ?? "未命名作品",
    year: row.year,
    season: row.season,
    format: row.format,
    episodes: row.episodes,
    coverUrl: row.cover_url ? animeCoverProxyPath(row.anime_id) : null,
    addedAt: row.added_at,
    lane: row.lane && isAnimeWatchlistLane(row.lane) ? row.lane : null,
    position: row.position,
    unavailable: row.unavailable === 1,
  };
}

export async function getAnimeWatchlistQueueBoard(
  db: D1Database,
): Promise<AnimeWatchlistQueueBoard> {
  await ensureAnimeSchema(db);

  const result = await db
    .prepare(
      `SELECT
        a.anime_id,
        a.title_zh_tw,
        a.title_native,
        a.title_romaji,
        a.title_english,
        a.year,
        a.season,
        a.format,
        a.episodes,
        a.cover_url,
        d.updated_at AS added_at,
        q.lane,
        q.position,
        q.unavailable
      FROM anime_user_decisions d
      JOIN anime_items a ON a.anime_id = d.anime_id
      LEFT JOIN anime_watchlist_queue q ON q.anime_id = a.anime_id
      WHERE d.status = 'WANT'
      ORDER BY d.updated_at DESC, a.anime_id DESC`,
    )
    .all<QueueItemRow>();

  const board: AnimeWatchlistQueueBoard = {
    meal: [],
    focus: [],
    pending: [],
    unavailable: [],
  };

  for (const row of result.results ?? []) {
    const item = mapQueueItem(row);
    if (item.unavailable) {
      board.unavailable.push(item);
    } else if (item.lane === "MEAL" && item.position != null) {
      board.meal.push(item);
    } else if (item.lane === "FOCUS" && item.position != null) {
      board.focus.push(item);
    } else {
      board.pending.push(item);
    }
  }

  const queueOrder = (a: AnimeWatchlistQueueItem, b: AnimeWatchlistQueueItem) =>
    (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER)
    || a.animeId - b.animeId;
  board.meal.sort(queueOrder);
  board.focus.sort(queueOrder);
  board.pending.sort((a, b) => b.addedAt - a.addedAt || b.animeId - a.animeId);
  board.unavailable.sort((a, b) => b.addedAt - a.addedAt || b.animeId - a.animeId);

  return board;
}

async function getWantQueueState(
  db: D1Database,
  animeId: number,
): Promise<QueueStateRow | null> {
  const decision = await db
    .prepare("SELECT status FROM anime_user_decisions WHERE anime_id = ?")
    .bind(animeId)
    .first<{ status: string }>();
  if (decision?.status !== "WANT") return null;

  return (await db
    .prepare(
      "SELECT lane, position, unavailable FROM anime_watchlist_queue WHERE anime_id = ?",
    )
    .bind(animeId)
    .first<QueueStateRow>()) ?? { lane: null, position: null, unavailable: 0 };
}

function oldLaneCompactionStatement(
  db: D1Database,
  state: QueueStateRow | null,
  nextLane: AnimeWatchlistLane | null,
) {
  if (
    !state
    || state.unavailable === 1
    || !state.lane
    || !isAnimeWatchlistLane(state.lane)
    || state.position == null
    || state.lane === nextLane
  ) {
    return null;
  }

  return db
    .prepare(
      `UPDATE anime_watchlist_queue
       SET position = position - 1
       WHERE lane = ? AND unavailable = 0 AND position > ?`,
    )
    .bind(state.lane, state.position);
}

export async function assignAnimeWatchlistLane(
  db: D1Database,
  animeId: number,
  lane: AnimeWatchlistLane,
): Promise<boolean> {
  await ensureAnimeSchema(db);
  const state = await getWantQueueState(db, animeId);
  if (!state) return false;
  if (state.unavailable === 0 && state.lane === lane && state.position != null) return true;

  const maxRow = await db
    .prepare(
      "SELECT COALESCE(MAX(position), 0) AS max_position FROM anime_watchlist_queue WHERE lane = ? AND unavailable = 0",
    )
    .bind(lane)
    .first<{ max_position: number }>();
  const nextPosition = (maxRow?.max_position ?? 0) + 1;
  const now = Date.now();

  const statements = [
    db
      .prepare(
        `INSERT INTO anime_watchlist_queue (
          anime_id, lane, position, unavailable, created_at, updated_at
        ) VALUES (?, ?, ?, 0, ?, ?)
        ON CONFLICT(anime_id) DO UPDATE SET
          lane = excluded.lane,
          position = excluded.position,
          unavailable = 0,
          updated_at = excluded.updated_at`,
      )
      .bind(animeId, lane, nextPosition, now, now),
  ];

  const compact = oldLaneCompactionStatement(db, state, lane);
  if (compact) statements.push(compact);
  await db.batch(statements);
  return true;
}

export async function markAnimeWatchlistUnavailable(
  db: D1Database,
  animeId: number,
): Promise<boolean> {
  await ensureAnimeSchema(db);
  const state = await getWantQueueState(db, animeId);
  if (!state) return false;
  const now = Date.now();

  const statements = [
    db
      .prepare(
        `INSERT INTO anime_watchlist_queue (
          anime_id, lane, position, unavailable, created_at, updated_at
        ) VALUES (?, NULL, NULL, 1, ?, ?)
        ON CONFLICT(anime_id) DO UPDATE SET
          lane = NULL,
          position = NULL,
          unavailable = 1,
          updated_at = excluded.updated_at`,
      )
      .bind(animeId, now, now),
  ];

  const compact = oldLaneCompactionStatement(db, state, null);
  if (compact) statements.push(compact);
  await db.batch(statements);
  return true;
}

export async function resetAnimeWatchlistQueue(
  db: D1Database,
  animeId: number,
): Promise<boolean> {
  await ensureAnimeSchema(db);
  const state = await getWantQueueState(db, animeId);
  if (!state) return false;

  const statements = [
    db
      .prepare("DELETE FROM anime_watchlist_queue WHERE anime_id = ?")
      .bind(animeId),
  ];
  const compact = oldLaneCompactionStatement(db, state, null);
  if (compact) statements.push(compact);
  await db.batch(statements);
  return true;
}

export async function moveAnimeWatchlistQueueItem(
  db: D1Database,
  animeId: number,
  direction: "UP" | "DOWN" | "TOP",
): Promise<boolean> {
  await ensureAnimeSchema(db);
  const state = await getWantQueueState(db, animeId);
  if (
    !state
    || state.unavailable === 1
    || !state.lane
    || !isAnimeWatchlistLane(state.lane)
    || state.position == null
  ) {
    return false;
  }

  if (direction === "TOP") {
    if (state.position <= 1) return true;
    const now = Date.now();
    await db.batch([
      db
        .prepare(
          `UPDATE anime_watchlist_queue
           SET position = position + 1
           WHERE lane = ? AND unavailable = 0 AND position < ?`,
        )
        .bind(state.lane, state.position),
      db
        .prepare(
          "UPDATE anime_watchlist_queue SET position = 1, updated_at = ? WHERE anime_id = ?",
        )
        .bind(now, animeId),
    ]);
    return true;
  }

  const operator = direction === "UP" ? "<" : ">";
  const order = direction === "UP" ? "DESC" : "ASC";
  const neighbor = await db
    .prepare(
      `SELECT anime_id, position
       FROM anime_watchlist_queue
       WHERE lane = ? AND unavailable = 0 AND position ${operator} ?
       ORDER BY position ${order}, anime_id ${order}
       LIMIT 1`,
    )
    .bind(state.lane, state.position)
    .first<{ anime_id: number; position: number }>();

  if (!neighbor) return true;
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        "UPDATE anime_watchlist_queue SET position = ?, updated_at = ? WHERE anime_id = ?",
      )
      .bind(neighbor.position, now, animeId),
    db
      .prepare(
        "UPDATE anime_watchlist_queue SET position = ?, updated_at = ? WHERE anime_id = ?",
      )
      .bind(state.position, now, neighbor.anime_id),
  ]);
  return true;
}
