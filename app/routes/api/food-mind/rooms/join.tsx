import type { ActionFunctionArgs } from "react-router";

import { joinFoodMindRoom } from "../../../../features/food-mind/food-mind.server";

/**
 * Joins an existing food mind room.
 *
 * @param request - JSON request with a fixed `playerKey` field.
 * @param context - React Router action context.
 * @param params - Route params containing `roomId`.
 * @returns JSON payload with the joined player.
 */
export async function action({ request, context, params }: ActionFunctionArgs): Promise<Response> {
  const roomId = params.roomId ?? "";
  const body = (await request.json().catch(() => null)) as { playerKey?: unknown } | null;
  const playerKey = typeof body?.playerKey === "string" ? body.playerKey : "";
  const player = await joinFoodMindRoom(context, roomId, playerKey);
  return Response.json({ ok: true, player });
}
