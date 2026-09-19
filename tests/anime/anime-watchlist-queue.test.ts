import assert from "node:assert/strict";
import test from "node:test";

import {
  ANIME_WATCHLIST_LANES,
  isAnimeWatchlistLane,
  otherAnimeWatchlistLane,
} from "../../app/features/anime/anime-watchlist-queue";

test("watchlist queues expose only meal and focus lanes", () => {
  assert.deepEqual(ANIME_WATCHLIST_LANES, ["MEAL", "FOCUS"]);
  assert.equal(isAnimeWatchlistLane("MEAL"), true);
  assert.equal(isAnimeWatchlistLane("FOCUS"), true);
  assert.equal(isAnimeWatchlistLane("UNAVAILABLE"), false);
  assert.equal(isAnimeWatchlistLane("PENDING"), false);
});

test("watchlist lane switch is symmetric", () => {
  assert.equal(otherAnimeWatchlistLane("MEAL"), "FOCUS");
  assert.equal(otherAnimeWatchlistLane("FOCUS"), "MEAL");
});
