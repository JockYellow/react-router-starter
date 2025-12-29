import type { ActionFunctionArgs } from "react-router";

import { requireBlogDb } from "../../../lib/d1.server";
import type { RoyaleState } from "../../../lib/spotify-ranking";
import { buildCorsHeaders, ensureSpotifySessionsTable, getSpotifyEnv, jsonWithCors } from "../../../lib/spotify.server";

type SavePayload = {
  userId?: string;
  state?: RoyaleState;
};

export async function action({ request, context }: ActionFunctionArgs) {
  const { allowedOrigins } = getSpotifyEnv(context, request.url, { requireSecrets: false });

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: buildCorsHeaders(request, allowedOrigins) });
  }

  const payload = (await request.json().catch(() => null)) as SavePayload | null;
  if (!payload || typeof payload !== "object") {
    return jsonWithCors(request, { error: "Invalid payload" }, { status: 400, allowedOrigins });
  }

  const userId = payload.userId?.toString().trim();
  const state = payload.state;

  if (!userId || !state) {
    return jsonWithCors(request, { error: "Missing userId or state" }, { status: 400, allowedOrigins });
  }

  const db = requireBlogDb(context);
  await ensureSpotifySessionsTable(db);

  const now = Date.now();
  await db
    .prepare("UPDATE game_sessions SET status = ?, algorithm_state = ?, updated_at = ? WHERE user_id = ?")
    .bind(state.status ?? "PLAYING", JSON.stringify(state), now, userId)
    .run();

  return jsonWithCors(request, { ok: true, updatedAt: now }, { allowedOrigins });
}
