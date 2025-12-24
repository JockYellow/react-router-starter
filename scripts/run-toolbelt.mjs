import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const isWsl = Boolean(process.env.WSL_INTEROP || process.env.WSL_DISTRO_NAME);
const env = {
  ...process.env,
  ...(isWsl ? { TMPDIR: "/tmp" } : {}),
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const binName = process.platform === "win32" ? "tsx.cmd" : "tsx";
const tsxPath = path.resolve(rootDir, "node_modules", ".bin", binName);

const child = spawn(tsxPath, ["toolbelt/index.ts"], {
  stdio: "inherit",
  env,
  cwd: rootDir,
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
