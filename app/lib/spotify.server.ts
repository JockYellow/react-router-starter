import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

type Context = LoaderFunctionArgs["context"] | ActionFunctionArgs["context"];

type SpotifyEnv = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  allowedOrigins: string[];
};

type SpotifyAppToken = {
  token: string;
  expiresAt: number;
};

let cachedAppToken: SpotifyAppToken | null = null;

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

export async function ensureSpotifyArtistsTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS spotify_followed_artists (
        dataset_key TEXT NOT NULL,
        artist_id TEXT NOT NULL,
        imported_at INTEGER NOT NULL,
        PRIMARY KEY (dataset_key, artist_id)
      )`,
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS idx_spotify_followed_artists_dataset ON spotify_followed_artists (dataset_key, imported_at)",
    )
    .run();
}

export async function getSpotifyAppToken(env: SpotifyEnv) {
  const now = Date.now();
  if (cachedAppToken && cachedAppToken.expiresAt > now) {
    return cachedAppToken.token;
  }

  if (typeof btoa !== "function") {
    throw new Response("Base64 encoder is unavailable", { status: 500 });
  }

  const credentials = `${env.clientId}:${env.clientSecret}`;
  const encoded = btoa(credentials);
  const body = new URLSearchParams({ grant_type: "client_credentials" });

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${encoded}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    throw new Response(`Spotify token error: ${errorText || tokenRes.status}`, { status: 502 });
  }

  const data = (await tokenRes.json()) as { access_token: string; expires_in: number };
  const expiresAt = now + data.expires_in * 1000 - 60_000;
  cachedAppToken = { token: data.access_token, expiresAt };
  return data.access_token;
}

export function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
