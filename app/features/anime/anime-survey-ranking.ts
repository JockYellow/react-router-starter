export type AnimeSurveyRankCandidate = {
  animeId: number;
  bangumiCollectionTotal: number | null;
  bangumiAverageScore: number | null;
  format: string | null;
  existingPosition: number;
};

function numericOrZero(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatPriority(format: string | null): number {
  return format === "TV" ? 0 : 1;
}

/**
 * Orders a newly-created TV-season scope by Bangumi recognition/popularity.
 *
 * Collection count is the primary signal, Bangumi score is the secondary
 * tie-breaker, TV receives a final small deterministic preference over WEB/ONA,
 * and the original provider order is preserved after that.
 *
 * @param left - First candidate.
 * @param right - Second candidate.
 * @returns Negative when left should appear earlier, positive when right should.
 */
export function compareAnimeSurveyRecognitionRank(
  left: AnimeSurveyRankCandidate,
  right: AnimeSurveyRankCandidate,
): number {
  const collectionDelta = numericOrZero(right.bangumiCollectionTotal)
    - numericOrZero(left.bangumiCollectionTotal);
  if (collectionDelta !== 0) return collectionDelta;

  const scoreDelta = numericOrZero(right.bangumiAverageScore)
    - numericOrZero(left.bangumiAverageScore);
  if (scoreDelta !== 0) return scoreDelta;

  const formatDelta = formatPriority(left.format) - formatPriority(right.format);
  if (formatDelta !== 0) return formatDelta;

  return left.existingPosition - right.existingPosition;
}
