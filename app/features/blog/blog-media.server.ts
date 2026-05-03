import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { buildPublicImageUrl, requireBlogImagesBucket, requireBlogImagesPublicBase } from "../../lib/r2.server";
import type { BlogMediaAsset, BlogMediaKind } from "./blog.types";

type Context = ActionFunctionArgs["context"] | LoaderFunctionArgs["context"];

export const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 512 * 1024 * 1024;
export const VIDEO_PART_BYTES = 8 * 1024 * 1024;

export function createAssetId() {
  const buffer = new Uint8Array(16);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function safeExtension(name: string, mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "video/mp4") return "mp4";
  if (mimeType === "video/webm") return "webm";
  if (mimeType === "video/quicktime") return "mov";
  const match = name.toLowerCase().match(/\.([a-z0-9]{2,8})$/);
  return match?.[1] ?? "bin";
}

export function normalizeDraftOrSlug(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || `draft-${Date.now().toString(36)}`;
}

export async function ensureBlogMediaTables(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS blog_media_assets (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
        r2_key TEXT NOT NULL UNIQUE,
        public_url TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        width INTEGER,
        height INTEGER,
        duration_sec REAL,
        alt TEXT,
        caption TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`,
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS blog_post_media (
        post_slug TEXT NOT NULL,
        media_id TEXT NOT NULL,
        usage_type TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        PRIMARY KEY (post_slug, media_id, usage_type)
      )`,
    )
    .run();
}

export function mapMediaRow(row: Record<string, any>): BlogMediaAsset {
  return {
    id: row.id,
    kind: row.kind as BlogMediaKind,
    r2Key: row.r2_key,
    publicUrl: row.public_url,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    width: row.width ?? null,
    height: row.height ?? null,
    durationSec: row.duration_sec ?? null,
    alt: row.alt ?? null,
    caption: row.caption ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? null,
  };
}

export async function insertMediaAsset(
  db: D1Database,
  input: {
    id: string;
    kind: BlogMediaKind;
    r2Key: string;
    publicUrl: string;
    mimeType: string;
    sizeBytes: number;
    width?: number | null;
    height?: number | null;
    durationSec?: number | null;
    alt?: string | null;
    caption?: string | null;
  },
) {
  await ensureBlogMediaTables(db);
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO blog_media_assets
       (id, kind, r2_key, public_url, mime_type, size_bytes, width, height, duration_sec, alt, caption, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.kind,
      input.r2Key,
      input.publicUrl,
      input.mimeType,
      input.sizeBytes,
      input.width ?? null,
      input.height ?? null,
      input.durationSec ?? null,
      input.alt ?? null,
      input.caption ?? null,
      now,
      now,
    )
    .run();
  const row = await db.prepare("SELECT * FROM blog_media_assets WHERE id = ?").bind(input.id).first<Record<string, any>>();
  return row ? mapMediaRow(row) : null;
}

export async function replacePostMediaReferences(db: D1Database, slug: string, mediaIds: string[]) {
  await ensureBlogMediaTables(db);
  await db.prepare("DELETE FROM blog_post_media WHERE post_slug = ?").bind(slug).run();
  const now = new Date().toISOString();
  let order = 0;
  for (const mediaId of mediaIds) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO blog_post_media (post_slug, media_id, usage_type, sort_order, created_at)
         VALUES (?, ?, 'content', ?, ?)`,
      )
      .bind(slug, mediaId, order, now)
      .run();
    order += 1;
  }
}

export async function softDeleteMediaAsset(db: D1Database, id: string) {
  await ensureBlogMediaTables(db);
  const now = new Date().toISOString();
  await db.prepare("UPDATE blog_media_assets SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(now, now, id).run();
  await db.prepare("DELETE FROM blog_post_media WHERE media_id = ?").bind(id).run();
}

export function getMediaStorage(context: Context) {
  return {
    bucket: requireBlogImagesBucket(context),
    publicBase: requireBlogImagesPublicBase(context),
  };
}

export function publicUrlFor(context: Context, key: string) {
  const publicBase = requireBlogImagesPublicBase(context);
  return buildPublicImageUrl(publicBase, key);
}
