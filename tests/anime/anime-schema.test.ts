import assert from "node:assert/strict";
import test from "node:test";

import { ensureAnimeSchema } from "../../app/features/anime/anime.schema.server";

function fakeSchemaDb(options: { failFirstBatch?: boolean } = {}) {
  const sql: string[] = [];
  let batchCalls = 0;
  let shouldFail = Boolean(options.failFirstBatch);

  const db = {
    prepare(statement: string) {
      sql.push(statement);
      return { statement };
    },
    async batch() {
      batchCalls += 1;
      if (shouldFail) {
        shouldFail = false;
        throw new Error("simulated schema failure");
      }
      return [];
    },
  } as unknown as D1Database;

  return {
    db,
    sql,
    batchCalls: () => batchCalls,
  };
}

test("Anime schema initializes once per D1 binding object", async () => {
  const fake = fakeSchemaDb();
  await ensureAnimeSchema(fake.db);
  await ensureAnimeSchema(fake.db);

  assert.equal(fake.batchCalls(), 1);
  assert.ok(fake.sql.some((statement) => statement.includes("CREATE TABLE IF NOT EXISTS anime_catalog")));
  assert.ok(fake.sql.some((statement) => statement.includes("CREATE TABLE IF NOT EXISTS anime_survey_load_state")));
  assert.ok(fake.sql.some((statement) => statement.includes("CREATE TABLE IF NOT EXISTS anime_seed_queue")));
});

test("Anime schema cache is cleared after a failed initialization", async () => {
  const fake = fakeSchemaDb({ failFirstBatch: true });
  await assert.rejects(ensureAnimeSchema(fake.db), /simulated schema failure/);
  await ensureAnimeSchema(fake.db);

  assert.equal(fake.batchCalls(), 2);
});
