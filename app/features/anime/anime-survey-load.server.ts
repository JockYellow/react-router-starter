import { cacheAniListAnimeBatch } from "./anime-catalog.server";
import { ensureAnimeSchema } from "./anime.schema.server";
import { animeSurveyScopeKey, type AnimeSurveyScope } from "./anime.types";
import { fetchAniListSeasonPage } from "./providers/anilist.server";

export const ANIME_SURVEY_LOAD_PHASES = [
  "FETCHING_PROVIDER",
  "BUILDING_SCOPE",
  "READY",
  "ERROR",
] as const;

export type AnimeSurveyLoadPhase = (typeof ANIME_SURVEY_LOAD_PHASES)[number];

export type AnimeSurveyLoadState = {
  scopeKey: string;
  phase: AnimeSurveyLoadPhase;
  targetCount: number;
  fetchedCount: number;
  nextPage: number;
  retryCount: number;
  lockedUntil: number | null;
  lastError: string | null;
  updatedAt: number;
};

type LoadStateDbRow = {
  scope_key: string;
  phase: AnimeSurveyLoadPhase;
  target_count: number;
  fetched_count: number;
  next_page: number;
  retry_count: number;
  locked_until: number | null;
  last_error: string | null;
  updated_at: number;
  resume_phase: "FETCHING_PROVIDER" | "BUILDING_SCOPE" | null;
};

type ProgressDbRow = {
  candidate_count: number;
  completed: number;
};

const PAGE_SIZE = 50;
const LOAD_LOCK_MS = 30_000;

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

async function readLoadState(db: D1Database, scopeKey: string): Promise<LoadStateDbRow | null> {
  return db
    .prepare(
      `SELECT scope_key, phase, target_count, fetched_count, next_page,
              retry_count, locked_until, last_error, updated_at, resume_phase
       FROM anime_survey_load_state
       WHERE scope_key = ?`,
    )
    .bind(scopeKey)
    .first<LoadStateDbRow>();
}

export async function ensureSurveyInitialization(
  db: D1Database,
  scope: AnimeSurveyScope,
  options: { targetCount?: number } = {},
): Promise<{ ready: boolean; state: AnimeSurveyLoadState | null }> {
  await ensureAnimeSchema(db);
  const scopeKey = animeSurveyScopeKey(scope);
  const existingLoad = await readLoadState(db, scopeKey);
  if (existingLoad?.phase === "READY") {
    return { ready: true, state: mapLoadState(existingLoad) };
  }

  const existingProgress = await db
    .prepare("SELECT candidate_count, completed FROM anime_survey_progress WHERE scope_key = ?")
    .bind(scopeKey)
    .first<ProgressDbRow>();

  if (!existingLoad && existingProgress && (existingProgress.candidate_count > 0 || existingProgress.completed === 1)) {
    return { ready: true, state: null };
  }

  if (existingLoad) {
    return { ready: false, state: mapLoadState(existingLoad) };
  }

  const targetCount = Math.max(1, Math.min(Math.trunc(options.targetCount ?? 100), 500));
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO anime_survey_progress (
          scope_key, scope_type, year, season, candidate_count,
          last_position, completed, started_at, updated_at
        ) VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?)`,
      )
      .bind(
        scopeKey,
        scope.type,
        scope.year,
        scope.type === "TV_SEASON" ? scope.season : null,
        now,
        now,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO anime_survey_load_state (
          scope_key, scope_type, year, season, phase, resume_phase,
          target_count, fetched_count, next_page, retry_count,
          locked_until, last_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'FETCHING_PROVIDER', NULL, ?, 0, 1, 0, NULL, NULL, ?, ?)`,
      )
      .bind(
        scopeKey,
        scope.type,
        scope.year,
        scope.type === "TV_SEASON" ? scope.season : null,
        targetCount,
        now,
        now,
      ),
  ]);

  const created = await readLoadState(db, scopeKey);
  if (!created) throw new Error(`Survey load state ${scopeKey} was not created`);
  return { ready: false, state: mapLoadState(created) };
}

export type SurveyLoadStepResult = {
  kind: "PROGRESS" | "BUSY" | "READY" | "ERROR";
  state: AnimeSurveyLoadState;
};

