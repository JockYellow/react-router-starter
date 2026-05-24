import type { ActionFunctionArgs } from "react-router";

import { answerFoodMindCard, answerFoodMindRankingSet } from "../../../../features/food-mind/food-mind.server";
import { isFoodMindScore } from "../../../../features/food-mind/food-mind.rules";

/**
 * Stores the current player's own score and prediction for the current card.
 *
 * @param request - JSON request with `playerId`, `selfScore`, and `predictPartnerScore`.
 * @param context - React Router action context.
 * @param params - Route params containing `roomId`.
 * @returns Updated room state payload.
 */
export async function action({ request, context, params }: ActionFunctionArgs): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | {
        playerId?: unknown;
        selfScore?: unknown;
        predictPartnerScore?: unknown;
        selfOrder?: unknown;
        predictPartnerOrder?: unknown;
      }
    | null;

  if (!body || typeof body.playerId !== "string") {
    return Response.json({ ok: false, error: "Invalid answer payload" }, { status: 400 });
  }

  if (Array.isArray(body.selfOrder) || Array.isArray(body.predictPartnerOrder)) {
    const state = await answerFoodMindRankingSet(
      context,
      params.roomId ?? "",
      body.playerId,
      Array.isArray(body.selfOrder) ? body.selfOrder.filter((item): item is string => typeof item === "string") : [],
      Array.isArray(body.predictPartnerOrder)
        ? body.predictPartnerOrder.filter((item): item is string => typeof item === "string")
        : [],
    );
    return Response.json(state);
  }

  if (!isFoodMindScore(body.selfScore) || !isFoodMindScore(body.predictPartnerScore)) {
    return Response.json({ ok: false, error: "Invalid answer payload" }, { status: 400 });
  }

  const state = await answerFoodMindCard(
    context,
    params.roomId ?? "",
    body.playerId,
    body.selfScore,
    body.predictPartnerScore,
  );
  return Response.json(state);
}
