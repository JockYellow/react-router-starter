import type { LoaderFunctionArgs } from "react-router";

import { requireAdmin } from "../../features/admin/admin-auth.server";
import { prefetchAnimeSurveyCredits } from "../../features/anime/anime-credits.server";
import { requireBlogDb } from "../../lib/d1.server";

function parseAnimeIds(value: string | null): number[] {
  if (!value) return [];
  return Array.from(new Set(
    value
      .split(",")
      .map((part) => Number(part))
      .filter((animeId) => Number.isInteger(animeId) && animeId > 0),
  )).slice(0, 20);
}

export async function loader({ request, context }: LoaderFunctionArgs): Promise<Response> {
  await requireAdmin(request, context);
  const url = new URL(request.url);
  const animeIds = parseAnimeIds(url.searchParams.get("ids"));
  if (!animeIds.length) return Response.json({ ok: true, items: [] });

  const db = requireBlogDb(context);
  const items = await prefetchAnimeSurveyCredits(db, animeIds, 4);
  return Response.json({ ok: true, items }, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
