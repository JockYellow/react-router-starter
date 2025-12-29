import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

import { buildCorsHeaders, getSpotifyAppToken, getSpotifyEnv, jsonWithCors } from "../../../lib/spotify.server";

type AlbumItem = {
  name: string;
  release_date: string;
  release_date_precision: "year" | "month" | "day" | string;
  album_group?: string | null;
};

function toComparableDate(value: AlbumItem) {
  const date = value.release_date;
  const precision = value.release_date_precision;
  if (!date) return null;

  if (precision === "day") {
    const parsed = new Date(date);
    return Number.isNaN(parsed.valueOf()) ? null : parsed.valueOf();
  }

  if (precision === "month") {
    const [yearStr, monthStr] = date.split("-");
    const year = Number.parseInt(yearStr, 10);
    const month = Number.parseInt(monthStr, 10);
    if (!year || !month) return null;
    const lastDay = new Date(year, month, 0).getDate();
    const parsed = new Date(`${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`);
    return Number.isNaN(parsed.valueOf()) ? null : parsed.valueOf();
  }

  if (precision === "year") {
    const year = Number.parseInt(date, 10);
    if (!year) return null;
    const parsed = new Date(`${year}-12-31`);
    return Number.isNaN(parsed.valueOf()) ? null : parsed.valueOf();
  }

  const fallback = new Date(date);
  return Number.isNaN(fallback.valueOf()) ? null : fallback.valueOf();
}

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const env = getSpotifyEnv(context, request.url);
  const artistId = params.artistId?.toString().trim();

  if (!artistId) {
    return jsonWithCors(request, { error: "Missing artistId" }, { status: 400, allowedOrigins: env.allowedOrigins });
  }

  const token = await getSpotifyAppToken(env);
  const query = new URLSearchParams({
    include_groups: "album,single",
    limit: "50",
  });
  const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}/albums?${query.toString()}`, {
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

  const data = (await res.json()) as { items?: AlbumItem[] };
  const candidates = (data.items ?? [])
    .filter((item) => item.release_date)
    .filter((item) => !item.album_group || item.album_group === "album" || item.album_group === "single");
  const latest = candidates
    .map((item) => ({
      item,
      ts: toComparableDate(item),
    }))
    .filter((entry) => entry.ts !== null)
    .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
    .map((entry) => entry.item)[0];

  return jsonWithCors(
    request,
    {
      releaseName: latest?.name ?? null,
      releaseDate: latest?.release_date ?? null,
      releasePrecision: latest?.release_date_precision ?? null,
    },
    { allowedOrigins: env.allowedOrigins },
  );
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { allowedOrigins } = getSpotifyEnv(context, request.url, { requireSecrets: false });
  if (request.method !== "OPTIONS") {
    return jsonWithCors(request, { error: "Method not allowed" }, { status: 405, allowedOrigins });
  }
  return new Response(null, { status: 204, headers: buildCorsHeaders(request, allowedOrigins) });
}
