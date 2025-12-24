import { spawn } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const envPath = path.join(repoRoot, ".env");

function disableDotenv() {
  if (!existsSync(envPath)) return null;
  const backupPath = path.join(
    repoRoot,
    `.env.wrangler-backup-${Date.now().toString(36)}`,
  );
  renameSync(envPath, backupPath);
  return backupPath;
}

function restoreDotenv(backupPath) {
  if (backupPath && existsSync(backupPath)) {
    renameSync(backupPath, envPath);
  }
}

let backupPath = null;
try {
  backupPath = disableDotenv();
} catch (error) {
  console.error("Failed to temporarily move .env for wrangler remote dev.");
  console.error(error);
  process.exit(1);
}

const env = { ...process.env };
delete env.CLOUDFLARE_API_TOKEN;

const args = ["dev", "--remote", ...process.argv.slice(2)];
const child = spawn("wrangler", args, {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

const cleanup = () => {
  try {
    restoreDotenv(backupPath);
  } catch (error) {
    console.error("Failed to restore .env after wrangler remote dev.");
    console.error(error);
  }
};

child.on("exit", (code) => {
  cleanup();
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  cleanup();
  console.error(error);
  process.exit(1);
});

process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
