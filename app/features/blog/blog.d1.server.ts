import type { BlogPost } from "./blog.types";
import { firstImageFromBlocks, parseBlogBlocks } from "./blog-content";

function parseTags(raw: string | null | undefined) {
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((tag) => tag.toString());
    }
  } catch {
    // ignore broken JSON and fall back to empty array
  }
  return [];
}

function mapRowToPost(row: Record<string, any>): BlogPost {
  const content = parseBlogBlocks(row.content_json, row.body ?? "");
  const imageUrl = row.image_url ?? firstImageFromBlocks(content);
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? "",
    body: row.body ?? "",
    content,
    imageUrl,
    coverMediaId: row.cover_media_id ?? null,
    tags: parseTags(row.tags),
    categoryId: row.category_id ?? undefined,
    subcategoryId: row.subcategory_id ?? undefined,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllBlogPosts(db: D1Database): Promise<BlogPost[]> {
  let results: Record<string, any>[] = [];
  try {
    const statement = db.prepare(
      `SELECT slug, title, summary, body, content_json, image_url, cover_media_id, tags, category_id, subcategory_id, published_at, created_at, updated_at
       FROM blog_posts
       ORDER BY datetime(published_at) DESC, id DESC`,
    );
    const response = await statement.all<Record<string, any>>();
    results = response.results;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("content_json") && !message.includes("cover_media_id")) throw error;
    const statement = db.prepare(
      `SELECT slug, title, summary, body, image_url, tags, category_id, subcategory_id, published_at, created_at, updated_at
       FROM blog_posts
       ORDER BY datetime(published_at) DESC, id DESC`,
    );
    const response = await statement.all<Record<string, any>>();
    results = response.results;
  }
  return results.map(mapRowToPost);
}

export async function getBlogPostBySlug(db: D1Database, slug: string): Promise<BlogPost | null> {
  let row: Record<string, any> | null = null;
  try {
    const statement = db.prepare(
      `SELECT slug, title, summary, body, content_json, image_url, cover_media_id, tags, category_id, subcategory_id, published_at, created_at, updated_at
       FROM blog_posts WHERE slug = ? LIMIT 1`,
    );
    row = await statement.bind(slug).first<Record<string, any>>();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("content_json") && !message.includes("cover_media_id")) throw error;
    const statement = db.prepare(
      `SELECT slug, title, summary, body, image_url, tags, category_id, subcategory_id, published_at, created_at, updated_at
       FROM blog_posts WHERE slug = ? LIMIT 1`,
    );
    row = await statement.bind(slug).first<Record<string, any>>();
  }
  return row ? mapRowToPost(row) : null;
}
