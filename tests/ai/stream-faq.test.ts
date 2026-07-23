import assert from "node:assert/strict";
import test from "node:test";

import {
  AIClientError,
  consumeAIStream,
} from "../../app/features/ai/client-sse";
import { matchStaticFaq } from "../../app/features/ai/faq";
import {
  extractOpenAIUsage,
  extractSSEFrames,
  OpenAIProvider,
} from "../../app/features/ai/openai-provider.server";
import type { AIRequest } from "../../app/features/ai/types";

function chunkedResponse(text: string, chunkSizes: number[], status = 200): Response {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  let chunkIndex = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      const size = chunkSizes[chunkIndex % chunkSizes.length] ?? 1;
      controller.enqueue(bytes.slice(offset, offset + size));
      offset += size;
      chunkIndex += 1;
    },
  });
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/event-stream; charset=utf-8" },
  });
}

function providerRequest(): AIRequest {
  return {
    feature: "company-fit",
    input: { companyName: "測試公司" },
    model: "test-model",
    maxOutputTokens: 1_000,
    promptCacheKey: "huang-profile-v1",
    abortSignal: new AbortController().signal,
    timeoutMs: 5_000,
    rateLimit: { remaining: 4, limits: {} },
    safetyIdentifier: "safe-test-identifier",
    telemetry: {
      requestId: "provider-test-request",
      feature: "company-fit",
      startedAt: Date.now(),
      inputLength: 4,
    },
  };
}

test("client parser handles arbitrary CRLF chunks and usage", async () => {
  const response = chunkedResponse(
    'event: delta\r\ndata: {"delta":"第一段"}\r\n\r\n' +
      'event: delta\r\ndata: {"delta":"第二段"}\r\n\r\n' +
      'event: usage\r\ndata: {"inputTokens":2000,"outputTokens":80,"cachedTokens":1536,"cacheWriteTokens":0,"remaining":4}\r\n\r\n' +
      'event: done\r\ndata: {"done":true}\r\n\r\n',
    [1, 2, 7, 3],
  );
  let output = "";
  let cachedTokens = 0;

  await consumeAIStream(response, {
    onDelta(delta) {
      output += delta;
    },
    onUsage(usage) {
      cachedTokens = usage.cachedTokens;
    },
  });

  assert.equal(output, "第一段第二段");
  assert.equal(cachedTokens, 1536);
});

test("client parser surfaces a safe non-2xx SSE error", async () => {
  const response = chunkedResponse(
    'event: error\ndata: {"code":"RATE_LIMITED","message":"本時段的 AI 使用額度已用完，請稍後再試。","requestId":"req-safe"}\n\n',
    [4, 1, 9],
    429,
  );

  await assert.rejects(
    consumeAIStream(response, { onDelta() {} }),
    (error: unknown) => error instanceof AIClientError &&
      error.code === "RATE_LIMITED" &&
      error.requestId === "req-safe",
  );
});

test("OpenAI stream utilities preserve incomplete frames and cached usage", () => {
  const extracted = extractSSEFrames(
    'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"A"}\n\n' +
      'event: response.completed\ndata: {"type":"response.completed"',
  );
  assert.equal(extracted.frames.length, 1);
  assert.match(extracted.rest, /response.completed/);
  assert.deepEqual(extractOpenAIUsage({
    input_tokens: 2300,
    output_tokens: 500,
    input_tokens_details: { cached_tokens: 2048, cache_write_tokens: 0 },
  }), {
    inputTokens: 2300,
    outputTokens: 500,
    cachedTokens: 2048,
    cacheWriteTokens: 0,
  });
});

test("provider converts arbitrarily chunked OpenAI events to stable site SSE", async () => {
  const upstream =
    'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"適配"}\n\n' +
    'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"分析"}\n\n' +
    'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":2200,"output_tokens":90,"input_tokens_details":{"cached_tokens":2048,"cache_write_tokens":0}}}}\n\n';
  const provider = new OpenAIProvider({
    apiKey: "test-key-never-logged",
    baseUrl: "https://api.openai.com/v1",
    fetchImpl: async () => chunkedResponse(upstream, [1, 5, 2, 11]),
  });
  const stream = await provider.streamResponse(providerRequest());
  let output = "";
  let usage: { cachedTokens: number; remaining: number | null } | undefined;

  await consumeAIStream(new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8" },
  }), {
    onDelta(delta) {
      output += delta;
    },
    onUsage(nextUsage) {
      usage = {
        cachedTokens: nextUsage.cachedTokens,
        remaining: nextUsage.remaining,
      };
    },
  });

  assert.equal(output, "適配分析");
  assert.deepEqual(usage, { cachedTokens: 2048, remaining: 4 });
});

test("provider maps malformed upstream deltas to a safe site error", async () => {
  const provider = new OpenAIProvider({
    apiKey: "test-key-never-logged",
    baseUrl: "https://api.openai.com/v1",
    fetchImpl: async () => chunkedResponse(
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":42}\n\n',
      [3, 1, 8],
    ),
  });
  const stream = await provider.streamResponse(providerRequest());

  await assert.rejects(
    consumeAIStream(new Response(stream, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    }), { onDelta() {} }),
    (error: unknown) => error instanceof AIClientError && error.code === "UPSTREAM_MALFORMED",
  );
});

test("static FAQs answer without an AI provider", () => {
  const faq = matchStaticFaq("有哪些作品或專案可以看？");
  assert.ok(faq);
  assert.match(faq.answer, /AI 知識庫健康度檢測|客製化客戶成效報告/);
});
