import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

type Context = LoaderFunctionArgs["context"] | ActionFunctionArgs["context"];

type SpotifyEnv = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  allowedOrigins: string[];
};

export function getSpotifyEnv(
  context: Context,
  requestUrl: string,
  options: { requireSecrets?: boolean } = {},
): SpotifyEnv {
  const ctx = context as any;
  const env =
    ctx?.cloudflare?.env ??
    ctx?.env ??
    ctx ??
    {};

  const clientId = env.SPOTIFY_CLIENT_ID ?? "";
  const clientSecret = env.SPOTIFY_CLIENT_SECRET ?? "";
  const origin = new URL(requestUrl).origin;
  const redirectUri = env.SPOTIFY_REDIRECT_URI ?? `${origin}/call_spotify`;
  const rawOrigins = env.SPOTIFY_ALLOWED_ORIGINS ?? `${origin}`;
  const allowedOrigins = rawOrigins
    .split(",")
    .map((value: string) => value.trim())
    .filter(Boolean);

  if ((options.requireSecrets ?? true) && (!clientId || !clientSecret)) {
    throw new Response("Spotify client env vars are missing", { status: 500 });
  }

  return { clientId, clientSecret, redirectUri, allowedOrigins };
}

export function buildCorsHeaders(request: Request, allowedOrigins: string[]) {
  const origin = request.headers.get("Origin") ?? "";
  const allowOrigin = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0] ?? "*";

  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", allowOrigin);
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  return headers;
}

export function jsonWithCors(
  request: Request,
  data: unknown,
  options: { status?: number; headers?: HeadersInit; allowedOrigins: string[] },
) {
  const headers = buildCorsHeaders(request, options.allowedOrigins);
  if (options.headers) {
    const extra = new Headers(options.headers);
    for (const [key, value] of extra.entries()) {
      headers.set(key, value);
    }
  }
  return Response.json(data, { status: options.status, headers });
}

export async function ensureSpotifySessionsTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS game_sessions (
        user_id TEXT PRIMARY KEY,
        status TEXT DEFAULT 'IDLE',
        artist_ids TEXT,
        algorithm_state TEXT,
        total_count INTEGER DEFAULT 0,
        updated_at INTEGER
      )`,
    )
    .run();
}

export function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
