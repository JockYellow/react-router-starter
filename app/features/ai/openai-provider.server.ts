import { AIError, mapOpenAIHttpError } from "./errors";
import { buildOpenAIInput } from "./prompt";
import { encodeDelta, encodeDone, encodeError, encodeUsage } from "./sse";
import type { AIProvider, AIRequest, AIUsage } from "./types";

interface OpenAIStreamEvent {
  type?: string;
  delta?: unknown;
  response?: {
    usage?: unknown;
  };
  error?: unknown;
}

interface ParsedSSEFrame {
  event?: string;
  data: string;
}

function parseSSEFrame(frame: string): ParsedSSEFrame | undefined {
  let event: string | undefined;
  const data: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }
  if (data.length === 0) return undefined;
  return { event, data: data.join("\n") };
}

export function extractSSEFrames(buffer: string): { frames: ParsedSSEFrame[]; rest: string } {
  const frames: ParsedSSEFrame[] = [];
  let cursor = 0;
  const boundary = /\r?\n\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(buffer)) !== null) {
    const parsed = parseSSEFrame(buffer.slice(cursor, match.index));
    if (parsed) frames.push(parsed);
    cursor = match.index + match[0].length;
  }
  return { frames, rest: buffer.slice(cursor) };
}

function finiteToken(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

export function extractOpenAIUsage(value: unknown): AIUsage {
  const usage = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const details = typeof usage.input_tokens_details === "object" && usage.input_tokens_details !== null
    ? usage.input_tokens_details as Record<string, unknown>
    : {};
  return {
    inputTokens: finiteToken(usage.input_tokens),
    outputTokens: finiteToken(usage.output_tokens),
    cachedTokens: finiteToken(details.cached_tokens),
    cacheWriteTokens: finiteToken(details.cache_write_tokens),
  };
}

async function readUpstreamErrorCode(response: Response): Promise<string | undefined> {
  if (!response.body) return undefined;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.length > 16_384) {
        await reader.cancel().catch(() => undefined);
        return undefined;
      }
    }
    text += decoder.decode();
    const value = JSON.parse(text) as { error?: { code?: unknown } };
    return typeof value.error?.code === "string" ? value.error.code : undefined;
  } catch {
    return undefined;
  } finally {
    reader.releaseLock();
  }
}

export class OpenAIProvider implements AIProvider {
  constructor(
    private readonly options: {
      apiKey: string;
      baseUrl: string;
      fetchImpl?: typeof fetch;
    },
  ) {}

