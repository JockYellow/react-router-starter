import type { AnimeSeason } from "../anime.types";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_PAGE_SIZE = 50;
const MAX_ATTEMPTS = 3;
const MAX_RETRY_WAIT_MS = 15_000;

export type BrowserAniListAnime = {
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

export type BrowserAniListPageBatch = {
  records: BrowserAniListAnime[];
  page: number;
  hasNextPage: boolean;
};

type AniListRawMedia = {
  id?: number | null;
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
  errors?: Array<{ message?: string | null; status?: number | null }> | null;
};

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  synonyms
  season
  seasonYear
  format
  episodes
  coverImage { extraLarge large }
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

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(MAX_RETRY_WAIT_MS, seconds * 1000);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.min(MAX_RETRY_WAIT_MS, Math.max(0, timestamp - Date.now()));
}

function shouldRetry(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function fallbackDelay(attempt: number) {
  const base = Math.min(MAX_RETRY_WAIT_MS, 500 * 2 ** attempt);
  return base + Math.floor(Math.random() * 250);
}

function isAnimeSeason(value: string | null | undefined): value is AnimeSeason {
  return value === "WINTER" || value === "SPRING" || value === "SUMMER" || value === "FALL";
}

function normalizeMedia(media: AniListRawMedia): BrowserAniListAnime | null {
  if (!Number.isInteger(media.id) || (media.id ?? 0) <= 0) return null;
  const studioEdges = media.studios?.edges?.filter(Boolean) ?? [];
  const mainStudio = studioEdges.find((edge) => edge?.isMain)?.node?.name ?? null;
  const fallbackStudio = studioEdges.find((edge) => edge?.node?.name)?.node?.name ?? null;

  return {
    id: media.id as number,
    idMal: Number.isInteger(media.idMal) ? (media.idMal as number) : null,
    title: {
      romaji: media.title?.romaji ?? null,
      english: media.title?.english ?? null,
      native: media.title?.native ?? null,
    },
    synonyms: (media.synonyms ?? []).filter((value): value is string => Boolean(value?.trim())),
    season: isAnimeSeason(media.season) ? media.season : null,
    seasonYear: Number.isInteger(media.seasonYear) ? (media.seasonYear as number) : null,
    format: media.format ?? null,
    episodes: Number.isInteger(media.episodes) ? (media.episodes as number) : null,
    coverUrl: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    genres: (media.genres ?? []).filter((value): value is string => Boolean(value?.trim())),
    popularity: Number.isInteger(media.popularity) ? (media.popularity as number) : null,
    averageScore: Number.isInteger(media.averageScore) ? (media.averageScore as number) : null,
    updatedAt: Number.isInteger(media.updatedAt) ? (media.updatedAt as number) : null,
    studio: mainStudio ?? fallbackStudio,
  };
}

async function requestAniList(body: string): Promise<AniListPageResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(ANILIST_ENDPOINT, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const error = new Error(`AniList request failed (${response.status})${text ? `: ${text.slice(0, 500)}` : ""}`);
        if (!shouldRetry(response.status) || attempt === MAX_ATTEMPTS - 1) throw error;
        await sleep(retryAfterMs(response.headers.get("Retry-After")) ?? fallbackDelay(attempt));
        continue;
      }

      const payload = (await response.json()) as AniListPageResponse;
      if (payload.errors?.length) {
        const message = payload.errors.map((entry) => entry.message).filter(Boolean).join("; ");
        throw new Error(message || "AniList GraphQL returned an error");
      }
      return payload;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error("AniList browser request failed");
      const aborted = normalized.name === "AbortError";
      lastError = aborted ? new Error(`AniList request timed out after ${DEFAULT_TIMEOUT_MS}ms`) : normalized;
      if (!aborted && normalized.message.includes("request failed (4") && !normalized.message.includes("(408)") && !normalized.message.includes("(425)") && !normalized.message.includes("(429)")) {
        throw normalized;
      }
      if (attempt === MAX_ATTEMPTS - 1) throw lastError;
      await sleep(fallbackDelay(attempt));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("AniList browser request failed");
}

export async function fetchAniListSeasonPageFromBrowser(options: {
  year: number;
  season: AnimeSeason;
  page: number;
  perPage: number;
}): Promise<BrowserAniListPageBatch> {
  const page = Math.max(1, Math.trunc(options.page));
  const perPage = Math.max(1, Math.min(MAX_PAGE_SIZE, Math.trunc(options.perPage)));
  const payload = await requestAniList(JSON.stringify({
    query: SEASON_QUERY,
    variables: {
      page,
      perPage,
      season: options.season,
      seasonYear: options.year,
      formats: ["TV", "TV_SHORT", "ONA"],
    },
  }));
  const pageData = payload.data?.Page;
  return {
    records: (pageData?.media ?? [])
      .filter((media): media is AniListRawMedia => Boolean(media))
      .map(normalizeMedia)
      .filter((media): media is BrowserAniListAnime => Boolean(media)),
    page: pageData?.pageInfo?.currentPage ?? page,
    hasNextPage: Boolean(pageData?.pageInfo?.hasNextPage),
  };
}
