import { normalizeAnimeAlias } from "./anime-title";
import {
  ANIME_EVALUATION_KEYS,
  ANIME_PRIMARY_STATUSES,
  ANIME_SEASONS,
  isAnimeEvaluationTagKey,
  type AnimeEvaluationKey,
  type AnimeEvaluationTagKey,
  type AnimePrimaryStatus,
  type AnimeSeason,
} from "./anime.types";

export const ANIME_LIBRARY_SORTS = ["RECENT", "TITLE", "YEAR_DESC"] as const;
export type AnimeLibrarySort = (typeof ANIME_LIBRARY_SORTS)[number];

export type AnimeLibraryQueryInput = {
  search?: string | null;
  statuses?: readonly string[];
  ratings?: readonly string[];
  years?: readonly number[];
  seasons?: readonly string[];
  tags?: readonly string[];
  sort?: string | null;
  limit?: number;
  offset?: number;
};

export type NormalizedAnimeLibraryQuery = {
  search: string | null;
  normalizedSearch: string | null;
  statuses: AnimePrimaryStatus[];
  ratings: AnimeEvaluationKey[];
  years: number[];
  seasons: AnimeSeason[];
  tags: AnimeEvaluationTagKey[];
  sort: AnimeLibrarySort;
  limit: number;
  offset: number;
};

export type AnimeLibrarySqlFilter = {
  whereSql: string;
  bindings: Array<string | number>;
};

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/**
 * Normalizes untrusted URL/query inputs before they are used by the library query.
 */
export function normalizeAnimeLibraryQuery(
  input: AnimeLibraryQueryInput = {},
): NormalizedAnimeLibraryQuery {
  const search = input.search?.trim().slice(0, 100) || null;
  const normalizedSearch = search ? normalizeAnimeAlias(search) || null : null;
  const statuses = unique(
    (input.statuses ?? []).filter((value): value is AnimePrimaryStatus =>
      ANIME_PRIMARY_STATUSES.includes(value as AnimePrimaryStatus)),
  );
  const ratings = unique(
    (input.ratings ?? []).filter((value): value is AnimeEvaluationKey =>
      ANIME_EVALUATION_KEYS.includes(value as AnimeEvaluationKey)),
  );
  const years = unique(
    (input.years ?? [])
      .map((value) => Math.trunc(value))
      .filter((value) => Number.isInteger(value) && value >= 1901 && value <= 2100),
  );
  const seasons = unique(
    (input.seasons ?? []).filter((value): value is AnimeSeason =>
      ANIME_SEASONS.includes(value as AnimeSeason)),
  );
  const tags = unique((input.tags ?? []).filter(isAnimeEvaluationTagKey));
  const sort = ANIME_LIBRARY_SORTS.includes(input.sort as AnimeLibrarySort)
    ? input.sort as AnimeLibrarySort
    : "RECENT";
  const limit = Math.min(100, Math.max(1, Math.trunc(input.limit ?? 48)));
  const offset = Math.min(100_000, Math.max(0, Math.trunc(input.offset ?? 0)));

  return {
    search,
    normalizedSearch,
    statuses,
    ratings,
    years,
    seasons,
    tags,
    sort,
    limit,
    offset,
  };
}

/**
 * Builds the parameterized WHERE fragment shared by the library count/data queries.
 */
export function buildAnimeLibrarySqlFilter(
  query: NormalizedAnimeLibraryQuery,
): AnimeLibrarySqlFilter {
  const clauses: string[] = [];
  const bindings: Array<string | number> = [];

  if (query.search) {
    const directSearch = `%${escapeLike(query.search)}%`;
    const aliasSearch = query.normalizedSearch
      ? `%${escapeLike(query.normalizedSearch)}%`
      : directSearch;
    clauses.push(`(
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
    )`);
    bindings.push(directSearch, directSearch, directSearch, directSearch, aliasSearch);
  }

  if (query.statuses.length) {
    clauses.push(`d.status IN (${query.statuses.map(() => "?").join(", ")})`);
    bindings.push(...query.statuses);
  }

  if (query.ratings.length) {
    clauses.push(`e.rating IN (${query.ratings.map(() => "?").join(", ")})`);
    bindings.push(...query.ratings);
  }

  if (query.years.length) {
    clauses.push(`a.year IN (${query.years.map(() => "?").join(", ")})`);
    bindings.push(...query.years);
  }

  if (query.seasons.length) {
    clauses.push(`a.season IN (${query.seasons.map(() => "?").join(", ")})`);
    bindings.push(...query.seasons);
  }

  for (const tag of query.tags) {
    clauses.push(`EXISTS (
      SELECT 1
      FROM anime_user_evaluation_tags filter_tag
      WHERE filter_tag.anime_id = a.anime_id
        AND filter_tag.tag_key = ?
    )`);
    bindings.push(tag);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join("\n  AND ")}` : "",
    bindings,
  };
}

export function animeLibraryOrderBySql(sort: AnimeLibrarySort): string {
  switch (sort) {
    case "TITLE":
      return "COALESCE(a.title_zh_tw, a.title_native, a.title_romaji, a.title_english, '') COLLATE NOCASE ASC, a.anime_id ASC";
    case "YEAR_DESC":
      return "(a.year IS NULL) ASC, a.year DESC, COALESCE(a.title_zh_tw, a.title_native, a.title_romaji, a.title_english, '') COLLATE NOCASE ASC, a.anime_id ASC";
    case "RECENT":
    default:
      return "MAX(d.updated_at, COALESCE(e.updated_at, 0)) DESC, a.anime_id DESC";
  }
}
