#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, options);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed (exit ${result.status})`);
  }
  return result;
}

function main() {
  const dumpsDir = resolve("dumps");
  mkdirSync(dumpsDir, { recursive: true });
  const dumpPath = join(dumpsDir, "d1-remote.sql");
  const wranglerBin = resolve("node_modules/.bin/wrangler");
  const xdgConfigHome = process.env.XDG_CONFIG_HOME ?? "/mnt/c/Users/真/AppData/Roaming/xdg.config";

  console.log("Dumping remote blog-db to local file...");
  const dump = run(
    wranglerBin,
    ["d1", "execute", "blog-db", "--remote", "--command", ".dump"],
    {
      env: { ...process.env, XDG_CONFIG_HOME: xdgConfigHome },
      stdio: ["ignore", "pipe", "inherit"],
      encoding: "utf8",
    },
  );
  writeFileSync(dumpPath, dump.stdout ?? "", "utf8");
  console.log(`Saved remote dump to ${dumpPath}`);

  console.log("Restoring dump into local D1 (Miniflare)...");
  run(
    wranglerBin,
    ["d1", "execute", "blog-db", "--local", `--file=${dumpPath}`],
    {
      env: { ...process.env, XDG_CONFIG_HOME: xdgConfigHome },
      stdio: "inherit",
    },
  );
  console.log("Local DB updated from remote.");
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