export async function processSurveyLoadStep(
  db: D1Database,
  scope: AnimeSurveyScope,
  options: { targetCount?: number } = {},
): Promise<SurveyLoadStepResult> {
  const initialized = await ensureSurveyInitialization(db, scope, options);
  if (initialized.ready && initialized.state?.phase === "READY") {
    return { kind: "READY", state: initialized.state };
  }
  if (!initialized.state) {
    throw new Error("Survey scope is already initialized without a load state");
  }

  const scopeKey = animeSurveyScopeKey(scope);
  let stateRow = await readLoadState(db, scopeKey);
  if (!stateRow) throw new Error(`Survey load state ${scopeKey} is missing`);
  if (stateRow.phase === "ERROR") return { kind: "ERROR", state: mapLoadState(stateRow) };
  if (stateRow.phase === "READY") return { kind: "READY", state: mapLoadState(stateRow) };

  const now = Date.now();
  if (stateRow.locked_until && stateRow.locked_until > now) {
    return { kind: "BUSY", state: mapLoadState(stateRow) };
  }

  const lockResult = await db
    .prepare(
      `UPDATE anime_survey_load_state
       SET locked_until = ?, updated_at = ?
       WHERE scope_key = ?
         AND phase NOT IN ('READY', 'ERROR')
         AND (locked_until IS NULL OR locked_until < ?)`,
    )
    .bind(now + LOAD_LOCK_MS, now, scopeKey, now)
    .run();

  if ((lockResult.meta.changes ?? 0) === 0) {
    const busyState = await readLoadState(db, scopeKey);
    if (!busyState) throw new Error(`Survey load state ${scopeKey} disappeared`);
    return { kind: "BUSY", state: mapLoadState(busyState) };
  }

  stateRow = (await readLoadState(db, scopeKey)) ?? stateRow;

  try {
    if (stateRow.phase === "BUILDING_SCOPE") {
      const countRow = await db
        .prepare("SELECT COUNT(*) AS count FROM anime_survey_candidates WHERE scope_key = ?")
        .bind(scopeKey)
        .first<{ count: number }>();
      const candidateCount = countRow?.count ?? 0;
      const finishedAt = Date.now();
      await db.batch([
        db
          .prepare(
            `UPDATE anime_survey_progress
             SET candidate_count = ?, completed = ?, updated_at = ?
             WHERE scope_key = ?`,
          )
          .bind(candidateCount, candidateCount === 0 ? 1 : 0, finishedAt, scopeKey),
        db
          .prepare(
            `UPDATE anime_survey_load_state
             SET phase = 'READY', resume_phase = NULL,
                 target_count = ?, fetched_count = ?,
                 locked_until = NULL, last_error = NULL, updated_at = ?
             WHERE scope_key = ?`,
          )
          .bind(candidateCount, candidateCount, finishedAt, scopeKey),
      ]);
      const ready = await readLoadState(db, scopeKey);
      if (!ready) throw new Error(`Survey load state ${scopeKey} disappeared after finalize`);
      return { kind: "READY", state: mapLoadState(ready) };
    }

    if (scope.type !== "TV_SEASON") {
      throw new Error("Progressive loading currently supports TV seasons only");
    }

    const page = stateRow.next_page;
    const batch = await fetchAniListSeasonPage({
      year: scope.year,
      season: scope.season,
      page,
      perPage: Math.min(PAGE_SIZE, Math.max(1, stateRow.target_count - stateRow.fetched_count)),
    });

    await cacheAniListAnimeBatch(db, batch.records);

    const addedAt = Date.now();
    const startPosition = stateRow.fetched_count + 1;
    if (batch.records.length > 0) {
      await db.batch(
        batch.records.map((anime, index) =>
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

    const nextFetched = Math.min(stateRow.target_count, stateRow.fetched_count + batch.records.length);
    const providerDone = !batch.hasNextPage || batch.records.length === 0 || nextFetched >= stateRow.target_count;
    const nextPhase: AnimeSurveyLoadPhase = providerDone ? "BUILDING_SCOPE" : "FETCHING_PROVIDER";
    const nextTarget = providerDone ? nextFetched : stateRow.target_count;

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
    if (!progress) throw new Error(`Survey load state ${scopeKey} disappeared after page ${page}`);
    return { kind: "PROGRESS", state: mapLoadState(progress) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown survey load error";
    await db
      .prepare(
        `UPDATE anime_survey_load_state
         SET phase = 'ERROR', resume_phase = ?, retry_count = retry_count + 1,
             locked_until = NULL, last_error = ?, updated_at = ?
         WHERE scope_key = ?`,
      )
      .bind(stateRow.phase, message.slice(0, 1000), Date.now(), scopeKey)
      .run();
    const failed = await readLoadState(db, scopeKey);
    if (!failed) throw error;
    return { kind: "ERROR", state: mapLoadState(failed) };
  }
}

export async function retrySurveyLoadStep(
  db: D1Database,
  scope: AnimeSurveyScope,
): Promise<AnimeSurveyLoadState> {
  await ensureAnimeSchema(db);
  const scopeKey = animeSurveyScopeKey(scope);
  const now = Date.now();
  await db
    .prepare(
      `UPDATE anime_survey_load_state
       SET phase = COALESCE(resume_phase, 'FETCHING_PROVIDER'),
           resume_phase = NULL, locked_until = NULL, last_error = NULL, updated_at = ?
       WHERE scope_key = ? AND phase = 'ERROR'`,
    )
    .bind(now, scopeKey)
    .run();
  const state = await readLoadState(db, scopeKey);
  if (!state) throw new Error(`Survey load state ${scopeKey} is missing`);
  return mapLoadState(state);
}
