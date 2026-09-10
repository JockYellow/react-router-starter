import { ensureAnimeChineseTitle } from "./anime-chinese-title.server";
import { getSurveyCandidates, type SurveyCandidateRow } from "./anime-survey.server";
import type { AnimeSurveyScope } from "./anime.types";

export async function getSurveyCandidateAtPosition(
  db: D1Database,
  scope: AnimeSurveyScope,
  position: number,
): Promise<SurveyCandidateRow | null> {
  if (!Number.isInteger(position) || position <= 0) return null;

  const candidates = await getSurveyCandidates(db, scope);
  const candidate = candidates.find((item) => item.position === position) ?? null;
  if (!candidate || candidate.titleZhTw) return candidate;

  try {
    const enrichment = await ensureAnimeChineseTitle(db, candidate.anilistId);
    return enrichment.titleZhTw
      ? { ...candidate, titleZhTw: enrichment.titleZhTw }
      : candidate;
  } catch {
    return candidate;
  }
}
