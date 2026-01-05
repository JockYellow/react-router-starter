import type { BlogPost } from "./blog.types";

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
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? "",
    body: row.body ?? "",
    imageUrl: row.image_url ?? null,
    tags: parseTags(row.tags),
    categoryId: row.category_id ?? undefined,
    subcategoryId: row.subcategory_id ?? undefined,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllBlogPosts(db: D1Database): Promise<BlogPost[]> {
  const statement = db.prepare(
    `SELECT slug, title, summary, body, image_url, tags, category_id, subcategory_id, published_at, created_at, updated_at
     FROM blog_posts
     ORDER BY datetime(published_at) DESC, id DESC`,
  );
  const { results } = await statement.all<Record<string, any>>();
  return results.map(mapRowToPost);
}

export async function getBlogPostBySlug(db: D1Database, slug: string): Promise<BlogPost | null> {
  const statement = db.prepare(
    `SELECT slug, title, summary, body, image_url, tags, category_id, subcategory_id, published_at, created_at, updated_at
     FROM blog_posts WHERE slug = ? LIMIT 1`,
  );
  const row = await statement.bind(slug).first<Record<string, any>>();
  return row ? mapRowToPost(row) : null;
}
