import assert from "node:assert/strict";
import test from "node:test";

import { fetchJikanSeasonPage } from "../../app/features/anime/providers/jikan.server";

test("Jikan seasonal provider normalizes TV/ONA records and pagination", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        pagination: {
          current_page: 2,
          has_next_page: true,
          last_visible_page: 4,
        },
        data: [
          {
            mal_id: 123,
            title: "Example Romaji",
            title_english: "Example English",
            title_japanese: "例",
            title_synonyms: ["Alt Example"],
            type: "TV",
            episodes: 12,
            score: 8.7,
            members: 54321,
            year: 2011,
            season: "winter",
            images: {
              webp: { large_image_url: "https://cdn.example.test/123.webp" },
              jpg: { large_image_url: "https://cdn.example.test/123.jpg" },
            },
            studios: [{ mal_id: 1, name: "Studio Example" }],
            genres: [{ mal_id: 1, name: "Action" }],
            themes: [{ mal_id: 2, name: "School" }],
          },
          {
            mal_id: 456,
            title: "ONA Example",
            type: "ONA",
            score: null,
            members: 10,
            year: 2011,
            season: "winter",
            images: { jpg: { image_url: "https://cdn.example.test/456.jpg" } },
            studios: [],
            genres: [],
            themes: [],
          },
          {
            mal_id: 789,
            title: "Movie Example",
            type: "Movie",
            score: 9,
            members: 100,
            year: 2011,
            season: "winter",
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }) as typeof fetch;

  try {
    const batch = await fetchJikanSeasonPage({ year: 2011, season: "WINTER", page: 2 });

    assert.match(requestedUrl, /api\.jikan\.moe\/v4\/seasons\/2011\/winter/);
    assert.match(requestedUrl, /page=2/);
    assert.match(requestedUrl, /sfw=true/);
    assert.equal(batch.page, 2);
    assert.equal(batch.hasNextPage, true);
    assert.equal(batch.records.length, 2);

    const tv = batch.records[0];
    assert.equal(tv.provider, "JIKAN");
    assert.equal(tv.providerId, 123);
    assert.equal(tv.malId, 123);
    assert.equal(tv.anilistId, null);
    assert.equal(tv.title.romaji, "Example Romaji");
    assert.equal(tv.title.english, "Example English");
    assert.equal(tv.title.native, "例");
    assert.deepEqual(tv.synonyms, ["Alt Example"]);
    assert.equal(tv.format, "TV");
    assert.equal(tv.averageScore, 87);
    assert.equal(tv.popularity, 54321);
    assert.equal(tv.studio, "Studio Example");
    assert.deepEqual(tv.genres, ["Action", "School"]);
    assert.equal(tv.coverUrl, "https://cdn.example.test/123.webp");

    const ona = batch.records[1];
    assert.equal(ona.providerId, 456);
    assert.equal(ona.format, "ONA");
    assert.equal(ona.averageScore, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
