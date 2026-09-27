import { resolveBangumiPersonDisplayName } from "./anime-credit-display.server";
import { parseBangumiSurveyCredits, type AnimeSurveyCredits } from "./anime-credits";
import { ensureAnimeSchema } from "./anime.schema.server";
import { fetchJsonWithTimeout } from "./providers/provider-http.server";

const BANGUMI_SUBJECT_API_BASE = "https://api.bgm.tv/v0/subjects";
const BANGUMI_PERSON_API_BASE = "https://api.bgm.tv/v0/persons";
const USER_AGENT = "JockYellow/AnimeMemory (https://github.com/JockYellow/react-router-starter)";
const CACHE_TABLE = "anime_survey_credits_cache";
const STUDIO_IDENTITY_TABLE = "anime_survey_credit_studio_identity";
const PERSON_DISPLAY_TABLE = "anime_credit_person_display_cache";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const creditsSchemaPromises = new WeakMap<object, Promise<void>>();

type RelatedPerson = {
  id?: number;
  name?: string;
  type?: number;
  relation?: string;
};

type PersonDetail = {
  id?: number;
  name?: string;
  infobox?: unknown;
};

type CreditCacheRow = {
  studio: string | null;
  directors_json: string;
  fetched_at: number;
};

type StudioIdentityRow = {
  studio_person_id: number | null;
  studio_raw: string | null;
  observed_at: number;
};

type PersonDisplayRow = {
  raw_name: string;
  display_name: string;
  aliases_json: string;
  fetched_at: number;
};

