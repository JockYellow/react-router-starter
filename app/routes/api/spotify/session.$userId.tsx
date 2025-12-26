import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

import { requireBlogDb } from "../../../lib/d1.server";
import type { MergeState } from "../../../lib/spotify-ranking";
import { buildCorsHeaders, ensureSpotifySessionsTable, getSpotifyEnv, jsonWithCors, parseJson } from "../../../lib/spotify.server";

type SessionRow = {
  user_id: string;
  status: string | null;
  artist_ids: string | null;
  algorithm_state: string | null;
  total_count: number | null;
  updated_at: number | null;
};

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const { allowedOrigins } = getSpotifyEnv(context, request.url, { requireSecrets: false });
  const userId = params.userId?.toString().trim();
  if (!userId) {
    return jsonWithCors(request, { error: "Missing userId" }, { status: 400, allowedOrigins });
  }

  const db = requireBlogDb(context);
  await ensureSpotifySessionsTable(db);

  const row = await db
    .prepare("SELECT user_id, status, artist_ids, algorithm_state, total_count, updated_at FROM game_sessions WHERE user_id = ?")
    .bind(userId)
    .first<SessionRow>();

  if (!row) {
    return jsonWithCors(request, { status: "IDLE" }, { allowedOrigins });
  }

  const artistIds = parseJson<string[]>(row.artist_ids);
  const state = parseJson<MergeState>(row.algorithm_state);

  return jsonWithCors(
    request,
    {
      status: row.status ?? "IDLE",
      userId: row.user_id,
      artistIds,
      state,
      totalCount: row.total_count ?? artistIds?.length ?? 0,
      updatedAt: row.updated_at ?? null,
    },
    { allowedOrigins },
  );
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { allowedOrigins } = getSpotifyEnv(context, request.url, { requireSecrets: false });
  if (request.method !== "OPTIONS") {
    return jsonWithCors(request, { error: "Method not allowed" }, { status: 405, allowedOrigins });
  }
  return new Response(null, { status: 204, headers: buildCorsHeaders(request, allowedOrigins) });
}
