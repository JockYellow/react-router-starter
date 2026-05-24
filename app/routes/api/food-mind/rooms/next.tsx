import type { ActionFunctionArgs } from "react-router";

import { advanceFoodMindRoom } from "../../../../features/food-mind/food-mind.server";

/**
 * Advances a room to the next card after reveal.
 *
 * @param request - JSON request with `expectedIndex`.
 * @param context - React Router action context.
 * @param params - Route params containing `roomId`.
 * @returns Updated room state payload.
 */
export async function action({ request, context, params }: ActionFunctionArgs): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { expectedIndex?: unknown } | null;
  const expectedIndex = typeof body?.expectedIndex === "number" && Number.isInteger(body.expectedIndex) ? body.expectedIndex : -1;
  const state = await advanceFoodMindRoom(context, params.roomId ?? "", expectedIndex);
  return Response.json(state);
}
