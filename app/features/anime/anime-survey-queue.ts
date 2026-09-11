import type {
  AnimeEvaluationKey,
  AnimeEvaluationTagKey,
  AnimePrimaryStatus,
  AnimeWatchDetail,
} from "./anime.types";

export type AnimeSurveyQueueCandidate = {
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

export type AnimeSurveyQueueRecord = {
  animeId: number;
  status: AnimePrimaryStatus | null;
  detailStatus: AnimeWatchDetail | null;
  rating: AnimeEvaluationKey | null;
  note: string | null;
  tags: AnimeEvaluationTagKey[];
};

export type AnimeSurveyQueueItem = {
  candidate: AnimeSurveyQueueCandidate;
  record: AnimeSurveyQueueRecord;
};

/**
 * Merges refill results into the existing client queue while preserving order.
 *
 * @param current - Current visible/upcoming queue.
 * @param incoming - Server refill candidates in canonical scope order.
 * @param excludedAnimeIds - Optimistically handled ids that must not reappear.
 * @param limit - Maximum client queue size.
 */
export function mergeAnimeSurveyQueue(
  current: readonly AnimeSurveyQueueItem[],
  incoming: readonly AnimeSurveyQueueItem[],
  excludedAnimeIds: ReadonlySet<number>,
  limit = 5,
): AnimeSurveyQueueItem[] {
  const merged: AnimeSurveyQueueItem[] = [];
  const seen = new Set<number>();

  for (const item of [...current, ...incoming]) {
    const animeId = item.candidate.animeId;
    if (excludedAnimeIds.has(animeId) || seen.has(animeId)) continue;
    seen.add(animeId);
    merged.push(item);
    if (merged.length >= limit) break;
  }

  return merged;
}

/**
 * Removes the answered active item from an optimistic queue.
 *
 * @param queue - Current queue.
 * @param animeId - Answered canonical anime id.
 */
export function advanceAnimeSurveyQueue(
  queue: readonly AnimeSurveyQueueItem[],
  animeId: number,
): AnimeSurveyQueueItem[] {
  if (queue[0]?.candidate.animeId === animeId) return queue.slice(1);
  return queue.filter((item) => item.candidate.animeId !== animeId);
}
