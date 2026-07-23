import assert from "node:assert/strict";
import test from "node:test";

import { AIError } from "../../app/features/ai/errors";
import { consumeAIRateLimit } from "../../app/features/ai/rate-limit.server";

function createD1Mock(options?: { fail?: boolean }): D1Database {
  const mock = {
    prepare() {
      return {
        bind(...bindings: Array<string | number>) {
          return {
            async all<T>() {
              if (options?.fail) throw new Error("D1 unavailable: internal detail must stay private");
              const results: Array<{ scope: string; request_count: number }> = [];
              for (let index = 0; index < bindings.length - 1; index += 4) {
                results.push({ scope: String(bindings[index]), request_count: 1 });
              }
              return { results: results as T[] };
            },
          };
        },
      };
    },
  };
  return mock as unknown as D1Database;
}

function aiRequest(cookie?: string): Request {
  return new Request("https://portfolio.example/api/ai/chat", {
    method: "POST",
    headers: {
      Origin: "https://portfolio.example",
      "CF-Connecting-IP": "203.0.113.8",
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
}

test("chat quota consumes IP, session, and global scopes without exposing the IP", async () => {
  const result = await consumeAIRateLimit({
    db: createD1Mock(),
    request: aiRequest(),
    feature: "chat",
    secret: "test-secret-with-at-least-32-characters",
    dailyGlobalLimit: 100,
    now: new Date("2026-07-23T03:15:00.000Z"),
  });

  assert.deepEqual(Object.keys(result.usage.limits), [
    "chat_ip_hour",
    "chat_session_hour",
    "global_day",
  ]);
  assert.equal(result.usage.remaining, 14);
  assert.match(result.setCookie ?? "", /Path=\/;/);
  assert.doesNotMatch(result.setCookie ?? "", /203\.0\.113\.8/);
  assert.match(result.safetyIdentifier, /^[a-f0-9]{64}$/);
});

test("D1 failures fail closed with a sanitized rate-limit error", async () => {
  await assert.rejects(
    consumeAIRateLimit({
      db: createD1Mock({ fail: true }),
      request: aiRequest("ai_session=12345678-1234-1234-1234-123456789abc"),
      feature: "chat",
      secret: "test-secret-with-at-least-32-characters",
    }),
    (error: unknown) => error instanceof AIError &&
      error.code === "RATE_LIMIT_UNAVAILABLE" &&
      !error.message.includes("internal detail"),
  );
});
