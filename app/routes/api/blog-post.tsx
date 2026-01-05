import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

import { requireBlogDb } from "../../lib/d1.server";
import { getBlogPostBySlug } from "../../features/blog/blog.d1.server";
import type { BlogPost } from "../../features/blog/blog.types";
import { requireAdmin } from "../../features/admin/admin-auth.server";
import { processCoverImage } from "../../lib/image-processing.server";
import { buildPublicImageUrl, requireBlogImagesBucket, requireBlogImagesPublicBase } from "../../lib/r2.server";

type IncomingPostPayload = Partial<BlogPost> & {
  updatedAtBase?: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  imageFile?: File | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizeIsoDate(value: unknown, fallback: string) {
  if (!value) return fallback;
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.valueOf())) return fallback;
  return parsed.toISOString();
}

function normalizeString(value: unknown) {
  return (value ?? "").toString().trim();
}

function normalizeCategory(value: unknown) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function parseTags(input: unknown) {
  const tags = new Set<string>();
  if (Array.isArray(input)) {
    for (const tag of input) {
      const value = normalizeString(tag);
      if (value) tags.add(value);
    }
  } else if (typeof input === "string") {
    for (const raw of input.split(",")) {
      const value = normalizeString(raw);
      if (value) tags.add(value);
    }
  }
  return Array.from(tags);
}

async function parsePayload(request: Request): Promise<IncomingPostPayload> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.startsWith("multipart/form-data")) {
    const formData = await request.formData();
    const tags = new Set<string>();
    const tagsField = formData.get("tags");
    if (typeof tagsField === "string") {
      for (const raw of tagsField.split(",")) {
        const value = normalizeString(raw);
        if (value) tags.add(value);
      }
    }
    for (const raw of formData.getAll("tag")) {
      const value = normalizeString(raw);
      if (value) tags.add(value);
    }

    const imageCandidate = formData.get("image");
    const imageFile = imageCandidate instanceof File && imageCandidate.size > 0 ? imageCandidate : null;

    const hasBody = formData.has("body");
    const hasSummary = formData.has("summary");
    const hasTitle = formData.has("title");
    const hasPublishedAt = formData.has("publishedAt");

    return {
      slug: normalizeString(formData.get("slug")),
      title: hasTitle ? normalizeString(formData.get("title")) : undefined,
      summary: hasSummary ? normalizeString(formData.get("summary")) : undefined,
      body: hasBody ? (formData.get("body") ?? "").toString() : undefined,
      categoryId: formData.has("categoryId") ? normalizeCategory(formData.get("categoryId")) : undefined,
      subcategoryId: formData.has("subcategoryId") ? normalizeCategory(formData.get("subcategoryId")) : undefined,
      publishedAt: hasPublishedAt ? normalizeString(formData.get("publishedAt")) : undefined,
      updatedAtBase: formData.has("updatedAtBase") ? normalizeString(formData.get("updatedAtBase")) : undefined,
      tags: Array.from(tags),
      imageFile,
    };
  }

  const payload = (await request.json()) as any;
  return {
    slug: normalizeString(payload.slug),
    title: normalizeString(payload.title),
    summary: normalizeString(payload.summary),
    body: (payload.body ?? "").toString(),
    categoryId: normalizeCategory(payload.categoryId),
    subcategoryId: normalizeCategory(payload.subcategoryId),
    publishedAt: normalizeString(payload.publishedAt),
    updatedAtBase: normalizeString(payload.updatedAtBase),
    tags: parseTags(payload.tags),
  };
}

