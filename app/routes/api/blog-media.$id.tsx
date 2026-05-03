import type { ActionFunctionArgs } from "react-router";

import { requireBlogDb } from "../../lib/d1.server";
import { requireCsrf } from "../../features/admin/admin-auth.server";
import { softDeleteMediaAsset } from "../../features/blog/blog-media.server";

export async function action({ request, context, params }: ActionFunctionArgs) {
  await requireCsrf(request, context);
  if (request.method.toUpperCase() !== "DELETE") {
    throw Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const id = params.id;
  if (!id) throw Response.json({ error: "media id is required" }, { status: 400 });
  await softDeleteMediaAsset(requireBlogDb(context), id);
  return Response.json({ ok: true });
}
