import type { ActionFunctionArgs } from "react-router";

import { requireCsrf } from "../../features/admin/admin-auth.server";
import { getMediaStorage } from "../../features/blog/blog-media.server";

export async function action({ request, context }: ActionFunctionArgs) {
  await requireCsrf(request, context);
  if (request.method.toUpperCase() !== "POST") {
    throw Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const payload = (await request.json().catch(() => null)) as { key?: string; uploadId?: string } | null;
  if (!payload?.key?.startsWith("blog/") || !payload.uploadId) {
    throw Response.json({ error: "Invalid abort payload" }, { status: 400 });
  }
  const { bucket } = getMediaStorage(context);
  await bucket.resumeMultipartUpload(payload.key, payload.uploadId).abort();
  return Response.json({ ok: true });
}
