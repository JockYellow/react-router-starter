import assert from "node:assert/strict";
import test from "node:test";

import {
  animeSurveyScopeKey,
  ANIME_EVALUATION_TAGS,
} from "../../app/features/anime/anime.types";
import {
  distinctAnimeAliases,
  normalizeAnimeAlias,
} from "../../app/features/anime/anime-title";
import { mapNetflixReviewStatus } from "../../app/features/anime/netflix-seed";

test("survey scope keys are deterministic", () => {
  assert.equal(
    animeSurveyScopeKey({ type: "TV_SEASON", year: 2024, season: "SPRING" }),
    "tv:2024:SPRING",
  );
  assert.equal(
    animeSurveyScopeKey({ type: "MOVIE_YEAR", year: 2024 }),
    "movie:2024",
  );
});

test("anime alias normalization removes presentation differences conservatively", () => {
  assert.equal(normalizeAnimeAlias(" SPY × FAMILY "), "spyxfamily");
  assert.equal(normalizeAnimeAlias("SPY x FAMILY"), "spyxfamily");
  assert.equal(normalizeAnimeAlias("路人超能 100"), "路人超能100");
});

test("distinct aliases dedupe normalized equivalents", () => {
  assert.deepEqual(
    distinctAnimeAliases(["SPY × FAMILY", "SPY x FAMILY", "  スパイファミリー  "]),
    ["SPY × FAMILY", "スパイファミリー"],
  );
});

test("Netflix review statuses map to viewing facts", () => {
  assert.deepEqual(mapNetflixReviewStatus("看完"), {
    include: true,
    status: "SEEN",
    detailStatus: "COMPLETE",
    reason: "MAPPED",
  });
  assert.equal(mapNetflixReviewStatus("看完一季／系列未追完").detailStatus, "SEASON_COMPLETE");
  assert.equal(mapNetflixReviewStatus("看過一部分").detailStatus, "PARTIAL");
  assert.equal(mapNetflixReviewStatus("棄番").detailStatus, "DROPPED");
  assert.deepEqual(mapNetflixReviewStatus("沒看"), {
    include: true,
    status: "NOT_SEEN",
    detailStatus: null,
    reason: "MAPPED",
  });
  assert.equal(mapNetflixReviewStatus("只看特別篇／電影").detailStatus, "MOVIE_ONLY");
});

test("false-positive and deferred Netflix rows are not imported as decisions", () => {
  assert.deepEqual(mapNetflixReviewStatus("誤判"), {
    include: false,
    status: null,
    detailStatus: null,
    reason: "EXCLUDED_FALSE_POSITIVE",
  });
  assert.deepEqual(mapNetflixReviewStatus("之後再確認"), {
    include: false,
    status: null,
    detailStatus: null,
    reason: "DEFERRED",
  });
});

test("initial evaluation tag keys are unique", () => {
  const keys = ANIME_EVALUATION_TAGS.map((tag) => tag.key);
  const labels = ANIME_EVALUATION_TAGS.map((tag) => tag.label);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(new Set(labels).size, labels.length);
  assert.equal(keys.length, 15);
});