async function uploadCoverImage(context: ActionFunctionArgs["context"], file: File, slug: string) {
  if (file.type && !file.type.startsWith("image/")) {
    throw Response.json({ error: "僅支援上傳圖片" }, { status: 400 });
  }
  const bucket = requireBlogImagesBucket(context);
  const publicBase = requireBlogImagesPublicBase(context);
  const processed = await processCoverImage(file);
  const key = `posts/${slug}/cover.webp`;
  await bucket.put(key, processed.data, {
    httpMetadata: {
      contentType: processed.contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return buildPublicImageUrl(publicBase, key);
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  requireAdmin(request, context);
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) {
    throw Response.json({ error: "slug is required" }, { status: 400 });
  }
  const db = requireBlogDb(context);
  const post = await getBlogPostBySlug(db, slug);
  if (!post) {
    throw Response.json({ error: "Post not found" }, { status: 404 });
  }
  return Response.json(post);
}

async function handlePost(request: Request, context: ActionFunctionArgs["context"]) {
  const payload = await parsePayload(request);
  const title = normalizeString(payload.title);
  const body = (payload.body ?? "").toString();
  const summary = normalizeString(payload.summary);
  const categoryId = normalizeCategory(payload.categoryId);
  const subcategoryId = normalizeCategory(payload.subcategoryId);

  if (!title || !body) {
    throw Response.json({ error: "title and body are required" }, { status: 400 });
  }
  const slugInput = payload.slug || title;
  const slug = slugify(slugInput) || slugify(`${title}-${Date.now()}`);
  const now = new Date().toISOString();
  const publishedAt = normalizeIsoDate(payload.publishedAt, now);
  const createdAt = payload.createdAt ?? now;
  const updatedAt = now;

  const db = requireBlogDb(context);
  const existing = await getBlogPostBySlug(db, slug);
  if (existing) {
    throw Response.json({ error: "slug already exists" }, { status: 409 });
  }

  const tags = JSON.stringify(parseTags(payload.tags));
  let imageUrl: string | null = null;
  if (payload.imageFile) {
    imageUrl = await uploadCoverImage(context, payload.imageFile, slug);
  }

  await db
    .prepare(
      `INSERT INTO blog_posts
        (slug, title, summary, body, image_url, tags, category_id, subcategory_id, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(slug, title, summary, body, imageUrl, tags, categoryId, subcategoryId, publishedAt, createdAt, updatedAt)
    .run();

  return Response.json({ ok: true, slug, imageUrl });
}

async function handlePut(request: Request, context: ActionFunctionArgs["context"]) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) {
    throw Response.json({ error: "slug is required" }, { status: 400 });
  }

  const payload = await parsePayload(request);

  const db = requireBlogDb(context);
  const existing = await getBlogPostBySlug(db, slug);
  if (!existing) {
    throw Response.json({ error: "Post not found" }, { status: 404 });
  }
  if (!payload.updatedAtBase) {
    throw Response.json({ error: "updatedAtBase is required" }, { status: 400 });
  }
  if (existing.updatedAt !== payload.updatedAtBase) {
    throw Response.json({ error: "Post was updated elsewhere" }, { status: 409 });
  }

  const title = normalizeString(payload.title) || existing.title;
  const summary = normalizeString(payload.summary) || existing.summary;
  const body = (payload.body ?? existing.body).toString();
  const tags = JSON.stringify(parseTags(payload.tags ?? existing.tags));
  const categoryId = normalizeCategory(payload.categoryId ?? existing.categoryId);
  const subcategoryId = normalizeCategory(payload.subcategoryId ?? existing.subcategoryId);
  const publishedAt = normalizeIsoDate(payload.publishedAt ?? existing.publishedAt, existing.publishedAt);
  const updatedAt = normalizeIsoDate(payload.updatedAt ?? new Date().toISOString(), new Date().toISOString());

  let imageUrl = existing.imageUrl ?? null;
  if (payload.imageFile) {
    imageUrl = await uploadCoverImage(context, payload.imageFile, slug);
  }

  await db
    .prepare(
      `UPDATE blog_posts
       SET title = ?, summary = ?, body = ?, image_url = ?, tags = ?, category_id = ?, subcategory_id = ?, published_at = ?, updated_at = ?
       WHERE slug = ?`,
    )
    .bind(title, summary, body, imageUrl, tags, categoryId, subcategoryId, publishedAt, updatedAt, slug)
    .run();

  const refreshed = await getBlogPostBySlug(db, slug);
  return Response.json({ ok: true, post: refreshed });
}

export async function action({ request, context }: ActionFunctionArgs) {
  requireAdmin(request, context);
  switch (request.method.toUpperCase()) {
    case "POST":
      return handlePost(request, context);
    case "PUT":
      return handlePut(request, context);
    default:
      throw Response.json({ error: "Method not allowed" }, { status: 405 });
  }
}
