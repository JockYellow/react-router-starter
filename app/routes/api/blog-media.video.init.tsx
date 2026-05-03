import type { ActionFunctionArgs } from "react-router";

import { requireCsrf } from "../../features/admin/admin-auth.server";
import {
  createAssetId,
  getMediaStorage,
  MAX_VIDEO_BYTES,
  normalizeDraftOrSlug,
  safeExtension,
  VIDEO_MIME_TYPES,
  VIDEO_PART_BYTES,
} from "../../features/blog/blog-media.server";

export async function action({ request, context }: ActionFunctionArgs) {
  await requireCsrf(request, context);
  if (request.method.toUpperCase() !== "POST") {
    throw Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const payload = (await request.json().catch(() => null)) as {
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    postSlug?: string;
    draftId?: string;
  } | null;
  const mimeType = payload?.mimeType ?? "";
  const sizeBytes = Number(payload?.sizeBytes ?? 0);
  if (!VIDEO_MIME_TYPES.has(mimeType)) {
    throw Response.json({ error: "僅支援 MP4、WebM、MOV" }, { status: 400 });
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_VIDEO_BYTES) {
    throw Response.json({ error: "影片必須小於 512 MiB" }, { status: 413 });
  }

  const assetId = createAssetId();
  const postKey = normalizeDraftOrSlug(payload?.postSlug || payload?.draftId);
  const extension = safeExtension(payload?.fileName ?? "", mimeType);
  const key = `blog/${postKey}/${assetId}/original.${extension}`;
  const { bucket } = getMediaStorage(context);
  const upload = await bucket.createMultipartUpload(key, {
    httpMetadata: {
      contentType: mimeType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return Response.json({
    assetId,
    key,
    uploadId: upload.uploadId,
    partSize: VIDEO_PART_BYTES,
  });
}
