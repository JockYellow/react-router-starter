export type BlogSubcategory = {
  id: string;
  title: string;
  description?: string;
};

export type BlogCategory = {
  id: string;
  title: string;
  description?: string;
  children: BlogSubcategory[];
};

export type BlogPost = {
  title: string;
  body: string;
  categoryId: string;
  subcategoryId?: string;
  publishedAt: string;
  createdAt?: string;
  updatedAt?: string;
  slug?: string;
  filename?: string;
};

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
        path.resolve(__dirname, "../content/blog/categories.json"),
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
  const mod: any = await import("../content/blog/categories.json");
  const data = mod.default ?? mod;
  return (data.categories || []) as BlogCategory[];
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
        path.resolve(__dirname, "../content/blog/posts"),
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
    const modules = import.meta.glob("../content/blog/posts/*.json", { eager: true });
    for (const [p, mod] of Object.entries(modules)) {
      const data = (mod as any).default ?? (mod as any);
      const filename = p.split("/").pop();
      posts.push({ ...(data as BlogPost), filename });
    }
  }
  const normalized = posts.map((post) => {
    const createdAt = post.createdAt ?? post.publishedAt ?? new Date().toISOString();
    const updatedAt = post.updatedAt ?? createdAt;
    return { ...post, createdAt, updatedAt };
  });
  normalized.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  return normalized;
}
