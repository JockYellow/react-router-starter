import type { LoaderFunctionArgs } from "react-router";

import { requireAdmin } from "../../features/admin/admin-auth.server";
import { getAnimePersonalRecord } from "../../features/anime/anime-record.server";
import { getNextUnresolvedSurveyCandidates } from "../../features/anime/anime-survey.server";
import { ANIME_SEASONS, type AnimeSeason } from "../../features/anime/anime.types";
import { requireBlogDb } from "../../lib/d1.server";

function isSeason(value: string | null): value is AnimeSeason {
  return Boolean(value && ANIME_SEASONS.includes(value as AnimeSeason));
}

function parsePositiveIds(value: string | null): number[] {
  if (!value) return [];
  return Array.from(new Set(
    value
      .split(",")
      .map((part) => Number(part))
      .filter((animeId) => Number.isInteger(animeId) && animeId > 0),
  )).slice(0, 200);
}

/**
 * Returns the next small unresolved Anime survey queue for optimistic refill.
 */
export async function loader({ request, context }: LoaderFunctionArgs): Promise<Response> {
  await requireAdmin(request, context);
  const db = requireBlogDb(context);
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  const season = url.searchParams.get("season");
  const requestedLimit = Number(url.searchParams.get("limit") ?? 5);

  if (!Number.isInteger(year) || year < 1901 || year > 2100 || !isSeason(season)) {
    return Response.json({ error: "Invalid survey scope" }, { status: 400 });
  }

  const limit = Number.isInteger(requestedLimit)
    ? Math.max(1, Math.min(requestedLimit, 5))
    : 5;
  const excludeAnimeIds = parsePositiveIds(url.searchParams.get("exclude"));
  const scope = { type: "TV_SEASON" as const, year, season };
  const candidates = await getNextUnresolvedSurveyCandidates(db, scope, {
    limit,
    excludeAnimeIds,
  });
  const items = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      record: await getAnimePersonalRecord(db, candidate.animeId),
    })),
  );

  return Response.json({ ok: true, items });
}
