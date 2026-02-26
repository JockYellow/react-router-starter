import { readdir, readFile, stat } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type ChangelogTag = "add" | "fix" | "change" | "docs";

type RawChangelog = {
  date?: unknown;
  title?: unknown;
  notes?: unknown;
  tag?: unknown;
};

type NormalizedChangelog = {
  slug: string;
  fullSlug: string;
  date: string;
  title: string;
  notes: string[];
  tag: ChangelogTag | null;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const CHANGELOG_DIR = resolve(ROOT, "app/content/changelog");
const SQL_FILE = resolve(ROOT, "sql/changelog/changelog-migrate.sql");
const CHANGELOG_FILE_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9\-]+\.json$/i;
const VALID_TAGS = new Set<ChangelogTag>(["add", "fix", "change", "docs"]);

function toSql(value: string | null | undefined) {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function slugFromFileName(fileName: string) {
  const stem = fileName.replace(/\.json$/i, "");
  const matched = stem.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
  return (matched?.[1] ?? stem).trim();
}

function normalizeOne(fileName: string, raw: RawChangelog): NormalizedChangelog {
  const slug = slugFromFileName(fileName);
  const fullSlug = fileName.replace(/\.json$/i, "").trim();
  const date = (raw.date ?? "").toString().trim();
  const title = (raw.title ?? "").toString().trim();

  if (!slug || !fullSlug || !date || !title) {
    throw new Error(`必要欄位缺失：${fileName}`);
  }

  const notes = Array.isArray(raw.notes)
    ? raw.notes.map((entry) => entry?.toString().trim()).filter(Boolean)
    : [];

  const tagValue = (raw.tag ?? "").toString().trim() as ChangelogTag;
  const tag = VALID_TAGS.has(tagValue) ? tagValue : null;

  return { slug, fullSlug, date, title, notes, tag };
}

async function loadChangelogsFromDisk() {
  const dirStat = await stat(CHANGELOG_DIR).catch(() => null);
  if (!dirStat?.isDirectory()) return [];

  const files = (await readdir(CHANGELOG_DIR)).filter((file) => CHANGELOG_FILE_RE.test(file)).sort();
  const items: NormalizedChangelog[] = [];

  for (const fileName of files) {
    const fullPath = join(CHANGELOG_DIR, fileName);
    const raw = JSON.parse(await readFile(fullPath, "utf8")) as RawChangelog;
    items.push(normalizeOne(fileName, raw));
  }

  const slugCounts = new Map<string, number>();
  for (const item of items) {
    slugCounts.set(item.slug, (slugCounts.get(item.slug) ?? 0) + 1);
  }

  return items.map((item) => ({
    ...item,
    slug: (slugCounts.get(item.slug) ?? 0) > 1 ? item.fullSlug : item.slug,
  }));
}

function renderSql(items: NormalizedChangelog[]) {
  const now = new Date().toISOString();
  const schemaSql = `
CREATE TABLE IF NOT EXISTS changelogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '[]',
  tag TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_changelogs_date ON changelogs (date DESC);`.trim();

  const upserts = items.map((item) => {
    const values = [
      toSql(item.slug),
      toSql(item.date),
      toSql(item.title),
      toSql(JSON.stringify(item.notes)),
      toSql(item.tag),
      toSql(now),
      toSql(now),
    ];

    return `INSERT INTO changelogs (slug, date, title, notes, tag, created_at, updated_at)
VALUES (${values.join(", ")})
ON CONFLICT(slug) DO UPDATE SET
  date = excluded.date,
  title = excluded.title,
  notes = excluded.notes,
  tag = excluded.tag,
  updated_at = excluded.updated_at;`;
  });

  return [schemaSql, ...upserts].join("\n\n");
}

async function run() {
  const items = await loadChangelogsFromDisk();
  if (!items.length) {
    console.log("沒有可匯入的 changelog JSON。");
    return;
  }

  const sql = renderSql(items);
  writeFileSync(SQL_FILE, sql, "utf8");

  console.log(`匯入 ${items.length} 筆 changelog，SQL 檔已輸出：${SQL_FILE}`);
  console.log("Local:  npx wrangler d1 execute blog-db --local --file=sql/changelog/changelog-migrate.sql");
  console.log("Remote: npx wrangler d1 execute blog-db --remote --file=sql/changelog/changelog-migrate.sql");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
