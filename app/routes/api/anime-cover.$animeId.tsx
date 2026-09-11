import type { LoaderFunctionArgs } from "react-router";

import { requireAdmin } from "../../features/admin/admin-auth.server";
import { getAnimeCoverSourceUrl } from "../../features/anime/anime-cover.server";
import { requireBlogDb } from "../../lib/d1.server";

const COVER_ACCEPT = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8";
const COVER_USER_AGENT = "JockYellow/AnimeMemory (+https://github.com/JockYellow/react-router-starter)";

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  await requireAdmin(request, context);

  const animeId = Number(params.animeId);
  if (!Number.isInteger(animeId) || animeId <= 0) {
    throw new Response("Invalid anime id", { status: 400 });
  }

  const sourceUrl = await getAnimeCoverSourceUrl(requireBlogDb(context), animeId);
  if (!sourceUrl) {
    throw new Response("Anime cover not found", { status: 404 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(sourceUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: COVER_ACCEPT,
        "User-Agent": COVER_USER_AGENT,
      },
    });
  } catch {
    throw new Response("Anime cover upstream unavailable", { status: 502 });
  }

  if (!upstream.ok) {
    throw new Response(`Anime cover upstream failed (${upstream.status})`, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Response("Anime cover upstream returned non-image content", { status: 502 });
  }

  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  });
  const etag = upstream.headers.get("etag");
  if (etag) headers.set("ETag", etag);
  const lastModified = upstream.headers.get("last-modified");
  if (lastModified) headers.set("Last-Modified", lastModified);

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}
