import { distinctAnimeAliases, normalizeAnimeAlias } from "./anime-title";
import { ensureAnimeSchema } from "./anime.schema.server";
import type { AniListAnime } from "./providers/anilist.server";
import type { AnimeProviderRecord } from "./providers/anime-provider.types";

export type CacheAnimeOptions = {
  titleZhTw?: string | null;
};

type AliasInput = {
  alias: string;
  source: string;
  language: string | null;
  isPrimary: boolean;
};

function buildProviderAliases(record: AnimeProviderRecord, titleZhTw?: string | null): AliasInput[] {
  const inputs: AliasInput[] = [];
  const provider = record.provider.toLowerCase();

  const add = (
    value: string | null | undefined,
    source: string,
    language: string | null,
    isPrimary = false,
  ) => {
    const alias = value?.trim();
    if (!alias) return;
    inputs.push({ alias, source, language, isPrimary });
  };

  add(titleZhTw, "resolved:zh-tw", "zh-TW", true);
  add(record.title.romaji, `${provider}:title:romaji`, "romaji", !titleZhTw);
  add(record.title.english, `${provider}:title:english`, "en");
  add(record.title.native, `${provider}:title:native`, "native");
  for (const synonym of record.synonyms) add(synonym, `${provider}:synonym`, null);

  const distinct = distinctAnimeAliases(inputs.map((input) => input.alias));
  const accepted = new Set(distinct.map(normalizeAnimeAlias));
  const seen = new Set<string>();

  return inputs.filter((input) => {
    const normalized = normalizeAnimeAlias(input.alias);
    if (!accepted.has(normalized) || seen.has(`${input.source}:${normalized}`)) return false;
    seen.add(`${input.source}:${normalized}`);
    return true;
  });
}

async function findAnimeId(db: D1Database, record: AnimeProviderRecord): Promise<number | null> {
  if (record.malId) {
    const byMal = await db
      .prepare("SELECT anime_id FROM anime_items WHERE mal_id = ?")
      .bind(record.malId)
      .first<{ anime_id: number }>();
    if (byMal) return byMal.anime_id;
  }
  if (record.anilistId) {
    const byAniList = await db
      .prepare("SELECT anime_id FROM anime_items WHERE anilist_id = ?")
      .bind(record.anilistId)
      .first<{ anime_id: number }>();
    if (byAniList) return byAniList.anime_id;
  }
  if (record.bangumiId) {
    const byBangumi = await db
      .prepare("SELECT anime_id FROM anime_items WHERE bangumi_id = ?")
      .bind(record.bangumiId)
      .first<{ anime_id: number }>();
    if (byBangumi) return byBangumi.anime_id;
  }
  return null;
}

export async function cacheAnimeProviderRecord(
  db: D1Database,
  record: AnimeProviderRecord,
  options: CacheAnimeOptions = {},
): Promise<number> {
  await ensureAnimeSchema(db);
  const now = Date.now();
  const titleZhTw = options.titleZhTw?.trim() || null;
  let animeId = await findAnimeId(db, record);

  if (animeId) {
    await db
      .prepare(
        `UPDATE anime_items SET
          mal_id = COALESCE(mal_id, ?),
          anilist_id = COALESCE(anilist_id, ?),
          bangumi_id = COALESCE(bangumi_id, ?),
          title_zh_tw = COALESCE(?, title_zh_tw),
          title_native = COALESCE(?, title_native),
          title_romaji = COALESCE(?, title_romaji),
          title_english = COALESCE(?, title_english),
          year = COALESCE(?, year),
          season = COALESCE(?, season),
          format = COALESCE(?, format),
          episodes = COALESCE(?, episodes),
          cover_url = COALESCE(?, cover_url),
          studio = COALESCE(?, studio),
          genres_json = ?,
          popularity = COALESCE(?, popularity),
          average_score = COALESCE(?, average_score),
          metadata_source = ?,
          provider_updated_at = COALESCE(?, provider_updated_at),
          synced_at = ?,
          updated_at = ?
        WHERE anime_id = ?`,
      )
      .bind(
        record.malId,
        record.anilistId,
        record.bangumiId,
        titleZhTw,
        record.title.native,
        record.title.romaji,
        record.title.english,
        record.seasonYear,
        record.season,
        record.format,
        record.episodes,
        record.coverUrl,
        record.studio,
        JSON.stringify(record.genres),
        record.popularity,
        record.averageScore,
        record.provider,
        record.providerUpdatedAt,
        now,
        now,
        animeId,
      )
      .run();
  } else {
    const inserted = await db
      .prepare(
        `INSERT INTO anime_items (
          mal_id, anilist_id, bangumi_id,
          title_zh_tw, title_native, title_romaji, title_english,
          year, season, format, episodes, cover_url, studio, genres_json,
          popularity, average_score, metadata_source, provider_updated_at,
          synced_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING anime_id`,
      )
      .bind(
        record.malId,
        record.anilistId,
        record.bangumiId,
        titleZhTw,
        record.title.native,
        record.title.romaji,
        record.title.english,
        record.seasonYear,
        record.season,
        record.format,
        record.episodes,
        record.coverUrl,
        record.studio,
        JSON.stringify(record.genres),
        record.popularity,
        record.averageScore,
        record.provider,
        record.providerUpdatedAt,
        now,
        now,
        now,
      )
      .first<{ anime_id: number }>();

    if (!inserted?.anime_id) {
      animeId = await findAnimeId(db, record);
      if (!animeId) throw new Error(`Unable to cache ${record.provider} anime ${record.providerId}`);
    } else {
      animeId = inserted.anime_id;
    }
  }

  const aliases = buildProviderAliases(record, titleZhTw);
  if (aliases.length) {
    await db.batch(
      aliases.map((input) =>
        db
          .prepare(
            `INSERT INTO anime_item_aliases (
              anime_id, alias, normalized_alias, source, language, is_primary, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(anime_id, normalized_alias, source) DO UPDATE SET
              alias = excluded.alias,
              language = COALESCE(excluded.language, anime_item_aliases.language),
              is_primary = MAX(anime_item_aliases.is_primary, excluded.is_primary)`,
          )
          .bind(
            animeId,
            input.alias,
            normalizeAnimeAlias(input.alias),
            input.source,
            input.language,
            input.isPrimary ? 1 : 0,
            now,
          ),
      ),
    );
  }

  return animeId;
}

