import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceAnimeSurveyQueue,
  mergeAnimeSurveyQueue,
  type AnimeSurveyQueueItem,
} from "../../app/features/anime/anime-survey-queue";

function item(animeId: number, position: number): AnimeSurveyQueueItem {
  return {
    candidate: {
      position,
      animeId,
      malId: null,
      anilistId: null,
      bangumiId: animeId,
      titleZhTw: null,
      titleNative: `Anime ${animeId}`,
      titleRomaji: null,
      titleEnglish: null,
      year: 2025,
      season: "WINTER",
      format: "TV",
      episodes: 12,
      coverUrl: `/api/anime/cover/${animeId}`,
      studio: null,
      popularity: null,
      averageScore: null,
      decisionStatus: null,
      detailStatus: null,
    },
    record: {
      animeId,
      status: null,
      detailStatus: null,
      rating: null,
      note: null,
      tags: [],
    },
  };
}

test("optimistic queue advances immediately without changing remaining order", () => {
  const queue = [item(1, 1), item(2, 2), item(3, 3)];
  assert.deepEqual(
    advanceAnimeSurveyQueue(queue, 1).map((entry) => entry.candidate.animeId),
    [2, 3],
  );
});

test("queue refill deduplicates current items and excludes optimistic answers", () => {
  const queue = [item(2, 2), item(3, 3)];
  const refill = [item(1, 1), item(2, 2), item(3, 3), item(4, 4), item(5, 5), item(6, 6)];
  const merged = mergeAnimeSurveyQueue(queue, refill, new Set([1]), 5);

  assert.deepEqual(merged.map((entry) => entry.candidate.animeId), [2, 3, 4, 5, 6]);
});

test("queue refill keeps the client queue bounded", () => {
  const merged = mergeAnimeSurveyQueue(
    [],
    [item(1, 1), item(2, 2), item(3, 3), item(4, 4), item(5, 5), item(6, 6)],
    new Set(),
    5,
  );

  assert.equal(merged.length, 5);
});
