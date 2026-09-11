import type { AnimeSeason } from "../anime.types";
import { AnimeProviderError, fetchJsonWithTimeout } from "./provider-http.server";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_PAGE_SIZE = 50;

export const ANILIST_DEFAULT_TV_FORMATS = ["TV", "TV_SHORT", "ONA"] as const;

export type AniListAnime = {
  id: number;
  idMal: number | null;
  title: {
    romaji: string | null;
    english: string | null;
    native: string | null;
  };
  synonyms: string[];
  season: AnimeSeason | null;
  seasonYear: number | null;
  format: string | null;
  episodes: number | null;
  coverUrl: string | null;
  genres: string[];
  popularity: number | null;
  averageScore: number | null;
  updatedAt: number | null;
  studio: string | null;
};

export type AniListPageBatch = {
  records: AniListAnime[];
  page: number;
  hasNextPage: boolean;
};

type AniListRawMedia = {
  id: number;
  idMal?: number | null;
  title?: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  } | null;
  synonyms?: Array<string | null> | null;
  season?: string | null;
  seasonYear?: number | null;
  format?: string | null;
  episodes?: number | null;
  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
  } | null;
  genres?: Array<string | null> | null;
  popularity?: number | null;
  averageScore?: number | null;
  updatedAt?: number | null;
  studios?: {
    edges?: Array<{
      isMain?: boolean | null;
      node?: { name?: string | null } | null;
    } | null> | null;
  } | null;
};

type AniListPageResponse = {
  data?: {
    Page?: {
      pageInfo?: {
        currentPage?: number | null;
        hasNextPage?: boolean | null;
      } | null;
      media?: Array<AniListRawMedia | null> | null;
    } | null;
  } | null;
  errors?: Array<{ message?: string | null }> | null;
};

const MEDIA_FIELDS = `
  id
  idMal
  title {
    romaji
    english
    native
  }
  synonyms
  season
  seasonYear
  format
  episodes
  coverImage {
    extraLarge
    large
  }
  genres
  popularity
  averageScore
  updatedAt
  studios {
    edges {
      isMain
      node { name }
    }
  }
`;

