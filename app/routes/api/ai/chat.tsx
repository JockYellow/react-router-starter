import type { ActionFunctionArgs } from "react-router";

import { handleAIAction } from "../../../features/ai/handler.server";

export async function action(args: ActionFunctionArgs): Promise<Response> {
  return handleAIAction("chat", args);
}
