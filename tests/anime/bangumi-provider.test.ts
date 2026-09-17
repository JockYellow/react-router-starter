import assert from "node:assert/strict";
import test from "node:test";

import { fetchBangumiSeasonBatch, isExcludedBangumiSeasonTags } from "../../app/features/anime/providers/bangumi.server";

test("Bangumi seasonal provider normalizes TV data and converts Chinese titles to Traditional", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      total: 1,
      limit: 25,
      offset: 0,
      data: [{
        id: 123,
        type: 2,
        name: "テスト作品",
        name_cn: "测试动画",
        date: "2011-01-08",
        platform: "TV",
        eps: 12,
        score: 8.3,
        collection_total: 54321,
        images: { large: "https://lain.bgm.tv/pic/cover/l/example.jpg" },
        tags: [{ name: "科幻" }, { name: "校园" }],
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    const batch = await fetchBangumiSeasonBatch({ year: 2011, season: "WINTER" });

    assert.match(requestedUrl, /api\.bgm\.tv\/v0\/subjects/);
    assert.match(requestedUrl, /type=2/);
    assert.match(requestedUrl, /cat=1/);
    assert.match(requestedUrl, /year=2011/);
    assert.match(requestedUrl, /month=1/);
    assert.match(requestedUrl, /limit=25/);
    assert.match(requestedUrl, /offset=0/);

    assert.equal(batch.done, false);
    assert.equal(batch.step, 1);
    assert.equal(batch.stepTotal, 6);
    assert.equal(batch.label, "1 月 · TV · 第 1–1 筆");
    assert.equal(batch.progressCurrent, 1);
    assert.equal(batch.progressTotal, 1);
    assert.equal(batch.records.length, 1);

    const anime = batch.records[0];
    assert.equal(anime.provider, "BANGUMI");
    assert.equal(anime.providerId, 123);
    assert.equal(anime.bangumiId, 123);
    assert.equal(anime.malId, null);
    assert.equal(anime.anilistId, null);
    assert.equal(anime.title.native, "テスト作品");
    assert.equal(anime.titleZhTw, "測試動畫");
    assert.deepEqual(anime.synonyms, ["测试动画"]);
    assert.equal(anime.season, "WINTER");
    assert.equal(anime.seasonYear, 2011);
    assert.equal(anime.format, "TV");
    assert.equal(anime.episodes, 12);
    assert.equal(anime.averageScore, 83);
    assert.equal(anime.popularity, 54321);
    assert.deepEqual(anime.genres, ["科幻", "校园"]);

    assert.deepEqual(JSON.parse(batch.nextCursor ?? "null"), {
      monthIndex: 0,
      categoryIndex: 1,
      offset: 0,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Bangumi seasonal provider resumes with 25-item pagination before advancing streams", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    total: 130,
    limit: 25,
    offset: 0,
    data: [],
  }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

  try {
    const batch = await fetchBangumiSeasonBatch({ year: 2011, season: "WINTER" });
    assert.equal(batch.done, false);
    assert.deepEqual(JSON.parse(batch.nextCursor ?? "null"), {
      monthIndex: 0,
      categoryIndex: 0,
      offset: 25,
    });
    assert.equal(batch.progressCurrent, 25);
    assert.equal(batch.progressTotal, 130);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Bangumi seasonal provider completes after the third month WEB stream", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    total: 0,
    limit: 25,
    offset: 0,
    data: [],
  }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

  try {
    const batch = await fetchBangumiSeasonBatch({
      year: 2011,
      season: "WINTER",
      cursor: JSON.stringify({ monthIndex: 2, categoryIndex: 1, offset: 0 }),
    });
    assert.equal(batch.step, 6);
    assert.equal(batch.label, "3 月 · WEB");
    assert.equal(batch.done, true);
    assert.equal(batch.nextCursor, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Bangumi seasonal exclusion tags reject Chinese and US animation labels", () => {
  assert.equal(isExcludedBangumiSeasonTags(["科幻", "国产"]), true);
  assert.equal(isExcludedBangumiSeasonTags(["美國動畫"]), true);
  assert.equal(isExcludedBangumiSeasonTags(["日本", "校園"]), false);
});
