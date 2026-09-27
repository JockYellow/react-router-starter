import { ensureAnimeBangumiMetricsSchema } from "./anime-bangumi-metrics.server";
import { ensureAnimeChineseTitle } from "./anime-chinese-title.server";
import { getAnimeSurveyCredits } from "./anime-credits.server";
import { ensureAnimeSchema } from "./anime.schema.server";

export type AnimeCanonicalTitles = {
  zhTw: string | null;
  native: string | null;
  romaji: string | null;
  english: string | null;
};

export type AnimeCanonicalMetadata = {
  animeId: number;
  malId: number | null;
  anilistId: number | null;
  bangumiId: number | null;
  titles: AnimeCanonicalTitles & { display: string };
  year: number | null;
  season: string | null;
  format: string | null;
  episodes: number | null;
  coverUrl: string | null;
  genres: string[];
  metadataSource: string;
  legacySharedPopularity: number | null;
  bangumi: {
    collectionTotal: number | null;
    averageScore: number | null;
    format: string | null;
    observedAt: number;
  } | null;
  credits: {
    studioRaw: string | null;
    directorsRaw: string[];
  };
};

export type AnimeCanonicalMetadataOptions = {
  enrichChineseTitle?: boolean;
  enrichCredits?: boolean;
};

type MetadataRow = {
  anime_id: number;
  mal_id: number | null;
  anilist_id: number | null;
  bangumi_id: number | null;
  title_zh_tw: string | null;
  title_native: string | null;
  title_romaji: string | null;
  title_english: string | null;
  year: number | null;
  season: string | null;
  format: string | null;
  episodes: number | null;
  cover_url: string | null;
  studio: string | null;
  genres_json: string;
  metadata_source: string;
  popularity: number | null;
  collection_total: number | null;
  bangumi_average_score: number | null;
  bangumi_format: string | null;
  bangumi_observed_at: number | null;
};

function clean(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

export function selectAnimeDisplayTitle(titles: AnimeCanonicalTitles): string {
  return clean(titles.zhTw)
    ?? clean(titles.native)
    ?? clean(titles.romaji)
    ?? clean(titles.english)
    ?? "未命名作品";
}

function parseGenres(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is string => typeof item === "string" && Boolean(item.trim()),
    );
  } catch {
    return [];
  }
}

/**
 * Reads the provider-neutral Anime Memory metadata snapshot.
 *
 * This is the shared read boundary for later survey ordering, presentation and
 * external-history ingestion work. Provider-specific popularity remains in its
 * provider-specific table and is never reinterpreted as a shared score.
 */
export async function getAnimeCanonicalMetadata(
  db: D1Database,
  animeId: number,
  options: AnimeCanonicalMetadataOptions = {},
): Promise<AnimeCanonicalMetadata | null> {
  await ensureAnimeSchema(db);
  await ensureAnimeBangumiMetricsSchema(db);

  if (options.enrichChineseTitle) {
    try {
      await ensureAnimeChineseTitle(db, animeId);
    } catch {
      // Enrichment is best-effort. Canonical cached metadata remains readable.
    }
  }

  let directorsRaw: string[] = [];
  if (options.enrichCredits) {
    const credits = await getAnimeSurveyCredits(db, animeId);
    directorsRaw = credits.directors;
  }

  const row = await db
    .prepare(
      `SELECT
        i.anime_id,
        i.mal_id,
        i.anilist_id,
        i.bangumi_id,
        i.title_zh_tw,
        i.title_native,
        i.title_romaji,
        i.title_english,
        i.year,
        i.season,
        i.format,
        i.episodes,
        i.cover_url,
        i.studio,
        i.genres_json,
        i.metadata_source,
        i.popularity,
        m.collection_total,
        m.average_score AS bangumi_average_score,
        m.format AS bangumi_format,
        m.observed_at AS bangumi_observed_at
      FROM anime_items i
      LEFT JOIN anime_bangumi_metrics m ON m.anime_id = i.anime_id
      WHERE i.anime_id = ?`,
    )
    .bind(animeId)
    .first<MetadataRow>();

  if (!row) return null;

  const titles: AnimeCanonicalTitles = {
    zhTw: clean(row.title_zh_tw),
    native: clean(row.title_native),
    romaji: clean(row.title_romaji),
    english: clean(row.title_english),
  };

  return {
    animeId: row.anime_id,
    malId: row.mal_id,
    anilistId: row.anilist_id,
    bangumiId: row.bangumi_id,
    titles: {
      ...titles,
      display: selectAnimeDisplayTitle(titles),
    },
    year: row.year,
    season: row.season,
    format: row.format,
    episodes: row.episodes,
    coverUrl: row.cover_url,
    genres: parseGenres(row.genres_json),
    metadataSource: row.metadata_source,
    legacySharedPopularity: row.popularity,
    bangumi: row.bangumi_observed_at == null
      ? null
      : {
          collectionTotal: row.collection_total,
          averageScore: row.bangumi_average_score,
          format: row.bangumi_format,
          observedAt: row.bangumi_observed_at,
        },
    credits: {
      studioRaw: clean(row.studio),
      directorsRaw,
    },
  };
}
