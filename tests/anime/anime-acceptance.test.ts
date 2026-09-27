import assert from "node:assert/strict";
import test from "node:test";

import { getAnimeAcceptanceSnapshot } from "../../app/features/anime/anime-acceptance.server";

function fakeAcceptanceDb(counts: Record<string, number>) {
  function lookup(sql: string): number {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized.includes("json_extract(payload_json")) return counts.queueResolverCurrent ?? 0;
    if (normalized.includes("FROM anime_seed_queue WHERE source = 'netflix'")) return counts.queueTotal ?? 0;

    if (normalized.includes("FROM anime_item_sources s LEFT JOIN anime_user_decisions")) {
      return counts.matchedWithoutDecision ?? 0;
    }
    if (normalized.includes("FROM anime_item_sources s JOIN anime_user_decisions")) {
      return counts.matchedWithDecision ?? 0;
    }
    if (
      normalized.includes("FROM anime_item_sources")
      && normalized.includes("match_status = 'MATCHED'")
      && normalized.includes("anime_id IS NULL")
    ) return counts.matchedWithoutAnimeId ?? 0;
    if (normalized.includes("FROM anime_item_sources") && normalized.includes("match_status = 'MATCHED'")) {
      return counts.canonicalMatched ?? 0;
    }
    if (normalized.includes("FROM anime_item_sources") && normalized.includes("match_status = 'AMBIGUOUS'")) {
      return counts.canonicalAmbiguous ?? 0;
    }
    if (normalized.includes("FROM anime_item_sources") && normalized.includes("match_status = 'UNMATCHED'")) {
      return counts.canonicalUnmatched ?? 0;
    }
    if (normalized.includes("FROM anime_item_sources WHERE source = 'netflix'")) {
      return counts.canonicalSourcesTotal ?? 0;
    }

    if (normalized.includes("FROM anime_survey_progress p") && !normalized.includes("anime_scope_ordering_state")) {
      return counts.tvScopesWithCandidates ?? 0;
    }
    if (normalized.includes("ordering_version < ?")) return counts.scopesWithMigrationError ?? 0;
    if (normalized.includes("missing_metric_count > 0")) return counts.scopesWithMissingMetrics ?? 0;
    if (normalized.includes("ordering_version >= ?")) return counts.scopesCurrent ?? 0;
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
    queueTotal: 12,
    queueResolverCurrent: 9,
    canonicalSourcesTotal: 8,
    canonicalMatched: 5,
    canonicalAmbiguous: 2,
    canonicalUnmatched: 1,
    matchedWithoutAnimeId: 0,
    matchedWithoutDecision: 1,
    matchedWithDecision: 4,
    tvScopesWithCandidates: 7,
    scopesCurrent: 4,
    scopesWithMigrationError: 1,
    scopesWithMissingMetrics: 2,
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
