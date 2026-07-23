import { AIError } from "./errors";
import type { AIChatMessage, ChatInput, CompanyFitInput } from "./types";

export const AI_INPUT_LIMITS = {
  bodyBytes: 32 * 1024,
  companyName: 100,
  jobTitle: 150,
  jobDescription: 6_000,
  chatMessages: 8,
  chatMessage: 1_000,
  chatTotal: 6_000,
} as const;

function characterLength(value: string): number {
  return Array.from(value).length;
}

function cleanString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new AIError("INPUT_INVALID", 400);
  const cleaned = value.trim();
  return cleaned || undefined;
}

function assertMax(value: string | undefined, max: number): void {
  if (value && characterLength(value) > max) {
    throw new AIError("CONTENT_TOO_LONG", 413);
  }
}

export function assertAIRequestEnvelope(request: Request): void {
  if (request.method.toUpperCase() !== "POST") {
    throw new AIError("METHOD_NOT_ALLOWED", 405);
  }

  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new AIError("ORIGIN_NOT_ALLOWED", 403);
  }

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw new AIError("UNSUPPORTED_MEDIA_TYPE", 415);
  }

  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null) {
    const parsed = Number(contentLength);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new AIError("INPUT_INVALID", 400);
    }
    if (parsed > AI_INPUT_LIMITS.bodyBytes) {
      throw new AIError("CONTENT_TOO_LONG", 413);
    }
  }
}

export async function readAIJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > AI_INPUT_LIMITS.bodyBytes) {
    throw new AIError("CONTENT_TOO_LONG", 413);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AIError("INPUT_INVALID", 400);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateCompanyFitInput(value: unknown): CompanyFitInput {
  if (!isRecord(value)) throw new AIError("INPUT_INVALID", 400);
  const companyName = cleanString(value.companyName);
  const jobTitle = cleanString(value.jobTitle);
  const jobDescription = cleanString(value.jobDescription);

  if (!companyName) throw new AIError("INPUT_REQUIRED", 400);
  assertMax(companyName, AI_INPUT_LIMITS.companyName);
  assertMax(jobTitle, AI_INPUT_LIMITS.jobTitle);
  assertMax(jobDescription, AI_INPUT_LIMITS.jobDescription);

  return {
    companyName,
    ...(jobTitle ? { jobTitle } : {}),
    ...(jobDescription ? { jobDescription } : {}),
  };
}

export function validateChatInput(value: unknown): ChatInput {
  if (!isRecord(value) || !Array.isArray(value.messages)) {
    throw new AIError("INPUT_INVALID", 400);
  }
  if (value.messages.length === 0) throw new AIError("INPUT_REQUIRED", 400);
  if (value.messages.length > AI_INPUT_LIMITS.chatMessages) {
    throw new AIError("CONTENT_TOO_LONG", 413);
  }

  let total = 0;
  const messages: AIChatMessage[] = value.messages.map((message) => {
    if (!isRecord(message) || (message.role !== "user" && message.role !== "assistant")) {
      throw new AIError("INPUT_INVALID", 400);
    }
    const content = cleanString(message.content);
    if (!content) throw new AIError("INPUT_REQUIRED", 400);
    const length = characterLength(content);
    if (length > AI_INPUT_LIMITS.chatMessage) throw new AIError("CONTENT_TOO_LONG", 413);
    total += length;
    return { role: message.role, content };
  });

  if (total > AI_INPUT_LIMITS.chatTotal) throw new AIError("CONTENT_TOO_LONG", 413);
  if (messages.at(-1)?.role !== "user") throw new AIError("INPUT_INVALID", 400);
  return { messages };
}

export function dynamicInputLength(input: CompanyFitInput | ChatInput): number {
  if ("companyName" in input) {
    return characterLength(input.companyName) +
      characterLength(input.jobTitle ?? "") +
      characterLength(input.jobDescription ?? "");
  }
  return input.messages.reduce((sum, message) => sum + characterLength(message.content), 0);
}