  async streamResponse(input: AIRequest): Promise<ReadableStream<Uint8Array>> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const upstreamAbort = new AbortController();
    let timedOut = false;
    const abortFromClient = () => upstreamAbort.abort(input.abortSignal.reason);
    if (input.abortSignal.aborted) abortFromClient();
    else input.abortSignal.addEventListener("abort", abortFromClient, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      upstreamAbort.abort(new DOMException("AI request timed out", "TimeoutError"));
    }, input.timeoutMs);

    let response: Response;
    try {
      response = await fetchImpl(`${this.options.baseUrl.replace(/\/+$/, "")}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: input.model,
          input: buildOpenAIInput(input.feature, input.input),
          stream: true,
          store: false,
          max_output_tokens: input.maxOutputTokens,
          reasoning: { effort: input.feature === "company-fit" ? "low" : "none" },
          text: { verbosity: input.feature === "company-fit" ? "medium" : "low" },
          prompt_cache_key: input.promptCacheKey,
          prompt_cache_options: { mode: "explicit" },
          safety_identifier: input.safetyIdentifier,
        }),
        signal: upstreamAbort.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      input.abortSignal.removeEventListener("abort", abortFromClient);
      if (timedOut) throw new AIError("UPSTREAM_TIMEOUT", 504, error);
      if (input.abortSignal.aborted) throw new AIError("STREAM_INTERRUPTED", 499, error);
      throw new AIError("UPSTREAM_TEMPORARY", 503, error);
    }

    if (!response.ok) {
      clearTimeout(timeout);
      input.abortSignal.removeEventListener("abort", abortFromClient);
      const upstreamCode = await readUpstreamErrorCode(response);
      throw mapOpenAIHttpError(response.status, upstreamCode);
    }
    if (!response.body) {
      clearTimeout(timeout);
      input.abortSignal.removeEventListener("abort", abortFromClient);
      throw new AIError("UPSTREAM_MALFORMED", 502);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let completed = false;
    let closed = false;

    const cleanup = () => {
      clearTimeout(timeout);
      input.abortSignal.removeEventListener("abort", abortFromClient);
    };

    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (closed) return;
        try {
          while (!closed) {
            const chunk = await reader.read();
            if (chunk.done) {
              buffer += decoder.decode();
              const trailing = buffer.trim();
              if (trailing) {
                const parsed = parseSSEFrame(trailing);
                if (parsed) processFrame(parsed, controller);
              }
              if (closed) return;
              if (!completed && !input.abortSignal.aborted) {
                input.telemetry.onError?.("STREAM_INTERRUPTED");
                controller.enqueue(encodeError("STREAM_INTERRUPTED", input.telemetry.requestId));
              }
              closed = true;
              cleanup();
              controller.close();
              return;
            }

            buffer += decoder.decode(chunk.value, { stream: true });
            const extracted = extractSSEFrames(buffer);
            buffer = extracted.rest;
            for (const frame of extracted.frames) {
              processFrame(frame, controller);
              if (closed) return;
            }
            if (extracted.frames.length > 0) return;
          }
        } catch (error) {
          if (closed) return;
          const code = timedOut ? "UPSTREAM_TIMEOUT" : "STREAM_INTERRUPTED";
          input.telemetry.onError?.(code);
          if (!input.abortSignal.aborted) controller.enqueue(encodeError(code, input.telemetry.requestId));
          closed = true;
          cleanup();
          controller.close();
        }
      },
      async cancel(reason) {
        closed = true;
        cleanup();
        upstreamAbort.abort(reason);
        await reader.cancel(reason).catch(() => undefined);
      },
    });

    function processFrame(frame: ParsedSSEFrame, controller: ReadableStreamDefaultController<Uint8Array>): void {
      if (closed || frame.data === "[DONE]") return;
      let event: OpenAIStreamEvent;
      try {
        event = JSON.parse(frame.data) as OpenAIStreamEvent;
      } catch (error) {
        input.telemetry.onError?.("UPSTREAM_MALFORMED");
        controller.enqueue(encodeError("UPSTREAM_MALFORMED", input.telemetry.requestId));
        closed = true;
        cleanup();
        upstreamAbort.abort(error);
        controller.close();
        return;
      }

      const eventType = event.type ?? frame.event;
      if (eventType === "response.output_text.delta") {
        if (typeof event.delta !== "string") {
          input.telemetry.onError?.("UPSTREAM_MALFORMED");
          controller.enqueue(encodeError("UPSTREAM_MALFORMED", input.telemetry.requestId));
          closed = true;
          cleanup();
          upstreamAbort.abort();
          controller.close();
          return;
        }
        controller.enqueue(encodeDelta(event.delta));
        return;
      }

      if (eventType === "response.completed") {
        const usage = extractOpenAIUsage(event.response?.usage);
        input.telemetry.onUsage?.(usage);
        controller.enqueue(encodeUsage(usage, input.rateLimit));
        controller.enqueue(encodeDone());
        completed = true;
        closed = true;
        cleanup();
        controller.close();
        void reader.cancel().catch(() => undefined);
        return;
      }

      if (eventType === "error" || eventType === "response.failed" || eventType === "response.incomplete") {
        input.telemetry.onError?.("UPSTREAM_TEMPORARY");
        controller.enqueue(encodeError("UPSTREAM_TEMPORARY", input.telemetry.requestId));
        closed = true;
        cleanup();
        upstreamAbort.abort();
        controller.close();
      }
    }
  }
}
