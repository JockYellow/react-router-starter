import { ensureAnimeChineseTitle } from "./anime-chinese-title.server";
import { ensureAnimeSchema } from "./anime.schema.server";
import { animeSurveyScopeKey, type AnimeSurveyScope } from "./anime.types";

export type SurveyCandidateRow = {
  position: number;
  animeId: number;
  malId: number | null;
  anilistId: number | null;
  bangumiId: number | null;
  titleZhTw: string | null;
  titleNative: string | null;
  titleRomaji: string | null;
  titleEnglish: string | null;
  year: number | null;
  season: string | null;
  format: string | null;
  episodes: number | null;
  coverUrl: string | null;
  studio: string | null;
  popularity: number | null;
  averageScore: number | null;
  decisionStatus: string | null;
  detailStatus: string | null;
};

export type SurveyScopeSummary = {
  scopeKey: string;
  scopeType: "TV_SEASON" | "MOVIE_YEAR";
  year: number;
  season: string | null;
  candidateCount: number;
  processedCount: number;
  lastPosition: number;
  completed: boolean;
  startedAt: number | null;
  updatedAt: number;
};

type SurveyScopeDbRow = {
  scope_key: string;
  scope_type: "TV_SEASON" | "MOVIE_YEAR";
  year: number;
  season: string | null;
  candidate_count: number;
  processed_count?: number;
  last_position: number;
  completed: number;
  started_at: number | null;
  updated_at: number;
};

type CandidateDbRow = {
  position: number;
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
  popularity: number | null;
  average_score: number | null;
  decision_status: string | null;
  detail_status: string | null;
};

function mapCandidateRow(row: CandidateDbRow): SurveyCandidateRow {
  return {
    position: row.position,
    animeId: row.anime_id,
    malId: row.mal_id,
    anilistId: row.anilist_id,
    bangumiId: row.bangumi_id,
    titleZhTw: row.title_zh_tw,
    titleNative: row.title_native,
    titleRomaji: row.title_romaji,
    titleEnglish: row.title_english,
    year: row.year,
    season: row.season,
    format: row.format,
    episodes: row.episodes,
    coverUrl: row.cover_url,
    studio: row.studio,
    popularity: row.popularity,
    averageScore: row.average_score,
    decisionStatus: row.decision_status,
    detailStatus: row.detail_status,
  };
}

function mapScopeRow(row: SurveyScopeDbRow): SurveyScopeSummary {
  return {
    scopeKey: row.scope_key,
    scopeType: row.scope_type,
    year: row.year,
    season: row.season,
    candidateCount: row.candidate_count,
    processedCount: row.processed_count ?? 0,
    lastPosition: row.last_position,
    completed: row.completed === 1,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
  };
}

async function getExistingScope(db: D1Database, scopeKey: string): Promise<SurveyScopeDbRow | null> {
  return db
    .prepare(
      `SELECT
        p.*,
        COALESCE((
          SELECT SUM(
            CASE
              WHEN d.status IN ('WANT', 'NOT_SEEN') THEN 1
              WHEN d.status = 'SEEN' AND d.detail_status IS NOT NULL AND e.rating IS NOT NULL THEN 1
              ELSE 0
            END
          )
          FROM anime_scope_candidates c
          LEFT JOIN anime_user_decisions d ON d.anime_id = c.anime_id
          LEFT JOIN anime_user_evaluations e ON e.anime_id = c.anime_id
          WHERE c.scope_key = p.scope_key
        ), 0) AS processed_count
      FROM anime_survey_progress p
      WHERE p.scope_key = ?`,
    )
    .bind(scopeKey)
    .first<SurveyScopeDbRow>();
}

export async function ensureSurveyScopeCandidates(
  db: D1Database,
  scope: AnimeSurveyScope,
  _options: { limit?: number } = {},
): Promise<SurveyScopeSummary> {
  await ensureAnimeSchema(db);
  const scopeKey = animeSurveyScopeKey(scope);
  const existing = await getExistingScope(db, scopeKey);
  if (existing) return mapScopeRow(existing);

  // Candidate creation is intentionally centralized in anime-survey-load.server.
  // This prevents a hidden fallback from contacting a second provider or changing
  // a frozen scope ordering without the visible initialization UI.
  throw new Error(`Anime survey scope ${scopeKey} has not been initialized`);
}

