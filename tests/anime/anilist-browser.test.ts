import assert from "node:assert/strict";
import test from "node:test";

import { fetchAniListSeasonPageFromBrowser } from "../../app/features/anime/providers/anilist-browser";

test("browser AniList fetch normalizes a seasonal page", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    const requestBody = JSON.parse(String(init?.body ?? "{}"));
    assert.equal(requestBody.variables.page, 1);
    assert.equal(requestBody.variables.perPage, 50);
    assert.equal(requestBody.variables.season, "SPRING");
    assert.equal(requestBody.variables.seasonYear, 2014);

    return new Response(JSON.stringify({
      data: {
        Page: {
          pageInfo: { currentPage: 1, hasNextPage: true },
          media: [{
            id: 123,
            idMal: 456,
            title: { romaji: "Example", english: null, native: "例" },
            synonyms: ["Example Alias"],
            season: "SPRING",
            seasonYear: 2014,
            format: "TV",
            episodes: 12,
            coverImage: { extraLarge: "https://example.com/cover.jpg" },
            genres: ["Drama"],
            popularity: 1000,
            averageScore: 80,
            updatedAt: 123456,
            studios: { edges: [{ isMain: true, node: { name: "Example Studio" } }] },
          }],
        },
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    const batch = await fetchAniListSeasonPageFromBrowser({
      year: 2014,
      season: "SPRING",
      page: 1,
      perPage: 50,
    });
    assert.equal(calls, 1);
    assert.equal(batch.page, 1);
    assert.equal(batch.hasNextPage, true);
    assert.equal(batch.records.length, 1);
    assert.equal(batch.records[0]?.id, 123);
    assert.equal(batch.records[0]?.studio, "Example Studio");
    assert.equal(batch.records[0]?.coverUrl, "https://example.com/cover.jpg");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("browser AniList fetch does not retry a 403 manual block", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify({
      errors: [{ message: "You have been manually blocked. Please come to the principal's office.", status: 403 }],
      data: null,
    }), { status: 403, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    await assert.rejects(
      fetchAniListSeasonPageFromBrowser({ year: 2014, season: "SPRING", page: 1, perPage: 50 }),
      /request failed \(403\)/,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
