import assert from "node:assert/strict";
import test from "node:test";

import { resolveAnimeWatchlistView } from "../../app/features/anime/anime-watchlist-view";

test("watchlist defaults to ordered queues, including after stale action redirect", () => {
  assert.equal(resolveAnimeWatchlistView(new URLSearchParams()), "QUEUE");
  assert.equal(resolveAnimeWatchlistView(new URLSearchParams("stale=1")), "QUEUE");
});

test("explicit full view or searching and sorting uses legacy complete list", () => {
  assert.equal(resolveAnimeWatchlistView(new URLSearchParams("view=all")), "ALL");
  assert.equal(resolveAnimeWatchlistView(new URLSearchParams("q=Frieren")), "ALL");
  assert.equal(resolveAnimeWatchlistView(new URLSearchParams("sort=SCORE_DESC")), "ALL");
  assert.equal(resolveAnimeWatchlistView(new URLSearchParams("offset=48")), "ALL");
});
