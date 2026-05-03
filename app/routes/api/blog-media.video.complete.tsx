import type { ActionFunctionArgs } from "react-router";

import { requireBlogDb } from "../../lib/d1.server";
import { requireCsrf } from "../../features/admin/admin-auth.server";
import {
  getMediaStorage,
  insertMediaAsset,
  MAX_VIDEO_BYTES,
  publicUrlFor,
  VIDEO_MIME_TYPES,
} from "../../features/blog/blog-media.server";

export async function action({ request, context }: ActionFunctionArgs) {
  await requireCsrf(request, context);
  if (request.method.toUpperCase() !== "POST") {
    throw Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const payload = (await request.json().catch(() => null)) as {
    assetId?: string;
    key?: string;
    uploadId?: string;
    parts?: Array<{ partNumber: number; etag: string }>;
    mimeType?: string;
    sizeBytes?: number;
    alt?: string;
    caption?: string;
  } | null;
  if (!payload?.assetId || !payload.key?.startsWith("blog/") || !payload.uploadId || !Array.isArray(payload.parts)) {
    throw Response.json({ error: "Invalid complete payload" }, { status: 400 });
  }
  const sizeBytes = Number(payload.sizeBytes ?? 0);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_VIDEO_BYTES) {
    throw Response.json({ error: "影片大小不正確" }, { status: 413 });
  }
  if (!payload.mimeType || !VIDEO_MIME_TYPES.has(payload.mimeType)) {
    throw Response.json({ error: "影片格式不支援" }, { status: 400 });
  }
  const { bucket } = getMediaStorage(context);
  const upload = bucket.resumeMultipartUpload(payload.key, payload.uploadId);
  await upload.complete(payload.parts);

  const db = requireBlogDb(context);
  const asset = await insertMediaAsset(db, {
    id: payload.assetId,
    kind: "video",
    r2Key: payload.key,
    publicUrl: publicUrlFor(context, payload.key),
    mimeType: payload.mimeType,
    sizeBytes,
    alt: payload.alt?.trim() ?? "",
    caption: payload.caption?.trim() ?? "",
  });
  return Response.json({ asset });
}
