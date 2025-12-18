#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function findLatestDb() {
  const dir = resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  if (!existsSync(dir)) {
    throw new Error(`找不到本機 D1 目錄：${dir}`);
  }
  const files = readdirSync(dir).filter((file) => file.endsWith(".sqlite"));
  if (!files.length) {
    throw new Error(`在 ${dir} 內沒有 .sqlite 檔`);
  }
  const sorted = files
    .map((file) => {
      const full = join(dir, file);
      const stats = statSync(full);
      return { file: full, mtime: stats.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return sorted[0].file;
}

function runOrThrow(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...options });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} 失敗 (exit ${result.status})`);
  }
  return result;
}

function dumpSqlite(dbPath, dumpPath) {
  const result = spawnSync("sqlite3", [dbPath, ".dump"], {
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`sqlite3 dump 失敗 (exit ${result.status})`);
  }
  writeFileSync(dumpPath, result.stdout ?? "", { encoding: "utf8" });
}

function main() {
  const dbPath = findLatestDb();
  const dumpsDir = resolve("dumps");
  mkdirSync(dumpsDir, { recursive: true });
  const dumpPath = join(dumpsDir, "d1-local.sql");

  console.log(`Dumping ${dbPath} -> ${dumpPath}`);
  dumpSqlite(dbPath, dumpPath);

  const xdgConfigHome = process.env.XDG_CONFIG_HOME ?? "/mnt/c/Users/真/AppData/Roaming/xdg.config";
  const wranglerBin = resolve("node_modules/.bin/wrangler");

  console.log("上傳 dump 到遠端 D1...");
  runOrThrow(wranglerBin, ["d1", "execute", "blog-db", "--remote", `--file=${dumpPath}`], {
    env: { ...process.env, XDG_CONFIG_HOME: xdgConfigHome },
  });
  console.log("完成");
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
