import { animeCoverProxyPath } from "./anime-cover.server";
import { getAnimePersonalRecord, type AnimePersonalRecord } from "./anime-record.server";
import { ensureAnimeSchema } from "./anime.schema.server";
import type { AnimeSeason } from "./anime.types";

export type AnimeLibraryDetail = {
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
  coverUrl: string | null;
  studio: string | null;
  genres: string[];
  metadataSource: string;
  malId: number | null;
  anilistId: number | null;
  bangumiId: number | null;
  record: AnimePersonalRecord;
  updatedAt: number;
};

type DetailRow = {
  anime_id: number;
  mal_id: number | null;
  anilist_id: number | null;
  bangumi_id: number | null;
  title_zh_tw: string | null;
  title_native: string | null;
  title_romaji: string | null;
  title_english: string | null;
  year: number | null;
  season: AnimeSeason | null;
  format: string | null;
  episodes: number | null;
  cover_url: string | null;
  studio: string | null;
  genres_json: string;
  metadata_source: string;
  decision_updated_at: number;
  evaluation_updated_at: number | null;
};

function parseGenres(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  } catch {
    return [];
  }
}

export async function getAnimeLibraryDetail(
  db: D1Database,
  animeId: number,
): Promise<AnimeLibraryDetail | null> {
  await ensureAnimeSchema(db);
  const row = await db
    .prepare(
      `SELECT
        a.anime_id,
        a.mal_id,
        a.anilist_id,
        a.bangumi_id,
        a.title_zh_tw,
        a.title_native,
        a.title_romaji,
        a.title_english,
        a.year,
        a.season,
        a.format,
        a.episodes,
        a.cover_url,
        a.studio,
        a.genres_json,
        a.metadata_source,
        d.updated_at AS decision_updated_at,
        e.updated_at AS evaluation_updated_at
      FROM anime_user_decisions d
      JOIN anime_items a ON a.anime_id = d.anime_id
      LEFT JOIN anime_user_evaluations e ON e.anime_id = d.anime_id
      WHERE a.anime_id = ?`,
    )
    .bind(animeId)
    .first<DetailRow>();

  if (!row) return null;
  const record = await getAnimePersonalRecord(db, animeId);

  return {
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
    coverUrl: row.cover_url ? animeCoverProxyPath(row.anime_id) : null,
    studio: row.studio,
    genres: parseGenres(row.genres_json),
    metadataSource: row.metadata_source,
    malId: row.mal_id,
    anilistId: row.anilist_id,
    bangumiId: row.bangumi_id,
    record,
    updatedAt: Math.max(row.decision_updated_at, row.evaluation_updated_at ?? 0),
  };
}
