import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

type Context = LoaderFunctionArgs["context"] | ActionFunctionArgs["context"];

const SESSION_COOKIE = "admin_session";
const CSRF_COOKIE = "admin_csrf";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_FAILURES = 6;

function parseCookies(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  return Object.fromEntries(
    header
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const [k, ...rest] = c.split("=");
        return [k, decodeURIComponent(rest.join("="))];
      }),
  );
}

function resolveEnv(context: Context) {
  const ctx = context as any;
  return (ctx?.cloudflare?.env ?? ctx?.env ?? ctx ?? {}) as Record<string, unknown>;
}

function getSecret(context: Context) {
  const env = resolveEnv(context);
  return (
    (env.BLOG_ADMIN_SESSION_SECRET as string | undefined) ??
    (env.ADMIN_SESSION_SECRET as string | undefined) ??
    (env.BLOG_ADMIN_PASS as string | undefined) ??
    (env.ADMIN_PASS as string | undefined) ??
    process.env.BLOG_ADMIN_SESSION_SECRET ??
    process.env.ADMIN_SESSION_SECRET ??
    process.env.BLOG_ADMIN_PASS ??
    process.env.ADMIN_PASS ??
    ""
  );
}

export function getAdminPassword(context: Context): string | null {
  const env = resolveEnv(context);
  return (
    (env.BLOG_ADMIN_PASS as string | undefined) ??
    (env.ADMIN_PASS as string | undefined) ??
    process.env.BLOG_ADMIN_PASS ??
    process.env.ADMIN_PASS ??
    null
  ) || null;
}

function randomToken(bytes = 24) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return btoa(String.fromCharCode(...buffer)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isSecureRequest(request: Request) {
  const url = new URL(request.url);
  if (url.protocol === "https:") return true;
  return !["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
}

function serializeCookie(name: string, value: string, request: Request, maxAge = COOKIE_MAX_AGE) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

async function signSession(sessionId: string, timestamp: string, context: Context) {
  const secret = getSecret(context);
  if (!secret) return "";
  return hmac(`${sessionId}.${timestamp}`, secret);
}

export async function isAdmin(request: Request, context: Context) {
  const cookie = parseCookies(request)[SESSION_COOKIE];
  if (!cookie) return false;
  const [sessionId, timestamp, signature] = cookie.split(".");
  if (!sessionId || !timestamp || !signature) return false;
  const issuedAt = Number(timestamp);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > COOKIE_MAX_AGE * 1000) return false;
  const expected = await signSession(sessionId, timestamp, context);
  return Boolean(expected && timingSafeEqual(signature, expected));
}

export async function requireAdmin(request: Request, context: Context) {
  if (await isAdmin(request, context)) return;
  const url = new URL("/admin/login", request.url);
  throw new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
    },
  });
}

export async function createAdminSessionCookie(request: Request, context: Context) {
  const sessionId = randomToken(24);
  const timestamp = Date.now().toString();
  const signature = await signSession(sessionId, timestamp, context);
  return serializeCookie(SESSION_COOKIE, `${sessionId}.${timestamp}.${signature}`, request);
}

export function clearAdminSessionCookie(request?: Request) {
  const secure = request && isSecureRequest(request) ? "; Secure" : "";
  return [`${SESSION_COOKIE}=; Path=/`, "HttpOnly", "SameSite=Lax", "Max-Age=0"].join("; ") + secure;
}

export async function getCsrfToken(request: Request, context: Context) {
  await requireAdmin(request, context);
  const cookies = parseCookies(request);
  const existing = cookies[CSRF_COOKIE];
  const token = existing && /^[a-zA-Z0-9_-]{20,120}$/.test(existing) ? existing : randomToken(32);
  return {
    token,
    cookie: serializeCookie(CSRF_COOKIE, token, request),
  };
}

export async function requireCsrf(request: Request, context: Context) {
  await requireAdmin(request, context);
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const selfOrigin = new URL(request.url).origin;
  if (origin && origin !== selfOrigin) {
    throw Response.json({ error: "Invalid origin" }, { status: 403 });
  }
  if (!origin && referer) {
    let refererOrigin = "";
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      refererOrigin = "";
    }
    if (refererOrigin && refererOrigin !== selfOrigin) {
      throw Response.json({ error: "Invalid referer" }, { status: 403 });
    }
  }

  const cookies = parseCookies(request);
  const cookieToken = cookies[CSRF_COOKIE];
  const headerToken = request.headers.get("x-csrf-token");
  if (!cookieToken || !headerToken || !timingSafeEqual(cookieToken, headerToken)) {
    throw Response.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
}

function loginKey(request: Request) {
  const ip =
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown";
  const ua = request.headers.get("user-agent") ?? "unknown";
  return `${ip}:${ua.slice(0, 160)}`;
}

async function ensureLoginAttemptsTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_login_attempts (
        key TEXT PRIMARY KEY,
        failed_count INTEGER NOT NULL,
        first_failed_at INTEGER NOT NULL,
        last_failed_at INTEGER NOT NULL
      )`,
    )
    .run();
}

function getDb(context: Context) {
  const env = resolveEnv(context) as any;
  return (env.BLOG_DB ?? env.blog_db) as D1Database | undefined;
}

export async function assertLoginAllowed(request: Request, context: Context) {
  const db = getDb(context);
  if (!db) return;
  await ensureLoginAttemptsTable(db);
  const key = loginKey(request);
  const now = Date.now();
  const row = await db
    .prepare("SELECT failed_count, first_failed_at FROM admin_login_attempts WHERE key = ?")
    .bind(key)
    .first<{ failed_count: number; first_failed_at: number }>();
  if (!row) return;
  if (now - row.first_failed_at > LOGIN_WINDOW_MS) {
    await db.prepare("DELETE FROM admin_login_attempts WHERE key = ?").bind(key).run();
    return;
  }
  if (row.failed_count >= LOGIN_MAX_FAILURES) {
    throw new Response(JSON.stringify({ error: "登入嘗試過於頻繁，請稍後再試。" }), {
      status: 429,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}

export async function recordLoginFailure(request: Request, context: Context) {
  const db = getDb(context);
  if (!db) return;
  await ensureLoginAttemptsTable(db);
  const key = loginKey(request);
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO admin_login_attempts (key, failed_count, first_failed_at, last_failed_at)
       VALUES (?, 1, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         failed_count = CASE
           WHEN ? - first_failed_at > ? THEN 1
           ELSE failed_count + 1
         END,
         first_failed_at = CASE
           WHEN ? - first_failed_at > ? THEN ?
           ELSE first_failed_at
         END,
         last_failed_at = ?`,
    )
    .bind(key, now, now, now, LOGIN_WINDOW_MS, now, LOGIN_WINDOW_MS, now, now)
    .run();
}

export async function clearLoginFailures(request: Request, context: Context) {
  const db = getDb(context);
  if (!db) return;
  await ensureLoginAttemptsTable(db);
  await db.prepare("DELETE FROM admin_login_attempts WHERE key = ?").bind(loginKey(request)).run();
}
