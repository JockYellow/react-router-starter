import { cacheAniListAnimeBatch } from "./anime-catalog.server";
import { ensureAnimeSchema } from "./anime.schema.server";
import type { AnimeSurveyLoadState } from "./anime-survey-load.server";
import { animeSurveyScopeKey, type AnimeSurveyScope } from "./anime.types";
import type { AniListAnime } from "./providers/anilist.server";

const PAGE_SIZE = 50;
const LOAD_LOCK_MS = 30_000;
const ALLOWED_FORMATS = new Set(["TV", "TV_SHORT", "ONA"]);

type LoadStateDbRow = {
  scope_key: string;
  phase: "FETCHING_PROVIDER" | "BUILDING_SCOPE" | "READY" | "ERROR";
  target_count: number;
  fetched_count: number;
  next_page: number;
  retry_count: number;
  locked_until: number | null;
  last_error: string | null;
  updated_at: number;
};

function mapLoadState(row: LoadStateDbRow): AnimeSurveyLoadState {
  return {
    scopeKey: row.scope_key,
    phase: row.phase,
    targetCount: row.target_count,
    fetchedCount: row.fetched_count,
    nextPage: row.next_page,
    retryCount: row.retry_count,
    lockedUntil: row.locked_until,
    lastError: row.last_error,
    updatedAt: row.updated_at,
  };
}

async function readLoadState(db: D1Database, scopeKey: string) {
  return db
    .prepare(
      `SELECT scope_key, phase, target_count, fetched_count, next_page,
              retry_count, locked_until, last_error, updated_at
       FROM anime_survey_load_state
       WHERE scope_key = ?`,
    )
    .bind(scopeKey)
    .first<LoadStateDbRow>();
}

export type BrowserLoadClaimResult =
  | { kind: "FETCH_BROWSER"; state: AnimeSurveyLoadState; page: number; perPage: number }
  | { kind: "BUSY" | "READY" | "ERROR"; state: AnimeSurveyLoadState };

export async function claimBrowserSurveyLoadPage(
  db: D1Database,
  scope: AnimeSurveyScope,
): Promise<BrowserLoadClaimResult> {
  await ensureAnimeSchema(db);
  if (scope.type !== "TV_SEASON") throw new Error("Browser provider loading currently supports TV seasons only");

  const scopeKey = animeSurveyScopeKey(scope);
  let state = await readLoadState(db, scopeKey);
  if (!state) throw new Error(`Survey load state ${scopeKey} is missing`);
  if (state.phase === "READY") return { kind: "READY", state: mapLoadState(state) };
  if (state.phase === "ERROR") return { kind: "ERROR", state: mapLoadState(state) };
  if (state.phase !== "FETCHING_PROVIDER") {
    return { kind: "BUSY", state: mapLoadState(state) };
  }

  const now = Date.now();
  if (state.locked_until && state.locked_until > now) {
    return { kind: "BUSY", state: mapLoadState(state) };
  }

  const lockResult = await db
    .prepare(
      `UPDATE anime_survey_load_state
       SET locked_until = ?, updated_at = ?
       WHERE scope_key = ?
         AND phase = 'FETCHING_PROVIDER'
         AND (locked_until IS NULL OR locked_until < ?)`,
    )
    .bind(now + LOAD_LOCK_MS, now, scopeKey, now)
    .run();

  if ((lockResult.meta.changes ?? 0) === 0) {
    const busy = await readLoadState(db, scopeKey);
    if (!busy) throw new Error(`Survey load state ${scopeKey} disappeared`);
    return { kind: "BUSY", state: mapLoadState(busy) };
  }

  state = (await readLoadState(db, scopeKey)) ?? state;
  return {
    kind: "FETCH_BROWSER",
    state: mapLoadState(state),
    page: state.next_page,
    perPage: Math.min(PAGE_SIZE, Math.max(1, state.target_count - state.fetched_count)),
  };
}

function optionalString(value: unknown, maxLength: number): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("Invalid AniList string field");
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) throw new Error("AniList string field is too long");
  return trimmed;
}

function optionalInteger(value: unknown, options: { min?: number; max?: number } = {}): number | null {
  if (value == null) return null;
  if (!Number.isInteger(value)) throw new Error("Invalid AniList integer field");
  const number = value as number;
  if (options.min != null && number < options.min) throw new Error("AniList integer field is below range");
  if (options.max != null && number > options.max) throw new Error("AniList integer field is above range");
  return number;
}

function stringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  if (value.length > maxItems) throw new Error("AniList string array is too large");
  return value
    .map((entry) => optionalString(entry, maxLength))
    .filter((entry): entry is string => Boolean(entry));
}

