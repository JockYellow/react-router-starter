import { ensureAnimeBangumiMetricsSchema } from "./anime-bangumi-metrics.server";
import { animeCoverProxyPath } from "./anime-cover.server";
import {
  animeWatchlistOrderBySql,
  buildAnimeWatchlistSearchFilter,
  normalizeAnimeWatchlistQuery,
  type AnimeWatchlistQueryInput,
  type NormalizedAnimeWatchlistQuery,
} from "./anime-watchlist";
import { ensureAnimeSchema } from "./anime.schema.server";
import type { AnimeSeason } from "./anime.types";

export type AnimeWatchlistItem = {
  animeId: number;
  title: string;
  year: number | null;
  season: AnimeSeason | null;
  format: string | null;
  episodes: number | null;
  studio: string | null;
  coverUrl: string | null;
  addedAt: number;
  externalScore: number | null;
  scoreSource: string | null;
  bangumiCollectionTotal: number | null;
};

export type AnimeWatchlistPage = {
  items: AnimeWatchlistItem[];
  total: number;
  hasMore: boolean;
  query: NormalizedAnimeWatchlistQuery;
};

type WatchlistRow = {
  anime_id: number;
  title_zh_tw: string | null;
  title_native: string | null;
  title_romaji: string | null;
  title_english: string | null;
  year: number | null;
  season: AnimeSeason | null;
  format: string | null;
  episodes: number | null;
  studio: string | null;
  cover_url: string | null;
  added_at: number;
  external_score: number | null;
  score_source: string | null;
  bangumi_collection_total: number | null;
};

export async function getAnimeWatchlistPage(
  db: D1Database,
  input: AnimeWatchlistQueryInput = {},
): Promise<AnimeWatchlistPage> {
  await ensureAnimeSchema(db);
  await ensureAnimeBangumiMetricsSchema(db);

  const query = normalizeAnimeWatchlistQuery(input);
  const search = buildAnimeWatchlistSearchFilter(query);
  const orderBy = animeWatchlistOrderBySql(query.sort);
  const baseFrom = `
    FROM anime_user_decisions d
    JOIN anime_items a ON a.anime_id = d.anime_id
    LEFT JOIN anime_bangumi_metrics bm ON bm.anime_id = a.anime_id
    WHERE d.status = 'WANT'
    ${search.sql}`;

  const [countRow, rows] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS count ${baseFrom}`).bind(...search.bindings).first<{ count: number }>(),
    db
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
          a.studio,
          a.cover_url,
          d.updated_at AS added_at,
          COALESCE(bm.average_score, a.average_score) AS external_score,
          CASE
            WHEN bm.average_score IS NOT NULL THEN 'Bangumi'
            WHEN a.average_score IS NOT NULL THEN a.metadata_source
            ELSE NULL
          END AS score_source,
          bm.collection_total AS bangumi_collection_total
        ${baseFrom}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?`,
      )
      .bind(...search.bindings, query.limit, query.offset)
      .all<WatchlistRow>(),
  ]);

  const total = countRow?.count ?? 0;
  const items = (rows.results ?? []).map((row): AnimeWatchlistItem => ({
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
    studio: row.studio,
    coverUrl: row.cover_url ? animeCoverProxyPath(row.anime_id) : null,
    addedAt: row.added_at,
    externalScore: row.external_score,
    scoreSource: row.score_source,
    bangumiCollectionTotal: row.bangumi_collection_total,
  }));

  return {
    items,
    total,
    hasMore: query.offset + items.length < total,
    query,
  };
}

export async function transitionWantDecision(
  db: D1Database,
  animeId: number,
  nextStatus: "SEEN" | "NOT_SEEN",
): Promise<boolean> {
  await ensureAnimeSchema(db);
  const now = Date.now();
  const result = await db
    .prepare(
      `UPDATE anime_user_decisions
       SET status = ?, detail_status = NULL, updated_at = ?
       WHERE anime_id = ? AND status = 'WANT'`,
    )
    .bind(nextStatus, now, animeId)
    .run();

  if ((result.meta?.changes ?? 0) < 1) return false;

  await db.batch([
    db.prepare("DELETE FROM anime_user_evaluation_tags WHERE anime_id = ?").bind(animeId),
    db.prepare("DELETE FROM anime_user_evaluations WHERE anime_id = ?").bind(animeId),
  ]);
  return true;
}
