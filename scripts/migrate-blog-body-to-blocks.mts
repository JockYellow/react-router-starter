import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { blocksFromPlainText } from "../app/features/blog/blog-content";

const target = process.argv.includes("--remote") ? "--remote" : "--local";
const force = process.argv.includes("--force");
const sqlFile = resolve(process.cwd(), "sql/blog/blog-body-to-blocks.sql");

function runWrangler(args: string[]) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, TMPDIR: process.env.TMPDIR || "/tmp" },
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.stderr.write(result.stdout);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

function toSql(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function parseRows(stdout: string) {
  const parsed = JSON.parse(stdout) as Array<{ results?: Array<{ slug: string; body: string }> }>;
  return parsed.flatMap((item) => item.results ?? []);
}

const rows = parseRows(
  runWrangler([
    "d1",
    "execute",
    "blog-db",
    target,
    "--command",
    "SELECT slug, body FROM blog_posts WHERE body IS NOT NULL AND trim(body) <> ''",
    "--json",
  ]),
);

const statements = rows.map((row) => {
  const blocks = blocksFromPlainText(row.body);
return `UPDATE blog_posts
SET content_json = ${toSql(JSON.stringify(blocks))}
WHERE slug = ${toSql(row.slug)}${force ? ";" : "\n  AND (content_json IS NULL OR content_json = '' OR content_json = '[]');"}`;
});

const sql = statements.length ? statements.join("\n\n") : "-- No blog posts require migration.\n";
writeFileSync(sqlFile, sql, "utf8");
console.log(`已輸出 ${statements.length} 篇舊文 content_json 遷移 SQL：${sqlFile}`);

runWrangler(["d1", "execute", "blog-db", target, `--file=${sqlFile}`]);
console.log(`已套用到 ${target === "--remote" ? "remote" : "local"} D1。`);
