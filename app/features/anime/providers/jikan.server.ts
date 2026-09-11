import type { AnimeSeason } from "../anime.types";
import type { AnimeProviderPageBatch, AnimeProviderRecord } from "./anime-provider.types";
import { fetchJsonWithTimeout } from "./provider-http.server";

const JIKAN_BASE_URL = "https://api.jikan.moe/v4";
const DEFAULT_TIMEOUT_MS = 15_000;
const ACCEPTED_TV_TYPES = new Set(["TV", "ONA"]);

const SEASON_SLUG: Record<AnimeSeason, string> = {
  WINTER: "winter",
  SPRING: "spring",
  SUMMER: "summer",
  FALL: "fall",
};

type JikanNamedResource = {
  mal_id?: number | null;
  name?: string | null;
};

type JikanAnime = {
  mal_id?: number | null;
  title?: string | null;
  title_english?: string | null;
  title_japanese?: string | null;
  title_synonyms?: Array<string | null> | null;
  type?: string | null;
  episodes?: number | null;
  score?: number | null;
  members?: number | null;
  year?: number | null;
  season?: string | null;
  images?: {
    webp?: {
      large_image_url?: string | null;
      image_url?: string | null;
    } | null;
    jpg?: {
      large_image_url?: string | null;
      image_url?: string | null;
    } | null;
  } | null;
  studios?: Array<JikanNamedResource | null> | null;
  genres?: Array<JikanNamedResource | null> | null;
  themes?: Array<JikanNamedResource | null> | null;
};

type JikanSeasonResponse = {
  data?: Array<JikanAnime | null> | null;
  pagination?: {
    current_page?: number | null;
    has_next_page?: boolean | null;
    last_visible_page?: number | null;
  } | null;
};

function isSeason(value: string | null | undefined): value is AnimeSeason {
  return value === "WINTER" || value === "SPRING" || value === "SUMMER" || value === "FALL";
}

function normalizeSeason(value: string | null | undefined, fallback: AnimeSeason): AnimeSeason {
  const upper = value?.trim().toUpperCase();
  return isSeason(upper) ? upper : fallback;
}

function safePositiveInt(value: number | null | undefined): number | null {
  return Number.isInteger(value) && (value ?? 0) > 0 ? (value as number) : null;
}

function normalizeJikanAnime(
  anime: JikanAnime,
  expectedYear: number,
  expectedSeason: AnimeSeason,
): AnimeProviderRecord | null {
  const malId = safePositiveInt(anime.mal_id);
  if (!malId) return null;

  const format = anime.type?.trim() || null;
  if (!format || !ACCEPTED_TV_TYPES.has(format.toUpperCase())) return null;

  const score = typeof anime.score === "number" && Number.isFinite(anime.score)
    ? Math.max(0, Math.min(100, Math.round(anime.score * 10)))
    : null;
  const members = safePositiveInt(anime.members) ?? 0;
  const studio = (anime.studios ?? []).find((item) => item?.name?.trim())?.name?.trim() ?? null;
  const genres = [...(anime.genres ?? []), ...(anime.themes ?? [])]
    .map((item) => item?.name?.trim())
    .filter((value): value is string => Boolean(value));

  return {
    provider: "JIKAN",
    providerId: malId,
    malId,
    anilistId: null,
    bangumiId: null,
    title: {
      romaji: anime.title?.trim() || null,
      english: anime.title_english?.trim() || null,
      native: anime.title_japanese?.trim() || null,
    },
    synonyms: (anime.title_synonyms ?? [])
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value)),
    season: normalizeSeason(anime.season, expectedSeason),
    seasonYear: safePositiveInt(anime.year) ?? expectedYear,
    format: format.toUpperCase(),
    episodes: Number.isInteger(anime.episodes) && (anime.episodes ?? 0) >= 0 ? (anime.episodes as number) : null,
    coverUrl:
      anime.images?.webp?.large_image_url ??
      anime.images?.jpg?.large_image_url ??
      anime.images?.webp?.image_url ??
      anime.images?.jpg?.image_url ??
      null,
    genres: [...new Set(genres)],
    popularity: members,
    averageScore: score,
    providerUpdatedAt: null,
    studio,
  };
}

export async function fetchJikanSeasonPage(options: {
  year: number;
  season: AnimeSeason;
  page: number;
}): Promise<AnimeProviderPageBatch> {
  const page = Math.max(1, Math.trunc(options.page));
  const url = new URL(`${JIKAN_BASE_URL}/seasons/${options.year}/${SEASON_SLUG[options.season]}`);
  url.searchParams.set("sfw", "true");
  url.searchParams.set("page", String(page));

  const payload = await fetchJsonWithTimeout<JikanSeasonResponse>(
    "Jikan",
    url,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "AnimeMemory/1.0 (+https://github.com/JockYellow/react-router-starter)",
      },
    },
    DEFAULT_TIMEOUT_MS,
    {
      maxRetries: 2,
      baseDelayMs: 800,
      maxDelayMs: 10_000,
      jitterMs: 300,
    },
  );

  const records = (payload.data ?? [])
    .filter((item): item is JikanAnime => Boolean(item))
    .map((item) => normalizeJikanAnime(item, options.year, options.season))
    .filter((item): item is AnimeProviderRecord => Boolean(item));

  return {
    records,
    page: payload.pagination?.current_page ?? page,
    hasNextPage: Boolean(payload.pagination?.has_next_page),
  };
}
