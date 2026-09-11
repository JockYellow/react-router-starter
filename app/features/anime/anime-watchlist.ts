import { normalizeAnimeAlias } from "./anime-title";

export const ANIME_WATCHLIST_SORTS = [
  "ADDED_DESC",
  "YEAR_DESC",
  "SCORE_DESC",
] as const;
export type AnimeWatchlistSort = (typeof ANIME_WATCHLIST_SORTS)[number];

export type AnimeWatchlistQueryInput = {
  search?: string | null;
  sort?: string | null;
  limit?: number;
  offset?: number;
};

export type NormalizedAnimeWatchlistQuery = {
  search: string | null;
  normalizedSearch: string | null;
  sort: AnimeWatchlistSort;
  limit: number;
  offset: number;
};

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function finiteInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.trunc(value as number) : fallback;
}

export function normalizeAnimeWatchlistQuery(
  input: AnimeWatchlistQueryInput = {},
): NormalizedAnimeWatchlistQuery {
  const search = input.search?.trim().slice(0, 100) || null;
  const normalizedSearch = search ? normalizeAnimeAlias(search) || null : null;
  const sort = ANIME_WATCHLIST_SORTS.includes(input.sort as AnimeWatchlistSort)
    ? input.sort as AnimeWatchlistSort
    : "ADDED_DESC";
  const limit = Math.min(100, Math.max(1, finiteInteger(input.limit, 48)));
  const offset = Math.min(100_000, Math.max(0, finiteInteger(input.offset, 0)));

  return { search, normalizedSearch, sort, limit, offset };
}

export function buildAnimeWatchlistSearchFilter(
  query: NormalizedAnimeWatchlistQuery,
): { sql: string; bindings: string[] } {
  if (!query.search) return { sql: "", bindings: [] };

  const direct = `%${escapeLike(query.search)}%`;
  const alias = `%${escapeLike(query.normalizedSearch ?? query.search)}%`;
  return {
    sql: `AND (
      COALESCE(a.title_zh_tw, '') COLLATE NOCASE LIKE ? ESCAPE '\\'
      OR COALESCE(a.title_native, '') COLLATE NOCASE LIKE ? ESCAPE '\\'
      OR COALESCE(a.title_romaji, '') COLLATE NOCASE LIKE ? ESCAPE '\\'
      OR COALESCE(a.title_english, '') COLLATE NOCASE LIKE ? ESCAPE '\\'
      OR EXISTS (
        SELECT 1
        FROM anime_item_aliases aa
        WHERE aa.anime_id = a.anime_id
          AND aa.normalized_alias LIKE ? ESCAPE '\\'
      )
    )`,
    bindings: [direct, direct, direct, direct, alias],
  };
}

export function animeWatchlistOrderBySql(sort: AnimeWatchlistSort): string {
  switch (sort) {
    case "YEAR_DESC":
      return "(a.year IS NULL) ASC, a.year DESC, d.updated_at DESC, a.anime_id DESC";
    case "SCORE_DESC":
      return "(COALESCE(bm.average_score, a.average_score) IS NULL) ASC, COALESCE(bm.average_score, a.average_score) DESC, d.updated_at DESC, a.anime_id DESC";
    case "ADDED_DESC":
    default:
      return "d.updated_at DESC, a.anime_id DESC";
  }
}

export function sanitizeAnimeWatchlistReturnTo(value: string | null | undefined): string {
  const candidate = value?.trim();
  if (!candidate || candidate.length > 2000) return "/anime/watchlist";
  if (candidate === "/anime/watchlist" || candidate.startsWith("/anime/watchlist?")) return candidate;
  return "/anime/watchlist";
}
