import type { ActionFunctionArgs } from "react-router";

import { requireBlogDb } from "../../lib/d1.server";
import { processBlogImage } from "../../lib/image-processing.server";
import { requireCsrf } from "../../features/admin/admin-auth.server";
import {
  createAssetId,
  getMediaStorage,
  IMAGE_MIME_TYPES,
  insertMediaAsset,
  MAX_IMAGE_BYTES,
  normalizeDraftOrSlug,
} from "../../features/blog/blog-media.server";

function readString(formData: FormData, key: string) {
  return (formData.get(key) ?? "").toString().trim();
}

function hasImageMagic(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (mime === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (mime === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function action({ request, context }: ActionFunctionArgs) {
  await requireCsrf(request, context);
  if (request.method.toUpperCase() !== "POST") {
    throw Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    throw Response.json({ error: "圖片必填" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw Response.json({ error: "圖片超過 15 MiB" }, { status: 413 });
  }
  if (!IMAGE_MIME_TYPES.has(file.type)) {
    throw Response.json({ error: "僅支援 JPEG、PNG、WebP" }, { status: 400 });
  }
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!hasImageMagic(header, file.type)) {
    throw Response.json({ error: "圖片格式驗證失敗" }, { status: 400 });
  }

  const postKey = normalizeDraftOrSlug(readString(formData, "postSlug") || readString(formData, "draftId"));
  const alt = readString(formData, "alt");
  const caption = readString(formData, "caption");
  const assetId = createAssetId();
  const displayKey = `blog/${postKey}/${assetId}/display.webp`;
  const thumbKey = `blog/${postKey}/${assetId}/thumb.webp`;
  const { bucket, publicBase } = getMediaStorage(context);
  const processed = await processBlogImage(file);

  await Promise.all([
    bucket.put(displayKey, processed.display.data, {
      httpMetadata: { contentType: processed.display.contentType, cacheControl: "public, max-age=31536000, immutable" },
    }),
    bucket.put(thumbKey, processed.thumb.data, {
      httpMetadata: { contentType: processed.thumb.contentType, cacheControl: "public, max-age=31536000, immutable" },
    }),
  ]);

  const publicUrl = new URL(displayKey, publicBase).toString();
  const db = requireBlogDb(context);
  const asset = await insertMediaAsset(db, {
    id: assetId,
    kind: "image",
    r2Key: displayKey,
    publicUrl,
    mimeType: "image/webp",
    sizeBytes: processed.originalBytes,
    width: processed.width,
    height: processed.height,
    alt,
    caption,
  });
  return Response.json({ asset, thumbUrl: new URL(thumbKey, publicBase).toString() });
}
