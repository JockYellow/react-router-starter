import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { requireAdmin } from "../../../features/admin/admin-auth.server";
import { processSurveyLoadStep, retrySurveyLoadStep } from "../../../features/anime/anime-survey-load.server";
import { ANIME_SEASONS, type AnimeSeason } from "../../../features/anime/anime.types";
import { requireBlogDb } from "../../../lib/d1.server";

function isSeason(value: string): value is AnimeSeason {
  return ANIME_SEASONS.includes(value as AnimeSeason);
}

function parseScope(formData: FormData) {
  const year = Number(formData.get("year"));
  const seasonValue = String(formData.get("season") ?? "");
  if (!Number.isInteger(year) || year < 1901 || year > 2100 || !isSeason(seasonValue)) {
    throw new Response("Invalid survey scope", { status: 400 });
  }
  return { type: "TV_SEASON" as const, year, season: seasonValue };
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireAdmin(request, context);
  throw new Response("Method not allowed", { status: 405 });
}

export async function action({ request, context }: ActionFunctionArgs) {
  await requireAdmin(request, context);
  const db = requireBlogDb(context);
  const formData = await request.formData();
  const scope = parseScope(formData);
  const intent = String(formData.get("intent") ?? "");

  if (intent === "initialize-step") {
    return Response.json(await processSurveyLoadStep(db, scope, { targetCount: 100 }));
  }

  if (intent === "retry-load") {
    return Response.json({ kind: "RETRYING" as const, state: await retrySurveyLoadStep(db, scope) });
  }

  throw new Response("Unknown anime survey load action", { status: 400 });
}
