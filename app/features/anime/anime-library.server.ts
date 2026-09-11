import { animeCoverProxyPath } from "./anime-cover.server";
import {
  animeLibraryOrderBySql,
  buildAnimeLibrarySqlFilter,
  normalizeAnimeLibraryQuery,
  type AnimeLibraryQueryInput,
  type NormalizedAnimeLibraryQuery,
} from "./anime-library";
import { ensureAnimeSchema } from "./anime.schema.server";
import {
  isAnimeEvaluationTagKey,
  type AnimeEvaluationKey,
  type AnimeEvaluationTagKey,
  type AnimePrimaryStatus,
  type AnimeSeason,
  type AnimeWatchDetail,
} from "./anime.types";

export type AnimeLibraryItem = {
  animeId: number;
  title: string;
  titleZhTw: string | null;
  titleNative: string | null;
  titleRomaji: string | null;
  titleEnglish: string | null;
  year: number | null;
  season: AnimeSeason | null;
  format: string | null;
  episodes: number | null;
  studio: string | null;
  coverUrl: string | null;
  status: AnimePrimaryStatus;
  detailStatus: AnimeWatchDetail | null;
  rating: AnimeEvaluationKey | null;
  tags: AnimeEvaluationTagKey[];
  updatedAt: number;
};

export type AnimeLibraryPage = {
  items: AnimeLibraryItem[];
  total: number;
  hasMore: boolean;
  query: NormalizedAnimeLibraryQuery;
};

type LibraryRow = {
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
  status: AnimePrimaryStatus;
  detail_status: AnimeWatchDetail | null;
  rating: AnimeEvaluationKey | null;
  tags_csv: string | null;
  updated_at: number;
};

function parseTagCsv(value: string | null): AnimeEvaluationTagKey[] {
  if (!value) return [];
  return value.split(",").filter(isAnimeEvaluationTagKey);
}

/**
 * Reads personal Anime Memory records for the future library/poster-wall UI.
 * Only titles with a user decision are included; provider-only catalog rows stay hidden.
 */
export async function getAnimeLibraryPage(
  db: D1Database,
  input: AnimeLibraryQueryInput = {},
): Promise<AnimeLibraryPage> {
  await ensureAnimeSchema(db);

  const query = normalizeAnimeLibraryQuery(input);
  const filter = buildAnimeLibrarySqlFilter(query);
  const orderBy = animeLibraryOrderBySql(query.sort);
  const baseFrom = `
    FROM anime_user_decisions d
    JOIN anime_items a ON a.anime_id = d.anime_id
    LEFT JOIN anime_user_evaluations e ON e.anime_id = d.anime_id
    ${filter.whereSql}`;

  const countStatement = db
    .prepare(`SELECT COUNT(*) AS count ${baseFrom}`)
    .bind(...filter.bindings);
  const rowsStatement = db
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
        d.status,
        d.detail_status,
        e.rating,
        (
          SELECT GROUP_CONCAT(tag_key, ',')
          FROM anime_user_evaluation_tags result_tag
          WHERE result_tag.anime_id = a.anime_id
        ) AS tags_csv,
        MAX(d.updated_at, COALESCE(e.updated_at, 0)) AS updated_at
      ${baseFrom}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`,
    )
    .bind(...filter.bindings, query.limit, query.offset);

  const [countRow, rows] = await Promise.all([
    countStatement.first<{ count: number }>(),
    rowsStatement.all<LibraryRow>(),
  ]);

  const total = countRow?.count ?? 0;
  const items = (rows.results ?? []).map((row): AnimeLibraryItem => ({
    animeId: row.anime_id,
    title: row.title_zh_tw
      ?? row.title_native
      ?? row.title_romaji
      ?? row.title_english
      ?? "未命名作品",
    titleZhTw: row.title_zh_tw,
    titleNative: row.title_native,
    titleRomaji: row.title_romaji,
    titleEnglish: row.title_english,
    year: row.year,
    season: row.season,
    format: row.format,
    episodes: row.episodes,
    studio: row.studio,
    coverUrl: row.cover_url ? animeCoverProxyPath(row.anime_id) : null,
    status: row.status,
    detailStatus: row.detail_status,
    rating: row.rating,
    tags: parseTagCsv(row.tags_csv),
    updatedAt: row.updated_at,
  }));

  return {
    items,
    total,
    hasMore: query.offset + items.length < total,
    query,
  };
}
