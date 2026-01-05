import { readdir, readFile, stat } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BlogPost } from "../app/lib/blog.types";

// ===== 路徑設定 =====

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 專案根目錄（scripts/ 的上一層）
const ROOT = resolve(__dirname, "..");

// 文章 JSON 所在資料夾
const BLOG_POSTS_DIR = resolve(ROOT, "app/content/blog/posts");

// 比對檔名：2025-01-01-slug.json 這種
const BLOG_POST_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9\-]+\.json$/i;

// ===== 小工具函式 =====

function summarize(body: string) {
  const firstLine = body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)[0];

  if (!firstLine) return "";
  return firstLine.length > 200 ? `${firstLine.slice(0, 197)}…` : firstLine;
}

function toSql(value: string | null | undefined) {
  if (value === null || value === undefined) return "NULL";
  // 單引號要轉義成兩個單引號
  return `'${value.replace(/'/g, "''")}'`;
}

function normalizePost(raw: Record<string, any>): BlogPost {
  const title = (raw.title ?? "").toString();
  const body = (raw.body ?? "").toString();
  const slug = (raw.slug ?? "").toString();
  const publishedAt = new Date(raw.publishedAt ?? Date.now());

  if (!title || !body || !slug || Number.isNaN(publishedAt.valueOf())) {
    throw new Error(`文章內容缺少必要欄位：${JSON.stringify(raw)}`);
  }

  const createdAt = raw.createdAt ?? raw.publishedAt ?? new Date().toISOString();
  const updatedAt = raw.updatedAt ?? createdAt;

  const summary =
    typeof raw.summary === "string" && raw.summary.trim().length
      ? raw.summary
      : summarize(body);

  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag: any) => tag.toString())
    : [];

  return {
    slug,
    title,
    summary,
    body,
    tags,
    categoryId: raw.categoryId ?? null,
    subcategoryId: raw.subcategoryId ?? null,
    publishedAt: publishedAt.toISOString(),
    createdAt,
    updatedAt,
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : null,
  };
}

async function loadBlogPostsFromDisk() {
  const dirStat = await stat(BLOG_POSTS_DIR).catch(() => null);
  if (!dirStat?.isDirectory()) return [];

  const entries = await readdir(BLOG_POSTS_DIR);
  const posts: BlogPost[] = [];

  for (const file of entries) {
    if (!BLOG_POST_RE.test(file)) continue;
    const full = join(BLOG_POSTS_DIR, file);
    const raw = JSON.parse(await readFile(full, "utf8"));
    posts.push(normalizePost(raw));
  }

  // 依照發佈時間新到舊排序（可有可無，只是整齊一點）
  posts.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  return posts;
}

async function run() {
  const posts = await loadBlogPostsFromDisk();

  if (!posts.length) {
    console.log("沒有可匯入的文章。");
    return;
  }

  const statements = posts.map((post) => {
    const values = [
      toSql(post.slug),
      toSql(post.title),
      toSql(post.summary ?? ""),
      toSql(post.body),
      toSql(JSON.stringify(post.tags ?? [])),
      toSql(post.categoryId ?? null),
      toSql(post.subcategoryId ?? null),
      toSql(post.publishedAt),
      toSql(post.createdAt),
      toSql(post.updatedAt),
      toSql(post.imageUrl ?? null),
    ];

    return `INSERT OR IGNORE INTO blog_posts
(slug, title, summary, body, tags, category_id, subcategory_id, published_at, created_at, updated_at, image_url)
VALUES (${values.join(", ")});`;
  });

  // ✅ 重點：這次不再用 BEGIN TRANSACTION / COMMIT
  const sql = statements.join("\n");

  // SQL 檔案輸出在專案根目錄
  const sqlFile = resolve(ROOT, "sql/blog/blog-migrate.sql");
  writeFileSync(sqlFile, sql, "utf8");

  console.log(`匯入 ${posts.length} 篇文章到 blog_posts ...`);
  console.log("✅ 已將 SQL 輸出到檔案：", sqlFile);
  console.log("");
  console.log("接下來請手動執行這行來對遠端 D1 匯入資料：");
  console.log(`npx wrangler d1 execute blog-db --remote --file="${sqlFile}"`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
