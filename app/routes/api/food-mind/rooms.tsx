import type { ActionFunctionArgs } from "react-router";

import { createFoodMindRoom } from "../../../features/food-mind/food-mind.server";

/**
 * Creates a new food mind room.
 *
 * @param request - Optional JSON request with `themeId`.
 * @param context - React Router action context.
 * @returns JSON payload with the created room.
 */
export async function action({ request, context }: ActionFunctionArgs): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { themeId?: unknown } | null;
  const themeId = typeof body?.themeId === "string" ? body.themeId : null;
  const room = await createFoodMindRoom(context, themeId);
  return Response.json({ ok: true, room });
}
