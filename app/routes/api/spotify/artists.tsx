import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

import { buildCorsHeaders, getSpotifyAppToken, getSpotifyEnv, jsonWithCors } from "../../../features/spotify/spotify.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = getSpotifyEnv(context, request.url);
  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return jsonWithCors(request, { error: "Missing ids" }, { status: 400, allowedOrigins: env.allowedOrigins });
  }
  if (ids.length > 50) {
    return jsonWithCors(request, { error: "Too many ids" }, { status: 400, allowedOrigins: env.allowedOrigins });
  }

  const token = await getSpotifyAppToken(env);
  const params = new URLSearchParams({ ids: ids.join(",") });

  const res = await fetch(`https://api.spotify.com/v1/artists?${params.toString()}`, {
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

  const data = await res.json();
  return jsonWithCors(request, data, { allowedOrigins: env.allowedOrigins });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { allowedOrigins } = getSpotifyEnv(context, request.url, { requireSecrets: false });
  if (request.method !== "OPTIONS") {
    return jsonWithCors(request, { error: "Method not allowed" }, { status: 405, allowedOrigins });
  }
  return new Response(null, { status: 204, headers: buildCorsHeaders(request, allowedOrigins) });
}
