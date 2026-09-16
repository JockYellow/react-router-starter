import type { LoaderFunctionArgs } from "react-router";

import { requireAdmin } from "../../features/admin/admin-auth.server";
import { getAnimeSurveyCredits } from "../../features/anime/anime-credits.server";
import { requireBlogDb } from "../../lib/d1.server";

export async function loader({ request, context, params }: LoaderFunctionArgs): Promise<Response> {
  await requireAdmin(request, context);
  const animeId = Number(params.animeId);
  if (!Number.isInteger(animeId) || animeId <= 0) {
    return Response.json({ error: "Invalid anime id" }, { status: 400 });
  }

  const credits = await getAnimeSurveyCredits(requireBlogDb(context), animeId);
  return Response.json(
    { ok: true, ...credits },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
