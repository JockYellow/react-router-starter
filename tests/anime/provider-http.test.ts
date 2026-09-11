import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  AnimeProviderError,
  fetchJsonWithTimeout,
} from "../../app/features/anime/providers/provider-http.server";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("provider helper retries transient 503 responses then succeeds", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls < 3) return new Response("busy", { status: 503 });
    return Response.json({ ok: true });
  }) as typeof fetch;

  const result = await fetchJsonWithTimeout<{ ok: boolean }>(
    "TestProvider",
    "https://example.test/data",
    {},
    1_000,
    { maxRetries: 2, baseDelayMs: 0, maxDelayMs: 0, jitterMs: 0 },
  );

  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 3);
});

test("provider helper does not retry a non-retryable 400 response", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("bad request", { status: 400 });
  }) as typeof fetch;

  await assert.rejects(
    () => fetchJsonWithTimeout(
      "TestProvider",
      "https://example.test/data",
      {},
      1_000,
      { maxRetries: 2, baseDelayMs: 0, maxDelayMs: 0, jitterMs: 0 },
    ),
    (error: unknown) => error instanceof AnimeProviderError && error.status === 400,
  );
  assert.equal(calls, 1);
});

test("provider helper retries 429 and accepts Retry-After", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) {
      return new Response("rate limited", {
        status: 429,
        headers: { "Retry-After": "0" },
      });
    }
    return Response.json({ ok: true });
  }) as typeof fetch;

  const result = await fetchJsonWithTimeout<{ ok: boolean }>(
    "TestProvider",
    "https://example.test/data",
    {},
    1_000,
    { maxRetries: 1, baseDelayMs: 0, maxDelayMs: 0, jitterMs: 0 },
  );

  assert.equal(result.ok, true);
  assert.equal(calls, 2);
});
