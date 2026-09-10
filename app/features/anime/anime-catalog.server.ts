import { distinctAnimeAliases, normalizeAnimeAlias } from "./anime-title";
import { ensureAnimeSchema } from "./anime.schema.server";
import type { AniListAnime } from "./providers/anilist.server";

export type CacheAniListOptions = {
  titleZhTw?: string | null;
};

type AliasInput = {
  alias: string;
  source: string;
  language: string | null;
  isPrimary: boolean;
};

function buildAniListAliases(anime: AniListAnime, titleZhTw?: string | null): AliasInput[] {
  const inputs: AliasInput[] = [];

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
  add(anime.title.romaji, "anilist:title:romaji", "romaji", !titleZhTw);
  add(anime.title.english, "anilist:title:english", "en");
  add(anime.title.native, "anilist:title:native", "native");
  for (const synonym of anime.synonyms) {
    add(synonym, "anilist:synonym", null);
  }

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

export async function cacheAniListAnime(
  db: D1Database,
  anime: AniListAnime,
  options: CacheAniListOptions = {},
): Promise<void> {
  await ensureAnimeSchema(db);

  const now = Date.now();
  const titleZhTw = options.titleZhTw?.trim() || null;

  await db
    .prepare(
      `INSERT INTO anime_catalog (
        anilist_id,
        mal_id,
        title_zh_tw,
        title_native,
        title_romaji,
        title_english,
        year,
        season,
        format,
        episodes,
        cover_url,
        studio,
        genres_json,
        popularity,
        average_score,
        provider_updated_at,
        synced_at,
        created_at,
        updated_at
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

  const aliases = buildAniListAliases(anime, titleZhTw);
  if (!aliases.length) return;

  await db.batch(
    aliases.map((input) =>
      db
        .prepare(
          `INSERT INTO anime_aliases (
            anilist_id,
            alias,
            normalized_alias,
            source,
            language,
            is_primary,
            created_at
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

export async function cacheAniListAnimeBatch(
  db: D1Database,
  anime: readonly AniListAnime[],
): Promise<void> {
  for (const record of anime) {
    await cacheAniListAnime(db, record);
  }
}
