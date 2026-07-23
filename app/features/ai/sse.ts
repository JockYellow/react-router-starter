import type { AIErrorCode } from "./errors";
import { publicAIMessage } from "./errors";
import type { AIRateLimitUsage, AIUsage } from "./types";

const encoder = new TextEncoder();

export function encodeSSE(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function encodeDelta(delta: string): Uint8Array {
  return encodeSSE("delta", { delta });
}

export function encodeUsage(usage: AIUsage, rateLimit: AIRateLimitUsage): Uint8Array {
  return encodeSSE("usage", { ...usage, ...rateLimit });
}

export function encodeDone(): Uint8Array {
  return encodeSSE("done", { done: true });
}

export function encodeError(code: AIErrorCode, requestId: string): Uint8Array {
  return encodeSSE("error", {
    code,
    message: publicAIMessage(code),
    requestId,
  });
}

export function sseHeaders(requestId: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("Content-Type", "text/event-stream; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Request-ID", requestId);
  return headers;
}

export function errorSSEResponse(
  code: AIErrorCode,
  requestId: string,
  status: number,
  extraHeaders?: HeadersInit,
): Response {
  return new Response(encodeError(code, requestId), {
    status,
    headers: sseHeaders(requestId, extraHeaders),
  });
}
