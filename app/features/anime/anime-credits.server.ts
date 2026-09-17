import { parseBangumiSurveyCredits, type AnimeSurveyCredits } from "./anime-credits";
import { ensureAnimeSchema } from "./anime.schema.server";
import { fetchJsonWithTimeout } from "./providers/provider-http.server";

const BANGUMI_API_BASE = "https://api.bgm.tv/v0/subjects";
const USER_AGENT = "JockYellow/AnimeMemory (https://github.com/JockYellow/react-router-starter)";
const CACHE_TABLE = "anime_survey_credits_cache";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const creditsSchemaPromises = new WeakMap<object, Promise<void>>();

type RelatedPerson = {
  id?: number;
  name?: string;
  type?: number;
  relation?: string;
};

type CreditCacheRow = {
  studio: string | null;
  directors_json: string;
  fetched_at: number;
};

async function ensureAnimeCreditsCacheSchema(db: D1Database): Promise<void> {
  const key = db as unknown as object;
  const existing = creditsSchemaPromises.get(key);
  if (existing) return existing;

  const pending = db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ${CACHE_TABLE} (
        anime_id INTEGER PRIMARY KEY,
        studio TEXT,
        directors_json TEXT NOT NULL DEFAULT '[]',
        fetched_at INTEGER NOT NULL,
        FOREIGN KEY (anime_id) REFERENCES anime_items(anime_id) ON DELETE CASCADE
      )`,
    )
    .run()
    .then(() => undefined)
    .catch((error) => {
      creditsSchemaPromises.delete(key);
      throw error;
    });
  creditsSchemaPromises.set(key, pending);
  return pending;
}

function parseCachedCredits(row: CreditCacheRow): AnimeSurveyCredits {
  let directors: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.directors_json);
    if (Array.isArray(parsed)) {
      directors = parsed.filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
    }
  } catch {
    directors = [];
  }
  return { studio: row.studio?.trim() || null, directors };
}

export async function getAnimeSurveyCredits(
  db: D1Database,
  animeId: number,
): Promise<AnimeSurveyCredits> {
  await ensureAnimeSchema(db);
  await ensureAnimeCreditsCacheSchema(db);

  const cached = await db
    .prepare(`SELECT studio, directors_json, fetched_at FROM ${CACHE_TABLE} WHERE anime_id = ?`)
    .bind(animeId)
    .first<CreditCacheRow>();
  if (cached && Date.now() - cached.fetched_at < CACHE_TTL_MS) return parseCachedCredits(cached);

  const row = await db
    .prepare("SELECT bangumi_id, studio FROM anime_items WHERE anime_id = ?")
    .bind(animeId)
    .first<{ bangumi_id: number | null; studio: string | null }>();

  if (!row) return { studio: null, directors: [] };
  if (!row.bangumi_id) return { studio: row.studio, directors: [] };

  try {
    const people = await fetchJsonWithTimeout<RelatedPerson[]>(
      "Bangumi",
      `${BANGUMI_API_BASE}/${row.bangumi_id}/persons`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
      },
      8_000,
      { maxRetries: 1, baseDelayMs: 500, maxDelayMs: 1_500, jitterMs: 150 },
    );

    const credits = parseBangumiSurveyCredits(Array.isArray(people) ? people : [], row.studio);
    const now = Date.now();
    await db.batch([
      db
        .prepare(
          `INSERT INTO ${CACHE_TABLE} (anime_id, studio, directors_json, fetched_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(anime_id) DO UPDATE SET
             studio = excluded.studio,
             directors_json = excluded.directors_json,
             fetched_at = excluded.fetched_at`,
        )
        .bind(animeId, credits.studio, JSON.stringify(credits.directors), now),
      db
        .prepare("UPDATE anime_items SET studio = COALESCE(studio, ?), updated_at = ? WHERE anime_id = ?")
        .bind(credits.studio, now, animeId),
    ]);
    return credits;
  } catch {
    // Provider failure is deliberately not cached so the next prefetch/current-card request can retry.
    return { studio: row.studio, directors: [] };
  }
}

export async function prefetchAnimeSurveyCredits(
  db: D1Database,
  animeIds: readonly number[],
  concurrency = 4,
): Promise<Array<{ animeId: number; credits: AnimeSurveyCredits }>> {
  const ids = Array.from(new Set(animeIds.filter((animeId) => Number.isInteger(animeId) && animeId > 0)));
  const results: Array<{ animeId: number; credits: AnimeSurveyCredits }> = [];
  const workers = Math.max(1, Math.min(Math.trunc(concurrency), 6, ids.length || 1));
  let cursor = 0;

  await Promise.all(Array.from({ length: workers }, async () => {
    while (cursor < ids.length) {
      const index = cursor;
      cursor += 1;
      const animeId = ids[index];
      const credits = await getAnimeSurveyCredits(db, animeId);
      results[index] = { animeId, credits };
    }
  }));

  return results.filter(Boolean);
}