async function ensureAnimeCreditsCacheSchema(db: D1Database): Promise<void> {
  const key = db as unknown as object;
  const existing = creditsSchemaPromises.get(key);
  if (existing) return existing;

  const pending = db
    .batch([
      db.prepare(
        `CREATE TABLE IF NOT EXISTS ${CACHE_TABLE} (
          anime_id INTEGER PRIMARY KEY,
          studio TEXT,
          directors_json TEXT NOT NULL DEFAULT '[]',
          fetched_at INTEGER NOT NULL,
          FOREIGN KEY (anime_id) REFERENCES anime_items(anime_id) ON DELETE CASCADE
        )`,
      ),
      db.prepare(
        `CREATE TABLE IF NOT EXISTS ${STUDIO_IDENTITY_TABLE} (
          anime_id INTEGER PRIMARY KEY,
          studio_person_id INTEGER,
          studio_raw TEXT,
          observed_at INTEGER NOT NULL,
          FOREIGN KEY (anime_id) REFERENCES anime_items(anime_id) ON DELETE CASCADE
        )`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_anime_survey_credit_studio_person
         ON ${STUDIO_IDENTITY_TABLE} (studio_person_id)`,
      ),
      db.prepare(
        `CREATE TABLE IF NOT EXISTS ${PERSON_DISPLAY_TABLE} (
          bangumi_person_id INTEGER PRIMARY KEY CHECK (bangumi_person_id > 0),
          raw_name TEXT NOT NULL,
          display_name TEXT NOT NULL,
          aliases_json TEXT NOT NULL DEFAULT '[]',
          fetched_at INTEGER NOT NULL
        )`,
      ),
    ])
    .then(() => undefined)
    .catch((error) => {
      creditsSchemaPromises.delete(key);
      throw error;
    });
  creditsSchemaPromises.set(key, pending);
  return pending;
}

function parseDirectors(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      : [];
  } catch {
    return [];
  }
}

function parseCachedCredits(
  row: CreditCacheRow,
  identity: StudioIdentityRow | null,
): AnimeSurveyCredits {
  const studio = row.studio?.trim() || null;
  return {
    studio,
    studioDisplay: studio,
    studioPersonId: identity?.studio_person_id ?? null,
    directors: parseDirectors(row.directors_json),
  };
}

async function readStudioIdentity(
  db: D1Database,
  animeId: number,
): Promise<StudioIdentityRow | null> {
  return db
    .prepare(
      `SELECT studio_person_id, studio_raw, observed_at
       FROM ${STUDIO_IDENTITY_TABLE}
       WHERE anime_id = ?`,
    )
    .bind(animeId)
    .first<StudioIdentityRow>();
}

async function fetchAndCacheRawCredits(
  db: D1Database,
  animeId: number,
  bangumiId: number,
  fallbackStudio: string | null,
): Promise<AnimeSurveyCredits> {
  const people = await fetchJsonWithTimeout<RelatedPerson[]>(
    "Bangumi",
    `${BANGUMI_SUBJECT_API_BASE}/${bangumiId}/persons`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    },
    8_000,
    { maxRetries: 1, baseDelayMs: 500, maxDelayMs: 1_500, jitterMs: 150 },
  );

  const credits = parseBangumiSurveyCredits(Array.isArray(people) ? people : [], fallbackStudio);
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
      .prepare(
        `INSERT INTO ${STUDIO_IDENTITY_TABLE} (
           anime_id, studio_person_id, studio_raw, observed_at
         ) VALUES (?, ?, ?, ?)
         ON CONFLICT(anime_id) DO UPDATE SET
           studio_person_id = excluded.studio_person_id,
           studio_raw = excluded.studio_raw,
           observed_at = excluded.observed_at`,
      )
      .bind(animeId, credits.studioPersonId, credits.studio, now),
    db
      .prepare("UPDATE anime_items SET studio = COALESCE(studio, ?), updated_at = ? WHERE anime_id = ?")
      .bind(credits.studio, now, animeId),
  ]);

  return credits;
}

async function getRawAnimeSurveyCredits(
  db: D1Database,
  animeId: number,
  options: { requireStudioIdentity?: boolean } = {},
): Promise<AnimeSurveyCredits> {
  await ensureAnimeSchema(db);
  await ensureAnimeCreditsCacheSchema(db);

  const [cached, identity, item] = await Promise.all([
    db
      .prepare(`SELECT studio, directors_json, fetched_at FROM ${CACHE_TABLE} WHERE anime_id = ?`)
      .bind(animeId)
      .first<CreditCacheRow>(),
    readStudioIdentity(db, animeId),
    db
      .prepare("SELECT bangumi_id, studio FROM anime_items WHERE anime_id = ?")
      .bind(animeId)
      .first<{ bangumi_id: number | null; studio: string | null }>(),
  ]);

  if (!item) {
    return { studio: null, studioDisplay: null, studioPersonId: null, directors: [] };
  }

  const cacheFresh = Boolean(cached && Date.now() - cached.fetched_at < CACHE_TTL_MS);
  const identityFresh = Boolean(identity && Date.now() - identity.observed_at < CACHE_TTL_MS);

  if (cached && cacheFresh && (!options.requireStudioIdentity || identityFresh)) {
    return parseCachedCredits(cached, identity);
  }

  if (!item.bangumi_id) {
    const studio = cached?.studio?.trim() || item.studio?.trim() || null;
    return {
      studio,
      studioDisplay: studio,
      studioPersonId: identity?.studio_person_id ?? null,
      directors: cached ? parseDirectors(cached.directors_json) : [],
    };
  }

  try {
    return await fetchAndCacheRawCredits(db, animeId, item.bangumi_id, item.studio);
  } catch {
    if (cached) return parseCachedCredits(cached, identity);
    const studio = item.studio?.trim() || null;
    return { studio, studioDisplay: studio, studioPersonId: null, directors: [] };
  }
}

async function resolveStudioDisplay(
  db: D1Database,
  credits: AnimeSurveyCredits,
): Promise<AnimeSurveyCredits> {
  if (!credits.studio || !credits.studioPersonId) return credits;
  const cached = await db
    .prepare(
      `SELECT raw_name, display_name, aliases_json, fetched_at
       FROM ${PERSON_DISPLAY_TABLE}
       WHERE bangumi_person_id = ?`,
    )
    .bind(credits.studioPersonId)
    .first<PersonDisplayRow>();

  if (cached && Date.now() - cached.fetched_at < CACHE_TTL_MS) {
    return { ...credits, studioDisplay: cached.display_name.trim() || credits.studio };
  }

  try {
    const detail = await fetchJsonWithTimeout<PersonDetail>(
      "Bangumi",
      `${BANGUMI_PERSON_API_BASE}/${credits.studioPersonId}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
      },
      8_000,
      { maxRetries: 1, baseDelayMs: 500, maxDelayMs: 1_500, jitterMs: 150 },
    );

    const resolved = resolveBangumiPersonDisplayName(
      credits.studio,
      detail?.infobox,
    );
    const now = Date.now();
    await db
      .prepare(
        `INSERT INTO ${PERSON_DISPLAY_TABLE} (
          bangumi_person_id, raw_name, display_name, aliases_json, fetched_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(bangumi_person_id) DO UPDATE SET
          raw_name = excluded.raw_name,
          display_name = excluded.display_name,
          aliases_json = excluded.aliases_json,
          fetched_at = excluded.fetched_at`,
      )
      .bind(
        credits.studioPersonId,
        resolved.rawName,
        resolved.displayName,
        JSON.stringify(resolved.aliases),
        now,
      )
      .run();

    return { ...credits, studioDisplay: resolved.displayName };
  } catch {
    return credits;
  }
}

export async function getAnimeSurveyCredits(
  db: D1Database,
  animeId: number,
  options: { resolveDisplayName?: boolean } = {},
): Promise<AnimeSurveyCredits> {
  const raw = await getRawAnimeSurveyCredits(db, animeId, {
    requireStudioIdentity: Boolean(options.resolveDisplayName),
  });
  return options.resolveDisplayName ? resolveStudioDisplay(db, raw) : raw;
}

export async function prefetchAnimeSurveyCredits(
  db: D1Database,
  animeIds: readonly number[],
  concurrency = 4,
  options: { resolveDisplayName?: boolean } = {},
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
      const credits = await getAnimeSurveyCredits(db, animeId, options);
      results[index] = { animeId, credits };
    }
  }));

  return results.filter(Boolean);
}
