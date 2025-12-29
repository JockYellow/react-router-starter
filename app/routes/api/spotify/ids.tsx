import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

import { requireBlogDb } from "../../../lib/d1.server";
import { buildCorsHeaders, ensureSpotifyArtistsTable, getSpotifyEnv, jsonWithCors } from "../../../lib/spotify.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { allowedOrigins } = getSpotifyEnv(context, request.url, { requireSecrets: false });
  const url = new URL(request.url);
  const datasetKey = (url.searchParams.get("dataset") ?? "default").trim() || "default";

  const db = requireBlogDb(context);
  await ensureSpotifyArtistsTable(db);

  const rows = await db
    .prepare("SELECT artist_id FROM spotify_followed_artists WHERE dataset_key = ? ORDER BY imported_at DESC")
    .bind(datasetKey)
    .all<{ artist_id: string }>();

  const artistIds = (rows.results ?? []).map((row) => row.artist_id);

  return jsonWithCors(
    request,
    { datasetKey, artistIds, totalCount: artistIds.length },
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
