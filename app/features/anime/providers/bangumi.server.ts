import * as OpenCC from "opencc-js/core";
import * as Locale from "opencc-js/preset";

import type { AnimeSeason } from "../anime.types";
import type { AnimeProviderBatch, AnimeProviderRecord } from "./anime-provider.types";
import { fetchJsonWithTimeout } from "./provider-http.server";

const BANGUMI_SEARCH_ENDPOINT = "https://api.bgm.tv/v0/search/subjects";
const BANGUMI_BROWSE_ENDPOINT = "https://api.bgm.tv/v0/subjects";
const DEFAULT_TIMEOUT_MS = 12_000;
const USER_AGENT = "JockYellow/AnimeMemory (https://github.com/JockYellow/react-router-starter)";
const BROWSE_LIMIT = 100;
const toTaiwanTraditional = OpenCC.ConverterFactory(Locale.from.cn, Locale.to.tw);

const SEASON_MONTHS: Record<AnimeSeason, readonly number[]> = {
  WINTER: [1, 2, 3],
  SPRING: [4, 5, 6],
  SUMMER: [7, 8, 9],
  FALL: [10, 11, 12],
};

const ANIME_CATEGORIES = [
  { value: 1, label: "TV", format: "TV" },
  { value: 5, label: "WEB", format: "ONA" },
] as const;

export type BangumiAnimeCandidate = {
  id: number;
  name: string;
  nameCn: string | null;
  date: string | null;
  platform: string | null;
};

type BangumiRawSubject = {
  id?: number | null;
  type?: number | null;
  name?: string | null;
  name_cn?: string | null;
  date?: string | null;
  platform?: string | null;
  eps?: number | null;
  score?: number | null;
  collection_total?: number | null;
  rank?: number | null;
  images?: {
    large?: string | null;
    common?: string | null;
    medium?: string | null;
    small?: string | null;
    grid?: string | null;
  } | null;
  tags?: Array<string | { name?: string | null } | null> | null;
};

type BangumiSearchResponse = {
  data?: Array<BangumiRawSubject | null> | null;
  total?: number | null;
};

type BangumiBrowseResponse = {
  total?: number | null;
  limit?: number | null;
  offset?: number | null;
  data?: Array<BangumiRawSubject | null> | null;
};

type BangumiBrowseCursor = {
  monthIndex: number;
  categoryIndex: number;
  offset: number;
};

function parseCursor(value: string | null | undefined): BangumiBrowseCursor {
  if (!value) return { monthIndex: 0, categoryIndex: 0, offset: 0 };
  try {
    const parsed = JSON.parse(value) as Partial<BangumiBrowseCursor>;
    const monthIndex = Number.isInteger(parsed.monthIndex) ? Number(parsed.monthIndex) : 0;
    const categoryIndex = Number.isInteger(parsed.categoryIndex) ? Number(parsed.categoryIndex) : 0;
    const offset = Number.isInteger(parsed.offset) ? Number(parsed.offset) : 0;
    if (monthIndex < 0 || monthIndex >= 3 || categoryIndex < 0 || categoryIndex >= 2 || offset < 0) {
      throw new Error("cursor out of range");
    }
    return { monthIndex, categoryIndex, offset };
  } catch {
    throw new Error("Invalid Bangumi seasonal cursor");
  }
}

function serializeCursor(cursor: BangumiBrowseCursor): string {
  return JSON.stringify(cursor);
}

function nextStreamCursor(cursor: BangumiBrowseCursor): BangumiBrowseCursor | null {
  if (cursor.categoryIndex === 0) {
    return { monthIndex: cursor.monthIndex, categoryIndex: 1, offset: 0 };
  }
  if (cursor.monthIndex < 2) {
    return { monthIndex: cursor.monthIndex + 1, categoryIndex: 0, offset: 0 };
  }
  return null;
}

function safePositiveInt(value: number | null | undefined): number | null {
  return Number.isInteger(value) && (value ?? 0) > 0 ? (value as number) : null;
}

function normalizeTags(tags: BangumiRawSubject["tags"]): string[] {
  const values = (tags ?? [])
    .map((tag) => typeof tag === "string" ? tag : tag?.name)
    .map((tag) => tag?.trim())
    .filter((tag): tag is string => Boolean(tag));
  return [...new Set(values)];
}

