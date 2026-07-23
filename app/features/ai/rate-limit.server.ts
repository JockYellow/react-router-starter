import { AIError } from "./errors";
import type { AIFeature, AIRateLimitUsage } from "./types";

const COMPANY_DAILY_LIMIT = 5;
const CHAT_HOURLY_LIMIT = 15;
const SESSION_COOKIE = "ai_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

interface CounterRequest {
  scope: string;
  identifierHash: string;
  bucketStart: string;
  limit: number;
}

interface CounterRow {
  scope: string;
  request_count: number;
}

export interface RateLimitResult {
  usage: AIRateLimitUsage;
  safetyIdentifier: string;
  setCookie?: string;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function utcDayBucket(date: Date): string {
  return `${date.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

function utcHourBucket(date: Date): string {
  return `${date.toISOString().slice(0, 13)}:00:00.000Z`;
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("Cookie") ?? "";
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator === -1) continue;
    if (item.slice(0, separator).trim() === name) {
      const value = item.slice(separator + 1).trim();
      if (/^[a-f0-9-]{16,64}$/i.test(value)) return value;
    }
  }
  return undefined;
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function buildAtomicIncrementSql(counterCount: number): string {
  const values = Array.from({ length: counterCount }, () => "(?, ?, ?, ?)").join(", ");
  return `
    WITH incoming(scope, identifier_hash, bucket_start, quota_limit) AS (
      VALUES ${values}
    )
    INSERT INTO ai_usage_counters
      (scope, identifier_hash, bucket_start, request_count, updated_at)
    SELECT scope, identifier_hash, bucket_start, 1, ?
    FROM incoming
    WHERE NOT EXISTS (
      SELECT 1
      FROM incoming AS requested
      JOIN ai_usage_counters AS current
        ON current.scope = requested.scope
       AND current.identifier_hash = requested.identifier_hash
       AND current.bucket_start = requested.bucket_start
      WHERE current.request_count >= requested.quota_limit
    )
    ON CONFLICT(scope, identifier_hash, bucket_start) DO UPDATE SET
      request_count = ai_usage_counters.request_count + 1,
      updated_at = excluded.updated_at
    RETURNING scope, request_count
  `;
}

async function incrementAllOrReject(db: D1Database, counters: CounterRequest[]): Promise<CounterRow[]> {
  const bindings: Array<string | number> = [];
  for (const counter of counters) {
    bindings.push(counter.scope, counter.identifierHash, counter.bucketStart, counter.limit);
  }
  bindings.push(new Date().toISOString());

  const result = await db
    .prepare(buildAtomicIncrementSql(counters.length))
    .bind(...bindings)
    .all<CounterRow>();
  if (result.results.length !== counters.length) {
    throw new AIError("RATE_LIMITED", 429);
  }
  return result.results;
}

export async function consumeAIRateLimit(options: {
  db: D1Database;
  request: Request;
  feature: AIFeature;
  secret: string;
  dailyGlobalLimit?: string | number;
  now?: Date;
}): Promise<RateLimitResult> {
  const { db, request, feature, secret } = options;
  const now = options.now ?? new Date();
  const globalLimit = parsePositiveInt(options.dailyGlobalLimit, 100);
  const ip = request.headers.get("CF-Connecting-IP")?.trim() || "unknown";
  const ipHash = await hmac(secret, `ip:${ip}`);
  const globalHash = await hmac(secret, "global:all");
  const counters: CounterRequest[] = [
    {
      scope: "global_day",
      identifierHash: globalHash,
      bucketStart: utcDayBucket(now),
      limit: globalLimit,
    },
  ];

  let sessionId = readCookie(request, SESSION_COOKIE);
  let setCookie: string | undefined;
  if (feature === "company-fit") {
    counters.unshift({
      scope: "company_ip_day",
      identifierHash: ipHash,
      bucketStart: utcDayBucket(now),
      limit: COMPANY_DAILY_LIMIT,
    });
  } else {
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      setCookie = `${SESSION_COOKIE}=${sessionId}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
    }
    const sessionHash = await hmac(secret, `session:${sessionId}`);
    counters.unshift(
      {
        scope: "chat_ip_hour",
        identifierHash: ipHash,
        bucketStart: utcHourBucket(now),
        limit: CHAT_HOURLY_LIMIT,
      },
      {
        scope: "chat_session_hour",
        identifierHash: sessionHash,
        bucketStart: utcHourBucket(now),
        limit: CHAT_HOURLY_LIMIT,
      },
    );
  }

  let rows: CounterRow[];
  try {
    rows = await incrementAllOrReject(db, counters);
  } catch (error) {
    if (error instanceof AIError) throw error;
    throw new AIError("RATE_LIMIT_UNAVAILABLE", 503, error);
  }

  const limits: AIRateLimitUsage["limits"] = {};
  for (const counter of counters) {
    const count = rows.find((row) => row.scope === counter.scope)?.request_count ?? counter.limit;
    limits[counter.scope] = {
      limit: counter.limit,
      remaining: Math.max(0, counter.limit - count),
    };
  }
  const remaining = Math.min(...Object.values(limits).map((quota) => quota.remaining));
  return {
    usage: { remaining, limits },
    safetyIdentifier: ipHash,
    ...(setCookie ? { setCookie } : {}),
  };
}

export async function cleanupExpiredAIUsage(db: D1Database): Promise<void> {
  await db
    .prepare("DELETE FROM ai_usage_counters WHERE updated_at < datetime('now', '-3 days')")
    .run();
}

export function shouldCleanupAIUsage(requestId: string): boolean {
  const sample = Number.parseInt(requestId.replaceAll("-", "").slice(-2), 16);
  return Number.isFinite(sample) && sample < 3;
}
