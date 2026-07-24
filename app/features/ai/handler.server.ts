import type { ActionFunctionArgs } from "react-router";

import { AIError, normalizeAIError } from "./errors";
import { OpenAIProvider } from "./openai-provider.server";
import { getPublishedProfile } from "../profile/profile.server";
import { assertPromptCacheVersion, buildEffectivePromptCacheKey } from "./prompt";
import {
  cleanupExpiredAIUsage,
  consumeAIRateLimit,
  shouldCleanupAIUsage,
} from "./rate-limit.server";
import { errorSSEResponse, sseHeaders } from "./sse";
import type { AIEnv, AIFeature, AIUsage, ChatInput, CompanyFitInput } from "./types";
import {
  assertAIRequestEnvelope,
  dynamicInputLength,
  readAIJson,
  validateChatInput,
  validateCompanyFitInput,
} from "./validation";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_ANALYSIS_MODEL = "gpt-5.6-terra";
const DEFAULT_CHAT_MODEL = "gpt-5.6-luna";
const DEFAULT_TIMEOUT_MS = 90_000;

function getRuntime(context: ActionFunctionArgs["context"]): {
  env: AIEnv;
  executionContext?: ExecutionContext;
} {
  const value = context as unknown as {
    cloudflare?: { env?: AIEnv; ctx?: ExecutionContext };
    env?: AIEnv;
  };
  return {
    env: value.cloudflare?.env ?? value.env ?? {},
    executionContext: value.cloudflare?.ctx,
  };
}

function requireString(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AIError("SERVER_MISCONFIGURED", 503);
  }
  return value.trim();
}

function requireRateLimitSecret(value: unknown): string {
  const secret = requireString(value);
  if (secret.length < 32) {
    throw new AIError("SERVER_MISCONFIGURED", 503);
  }
  return secret;
}

function parseTimeout(value: unknown): number {
  const parsed = Number(value ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed < 1_000 || parsed > DEFAULT_TIMEOUT_MS) {
    throw new AIError("SERVER_MISCONFIGURED", 503);
  }
  return Math.floor(parsed);
}

function normalizeBaseUrl(value: unknown): string {
  const raw = typeof value === "string" && value.trim() ? value.trim() : DEFAULT_OPENAI_BASE_URL;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported protocol");
    return url.toString().replace(/\/+$/, "");
  } catch (error) {
    throw new AIError("SERVER_MISCONFIGURED", 503, error);
  }
}

function modelForFeature(env: AIEnv, feature: AIFeature): string {
  if (feature === "company-fit") {
    return env.OPENAI_MODEL_ANALYSIS?.trim() || env.OPENAI_MODEL?.trim() || DEFAULT_ANALYSIS_MODEL;
  }
  return env.OPENAI_MODEL_CHAT?.trim() || env.OPENAI_MODEL?.trim() || DEFAULT_CHAT_MODEL;
}

function logAIEvent(value: {
  requestId: string;
  feature: AIFeature;
  startedAt: number;
  inputLength: number;
  status: "completed" | "error" | "rate_limited";
  errorCode?: string;
  usage?: AIUsage;
}): void {
  console.info("ai_request", JSON.stringify({
    requestId: value.requestId,
    feature: value.feature,
    status: value.status,
    latencyMs: Date.now() - value.startedAt,
    inputLength: value.inputLength,
    ...(value.usage ? value.usage : {}),
    ...(value.errorCode ? { errorCode: value.errorCode } : {}),
  }));
}

export async function handleAIAction(
  feature: AIFeature,
  { request, context }: Pick<ActionFunctionArgs, "request" | "context">,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let inputLength = 0;

  try {
    assertAIRequestEnvelope(request);
    const json = await readAIJson(request);
    const input: CompanyFitInput | ChatInput = feature === "company-fit"
      ? validateCompanyFitInput(json)
      : validateChatInput(json);
    inputLength = dynamicInputLength(input);

    const { env, executionContext } = getRuntime(context);
    const apiKey = requireString(env.OPENAI_API_KEY);
    const rateLimitSecret = requireRateLimitSecret(env.AI_RATE_LIMIT_SECRET);
    const promptCacheKey = requireString(env.PROMPT_CACHE_KEY);
    assertPromptCacheVersion(promptCacheKey);
    if (!env.BLOG_DB) throw new AIError("SERVER_MISCONFIGURED", 503);

    const rateLimit = await consumeAIRateLimit({
      db: env.BLOG_DB,
      request,
      feature,
      secret: rateLimitSecret,
      dailyGlobalLimit: env.AI_DAILY_REQUEST_LIMIT,
    });
    const publishedProfile = await getPublishedProfile(env.BLOG_DB);
    if (executionContext && shouldCleanupAIUsage(requestId)) {
      executionContext.waitUntil(cleanupExpiredAIUsage(env.BLOG_DB).catch(() => undefined));
    }

    let terminalLogged = false;
    const provider = new OpenAIProvider({
      apiKey,
      baseUrl: normalizeBaseUrl(env.OPENAI_BASE_URL),
    });
    const stream = await provider.streamResponse({
      feature,
      input,
      model: modelForFeature(env, feature),
      maxOutputTokens: feature === "company-fit" ? 1_000 : 700,
      promptCacheKey: buildEffectivePromptCacheKey(promptCacheKey, publishedProfile.revision),
      profile: publishedProfile.profile,
      profileRevision: publishedProfile.revision,
      abortSignal: request.signal,
      timeoutMs: parseTimeout(env.AI_REQUEST_TIMEOUT_MS),
      rateLimit: rateLimit.usage,
      safetyIdentifier: rateLimit.safetyIdentifier,
      telemetry: {
        requestId,
        feature,
        startedAt,
        inputLength,
        onUsage(usage) {
          terminalLogged = true;
          logAIEvent({ requestId, feature, startedAt, inputLength, status: "completed", usage });
        },
        onError(errorCode) {
          if (terminalLogged) return;
          terminalLogged = true;
          logAIEvent({ requestId, feature, startedAt, inputLength, status: "error", errorCode });
        },
      },
    });

    const extraHeaders = rateLimit.setCookie ? { "Set-Cookie": rateLimit.setCookie } : undefined;
    return new Response(stream, {
      status: 200,
      headers: sseHeaders(requestId, extraHeaders),
    });
  } catch (error) {
    const aiError = normalizeAIError(error);
    logAIEvent({
      requestId,
      feature,
      startedAt,
      inputLength,
      status: aiError.code === "RATE_LIMITED" ? "rate_limited" : "error",
      errorCode: aiError.code,
    });
    const extraHeaders = aiError.code === "METHOD_NOT_ALLOWED" ? { Allow: "POST" } : undefined;
    return errorSSEResponse(aiError.code, requestId, aiError.status, extraHeaders);
  }
}
