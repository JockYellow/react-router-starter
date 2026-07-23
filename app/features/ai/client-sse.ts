export type AIUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  remaining: number | null;
};

export type AIStreamError = {
  code: string;
  message: string;
  requestId: string | null;
};

export type AIStreamHandlers = {
  onDelta: (text: string) => void;
  onUsage?: (usage: AIUsage) => void;
  onDone?: () => void;
};

type ParsedSseEvent = {
  event: string;
  data: string;
};

const PUBLIC_ERROR_CODES = new Set([
  "METHOD_NOT_ALLOWED",
  "ORIGIN_NOT_ALLOWED",
  "UNSUPPORTED_MEDIA_TYPE",
  "INPUT_INVALID",
  "INPUT_REQUIRED",
  "CONTENT_TOO_LONG",
  "RATE_LIMITED",
  "RATE_LIMIT_UNAVAILABLE",
  "OPENAI_QUOTA_EXCEEDED",
  "UPSTREAM_TEMPORARY",
  "UPSTREAM_TIMEOUT",
  "STREAM_INTERRUPTED",
  "UPSTREAM_MALFORMED",
  "SERVER_MISCONFIGURED",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseJson(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function parseEvent(block: string): ParsedSseEvent | null {
  let event = "message";
  const data: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }

  if (data.length === 0) return null;
  return { event, data: data.join("\n") };
}

function extractDelta(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (!isRecord(payload)) return "";
  if (typeof payload.delta === "string") return payload.delta;
  if (typeof payload.text === "string") return payload.text;
  if (typeof payload.content === "string") return payload.content;
  return "";
}

function extractUsage(payload: unknown): AIUsage {
  const source = isRecord(payload) && isRecord(payload.usage) ? payload.usage : payload;
  if (!isRecord(source)) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      cacheWriteTokens: 0,
      remaining: null,
    };
  }

  return {
    inputTokens: finiteNumber(source.inputTokens ?? source.input_tokens),
    outputTokens: finiteNumber(source.outputTokens ?? source.output_tokens),
    cachedTokens: finiteNumber(source.cachedTokens ?? source.cached_tokens),
    cacheWriteTokens: finiteNumber(source.cacheWriteTokens ?? source.cache_write_tokens),
    remaining: nullableNumber(
      source.remaining ?? source.remainingRequests ?? source.remaining_requests,
    ),
  };
}

function extractError(payload: unknown): AIStreamError {
  if (!isRecord(payload)) {
    return {
      code: "STREAM_ERROR",
      message: typeof payload === "string" && payload ? payload : "AI 回應中斷，請稍後再試。",
      requestId: null,
    };
  }

  const code = typeof payload.code === "string" ? payload.code : "STREAM_ERROR";
  const isPublicError = PUBLIC_ERROR_CODES.has(code);

  return {
    code: isPublicError ? code : "STREAM_ERROR",
    message:
      isPublicError && typeof payload.message === "string" && payload.message
        ? payload.message
        : "AI 回應中斷，請稍後再試。",
    requestId:
      typeof payload.requestId === "string"
        ? payload.requestId
        : typeof payload.request_id === "string"
          ? payload.request_id
          : null,
  };
}

/** Error emitted by the site's stable AI SSE protocol. */
export class AIClientError extends Error {
  readonly code: string;
  readonly requestId: string | null;

  constructor(error: AIStreamError) {
    super(error.message);
    this.name = "AIClientError";
    this.code = error.code;
    this.requestId = error.requestId;
  }
}

/** Reads the site's delta/usage/done/error SSE stream without assuming chunk boundaries. */
export async function consumeAIStream(
  response: Response,
  handlers: AIStreamHandlers,
): Promise<void> {
  const isEventStream = response.headers
    .get("Content-Type")
    ?.toLocaleLowerCase()
    .includes("text/event-stream") ?? false;

  if (!response.ok && !isEventStream) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // Upstream bodies are intentionally not surfaced to the UI.
    }
    const safeError = extractError(payload);
    if (safeError.message === "AI 回應中斷，請稍後再試。") {
      safeError.message = response.status === 429
        ? "目前使用額度已達上限，請稍後再試。"
        : "目前無法取得 AI 回應，請稍後再試。";
    }
    throw new AIClientError(safeError);
  }

  if (!response.body) {
    throw new AIClientError({
      code: "EMPTY_STREAM",
      message: "瀏覽器未收到串流內容，請重新整理後再試。",
      requestId: null,
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  const nextBoundary = (): { index: number; length: number } | null => {
    const match = /\r?\n\r?\n/.exec(buffer);
    return match ? { index: match.index, length: match[0].length } : null;
  };

  const dispatch = (block: string): void => {
    const parsed = parseEvent(block);
    if (!parsed) return;
    const payload = parseJson(parsed.data);

    if (parsed.event === "delta") {
      handlers.onDelta(extractDelta(payload));
      return;
    }
    if (parsed.event === "usage") {
      handlers.onUsage?.(extractUsage(payload));
      return;
    }
    if (parsed.event === "done") {
      completed = true;
      handlers.onDone?.();
      return;
    }
    if (parsed.event === "error") {
      throw new AIClientError(extractError(payload));
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary = nextBoundary();
      while (boundary) {
        dispatch(buffer.slice(0, boundary.index));
        buffer = buffer.slice(boundary.index + boundary.length);
        boundary = nextBoundary();
      }
      if (done) break;
    }
    if (buffer.trim()) dispatch(buffer);
  } finally {
    reader.releaseLock();
  }

  if (!completed) {
    throw new AIClientError({
      code: "STREAM_INTERRUPTED",
      message: "連線在回應完成前中斷，已保留目前內容，可重新產生。",
      requestId: null,
    });
  }
}

/** Maps unknown browser/network errors to concise Traditional Chinese messages. */
export function getAIErrorMessage(error: unknown): string {
  if (error instanceof AIClientError) {
    return error.requestId ? `${error.message}（編號：${error.requestId}）` : error.message;
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return "已停止產生。";
  }
  return "連線失敗，請確認網路後再試。";
}
