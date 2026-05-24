import type { LoaderFunctionArgs } from "react-router";

import { getFoodMindResult } from "../../../../features/food-mind/food-mind.server";

/**
 * Returns result statistics for a food mind room.
 *
 * @param context - React Router loader context.
 * @param params - Route params containing `roomId`.
 * @returns JSON result payload.
 */
export async function loader({ context, params }: LoaderFunctionArgs): Promise<Response> {
  const result = await getFoodMindResult(context, params.roomId ?? "");
  return Response.json(result);
}