export async function cacheAnimeProviderBatch(
  db: D1Database,
  records: readonly AnimeProviderRecord[],
): Promise<Array<{ animeId: number; record: AnimeProviderRecord }>> {
  const cached: Array<{ animeId: number; record: AnimeProviderRecord }> = [];
  for (const record of records) {
    cached.push({ animeId: await cacheAnimeProviderRecord(db, record), record });
  }
  return cached;
}

function fromAniList(anime: AniListAnime): AnimeProviderRecord {
  return {
    provider: "ANILIST",
    providerId: anime.id,
    malId: anime.idMal,
    anilistId: anime.id,
    bangumiId: null,
    title: anime.title,
    synonyms: anime.synonyms,
    season: anime.season,
    seasonYear: anime.seasonYear,
    format: anime.format,
    episodes: anime.episodes,
    coverUrl: anime.coverUrl,
    genres: anime.genres,
    popularity: anime.popularity,
    averageScore: anime.averageScore,
    providerUpdatedAt: anime.updatedAt,
    studio: anime.studio,
  };
}

// Compatibility path for the still-separate Netflix seed work. It keeps the old
// AniList-keyed tables writable while also populating the provider-neutral catalog.
export async function cacheAniListAnime(
  db: D1Database,
  anime: AniListAnime,
  options: CacheAnimeOptions = {},
): Promise<void> {
  await ensureAnimeSchema(db);
  const now = Date.now();
  const titleZhTw = options.titleZhTw?.trim() || null;

  await db
    .prepare(
      `INSERT INTO anime_catalog (
        anilist_id, mal_id, title_zh_tw, title_native, title_romaji, title_english,
        year, season, format, episodes, cover_url, studio, genres_json,
        popularity, average_score, provider_updated_at, synced_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(anilist_id) DO UPDATE SET
        mal_id = COALESCE(excluded.mal_id, anime_catalog.mal_id),
        title_zh_tw = COALESCE(excluded.title_zh_tw, anime_catalog.title_zh_tw),
        title_native = COALESCE(excluded.title_native, anime_catalog.title_native),
        title_romaji = COALESCE(excluded.title_romaji, anime_catalog.title_romaji),
        title_english = COALESCE(excluded.title_english, anime_catalog.title_english),
        year = COALESCE(excluded.year, anime_catalog.year),
        season = COALESCE(excluded.season, anime_catalog.season),
        format = COALESCE(excluded.format, anime_catalog.format),
        episodes = COALESCE(excluded.episodes, anime_catalog.episodes),
        cover_url = COALESCE(excluded.cover_url, anime_catalog.cover_url),
        studio = COALESCE(excluded.studio, anime_catalog.studio),
        genres_json = excluded.genres_json,
        popularity = COALESCE(excluded.popularity, anime_catalog.popularity),
        average_score = COALESCE(excluded.average_score, anime_catalog.average_score),
        provider_updated_at = COALESCE(excluded.provider_updated_at, anime_catalog.provider_updated_at),
        synced_at = excluded.synced_at,
        updated_at = excluded.updated_at`,
    )
    .bind(
      anime.id,
      anime.idMal,
      titleZhTw,
      anime.title.native,
      anime.title.romaji,
      anime.title.english,
      anime.seasonYear,
      anime.season,
      anime.format,
      anime.episodes,
      anime.coverUrl,
      anime.studio,
      JSON.stringify(anime.genres),
      anime.popularity,
      anime.averageScore,
      anime.updatedAt,
      now,
      now,
      now,
    )
    .run();

  const legacyAliases = buildProviderAliases(fromAniList(anime), titleZhTw);
  if (legacyAliases.length) {
    await db.batch(
      legacyAliases.map((input) =>
        db
          .prepare(
            `INSERT INTO anime_aliases (
              anilist_id, alias, normalized_alias, source, language, is_primary, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(anilist_id, normalized_alias, source) DO UPDATE SET
              alias = excluded.alias,
              language = COALESCE(excluded.language, anime_aliases.language),
              is_primary = MAX(anime_aliases.is_primary, excluded.is_primary)`,
          )
          .bind(
            anime.id,
            input.alias,
            normalizeAnimeAlias(input.alias),
            input.source,
            input.language,
            input.isPrimary ? 1 : 0,
            now,
          ),
      ),
    );
  }

  await cacheAnimeProviderRecord(db, fromAniList(anime), options);
}

export async function cacheAniListAnimeBatch(
  db: D1Database,
  anime: readonly AniListAnime[],
): Promise<void> {
  for (const record of anime) await cacheAniListAnime(db, record);
}
