import assert from "node:assert/strict";
import test from "node:test";

import {
  compareAnimeSurveyRecognitionRank,
  type AnimeSurveyRankCandidate,
} from "../../app/features/anime/anime-survey-ranking";

function candidate(
  animeId: number,
  collection: number | null,
  score: number | null,
  format: string | null,
  position: number,
): AnimeSurveyRankCandidate {
  return {
    animeId,
    bangumiCollectionTotal: collection,
    bangumiAverageScore: score,
    format,
    existingPosition: position,
  };
}

test("survey recognition ranking uses Bangumi collection count before score", () => {
  const rows = [
    candidate(1, 500, 100, "TV", 1),
    candidate(2, 800, 60, "ONA", 2),
  ].sort(compareAnimeSurveyRecognitionRank);

  assert.deepEqual(rows.map((row) => row.animeId), [2, 1]);
});

test("survey recognition ranking uses Bangumi score only as the secondary tie-breaker", () => {
  const rows = [
    candidate(1, 800, 70, "TV", 1),
    candidate(2, 800, 90, "ONA", 2),
  ].sort(compareAnimeSurveyRecognitionRank);

  assert.deepEqual(rows.map((row) => row.animeId), [2, 1]);
});

test("survey recognition ranking uses TV only after collection and score tie", () => {
  const rows = [
    candidate(1, 800, 90, "ONA", 1),
    candidate(2, 800, 90, "TV", 2),
  ].sort(compareAnimeSurveyRecognitionRank);

  assert.deepEqual(rows.map((row) => row.animeId), [2, 1]);
});

test("survey recognition ranking preserves provider order after all recognition signals tie", () => {
  const rows = [
    candidate(2, null, null, null, 2),
    candidate(1, null, null, null, 1),
  ].sort(compareAnimeSurveyRecognitionRank);

  assert.deepEqual(rows.map((row) => row.animeId), [1, 2]);
});
