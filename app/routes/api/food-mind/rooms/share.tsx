import type { LoaderFunctionArgs } from "react-router";

import { getFoodMindShare } from "../../../../features/food-mind/food-mind.server";

/**
 * Returns a compact sharing summary for a food mind room.
 *
 * @param context - React Router loader context.
 * @param params - Route params containing `roomId`.
 * @returns JSON share payload.
 */
export async function loader({ context, params }: LoaderFunctionArgs): Promise<Response> {
  const share = await getFoodMindShare(context, params.roomId ?? "");
  return Response.json(share);
}
