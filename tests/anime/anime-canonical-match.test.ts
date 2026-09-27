import assert from "node:assert/strict";
import test from "node:test";

import {
  findCanonicalAnimeId,
  findCanonicalAnimeIdByExternalIds,
  findUniqueCanonicalAnimeIdByExactAliases,
} from "../../app/features/anime/anime-canonical-match.server";

type FakeOptions = {
  external?: Partial<Record<"mal_id" | "anilist_id" | "bangumi_id", Record<number, number>>>;
  aliases?: Record<string, number[]>;
};

function fakeDb(options: FakeOptions = {}) {
  const queried: Array<{ sql: string; values: unknown[] }> = [];

  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          queried.push({ sql, values });
          return {
            async first<T>() {
              const column = (["mal_id", "anilist_id", "bangumi_id"] as const)
                .find((candidate) => sql.includes(`WHERE ${candidate} = ?`));
              if (!column) return null;
              const key = Number(values[0]);
              const animeId = options.external?.[column]?.[key];
              return (animeId ? { anime_id: animeId } : null) as T | null;
            },
            async all<T>() {
              if (!sql.includes("anime_item_aliases")) return { results: [] as T[] };
              const key = `${String(values[0])}:${String(values[1])}`;
              const ids = options.aliases?.[key] ?? [];
              return { results: ids.map((anime_id) => ({ anime_id })) as T[] };
            },
            async run() {
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
    async batch() {
      return [];
    },
  } as unknown as D1Database;

  return { db, queried };
}

test("canonical matcher prefers exact external ids before title aliases", async () => {
  const fake = fakeDb({
    external: {
      anilist_id: { 42: 9001 },
      bangumi_id: { 88: 9002 },
    },
    aliases: {
      "testwork:2020": [9999],
    },
  });

  const animeId = await findCanonicalAnimeId(fake.db, {
    externalIds: { anilistId: 42, bangumiId: 88 },
    aliases: ["Test Work"],
    year: 2020,
  });

  assert.equal(animeId, 9001);
  assert.equal(
    fake.queried.some((query) => query.sql.includes("anime_item_aliases")),
    false,
  );
});

test("canonical matcher accepts one unique exact normalized alias in a compatible year", async () => {
  const fake = fakeDb({
    aliases: {
      "testwork:2020": [123],
      "テスト作品:2020": [123],
    },
  });

  const animeId = await findUniqueCanonicalAnimeIdByExactAliases(
    fake.db,
    [" Test Work ", "TEST WORK", "テスト作品"],
    2020,
  );

  assert.equal(animeId, 123);
});

test("canonical matcher refuses ambiguous aliases", async () => {
  const fake = fakeDb({
    aliases: {
      "testwork:2020": [123, 456],
    },
  });

  const animeId = await findUniqueCanonicalAnimeIdByExactAliases(
    fake.db,
    ["Test Work"],
    2020,
  );

  assert.equal(animeId, null);
});

test("canonical matcher refuses alias reconciliation without a reliable year", async () => {
  const fake = fakeDb({
    aliases: {
      "testwork:undefined": [123],
    },
  });

  const animeId = await findUniqueCanonicalAnimeIdByExactAliases(
    fake.db,
    ["Test Work"],
    null,
  );

  assert.equal(animeId, null);
  assert.equal(
    fake.queried.some((query) => query.sql.includes("anime_item_aliases")),
    false,
  );
});

test("external-id lookup ignores invalid ids", async () => {
  const fake = fakeDb({
    external: {
      mal_id: { 10: 500 },
    },
  });

  assert.equal(
    await findCanonicalAnimeIdByExternalIds(fake.db, {
      malId: -1,
      anilistId: 0,
      bangumiId: null,
    }),
    null,
  );
});
