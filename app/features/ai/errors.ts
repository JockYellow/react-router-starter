export type AIErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "ORIGIN_NOT_ALLOWED"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INPUT_INVALID"
  | "INPUT_REQUIRED"
  | "CONTENT_TOO_LONG"
  | "RATE_LIMITED"
  | "RATE_LIMIT_UNAVAILABLE"
  | "OPENAI_QUOTA_EXCEEDED"
  | "UPSTREAM_TEMPORARY"
  | "UPSTREAM_TIMEOUT"
  | "STREAM_INTERRUPTED"
  | "UPSTREAM_MALFORMED"
  | "SERVER_MISCONFIGURED";

const PUBLIC_MESSAGES: Record<AIErrorCode, string> = {
  METHOD_NOT_ALLOWED: "僅接受 POST 請求。",
  ORIGIN_NOT_ALLOWED: "請從本站頁面送出請求。",
  UNSUPPORTED_MEDIA_TYPE: "請使用 application/json 格式。",
  INPUT_INVALID: "輸入格式不正確，請檢查後再試。",
  INPUT_REQUIRED: "請填寫必要內容後再送出。",
  CONTENT_TOO_LONG: "輸入內容超過長度限制，請縮短後再試。",
  RATE_LIMITED: "本時段的 AI 使用額度已用完，請稍後再試。",
  RATE_LIMIT_UNAVAILABLE: "AI 額度服務暫時無法使用，請稍後再試。",
  OPENAI_QUOTA_EXCEEDED: "AI 服務額度暫時不足，請稍後再試。",
  UPSTREAM_TEMPORARY: "AI 服務暫時忙碌，請稍後再試。",
  UPSTREAM_TIMEOUT: "AI 回應逾時，請稍後重新嘗試。",
  STREAM_INTERRUPTED: "AI 回應中斷，請重新嘗試。",
  UPSTREAM_MALFORMED: "AI 回應格式異常，請稍後再試。",
  SERVER_MISCONFIGURED: "AI 服務尚未完成設定。",
};

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly status: number;

  constructor(code: AIErrorCode, status: number, cause?: unknown) {
    super(PUBLIC_MESSAGES[code], cause === undefined ? undefined : { cause });
    this.name = "AIError";
    this.code = code;
    this.status = status;
  }
}

export function publicAIMessage(code: AIErrorCode): string {
  return PUBLIC_MESSAGES[code];
}

export function normalizeAIError(error: unknown): AIError {
  if (error instanceof AIError) return error;
  return new AIError("UPSTREAM_TEMPORARY", 503, error);
}

export function mapOpenAIHttpError(status: number, upstreamCode?: string): AIError {
  if (upstreamCode === "insufficient_quota" || status === 402) {
    return new AIError("OPENAI_QUOTA_EXCEEDED", 503);
  }
  if (status === 401 || status === 403) {
    return new AIError("SERVER_MISCONFIGURED", 503);
  }
  if (status === 408 || status === 429 || status >= 500) {
    return new AIError("UPSTREAM_TEMPORARY", 503);
  }
  return new AIError("UPSTREAM_MALFORMED", 502);
}
