import { ensureAnimeSchema } from "./anime.schema.server";
import { ANIME_SEASONS, type AnimeSeason } from "./anime.types";

export const ANIME_MEMORY_START_YEAR = 2011;

export type AnimeDashboardStats = {
  seen: number;
  want: number;
  favorite: number;
};

export type AnimeSeasonProgressCell = {
  year: number;
  season: AnimeSeason;
  candidateCount: number;
  processedCount: number;
  completed: boolean;
  started: boolean;
  updatedAt: number | null;
};

export type AnimeRecentRecord = {
  anilistId: number;
  title: string;
  status: string;
  detailStatus: string | null;
  rating: string | null;
  coverUrl: string | null;
  updatedAt: number;
};

export type AnimeDashboardData = {
  stats: AnimeDashboardStats;
  seasons: AnimeSeasonProgressCell[];
  recent: AnimeRecentRecord[];
  latestScope: AnimeSeasonProgressCell | null;
};

type ScopeRow = {
  year: number;
  season: AnimeSeason;
  candidate_count: number;
  processed_count: number;
  completed: number;
  updated_at: number;
};

export async function getAnimeDashboardData(
  db: D1Database,
  options: { startYear?: number; endYear?: number } = {},
): Promise<AnimeDashboardData> {
  await ensureAnimeSchema(db);

  const startYear = Math.max(1901, Math.trunc(options.startYear ?? ANIME_MEMORY_START_YEAR));
  const endYear = Math.max(startYear, Math.trunc(options.endYear ?? new Date().getFullYear()));

  const [decisionCounts, favoriteCount, scopeResult, recentResult] = await Promise.all([
    db
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN status = 'SEEN' THEN 1 ELSE 0 END), 0) AS seen,
          COALESCE(SUM(CASE WHEN status = 'WANT' THEN 1 ELSE 0 END), 0) AS want
        FROM anime_decisions`,
      )
      .first<{ seen: number; want: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM anime_evaluations WHERE rating = 'FAVORITE'")
      .first<{ count: number }>(),
    db
      .prepare(
        `SELECT
          p.year,
          p.season,
          p.candidate_count,
          COALESCE(SUM(
            CASE
              WHEN d.status IN ('WANT', 'NOT_SEEN') THEN 1
              WHEN d.status = 'SEEN' AND d.detail_status IS NOT NULL AND e.rating IS NOT NULL THEN 1
              ELSE 0
            END
          ), 0) AS processed_count,
          p.completed,
          p.updated_at
        FROM anime_survey_progress p
        LEFT JOIN anime_survey_candidates c ON c.scope_key = p.scope_key
        LEFT JOIN anime_decisions d ON d.anilist_id = c.anilist_id
        LEFT JOIN anime_evaluations e ON e.anilist_id = c.anilist_id
        WHERE p.scope_type = 'TV_SEASON'
          AND p.year BETWEEN ? AND ?
        GROUP BY p.scope_key
        ORDER BY p.updated_at DESC`,
      )
      .bind(startYear, endYear)
      .all<ScopeRow>(),
    db
      .prepare(
        `SELECT
          a.anilist_id,
          COALESCE(a.title_zh_tw, a.title_native, a.title_romaji, a.title_english, '未命名作品') AS title,
          d.status,
          d.detail_status,
          e.rating,
          a.cover_url,
          MAX(d.updated_at, COALESCE(e.updated_at, 0)) AS updated_at
        FROM anime_decisions d
        JOIN anime_catalog a ON a.anilist_id = d.anilist_id
        LEFT JOIN anime_evaluations e ON e.anilist_id = d.anilist_id
        ORDER BY updated_at DESC
        LIMIT 8`,
      )
      .all<{
        anilist_id: number;
        title: string;
        status: string;
        detail_status: string | null;
        rating: string | null;
        cover_url: string | null;
        updated_at: number;
      }>(),
  ]);

  const scopeMap = new Map<string, ScopeRow>();
  for (const row of scopeResult.results ?? []) {
    scopeMap.set(`${row.year}:${row.season}`, row);
  }

  const seasons: AnimeSeasonProgressCell[] = [];
  for (let year = endYear; year >= startYear; year -= 1) {
    for (const season of ANIME_SEASONS) {
      const existing = scopeMap.get(`${year}:${season}`);
      seasons.push({
        year,
        season,
        candidateCount: existing?.candidate_count ?? 0,
        processedCount: existing?.processed_count ?? 0,
        completed: existing?.completed === 1,
        started: Boolean(existing),
        updatedAt: existing?.updated_at ?? null,
      });
    }
  }

  const latestRow = (scopeResult.results ?? [])[0] ?? null;
  const latestScope = latestRow
    ? seasons.find((cell) => cell.year === latestRow.year && cell.season === latestRow.season) ?? null
    : null;

  return {
    stats: {
      seen: decisionCounts?.seen ?? 0,
      want: decisionCounts?.want ?? 0,
      favorite: favoriteCount?.count ?? 0,
    },
    seasons,
    recent: (recentResult.results ?? []).map((row) => ({
      anilistId: row.anilist_id,
      title: row.title,
      status: row.status,
      detailStatus: row.detail_status,
      rating: row.rating,
      coverUrl: row.cover_url,
      updatedAt: row.updated_at,
    })),
    latestScope,
  };
}
