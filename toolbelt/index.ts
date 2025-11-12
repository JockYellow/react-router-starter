// toolbelt/index.ts
import express from "express";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";

const app = express();
const PORT = 43210;
const HOST = "127.0.0.1";
const TOOLBELT_KEY = Math.random().toString(36).slice(2);

app.use(express.json({ limit: "2mb" }));

// CORS（本機開發）
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-toolbelt-key");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const CHANGELOG_DIR = resolve(REPO, "app/content/changelog");

// 基礎
app.get("/", (_req, res) => res.json({ ok: true, message: "Toolbelt is running!" }));
app.get("/key", (_req, res) => res.json({ key: TOOLBELT_KEY }));

// Admin 靜態站（本機後台）
app.use("/admin", express.static(join(__dirname, "admin"), { extensions: ["html"] }));
app.use((req, res, next) => { res.setHeader("X-Frame-Options", "DENY"); res.setHeader("Referrer-Policy", "no-referrer"); next(); });

// 授權保護（/admin 與 /key 除外）
app.use((req, res, next) => {
  if (req.path.startsWith("/admin") || req.path === "/key" || req.path === "/") return next();
  if (req.headers["x-toolbelt-key"] !== TOOLBELT_KEY) return res.status(401).send("Unauthorized");
  next();
});

// ── Changelog 檔案式 CRUD ──
const NAME_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9\-]+\.json$/i;
function ensureDir() { if (!existsSync(CHANGELOG_DIR)) mkdirSync(CHANGELOG_DIR, { recursive: true }); }
function filePath(name: string) {
  if (!NAME_RE.test(name)) throw new Error("Invalid filename");
  const full = resolve(CHANGELOG_DIR, name);
  if (!full.startsWith(CHANGELOG_DIR)) throw new Error("Path traversal");
  return full;
}
function validateData(d: any) {
  if (!d || typeof d !== "object") throw new Error("Invalid body");
  if (typeof d.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) throw new Error("date must be YYYY-MM-DD");
  if (typeof d.title !== "string" || !d.title.trim()) throw new Error("title required");
  if (d.notes && (!Array.isArray(d.notes) || !d.notes.every((s: any) => typeof s === "string"))) throw new Error("notes must be string[]");
  if (d.tag && !["add","fix","change","docs"].includes(d.tag)) throw new Error("tag invalid");
}

app.get("/fs/changelog/list", (_req, res) => {
  ensureDir();
  const files = readdirSync(CHANGELOG_DIR).filter(f => NAME_RE.test(f)).sort((a,b)=>a<b?1:-1);
  const items = files.map(f => { const raw = readFileSync(join(CHANGELOG_DIR, f), "utf8"); return { filename: f, ...JSON.parse(raw) }; });
  res.json(items);
});

app.post("/fs/changelog/create", (req, res) => {
  ensureDir();
  try {
    const { data, slug } = req.body as { data: any; slug?: string };
    validateData(data);
    const s = (slug || data.title || "update").toString().trim().toLowerCase()
      .replace(/[\s_]+/g,"-").replace(/[^a-z0-9\-]+/g,"").replace(/\-+/g,"-").replace(/^\-+|\-+$/g,"");
    const name = `${data.date}-${s || "update"}.json`;
    writeFileSync(filePath(name), JSON.stringify(data, null, 2) + "\n", "utf8");
    res.json({ ok: true, filename: name });
  } catch (e: any) { res.status(400).send(e.message || String(e)); }
});

app.put("/fs/changelog/update", (req, res) => {
  ensureDir();
  try {
    const { filename, data } = req.body as { filename: string; data: any };
    if (!filename) throw new Error("filename required");
    validateData(data);
    const full = filePath(filename);
    if (!existsSync(full)) return res.status(404).send("file not found");
    writeFileSync(full, JSON.stringify(data, null, 2) + "\n", "utf8");
    res.json({ ok: true, filename });
  } catch (e: any) { res.status(400).send(e.message || String(e)); }
});

app.delete("/fs/changelog/delete", (req, res) => {
  ensureDir();
  try {
    const { filename } = req.body as { filename: string };
    if (!filename) throw new Error("filename required");
    const full = filePath(filename);
    if (!existsSync(full)) return res.status(404).send("file not found");
    rmSync(full);
    res.json({ ok: true, filename });
  } catch (e: any) { res.status(400).send(e.message || String(e)); }
});

app.listen(PORT, HOST, () => {
  console.log(`[toolbelt] http://${HOST}:${PORT}`);
  console.log(`[toolbelt] key: ${TOOLBELT_KEY}`);
  console.log(`[toolbelt] repo: ${REPO}`);
});