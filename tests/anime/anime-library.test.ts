import assert from "node:assert/strict";
import test from "node:test";

import {
  animeLibraryOrderBySql,
  buildAnimeLibrarySqlFilter,
  normalizeAnimeLibraryQuery,
} from "../../app/features/anime/anime-library";

test("library query normalizes filters, removes invalid values, and clamps paging", () => {
  const query = normalizeAnimeLibraryQuery({
    search: "  Frieren  ",
    statuses: ["SEEN", "INVALID", "SEEN", "WANT"],
    ratings: ["LOVE", "NOPE", "LOVE"],
    years: [2025, 1800, 2024.9, 2025],
    seasons: ["WINTER", "BAD", "FALL", "WINTER"],
    tags: ["MUSIC_ADDS_A_LOT", "BAD_TAG", "MUSIC_ADDS_A_LOT"],
    sort: "YEAR_DESC",
    limit: 999,
    offset: -4,
  });

  assert.equal(query.search, "Frieren");
  assert.equal(query.normalizedSearch, "frieren");
  assert.deepEqual(query.statuses, ["SEEN", "WANT"]);
  assert.deepEqual(query.ratings, ["LOVE"]);
  assert.deepEqual(query.years, [2025, 2024]);
  assert.deepEqual(query.seasons, ["WINTER", "FALL"]);
  assert.deepEqual(query.tags, ["MUSIC_ADDS_A_LOT"]);
  assert.equal(query.sort, "YEAR_DESC");
  assert.equal(query.limit, 100);
  assert.equal(query.offset, 0);
});

test("library search covers display titles and normalized aliases with escaped LIKE input", () => {
  const query = normalizeAnimeLibraryQuery({ search: "  My_ Hero%!!  " });
  const filter = buildAnimeLibrarySqlFilter(query);

  assert.match(filter.whereSql, /title_zh_tw/);
  assert.match(filter.whereSql, /title_native/);
  assert.match(filter.whereSql, /title_romaji/);
  assert.match(filter.whereSql, /title_english/);
  assert.match(filter.whereSql, /anime_item_aliases/);
  assert.deepEqual(filter.bindings, [
    "%My\\_ Hero\\%!!%",
    "%My\\_ Hero\\%!!%",
    "%My\\_ Hero\\%!!%",
    "%My\\_ Hero\\%!!%",
    "%myhero%",
  ]);
});

test("library SQL filter parameterizes status, rating, year, season, and requires every selected tag", () => {
  const query = normalizeAnimeLibraryQuery({
    statuses: ["SEEN", "NOT_SEEN"],
    ratings: ["FAVORITE", "RECOMMEND"],
    years: [2025, 2024],
    seasons: ["WINTER"],
    tags: ["STORY_ENGAGING", "WANT_REWATCH"],
  });
  const filter = buildAnimeLibrarySqlFilter(query);

  assert.match(filter.whereSql, /d\.status IN \(\?, \?\)/);
  assert.match(filter.whereSql, /e\.rating IN \(\?, \?\)/);
  assert.match(filter.whereSql, /a\.year IN \(\?, \?\)/);
  assert.match(filter.whereSql, /a\.season IN \(\?\)/);
  assert.equal((filter.whereSql.match(/filter_tag\.tag_key = \?/g) ?? []).length, 2);
  assert.deepEqual(filter.bindings, [
    "SEEN",
    "NOT_SEEN",
    "FAVORITE",
    "RECOMMEND",
    2025,
    2024,
    "WINTER",
    "STORY_ENGAGING",
    "WANT_REWATCH",
  ]);
});

test("library sorting is deterministic for recent, title, and year modes", () => {
  assert.match(animeLibraryOrderBySql("RECENT"), /updated_at/);
  assert.match(animeLibraryOrderBySql("TITLE"), /COLLATE NOCASE ASC/);
  assert.match(animeLibraryOrderBySql("YEAR_DESC"), /a\.year DESC/);
});