const CANDIDATE_SELECT = `
  SELECT
    c.position,
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
    a.popularity,
    a.average_score,
    d.status AS decision_status,
    d.detail_status
  FROM anime_scope_candidates c
  JOIN anime_items a ON a.anime_id = c.anime_id
  LEFT JOIN anime_user_decisions d ON d.anime_id = c.anime_id`;

export async function getSurveyCandidates(
  db: D1Database,
  scope: AnimeSurveyScope,
): Promise<SurveyCandidateRow[]> {
  await ensureAnimeSchema(db);
  const scopeKey = animeSurveyScopeKey(scope);
  const result = await db
    .prepare(`${CANDIDATE_SELECT} WHERE c.scope_key = ? ORDER BY c.position ASC`)
    .bind(scopeKey)
    .all<CandidateDbRow>();
  return (result.results ?? []).map(mapCandidateRow);
}

export async function getNextUnresolvedSurveyCandidate(
  db: D1Database,
  scope: AnimeSurveyScope,
): Promise<SurveyCandidateRow | null> {
  await ensureAnimeSchema(db);
  const scopeKey = animeSurveyScopeKey(scope);

  const row = await db
    .prepare(
      `${CANDIDATE_SELECT}
       LEFT JOIN anime_user_evaluations e ON e.anime_id = c.anime_id
       WHERE c.scope_key = ?
         AND (
           d.anime_id IS NULL
           OR (d.status = 'SEEN' AND (d.detail_status IS NULL OR e.rating IS NULL))
         )
       ORDER BY c.position ASC
       LIMIT 1`,
    )
    .bind(scopeKey)
    .first<CandidateDbRow>();

  if (!row) return null;
  const candidate = mapCandidateRow(row);
  if (candidate.titleZhTw) return candidate;

  try {
    const enrichment = await ensureAnimeChineseTitle(db, candidate.animeId);
    return enrichment.titleZhTw ? { ...candidate, titleZhTw: enrichment.titleZhTw } : candidate;
  } catch {
    return candidate;
  }
}

export async function refreshSurveyProgress(
  db: D1Database,
  scope: AnimeSurveyScope,
): Promise<SurveyScopeSummary | null> {
  await ensureAnimeSchema(db);
  const scopeKey = animeSurveyScopeKey(scope);
  const now = Date.now();

  const stats = await db
    .prepare(
      `SELECT
        COUNT(*) AS candidate_count,
        COALESCE(SUM(
          CASE
            WHEN d.status IN ('WANT', 'NOT_SEEN') THEN 1
            WHEN d.status = 'SEEN' AND d.detail_status IS NOT NULL AND e.rating IS NOT NULL THEN 1
            ELSE 0
          END
        ), 0) AS processed_count,
        COALESCE(MAX(
          CASE
            WHEN d.status IN ('WANT', 'NOT_SEEN') THEN c.position
            WHEN d.status = 'SEEN' AND d.detail_status IS NOT NULL AND e.rating IS NOT NULL THEN c.position
            ELSE 0
          END
        ), 0) AS last_position
      FROM anime_scope_candidates c
      LEFT JOIN anime_user_decisions d ON d.anime_id = c.anime_id
      LEFT JOIN anime_user_evaluations e ON e.anime_id = c.anime_id
      WHERE c.scope_key = ?`,
    )
    .bind(scopeKey)
    .first<{ candidate_count: number; processed_count: number; last_position: number }>();

  if (!stats) return null;
  const completed = stats.candidate_count > 0 && stats.processed_count >= stats.candidate_count;

  await db
    .prepare(
      `UPDATE anime_survey_progress
       SET candidate_count = ?, last_position = ?, completed = ?, updated_at = ?
       WHERE scope_key = ?`,
    )
    .bind(stats.candidate_count, stats.last_position, completed ? 1 : 0, now, scopeKey)
    .run();

  const updated = await getExistingScope(db, scopeKey);
  return updated ? mapScopeRow(updated) : null;
}