const SEASON_QUERY = `
  query AnimeMemorySeason(
    $page: Int!
    $perPage: Int!
    $season: MediaSeason!
    $seasonYear: Int!
    $formats: [MediaFormat!]
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { currentPage hasNextPage }
      media(
        type: ANIME
        season: $season
        seasonYear: $seasonYear
        format_in: $formats
        isAdult: false
        sort: [POPULARITY_DESC, SCORE_DESC]
      ) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

function isAnimeSeason(value: string | null | undefined): value is AnimeSeason {
  return value === "WINTER" || value === "SPRING" || value === "SUMMER" || value === "FALL";
}

function normalizeMedia(media: AniListRawMedia): AniListAnime {
  const studioEdges = media.studios?.edges?.filter(Boolean) ?? [];
  const mainStudio = studioEdges.find((edge) => edge?.isMain)?.node?.name ?? null;
  const fallbackStudio = studioEdges.find((edge) => edge?.node?.name)?.node?.name ?? null;

  return {
    id: media.id,
    idMal: media.idMal ?? null,
    title: {
      romaji: media.title?.romaji ?? null,
      english: media.title?.english ?? null,
      native: media.title?.native ?? null,
    },
    synonyms: (media.synonyms ?? []).filter((value): value is string => Boolean(value?.trim())),
    season: isAnimeSeason(media.season) ? media.season : null,
    seasonYear: media.seasonYear ?? null,
    format: media.format ?? null,
    episodes: media.episodes ?? null,
    coverUrl: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    genres: (media.genres ?? []).filter((value): value is string => Boolean(value)),
    popularity: media.popularity ?? null,
    averageScore: media.averageScore ?? null,
    updatedAt: media.updatedAt ?? null,
    studio: mainStudio ?? fallbackStudio,
  };
}

async function queryAniList(
  query: string,
  variables: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<AniListPageResponse> {
  const payload = await fetchJsonWithTimeout<AniListPageResponse>(
    "AniList",
    ANILIST_ENDPOINT,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    },
    timeoutMs,
  );

  if (payload.errors?.length) {
    const message = payload.errors
      .map((error) => error.message)
      .filter(Boolean)
      .join("; ");
    throw new AnimeProviderError("AniList", message || "AniList GraphQL returned an error");
  }

  return payload;
}

function normalizePage(payload: AniListPageResponse, requestedPage: number): AniListPageBatch {
  const pageData = payload.data?.Page;
  return {
    records: (pageData?.media ?? [])
      .filter((media): media is AniListRawMedia => Boolean(media))
      .map(normalizeMedia),
    page: pageData?.pageInfo?.currentPage ?? requestedPage,
    hasNextPage: Boolean(pageData?.pageInfo?.hasNextPage),
  };
}

async function collectPages(
  query: string,
  baseVariables: Record<string, unknown>,
  limit: number,
): Promise<AniListAnime[]> {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 500));
  const records: AniListAnime[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage && records.length < safeLimit) {
    const perPage = Math.min(MAX_PAGE_SIZE, safeLimit - records.length);
    const payload = await queryAniList(query, {
      ...baseVariables,
      page,
      perPage,
    });
    const batch = normalizePage(payload, page);
    records.push(...batch.records);
    hasNextPage = batch.hasNextPage;
    page += 1;
  }

  return records.slice(0, safeLimit);
}

export async function fetchAniListSeasonPage(options: {
  year: number;
  season: AnimeSeason;
  page: number;
  perPage?: number;
  formats?: readonly string[];
}): Promise<AniListPageBatch> {
  const page = Math.max(1, Math.trunc(options.page));
  const perPage = Math.max(1, Math.min(Math.trunc(options.perPage ?? MAX_PAGE_SIZE), MAX_PAGE_SIZE));
  const payload = await queryAniList(SEASON_QUERY, {
    page,
    perPage,
    season: options.season,
    seasonYear: options.year,
    formats: [...(options.formats ?? ANILIST_DEFAULT_TV_FORMATS)],
  });
  return normalizePage(payload, page);
}

export async function fetchAniListSeason(options: {
  year: number;
  season: AnimeSeason;
  limit?: number;
  formats?: readonly string[];
}): Promise<AniListAnime[]> {
  return collectPages(
    SEASON_QUERY,
    {
      season: options.season,
      seasonYear: options.year,
      formats: [...(options.formats ?? ANILIST_DEFAULT_TV_FORMATS)],
    },
    options.limit ?? 100,
  );
}

export async function fetchAniListMoviesByYear(options: {
  year: number;
  limit?: number;
}): Promise<AniListAnime[]> {
  const query = `
    query AnimeMemoryMovies(
      $page: Int!
      $perPage: Int!
      $startDateGreater: FuzzyDateInt!
      $startDateLesser: FuzzyDateInt!
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { currentPage hasNextPage }
        media(
          type: ANIME
          format: MOVIE
          startDate_greater: $startDateGreater
          startDate_lesser: $startDateLesser
          isAdult: false
          sort: [POPULARITY_DESC, SCORE_DESC]
        ) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;

  return collectPages(
    query,
    {
      startDateGreater: options.year * 10_000,
      startDateLesser: (options.year + 1) * 10_000,
    },
    options.limit ?? 100,
  );
}

export async function searchAniListAnime(
  search: string,
  options: { limit?: number } = {},
): Promise<AniListAnime[]> {
  const trimmed = search.trim();
  if (!trimmed) return [];

  const query = `
    query AnimeMemorySearch($page: Int!, $perPage: Int!, $search: String!) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { currentPage hasNextPage }
        media(type: ANIME, search: $search, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;

  return collectPages(query, { search: trimmed }, options.limit ?? 10);
}
