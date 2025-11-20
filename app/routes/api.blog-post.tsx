import { json } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { requireBlogDb } from "../lib/d1.server";
import { getBlogPostBySlug } from "../lib/blog.d1.server";
import type { BlogPost } from "../lib/blog.types";
import { requireAdmin } from "../lib/admin-auth.server";

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

function parseTags(input: unknown) {
  if (!Array.isArray(input)) return [] as string[];
  return input.map((tag) => tag.toString()).filter(Boolean);
}

function normalizeIsoDate(value: unknown, fallback: string) {
  if (!value) return fallback;
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.valueOf())) return fallback;
  return parsed.toISOString();
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  requireAdmin(request, context);
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) {
    throw json({ error: "slug is required" }, { status: 400 });
  }
  const db = requireBlogDb(context);
  const post = await getBlogPostBySlug(db, slug);
  if (!post) {
    throw json({ error: "Post not found" }, { status: 404 });
  }
  return json(post);
}

async function handlePost(request: Request, context: ActionFunctionArgs["context"]) {
  const payload = (await request.json()) as Partial<BlogPost & { categoryId?: string; subcategoryId?: string }>;
  const title = (payload.title ?? "").toString().trim();
  const body = (payload.body ?? "").toString();
  const summary = (payload.summary ?? "").toString();
  const categoryId = (payload.categoryId ?? "").toString().trim() || null;
  const subcategoryId = (payload.subcategoryId ?? "").toString().trim() || null;

  if (!title || !body) {
    throw json({ error: "title and body are required" }, { status: 400 });
  }
  const slugInput = (payload.slug ?? title).toString();
  const slug = slugify(slugInput) || slugify(`${title}-${Date.now()}`);
  const now = new Date().toISOString();
  const publishedAt = normalizeIsoDate(payload.publishedAt, now);
  const createdAt = payload.createdAt ?? now;
  const updatedAt = now;

  const db = requireBlogDb(context);
  const existing = await getBlogPostBySlug(db, slug);
  if (existing) {
    throw json({ error: "slug already exists" }, { status: 409 });
  }

  await db
    .prepare(
      `INSERT INTO blog_posts
        (slug, title, summary, body, tags, category_id, subcategory_id, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      slug,
      title,
      summary,
      body,
      JSON.stringify(parseTags(payload.tags)),
      categoryId,
      subcategoryId,
      publishedAt,
      createdAt,
      updatedAt,
    )
    .run();

  return json({ ok: true, slug });
}

async function handlePut(request: Request, context: ActionFunctionArgs["context"]) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) {
    throw json({ error: "slug is required" }, { status: 400 });
  }

  const payload = (await request.json()) as Partial<
    BlogPost & { updatedAtBase?: string; categoryId?: string; subcategoryId?: string }
  >;

  const db = requireBlogDb(context);
  const existing = await getBlogPostBySlug(db, slug);
  if (!existing) {
    throw json({ error: "Post not found" }, { status: 404 });
  }
  if (!payload.updatedAtBase) {
    throw json({ error: "updatedAtBase is required" }, { status: 400 });
  }
  if (existing.updatedAt !== payload.updatedAtBase) {
    throw json({ error: "Post was updated elsewhere" }, { status: 409 });
  }

  const title = (payload.title ?? existing.title).toString();
  const summary = (payload.summary ?? existing.summary ?? "").toString();
  const body = (payload.body ?? existing.body).toString();
  const tags = JSON.stringify(parseTags(payload.tags ?? existing.tags));
  const categoryId = (payload.categoryId ?? existing.categoryId ?? "").toString().trim() || null;
  const subcategoryId = (payload.subcategoryId ?? existing.subcategoryId ?? "").toString().trim() || null;
  const publishedAt = normalizeIsoDate(payload.publishedAt ?? existing.publishedAt, existing.publishedAt);
  const updatedAt = normalizeIsoDate(payload.updatedAt ?? new Date().toISOString(), new Date().toISOString());

  await db
    .prepare(
      `UPDATE blog_posts
       SET title = ?, summary = ?, body = ?, tags = ?, category_id = ?, subcategory_id = ?, published_at = ?, updated_at = ?
       WHERE slug = ?`,
    )
    .bind(title, summary, body, tags, categoryId, subcategoryId, publishedAt, updatedAt, slug)
    .run();

  const refreshed = await getBlogPostBySlug(db, slug);
  return json({ ok: true, post: refreshed });
}

export async function action({ request, context }: ActionFunctionArgs) {
  requireAdmin(request, context);
  switch (request.method.toUpperCase()) {
    case "POST":
      return handlePost(request, context);
    case "PUT":
      return handlePut(request, context);
    default:
      throw json({ error: "Method not allowed" }, { status: 405 });
  }
}
