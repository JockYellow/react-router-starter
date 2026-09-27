import assert from "node:assert/strict";
import test from "node:test";

import { resolveBangumiByTitle } from "../../app/features/anime/anime-resolver.server";

test("Bangumi title resolver matches Traditional Netflix title against provider Chinese alias", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    data: [{
      id: 123,
      name: "テストアニメ",
      name_cn: "测试动画",
      date: "2024-01-01",
      platform: "TV",
    }],
  }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

  try {
    const result = await resolveBangumiByTitle("測試動畫");
    assert.equal(result.status, "MATCHED");
    if (result.status === "MATCHED") {
      assert.equal(result.candidate.id, 123);
      assert.equal(result.reason, "EXACT_ALIAS");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Bangumi title resolver refuses multiple exact matches without year evidence", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    data: [
      { id: 1, name: "Same Title", name_cn: "", date: "2020-01-01", platform: "TV" },
      { id: 2, name: "Same Title", name_cn: "", date: "2022-01-01", platform: "TV" },
    ],
  }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

  try {
    const result = await resolveBangumiByTitle("Same Title");
    assert.equal(result.status, "AMBIGUOUS");
    if (result.status === "AMBIGUOUS") {
      assert.equal(result.reason, "MULTIPLE_EXACT_ALIASES");
      assert.equal(result.candidates.length, 2);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Bangumi title resolver does not force a search result without an exact alias", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    data: [{
      id: 3,
      name: "Completely Different",
      name_cn: "完全不同",
      date: "2024-01-01",
      platform: "TV",
    }],
  }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

  try {
    const result = await resolveBangumiByTitle("Requested Work");
    assert.equal(result.status, "AMBIGUOUS");
    if (result.status === "AMBIGUOUS") {
      assert.equal(result.reason, "SEARCH_RESULTS_WITHOUT_EXACT_ALIAS");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
