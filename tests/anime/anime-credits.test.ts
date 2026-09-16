import assert from "node:assert/strict";
import test from "node:test";

import { parseBangumiSurveyCredits } from "../../app/features/anime/anime-credits";

test("survey credits pick animation studio and director relations", () => {
  const credits = parseBangumiSurveyCredits([
    { name: "Studio A", type: 2, relation: "动画制作" },
    { name: "Director A", type: 1, relation: "导演" },
    { name: "Director B", type: 1, relation: "總導演" },
    { name: "Composer", type: 1, relation: "音乐" },
  ]);

  assert.equal(credits.studio, "Studio A");
  assert.deepEqual(credits.directors, ["Director A", "Director B"]);
});

test("survey credits accept traditional and Japanese relation labels", () => {
  const credits = parseBangumiSurveyCredits([
    { name: "Studio B", relation: "動畫製作" },
    { name: "Director C", relation: "監督" },
    { name: "Studio C", relation: "アニメーション制作" },
  ]);

  assert.equal(credits.studio, "Studio B");
  assert.deepEqual(credits.directors, ["Director C"]);
});

test("survey credits fall back to stored studio and tolerate missing staff", () => {
  assert.deepEqual(parseBangumiSurveyCredits([], "Existing Studio"), {
    studio: "Existing Studio",
    directors: [],
  });
});

test("survey credits deduplicate repeated people", () => {
  const credits = parseBangumiSurveyCredits([
    { name: "Director A", relation: "导演" },
    { name: "Director A", relation: "导演" },
  ]);

  assert.deepEqual(credits.directors, ["Director A"]);
});
