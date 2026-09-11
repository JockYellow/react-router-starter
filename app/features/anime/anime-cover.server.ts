import { ensureAnimeSchema } from "./anime.schema.server";

const ALLOWED_ANIME_COVER_HOSTS = new Set([
  "lain.bgm.tv",
  "s4.anilist.co",
]);

export function animeCoverProxyPath(animeId: number): string {
  if (!Number.isInteger(animeId) || animeId <= 0) {
    throw new Error("Invalid anime id");
  }
  return `/api/anime/cover/${animeId}`;
}

export function parseAllowedAnimeCoverUrl(value: string | null | undefined): URL | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (!ALLOWED_ANIME_COVER_HOSTS.has(url.hostname)) return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

export async function getAnimeCoverSourceUrl(db: D1Database, animeId: number): Promise<URL | null> {
  await ensureAnimeSchema(db);
  const row = await db
    .prepare("SELECT cover_url FROM anime_items WHERE anime_id = ?")
    .bind(animeId)
    .first<{ cover_url: string | null }>();
  return parseAllowedAnimeCoverUrl(row?.cover_url);
}
