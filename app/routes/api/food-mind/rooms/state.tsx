import type { LoaderFunctionArgs } from "react-router";

import { getFoodMindState } from "../../../../features/food-mind/food-mind.server";

/**
 * Returns the current polling state for a food mind room.
 *
 * @param request - HTTP request with optional `playerId` query param.
 * @param context - React Router loader context.
 * @param params - Route params containing `roomId`.
 * @returns JSON room state payload.
 */
export async function loader({ request, context, params }: LoaderFunctionArgs): Promise<Response> {
  const url = new URL(request.url);
  const state = await getFoodMindState(context, params.roomId ?? "", url.searchParams.get("playerId"));
  return Response.json(state);
}
