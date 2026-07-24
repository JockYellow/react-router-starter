import type { Profile } from "../../data/profile";

export type AIFeature = "company-fit" | "chat";

export type AIChatRole = "user" | "assistant";

export interface AIChatMessage {
  role: AIChatRole;
  content: string;
}

export interface CompanyFitInput {
  companyName: string;
  jobTitle?: string;
  jobDescription?: string;
}

export interface ChatInput {
  messages: AIChatMessage[];
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
}

export interface AIRateLimitUsage {
  remaining: number;
  limits: Record<string, { limit: number; remaining: number }>;
}

export interface AITelemetry {
  requestId: string;
  feature: AIFeature;
  startedAt: number;
  inputLength: number;
  onUsage?: (usage: AIUsage) => void;
  onError?: (code: string) => void;
}

export interface AIRequest {
  feature: AIFeature;
  input: CompanyFitInput | ChatInput;
  model: string;
  maxOutputTokens: number;
  promptCacheKey: string;
  profile: Profile;
  profileRevision: number;
  abortSignal: AbortSignal;
  timeoutMs: number;
  rateLimit: AIRateLimitUsage;
  safetyIdentifier: string;
  telemetry: AITelemetry;
}

export interface AIProvider {
  streamResponse(input: AIRequest): Promise<ReadableStream<Uint8Array>>;
}

export interface AIEnv {
  OPENAI_API_KEY?: string;
  AI_RATE_LIMIT_SECRET?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL_ANALYSIS?: string;
  OPENAI_MODEL_CHAT?: string;
  OPENAI_MODEL?: string;
  PROMPT_CACHE_KEY?: string;
  AI_DAILY_REQUEST_LIMIT?: string | number;
  AI_REQUEST_TIMEOUT_MS?: string | number;
  BLOG_DB?: D1Database;
}
