import type { BlogCategory, BlogPost } from "./blog.types";
export type { BlogCategory, BlogSubcategory, BlogPost } from "./blog.types";

const BLOG_POST_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9\-]+\.json$/i;

export async function loadBlogCategories() {
  if (import.meta.env.DEV) {
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const { fileURLToPath } = await import("node:url");
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const candidates = [
        path.resolve(__dirname, "../../content/blog/categories.json"),
        path.resolve(process.cwd(), "app/content/blog/categories.json"),
      ];
      for (const candidate of candidates) {
        try {
          const raw = await fs.readFile(candidate, "utf8");
          const data = JSON.parse(raw) as { categories: BlogCategory[] };
          return data.categories || [];
        } catch {
          continue;
        }
      }
    } catch {
      // ignore
    }
  }
  const mod: any = await import("../../content/blog/categories.json");
  const data = mod.default ?? mod;
  return (data.categories || []) as BlogCategory[];
}

function deriveSummary(body: string) {
  const firstParagraph =
    body
      ?.split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)[0] ?? "";
  if (!firstParagraph) return "";
  return firstParagraph.length > 200 ? `${firstParagraph.slice(0, 197)}…` : firstParagraph;
}

export async function loadBlogPosts() {
  const posts: BlogPost[] = [];
  if (import.meta.env.DEV) {
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const { fileURLToPath } = await import("node:url");
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const candidates = [
        path.resolve(__dirname, "../../content/blog/posts"),
        path.resolve(process.cwd(), "app/content/blog/posts"),
      ];
      let dir: string | null = null;
      for (const candidate of candidates) {
        try {
          const stat = await fs.stat(candidate);
          if (stat.isDirectory()) {
            dir = candidate;
            break;
          }
        } catch {
          continue;
        }
      }
      if (dir) {
        const files = (await fs.readdir(dir)).filter((f) => BLOG_POST_RE.test(f));
        for (const file of files) {
          try {
            const raw = await fs.readFile(path.join(dir, file), "utf8");
            posts.push({ ...(JSON.parse(raw) as BlogPost), filename: file });
          } catch {
            // ignore malformed file
          }
        }
      }
    } catch {
      // ignore
    }
  }
  if (!posts.length) {
    const modules = import.meta.glob("../../content/blog/posts/*.json", { eager: true });
    for (const [p, mod] of Object.entries(modules)) {
      const data = (mod as any).default ?? (mod as any);
      const filename = p.split("/").pop();
      posts.push({ ...(data as BlogPost), filename });
    }
  }
  const normalized = posts.map((post) => {
    const body = typeof post.body === "string" ? post.body : "";
    const createdAt = post.createdAt ?? post.publishedAt ?? new Date().toISOString();
    const updatedAt = post.updatedAt ?? createdAt;
    const summary = post.summary ?? deriveSummary(body);
    const tags = Array.isArray(post.tags) ? post.tags.map((tag) => tag.toString()) : [];
    const imageUrl = typeof (post as any).imageUrl === "string" ? (post as any).imageUrl : null;
    return {
      ...post,
      body,
      summary,
      tags,
      createdAt,
      updatedAt,
      imageUrl,
      slug: post.slug ?? (post as any).filename?.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.json$/, ""),
    };
  });
  normalized.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  return normalized;
}
