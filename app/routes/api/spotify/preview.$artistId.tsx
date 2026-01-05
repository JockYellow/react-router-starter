import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

import { buildCorsHeaders, getSpotifyAppToken, getSpotifyEnv, jsonWithCors } from "../../../features/spotify/spotify.server";

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const env = getSpotifyEnv(context, request.url);
  const artistId = params.artistId?.toString().trim();

  if (!artistId) {
    return jsonWithCors(request, { error: "Missing artistId" }, { status: 400, allowedOrigins: env.allowedOrigins });
  }

  const token = await getSpotifyAppToken(env);
  const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    return jsonWithCors(
      request,
      { error: errorText || `Spotify API error: ${res.status}` },
      { status: 502, allowedOrigins: env.allowedOrigins },
    );
  }

  const data = (await res.json()) as { tracks?: { preview_url: string | null }[] };
  const previewUrl = data.tracks?.find((track) => track.preview_url)?.preview_url ?? null;
  return jsonWithCors(request, { previewUrl }, { allowedOrigins: env.allowedOrigins });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { allowedOrigins } = getSpotifyEnv(context, request.url, { requireSecrets: false });
  if (request.method !== "OPTIONS") {
    return jsonWithCors(request, { error: "Method not allowed" }, { status: 405, allowedOrigins });
  }
  return new Response(null, { status: 204, headers: buildCorsHeaders(request, allowedOrigins) });
}
