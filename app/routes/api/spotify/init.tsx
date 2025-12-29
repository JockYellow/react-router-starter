import type { ActionFunctionArgs } from "react-router";

import { requireBlogDb } from "../../../lib/d1.server";
import { initRoyaleState } from "../../../lib/spotify-ranking";
import { buildCorsHeaders, ensureSpotifySessionsTable, getSpotifyEnv, jsonWithCors } from "../../../lib/spotify.server";

type InitPayload = {
  userId?: string;
  artistIds?: string[];
};

export async function action({ request, context }: ActionFunctionArgs) {
  const { allowedOrigins } = getSpotifyEnv(context, request.url, { requireSecrets: false });

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: buildCorsHeaders(request, allowedOrigins) });
  }

  const payload = (await request.json().catch(() => null)) as InitPayload | null;
  if (!payload || typeof payload !== "object") {
    return jsonWithCors(request, { error: "Invalid payload" }, { status: 400, allowedOrigins });
  }

  const userId = payload.userId?.toString().trim();
  const artistIds = Array.isArray(payload.artistIds)
    ? payload.artistIds.map((id) => id?.toString().trim()).filter(Boolean)
    : [];

  if (!userId || artistIds.length === 0) {
    return jsonWithCors(request, { error: "Missing userId or artistIds" }, { status: 400, allowedOrigins });
  }

  const db = requireBlogDb(context);
  await ensureSpotifySessionsTable(db);

  const state = initRoyaleState(artistIds);
  const now = Date.now();
  await db
    .prepare(
      "INSERT OR REPLACE INTO game_sessions (user_id, status, artist_ids, algorithm_state, total_count, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(userId, state.status, JSON.stringify(artistIds), JSON.stringify(state), artistIds.length, now)
    .run();

  return jsonWithCors(
    request,
    { status: state.status, state, totalCount: artistIds.length, updatedAt: now },
    { allowedOrigins },
  );
}
