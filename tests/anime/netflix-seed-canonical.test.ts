import assert from "node:assert/strict";
import test from "node:test";

import { ensureAnimeSchema } from "../../app/features/anime/anime.schema.server";
import {
  importReviewedNetflixRow,
  NETFLIX_SEED_RESOLVER_VERSION,
} from "../../app/features/anime/netflix-seed.server";
import {
  serializeReviewedNetflixSeedQueueRow,
  upgradeLegacyReviewedNetflixSeedQueue,
} from "../../app/features/anime/netflix-seed-queue.server";

function fakeCanonicalNetflixDb(existingAnimeId = 321) {
  const sql: string[] = [];

  function statement(text: string, values: unknown[] = []) {
    return {
      bind(...next: unknown[]) {
        return statement(text, next);
      },
      async first<T>() {
        if (text.includes("FROM anime_item_sources s")) {
          return { anime_id: existingAnimeId } as T;
        }
        return null as T | null;
      },
      async all<T>() {
        return { results: [] as T[] };
      },
      async run() {
        return { meta: { changes: 1, last_row_id: 0 } };
      },
      text,
      values,
    };
  }

  const db = {
    prepare(text: string) {
      sql.push(text);
      return statement(text);
    },
    async batch() {
      return [];
    },
  } as unknown as D1Database;

  return { db, sql };
}

test("Netflix v2 reuses an existing canonical source and writes only canonical product tables", async () => {
  const fake = fakeCanonicalNetflixDb();
  await ensureAnimeSchema(fake.db);
  fake.sql.length = 0;

  const outcome = await importReviewedNetflixRow(fake.db, {
    title: "測試動畫",
    reviewStatus: "看完",
    lastWatchedAt: "2026-01-02",
  });

  assert.equal(outcome, "MATCHED");
  assert.ok(fake.sql.some((query) => query.includes("INSERT INTO anime_item_sources")));
  assert.ok(fake.sql.some((query) => query.includes("INSERT OR IGNORE INTO anime_user_decisions")));
  assert.ok(fake.sql.some((query) => query.includes("INSERT INTO anime_item_aliases")));
  assert.equal(
    fake.sql.some((query) => /INSERT\s+(?:OR IGNORE\s+)?INTO\s+anime_decisions\b/.test(query)),
    false,
  );
  assert.equal(
    fake.sql.some((query) => /INSERT\s+INTO\s+anime_sources\b/.test(query)),
    false,
  );
});

test("Netflix v2 decision write remains insert-only so manual decisions win", async () => {
  const fake = fakeCanonicalNetflixDb();
  await ensureAnimeSchema(fake.db);
  fake.sql.length = 0;

  await importReviewedNetflixRow(fake.db, {
    title: "Existing Work",
    reviewStatus: "棄番",
  });

  const decisionSql = fake.sql.find((query) => query.includes("anime_user_decisions"));
  assert.ok(decisionSql);
  assert.match(decisionSql, /INSERT OR IGNORE/);
  assert.doesNotMatch(decisionSql, /ON CONFLICT/);
});

test("Netflix queue payload carries resolver version so old staged rows reset once", () => {
  const payload = JSON.parse(serializeReviewedNetflixSeedQueueRow({
    title: "Example",
    reviewStatus: "看完",
  })) as Record<string, unknown>;

  assert.equal(NETFLIX_SEED_RESOLVER_VERSION, 2);
  assert.equal(payload.resolverVersion, 2);
  assert.equal(payload.title, "Example");
});


test("legacy staged Netflix rows are upgraded to v2 and reset to pending before processing", async () => {
  const updates: Array<{ sql: string; values: unknown[] }> = [];
  const oldPayload = JSON.stringify({ title: "Example", reviewStatus: "看完" });

  function statement(sql: string, values: unknown[] = []) {
    return {
      bind(...next: unknown[]) {
        return statement(sql, next);
      },
      async first<T>() {
        return null as T | null;
      },
      async all<T>() {
        if (sql.includes("FROM anime_seed_queue") && sql.includes("ORDER BY id ASC")) {
          return {
            results: [{
              id: 1,
              source_ref: "Example",
              payload_json: oldPayload,
            }] as T[],
          };
        }
        return { results: [] as T[] };
      },
      async run() {
        if (sql.includes("UPDATE anime_seed_queue")) updates.push({ sql, values });
        return { meta: { changes: 1 } };
      },
    };
  }

  const db = {
    prepare(sql: string) {
      return statement(sql);
    },
    async batch() {
      return [];
    },
  } as unknown as D1Database;

  await ensureAnimeSchema(db);
  const upgraded = await upgradeLegacyReviewedNetflixSeedQueue(db);

  assert.equal(upgraded, 1);
  assert.equal(updates.length, 1);
  assert.match(updates[0].sql, /queue_status = 'PENDING'/);
  const payload = JSON.parse(String(updates[0].values[0])) as Record<string, unknown>;
  assert.equal(payload.resolverVersion, 2);
  assert.equal(payload.title, "Example");
});