function validateBrowserRecords(
  value: unknown,
  scope: Extract<AnimeSurveyScope, { type: "TV_SEASON" }>,
): AniListAnime[] {
  if (!Array.isArray(value)) throw new Error("AniList browser payload must be an array");
  if (value.length > PAGE_SIZE) throw new Error("AniList browser payload exceeds page size");

  const seenIds = new Set<number>();
  const records: AniListAnime[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") throw new Error("Invalid AniList record");
    const source = entry as Record<string, unknown>;
    const id = optionalInteger(source.id, { min: 1 });
    if (!id) throw new Error("AniList record is missing a valid id");
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const seasonYear = optionalInteger(source.seasonYear, { min: 1901, max: 2100 });
    const season = optionalString(source.season, 20);
    const format = optionalString(source.format, 40);
    if (seasonYear !== scope.year || season !== scope.season || !format || !ALLOWED_FORMATS.has(format)) {
      throw new Error("AniList record does not match the requested TV season");
    }

    const rawTitle = source.title && typeof source.title === "object"
      ? source.title as Record<string, unknown>
      : {};
    const title = {
      romaji: optionalString(rawTitle.romaji, 500),
      english: optionalString(rawTitle.english, 500),
      native: optionalString(rawTitle.native, 500),
    };
    if (!title.romaji && !title.english && !title.native) {
      throw new Error("AniList record has no usable title");
    }

    const coverUrl = optionalString(source.coverUrl, 2000);
    if (coverUrl) {
      let parsed: URL;
      try {
        parsed = new URL(coverUrl);
      } catch {
        throw new Error("Invalid AniList cover URL");
      }
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("Invalid AniList cover URL protocol");
    }

    records.push({
      id,
      idMal: optionalInteger(source.idMal, { min: 1 }),
      title,
      synonyms: stringArray(source.synonyms, 60, 500),
      season: scope.season,
      seasonYear: scope.year,
      format,
      episodes: optionalInteger(source.episodes, { min: 0, max: 10000 }),
      coverUrl,
      genres: stringArray(source.genres, 40, 150),
      popularity: optionalInteger(source.popularity, { min: 0 }),
      averageScore: optionalInteger(source.averageScore, { min: 0, max: 100 }),
      updatedAt: optionalInteger(source.updatedAt, { min: 0 }),
      studio: optionalString(source.studio, 500),
    });
  }

  return records;
}

export async function ingestBrowserSurveyLoadPage(
  db: D1Database,
  scope: AnimeSurveyScope,
  input: { page: number; hasNextPage: boolean; records: unknown },
) {
  await ensureAnimeSchema(db);
  if (scope.type !== "TV_SEASON") throw new Error("Browser provider loading currently supports TV seasons only");
  const scopeKey = animeSurveyScopeKey(scope);
  const state = await readLoadState(db, scopeKey);
  if (!state) throw new Error(`Survey load state ${scopeKey} is missing`);
  if (state.phase === "READY") return { kind: "READY" as const, state: mapLoadState(state) };
  if (state.phase !== "FETCHING_PROVIDER") throw new Error(`Survey load state is ${state.phase}, not FETCHING_PROVIDER`);

  const page = Math.max(1, Math.trunc(input.page));
  if (page < state.next_page) {
    return { kind: "PROGRESS" as const, state: mapLoadState(state) };
  }
  if (page !== state.next_page) throw new Error(`Unexpected AniList page ${page}; expected ${state.next_page}`);

  const records = validateBrowserRecords(input.records, scope);
  await cacheAniListAnimeBatch(db, records);

  const addedAt = Date.now();
  const startPosition = state.fetched_count + 1;
  if (records.length) {
    await db.batch(
      records.map((anime, index) =>
        db
          .prepare(
            `INSERT OR IGNORE INTO anime_survey_candidates (
              scope_key, anilist_id, position, added_at
            ) VALUES (?, ?, ?, ?)`,
          )
          .bind(scopeKey, anime.id, startPosition + index, addedAt),
      ),
    );
  }

  const countRow = await db
    .prepare("SELECT COUNT(*) AS count FROM anime_survey_candidates WHERE scope_key = ?")
    .bind(scopeKey)
    .first<{ count: number }>();
  const nextFetched = Math.min(state.target_count, countRow?.count ?? state.fetched_count + records.length);
  const providerDone = !input.hasNextPage || records.length === 0 || nextFetched >= state.target_count;
  const nextPhase = providerDone ? "BUILDING_SCOPE" : "FETCHING_PROVIDER";
  const nextTarget = providerDone ? nextFetched : state.target_count;

  await db
    .prepare(
      `UPDATE anime_survey_load_state
       SET phase = ?, resume_phase = NULL,
           target_count = ?, fetched_count = ?, next_page = ?,
           locked_until = NULL, last_error = NULL, updated_at = ?
       WHERE scope_key = ?`,
    )
    .bind(nextPhase, nextTarget, nextFetched, page + 1, Date.now(), scopeKey)
    .run();

  const progress = await readLoadState(db, scopeKey);
  if (!progress) throw new Error(`Survey load state ${scopeKey} disappeared after browser page ${page}`);
  return { kind: "PROGRESS" as const, state: mapLoadState(progress) };
}

export async function recordBrowserSurveyLoadError(
  db: D1Database,
  scope: AnimeSurveyScope,
  input: { page: number; message: string },
) {
  await ensureAnimeSchema(db);
  const scopeKey = animeSurveyScopeKey(scope);
  const page = Math.max(1, Math.trunc(input.page));
  const message = input.message.trim() || "Browser could not reach AniList";
  await db
    .prepare(
      `UPDATE anime_survey_load_state
       SET phase = 'ERROR', resume_phase = 'FETCHING_PROVIDER',
           retry_count = retry_count + 1, locked_until = NULL,
           last_error = ?, updated_at = ?
       WHERE scope_key = ? AND phase = 'FETCHING_PROVIDER' AND next_page = ?`,
    )
    .bind(`瀏覽器直接讀取 AniList 失敗：${message}`.slice(0, 1000), Date.now(), scopeKey, page)
    .run();
  const failed = await readLoadState(db, scopeKey);
  if (!failed) throw new Error(`Survey load state ${scopeKey} is missing`);
  return { kind: "ERROR" as const, state: mapLoadState(failed) };
}
