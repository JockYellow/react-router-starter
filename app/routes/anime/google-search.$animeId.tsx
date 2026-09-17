import type { LoaderFunctionArgs } from "react-router";

import { requireAdmin } from "../../features/admin/admin-auth.server";
import { requireBlogDb } from "../../lib/d1.server";

type AnimeSearchTitleRow = {
  title_zh_tw: string | null;
  title_native: string | null;
  title_romaji: string | null;
  title_english: string | null;
};

function firstTitle(row: AnimeSearchTitleRow): string | null {
  for (const value of [row.title_zh_tw, row.title_native, row.title_romaji, row.title_english]) {
    const title = value?.trim();
    if (title) return title;
  }
  return null;
}

export async function loader({ request, context, params }: LoaderFunctionArgs): Promise<Response> {
  await requireAdmin(request, context);
  const animeId = Number(params.animeId);
  if (!Number.isInteger(animeId) || animeId <= 0) {
    throw new Response("Invalid anime id", { status: 400 });
  }

  const db = requireBlogDb(context);
  const row = await db
    .prepare(
      `SELECT title_zh_tw, title_native, title_romaji, title_english
       FROM anime_items
       WHERE anime_id = ?`,
    )
    .bind(animeId)
    .first<AnimeSearchTitleRow>();

  if (!row) throw new Response("Anime not found", { status: 404 });
  const title = firstTitle(row);
  if (!title) throw new Response("Anime title not found", { status: 404 });

  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", title);
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Cache-Control": "no-store",
    },
  });
}
