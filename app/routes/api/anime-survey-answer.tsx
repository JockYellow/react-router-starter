import type { ActionFunctionArgs } from "react-router";

import { requireAdmin } from "../../features/admin/admin-auth.server";
import { saveFastSurveyPrimaryDecision } from "../../features/anime/anime-survey-fast-save.server";
import { ANIME_SEASONS, type AnimeSeason } from "../../features/anime/anime.types";
import { requireBlogDb } from "../../lib/d1.server";

function isSeason(value: string): value is AnimeSeason {
  return ANIME_SEASONS.includes(value as AnimeSeason);
}

/**
 * Lightweight endpoint used only by optimistic Want / Not Seen answers.
 */
export async function action({ request, context }: ActionFunctionArgs): Promise<Response> {
  await requireAdmin(request, context);
  const formData = await request.formData();
  const year = Number(formData.get("year"));
  const season = String(formData.get("season") ?? "");
  const animeId = Number(formData.get("animeId"));
  const status = String(formData.get("status") ?? "");

  if (!Number.isInteger(year) || year < 1901 || year > 2100 || !isSeason(season)) {
    return Response.json({ error: "Invalid survey scope" }, { status: 400 });
  }
  if (!Number.isInteger(animeId) || animeId <= 0) {
    return Response.json({ error: "Invalid anime id" }, { status: 400 });
  }
  if (status !== "WANT" && status !== "NOT_SEEN") {
    return Response.json({ error: "Invalid optimistic primary decision" }, { status: 400 });
  }

  await saveFastSurveyPrimaryDecision(
    requireBlogDb(context),
    { type: "TV_SEASON", year, season },
    animeId,
    status,
  );

  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
