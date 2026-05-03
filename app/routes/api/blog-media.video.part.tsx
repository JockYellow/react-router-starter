import type { ActionFunctionArgs } from "react-router";

import { requireCsrf } from "../../features/admin/admin-auth.server";
import { getMediaStorage, VIDEO_PART_BYTES } from "../../features/blog/blog-media.server";

function hasVideoMagic(bytes: Uint8Array) {
  const text4 = String.fromCharCode(...bytes.slice(0, 4));
  const text8 = String.fromCharCode(...bytes.slice(4, 8));
  return text4 === "\u001aEß£" || text8 === "ftyp";
}

export async function action({ request, context }: ActionFunctionArgs) {
  await requireCsrf(request, context);
  if (request.method.toUpperCase() !== "PUT") {
    throw Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  const uploadId = url.searchParams.get("uploadId") ?? "";
  const partNumber = Number(url.searchParams.get("partNumber") ?? "0");
  const isFirstPart = partNumber === 1;
  if (!key.startsWith("blog/") || !uploadId || !Number.isInteger(partNumber) || partNumber < 1) {
    throw Response.json({ error: "Invalid multipart params" }, { status: 400 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > VIDEO_PART_BYTES) {
    throw Response.json({ error: "影片分片超過 8 MiB" }, { status: 413 });
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > VIDEO_PART_BYTES) {
    throw Response.json({ error: "影片分片大小不正確" }, { status: 413 });
  }
  if (isFirstPart && !hasVideoMagic(bytes.slice(0, 16))) {
    throw Response.json({ error: "影片格式驗證失敗" }, { status: 400 });
  }
  const { bucket } = getMediaStorage(context);
  const upload = bucket.resumeMultipartUpload(key, uploadId);
  const uploadedPart = await upload.uploadPart(partNumber, bytes);
  return Response.json({ part: uploadedPart });
}
