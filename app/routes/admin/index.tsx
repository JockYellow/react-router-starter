import { redirect } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { requireAdmin } from "../../features/admin/admin-auth.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireAdmin(request, context);
  throw redirect("/admin/blog-edit");
}

export async function action({ request, context }: ActionFunctionArgs) {
  await requireAdmin(request, context);
  throw redirect("/admin/blog-edit");
}

export default function AdminIndexRedirect() {
  return null;
}
