import assert from "node:assert/strict";
import test from "node:test";

import { getAnimeAcceptanceSnapshot } from "../../app/features/anime/anime-acceptance.server";

function fakeAcceptanceDb(counts: Record<string, number>) {
  function lookup(sql: string): number {
    const entries = Object.entries(counts).sort((a, b) => b[0].length - a[0].length);
    for (const [needle, value] of entries) {
      if (sql.includes(needle)) return value;
    }
    return 0;
  }

  function statement(sql: string, values: unknown[] = []) {
    return {
      bind(...next: unknown[]) {
        return statement(sql, next);
      },
      async first<T>() {
        if (sql.includes("COUNT(*) AS count")) {
          return { count: lookup(sql) } as T;
        }
        return null as T | null;
      },
      async all<T>() {
        return { results: [] as T[] };
      },
      async run() {
        return { meta: { changes: 0 } };
      },
      sql,
      values,
    };
  }

  return {
    prepare(sql: string) {
      return statement(sql);
    },
    async batch() {
      return [];
    },
  } as unknown as D1Database;
}

test("acceptance snapshot exposes counts only and derives pending/legacy totals", async () => {
  const db = fakeAcceptanceDb({
    "FROM anime_seed_queue WHERE source = 'netflix'": 12,
    "json_extract(payload_json, '$.resolverVersion')": 9,
    "FROM anime_item_sources WHERE source = 'netflix'": 8,
    "match_status = 'MATCHED'": 5,
    "match_status = 'AMBIGUOUS'": 2,
    "match_status = 'UNMATCHED'": 1,
    "match_status = 'MATCHED'\n         AND anime_id IS NULL": 0,
    "LEFT JOIN anime_user_decisions": 1,
    "JOIN anime_user_decisions": 4,
    "FROM anime_survey_progress p": 7,
    "ordering_version >= ?": 4,
    "ordering_version < ?": 1,
    "missing_metric_count > 0": 2,
  });

  const snapshot = await getAnimeAcceptanceSnapshot(db);

  assert.equal(snapshot.netflix.queueTotal, 12);
  assert.equal(snapshot.netflix.queueResolverCurrent, 9);
  assert.equal(snapshot.netflix.queueResolverLegacy, 3);
  assert.equal(snapshot.netflix.canonicalSourcesTotal, 8);
  assert.equal(snapshot.netflix.canonicalMatched, 5);
  assert.equal(snapshot.netflix.canonicalAmbiguous, 2);
  assert.equal(snapshot.netflix.canonicalUnmatched, 1);
  assert.equal(snapshot.netflix.matchedWithoutAnimeId, 0);
  assert.equal(snapshot.netflix.matchedWithoutDecision, 1);
  assert.equal(snapshot.netflix.matchedWithDecision, 4);

  assert.equal(snapshot.ordering.currentVersion, 2);
  assert.equal(snapshot.ordering.tvScopesWithCandidates, 7);
  assert.equal(snapshot.ordering.scopesCurrent, 4);
  assert.equal(snapshot.ordering.scopesPendingMigration, 3);
  assert.equal(snapshot.ordering.scopesWithMigrationError, 1);
  assert.equal(snapshot.ordering.scopesWithMissingMetrics, 2);
});
