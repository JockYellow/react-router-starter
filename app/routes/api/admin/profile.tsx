import type { ActionFunctionArgs } from "react-router";

import { handleProfileAdminAction } from "../../../features/profile/profile-admin.server";

export async function action({ request, context }: ActionFunctionArgs) {
  return handleProfileAdminAction(request, context);
}