function normalizeBrowseSubject(
  subject: BangumiRawSubject,
  input: { year: number; season: AnimeSeason; format: "TV" | "ONA" },
): AnimeProviderRecord | null {
  const id = safePositiveInt(subject.id);
  const name = subject.name?.trim();
  if (!id || !name || subject.type !== 2) return null;

  const nameCn = subject.name_cn?.trim() || null;
  const titleZhTw = nameCn ? toTaiwanTraditional(nameCn).trim() || null : null;
  const dateYear = Number(subject.date?.slice(0, 4));
  const score = typeof subject.score === "number" && Number.isFinite(subject.score)
    ? Math.max(0, Math.min(100, Math.round(subject.score * 10)))
    : null;

  return {
    provider: "BANGUMI",
    providerId: id,
    malId: null,
    anilistId: null,
    bangumiId: id,
    titleZhTw,
    title: {
      romaji: null,
      english: null,
      native: name,
    },
    synonyms: nameCn && nameCn !== name ? [nameCn] : [],
    season: input.season,
    seasonYear: Number.isInteger(dateYear) && dateYear > 1900 ? dateYear : input.year,
    format: input.format,
    episodes: Number.isInteger(subject.eps) && (subject.eps ?? 0) >= 0 ? (subject.eps as number) : null,
    coverUrl:
      subject.images?.large ??
      subject.images?.common ??
      subject.images?.medium ??
      subject.images?.grid ??
      subject.images?.small ??
      null,
    genres: normalizeTags(subject.tags),
    popularity: Number.isInteger(subject.collection_total) && (subject.collection_total ?? 0) >= 0
      ? (subject.collection_total as number)
      : null,
    averageScore: score,
    providerUpdatedAt: null,
    studio: null,
  };
}

export async function fetchBangumiSeasonBatch(options: {
  year: number;
  season: AnimeSeason;
  cursor?: string | null;
}): Promise<AnimeProviderBatch> {
  const cursor = parseCursor(options.cursor);
  const month = SEASON_MONTHS[options.season][cursor.monthIndex];
  const category = ANIME_CATEGORIES[cursor.categoryIndex];
  const step = cursor.monthIndex * ANIME_CATEGORIES.length + cursor.categoryIndex + 1;
  const stepTotal = SEASON_MONTHS[options.season].length * ANIME_CATEGORIES.length;

  const url = new URL(BANGUMI_BROWSE_ENDPOINT);
  url.searchParams.set("type", "2");
  url.searchParams.set("cat", String(category.value));
  url.searchParams.set("year", String(options.year));
  url.searchParams.set("month", String(month));
  url.searchParams.set("sort", "date");
  url.searchParams.set("limit", String(BROWSE_LIMIT));
  url.searchParams.set("offset", String(cursor.offset));

  const payload = await fetchJsonWithTimeout<BangumiBrowseResponse>(
    "Bangumi",
    url,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
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
    .filter((subject): subject is BangumiRawSubject => Boolean(subject))
    .map((subject) => normalizeBrowseSubject(subject, {
      year: options.year,
      season: options.season,
      format: category.format,
    }))
    .filter((record): record is AnimeProviderRecord => Boolean(record));

  const responseOffset = Number.isInteger(payload.offset) ? Number(payload.offset) : cursor.offset;
  const responseLimit = Number.isInteger(payload.limit) && Number(payload.limit) > 0
    ? Number(payload.limit)
    : BROWSE_LIMIT;
  const total = Number.isInteger(payload.total) && Number(payload.total) >= 0
    ? Number(payload.total)
    : responseOffset + records.length;
  const nextOffset = responseOffset + responseLimit;

  let nextCursor: BangumiBrowseCursor | null;
  if (nextOffset < total) {
    nextCursor = { ...cursor, offset: nextOffset };
  } else {
    nextCursor = nextStreamCursor(cursor);
  }

  return {
    records,
    nextCursor: nextCursor ? serializeCursor(nextCursor) : null,
    done: nextCursor == null,
    step,
    stepTotal,
    label: `${month} 月 · ${category.label}`,
  };
}

export async function searchBangumiAnime(
  keyword: string,
  options: { limit?: number; offset?: number } = {},
): Promise<BangumiAnimeCandidate[]> {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  const limit = Math.max(1, Math.min(Math.trunc(options.limit ?? 10), 20));
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  const url = new URL(BANGUMI_SEARCH_ENDPOINT);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  const payload = await fetchJsonWithTimeout<BangumiSearchResponse>(
    "Bangumi",
    url,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        keyword: trimmed,
        sort: "match",
        filter: {
          type: [2],
          nsfw: false,
        },
      }),
    },
    DEFAULT_TIMEOUT_MS,
  );

  return (payload.data ?? [])
    .filter((subject): subject is BangumiRawSubject => Boolean(subject?.id && subject?.name))
    .map((subject) => ({
      id: subject.id as number,
      name: (subject.name as string).trim(),
      nameCn: subject.name_cn?.trim() || null,
      date: subject.date ?? null,
      platform: subject.platform ?? null,
    }));
}
