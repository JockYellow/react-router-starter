import { savePrimaryDecision } from "./anime-record.server";
import { animeSurveyScopeKey, type AnimePrimaryStatus, type AnimeSurveyScope } from "./anime.types";

export type FastSurveyPrimaryStatus = Extract<AnimePrimaryStatus, "WANT" | "NOT_SEEN">;

/**
 * Persists a fast primary answer first. Progress metadata is only touched as a
 * best-effort follow-up, so a derived-progress failure can never turn a
 * successful answer write into a client-visible save failure.
 */
export async function saveFastSurveyPrimaryDecision(
  db: D1Database,
  scope: AnimeSurveyScope,
  animeId: number,
  status: FastSurveyPrimaryStatus,
): Promise<void> {
  await savePrimaryDecision(db, animeId, status);

  const scopeKey = animeSurveyScopeKey(scope);
  const now = Date.now();

  try {
    await db
      .prepare(
        `UPDATE anime_survey_progress
         SET
           last_position = MAX(
             last_position,
             COALESCE(
               (SELECT position
                FROM anime_scope_candidates
                WHERE scope_key = ? AND anime_id = ?),
               last_position
             )
           ),
           updated_at = ?
         WHERE scope_key = ?`,
      )
      .bind(scopeKey, animeId, now, scopeKey)
      .run();
  } catch {
    // The answer row is the source of truth. Loader/dashboard reconciliation can
    // rebuild derived progress later, so this metadata touch must stay non-fatal.
  }
}
