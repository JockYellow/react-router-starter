import assert from "node:assert/strict";
import test from "node:test";

import {
  animeWatchlistOrderBySql,
  buildAnimeWatchlistSearchFilter,
  normalizeAnimeWatchlistQuery,
  sanitizeAnimeWatchlistReturnTo,
} from "../../app/features/anime/anime-watchlist";

test("watchlist query normalizes search, sort, and paging", () => {
  const query = normalizeAnimeWatchlistQuery({
    search: "  Frieren  ",
    sort: "SCORE_DESC",
    limit: 999,
    offset: -3,
  });

  assert.equal(query.search, "Frieren");
  assert.equal(query.normalizedSearch, "frieren");
  assert.equal(query.sort, "SCORE_DESC");
  assert.equal(query.limit, 100);
  assert.equal(query.offset, 0);
});

test("watchlist rejects unknown sorts instead of introducing provider popularity mixing", () => {
  const query = normalizeAnimeWatchlistQuery({ sort: "POPULARITY_DESC" });
  assert.equal(query.sort, "ADDED_DESC");
});

test("watchlist search covers display titles and aliases with escaped LIKE input", () => {
  const query = normalizeAnimeWatchlistQuery({ search: "My_ Hero%!!" });
  const filter = buildAnimeWatchlistSearchFilter(query);

  assert.match(filter.sql, /title_zh_tw/);
  assert.match(filter.sql, /anime_item_aliases/);
  assert.deepEqual(filter.bindings, [
    "%My\\_ Hero\\%!!%",
    "%My\\_ Hero\\%!!%",
    "%My\\_ Hero\\%!!%",
    "%My\\_ Hero\\%!!%",
    "%myhero%",
  ]);
});

test("watchlist sorting is deterministic", () => {
  assert.match(animeWatchlistOrderBySql("ADDED_DESC"), /d\.updated_at DESC/);
  assert.match(animeWatchlistOrderBySql("YEAR_DESC"), /a\.year DESC/);
  assert.match(animeWatchlistOrderBySql("SCORE_DESC"), /average_score/);
});

test("watchlist return path remains same-origin and list-scoped", () => {
  assert.equal(sanitizeAnimeWatchlistReturnTo("/anime/watchlist"), "/anime/watchlist");
  assert.equal(
    sanitizeAnimeWatchlistReturnTo("/anime/watchlist?q=Frieren&offset=48"),
    "/anime/watchlist?q=Frieren&offset=48",
  );
  assert.equal(sanitizeAnimeWatchlistReturnTo("https://example.com"), "/anime/watchlist");
  assert.equal(sanitizeAnimeWatchlistReturnTo("/anime/library"), "/anime/watchlist");
});
