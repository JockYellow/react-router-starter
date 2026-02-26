// toolbelt/index.ts
import express from "express";
import { load } from "cheerio";
import type { BrowserContext } from "playwright";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process"; // for git use

const app = express();
const PORT = 43210;
const HOST = "127.0.0.1";
const TOOLBELT_KEY = Math.random().toString(36).slice(2);
const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  process.env.FRONT_URL ||
  process.env.PUBLIC_FRONTEND_URL ||
  "";
const FRONTEND_API_BASE = process.env.FRONTEND_API_BASE || FRONTEND_URL || "";

function runCmd(cmd: string, args: string[] = []) {
  const result = spawnSync(cmd, args, {
    cwd: REPO,
    shell: false,          // for git use
    encoding: "utf8",
  });
  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}


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
const KKTIX_BASE = "https://kktix.com/events";
const KKTIX_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const KKTIX_SOURCE = "kktix";
const KKTIX_MAX_PAGES = 5;
const INDIEVOX_BASE = "https://www.indievox.com";
const INDIEVOX_SOURCE = "indievox";
const INDIEVOX_MAX_PAGES = 10;
const MAX_PAGES_LIMIT = 10;
const CONCERT_SOURCES = [KKTIX_SOURCE, INDIEVOX_SOURCE] as const;

type ConcertSource = (typeof CONCERT_SOURCES)[number];

type ConcertEventInput = {
  source: string;
  source_id: string;
  title: string;
  event_at: string;
  url: string;
};

type SourceResult = {
  source: ConcertSource;
  total: number;
  pagesFetched?: number;
  error?: string;
};

type ScrapeResult = {
  events: ConcertEventInput[];
  pagesFetched: number;
};

const decodeHtmlEntities = (value: string) =>
  value.replace(/&(#\d+|#x[0-9a-fA-F]+|quot|amp|lt|gt|apos);/g, (full, entity) => {
    switch (entity) {
      case "quot":
        return "\"";
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "apos":
        return "'";
      default:
        break;
    }

    if (entity.startsWith("#x")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isNaN(code) ? full : String.fromCharCode(code);
    }

    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? full : String.fromCharCode(code);
    }

    return full;
  });

const parseKktixPayload = (html: string) => {
  const doubleMatch = html.match(/data-react-props="([^"]+)"/);
  const singleMatch = html.match(/data-react-props='([^']+)'/);
  const raw = doubleMatch?.[1] ?? singleMatch?.[1];
  if (!raw) return null;

  const decoded = decodeHtmlEntities(raw);
  try {
    return JSON.parse(decoded) as { data?: any[] };
  } catch {
    return null;
  }
};

const toIsoFromEpoch = (value: number) => new Date(value * 1000).toISOString();

const parseKktixEvents = (html: string): ConcertEventInput[] => {
  const payload = parseKktixPayload(html);
  const rows = Array.isArray(payload?.data) ? payload?.data : [];
  const events: ConcertEventInput[] = [];

  for (const row of rows) {
    const title = typeof row?.name === "string" ? row.name.trim() : "";
    const url = typeof row?.public_url === "string" ? row.public_url.trim() : "";
    if (!title || !url) continue;

    let sourceId = typeof row?.slug === "string" ? row.slug.trim() : "";
    if (!sourceId) {
      sourceId = url.split("/").filter(Boolean).pop() ?? "";
    }

    const startAt =
      typeof row?.start_at === "number" ? row.start_at : Number.parseInt(String(row?.start_at ?? ""), 10);
    if (!sourceId || Number.isNaN(startAt)) continue;

    events.push({
      source: KKTIX_SOURCE,
      source_id: sourceId,
      title,
      event_at: toIsoFromEpoch(startAt),
      url,
    });
  }

  return events;
};

const parseIndievoxDate = (value: string) => {
  const match = value.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (!match) return "";
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
};

const parseIndievoxEvents = (html: string): ConcertEventInput[] => {
  const $ = load(html);
  const events: ConcertEventInput[] = [];

  $("a[href*='/activity/detail/']").each((_, element) => {
    const link = $(element).attr("href")?.trim() ?? "";
    if (!link) return;
    const url = new URL(link, INDIEVOX_BASE).toString();
    const pathSegments = new URL(url).pathname.split("/").filter(Boolean);
    const sourceId = pathSegments[pathSegments.length - 1] ?? "";
    const title =
      $(element).find(".multi_ellipsis").text().trim() ||
      $(element).find("img").attr("alt")?.trim() ||
      $(element).text().trim();
    const dateText =
      $(element).find(".date").text().trim() ||
      $(element).closest(".panel-body").prev(".panel-heading").text().trim();
    const eventAt = parseIndievoxDate(dateText);
    if (!sourceId || !title || !eventAt) return;

    events.push({
      source: INDIEVOX_SOURCE,
      source_id: sourceId,
      title,
      event_at: eventAt,
      url,
    });
  });

  return events;
};

const dedupeEvents = (events: ConcertEventInput[]) => {
  const map = new Map<string, ConcertEventInput>();
  for (const event of events) {
    const key = `${event.source}:${event.source_id}`;
    if (!map.has(key)) {
      map.set(key, event);
    }
  }
  return Array.from(map.values());
};

const buildKktixUrl = (startAt: string, endAt: string, page: number) => {
  const target = new URL(KKTIX_BASE);
  target.searchParams.set("event_tag_ids_in", "1");
  if (startAt) target.searchParams.set("start_at", startAt);
  if (endAt) target.searchParams.set("end_at", endAt);
  target.searchParams.set("page", String(page));
  return target.toString();
};

const buildIndievoxActivityUrl = (startAt: string, endAt: string) => {
  const target = new URL(`${INDIEVOX_BASE}/activity`);
  target.searchParams.set("type", "card");
  if (startAt) target.searchParams.set("startDate", startAt);
  if (endAt) target.searchParams.set("endDate", endAt);
  return target.toString();
};

const ensureKktixProfileDir = () => {
  const dir = resolve(REPO, ".toolbelt", "kktix-profile");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const clampPageCount = (value: unknown, defaultValue: number) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, 1), MAX_PAGES_LIMIT);
};

const parseSourceInput = (value: unknown): ConcertSource[] => {
  if (value === undefined || value === null) return [KKTIX_SOURCE];
  const tokens = Array.isArray(value)
    ? value.map((entry) => String(entry))
    : String(value).split(",");
  const cleaned = tokens.map((token) => token.trim().toLowerCase()).filter(Boolean);
  if (cleaned.includes("all")) {
    return [...CONCERT_SOURCES];
  }
  const selected = cleaned.filter((token) => CONCERT_SOURCES.includes(token as ConcertSource));
  return selected.length > 0 ? Array.from(new Set(selected)) : [KKTIX_SOURCE];
};

const scrapeKktixWithPlaywright = async (
  context: BrowserContext,
  startAt: string,
  endAt: string,
  maxPages: number,
): Promise<ScrapeResult> => {
  const page = await context.newPage();
  const eventsByKey = new Map<string, ConcertEventInput>();
  let pagesFetched = 0;

  try {
    for (let pageIndex = 1; pageIndex <= maxPages; pageIndex += 1) {
      const targetUrl = buildKktixUrl(startAt, endAt, pageIndex);
      await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
      const html = await page.content();
      const events = parseKktixEvents(html);
      pagesFetched += 1;

      if (events.length === 0 && html.includes("Attention Required")) {
        throw new Error("Blocked by Cloudflare challenge. Try KKTIX_HEADLESS=0.");
      }

      for (const event of events) {
        const key = `${event.source}:${event.source_id}`;
        if (!eventsByKey.has(key)) {
          eventsByKey.set(key, event);
        }
      }

      if (events.length === 0) {
        break;
      }
    }
  } finally {
    await page.close();
  }

  return { events: Array.from(eventsByKey.values()), pagesFetched };
};

const scrapeIndievoxWithPlaywright = async (
  context: BrowserContext,
  startAt: string,
  endAt: string,
  maxPages: number,
): Promise<ScrapeResult> => {
  const page = await context.newPage();
  const eventsByKey = new Map<string, ConcertEventInput>();
  let pagesFetched = 0;

  try {
    const targetUrl = buildIndievoxActivityUrl(startAt, endAt);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await page
      .waitForSelector("a[href*='/activity/detail/']", {
        timeout: 8000,
      })
      .catch(() => null);

    const countItems = async () => page.locator("a[href*='/activity/detail/']").count();
    let previousCount = await countItems();
    pagesFetched = previousCount > 0 ? 1 : 0;

    while (pagesFetched < maxPages) {
      const loadMore = page.locator(".page-show-more a");
      const visible = await loadMore.isVisible().catch(() => false);
      if (!visible) break;

      await loadMore.scrollIntoViewIfNeeded();
      await loadMore.click();

      const increased = await page
        .waitForFunction(
          (prev) => document.querySelectorAll("a[href*='/activity/detail/']").length > prev,
          previousCount,
          { timeout: 8000 },
        )
        .then(() => true)
        .catch(() => false);

      if (!increased) {
        await page.waitForTimeout(800);
      }

      const nextCount = await countItems();
      if (nextCount <= previousCount) {
        break;
      }

      previousCount = nextCount;
      pagesFetched += 1;
    }

    const html = await page.content();
    const events = parseIndievoxEvents(html);

    for (const event of events) {
      const key = `${event.source}:${event.source_id}`;
      if (!eventsByKey.has(key)) {
        eventsByKey.set(key, event);
      }
    }
  } finally {
    await page.close();
  }

  return { events: Array.from(eventsByKey.values()), pagesFetched };
};

// 基礎
app.get("/", (_req, res) => res.json({ ok: true, message: "Toolbelt is running!" }));
app.get("/key", (_req, res) => res.json({ key: TOOLBELT_KEY }));
app.get("/config", (_req, res) =>
  res.json({
    frontendUrl: FRONTEND_URL || null,
    apiBase: FRONTEND_API_BASE || null,
  }),
);

app.use((req, res, next) => { res.setHeader("X-Frame-Options", "DENY"); res.setHeader("Referrer-Policy", "no-referrer"); next(); });

// 授權保護（/、/key、/config 除外）
app.use((req, res, next) => {
  if (req.path === "/key" || req.path === "/" || req.path === "/config") return next();
  if (req.headers["x-toolbelt-key"] !== TOOLBELT_KEY) return res.status(401).send("Unauthorized");
  next();
});
// ── Git 操作 API ──
app.post("/ops/git/commit-push", (req, res) => {
  const { message } = req.body as { message?: string };

  if (!message || !message.trim()) {
    return res.status(400).json({ ok: false, error: "commit message 必填" });
  }

  // 先記錄現在狀態（純資訊用）
  const statusBefore = runCmd("git", ["status", "--short"]);

  // 1) git add -A
  const add = runCmd("git", ["add", "-A"]);
  if (add.code !== 0) {
    return res.status(500).json({
      ok: false,
      step: "add",
      stdout: add.stdout,
      stderr: add.stderr,
    });
  }

  // 2) git commit -m "<message>"
  const commit = runCmd("git", ["commit", "-m", message]);
  const commitOut = (commit.stdout || "") + (commit.stderr || "");
  const nothingToCommit = /nothing to commit/i.test(commitOut);

  // 如果真的「完全沒東西可以 commit」，這不是錯誤，可以照樣回 ok:true
  // 只是之後 push 多半也沒東西
  let pushResult: { code: number; stdout: string; stderr: string } | null = null;
  let pushed = false;

  if (!nothingToCommit) {
    // 有東西要 commit，結果 code 不是 0 → 真正錯誤，直接回
    if (commit.code !== 0) {
      return res.status(500).json({
        ok: false,
        step: "commit",
        stdout: commit.stdout,
        stderr: commit.stderr,
      });
    }

    // 3) git push（只有在有新 commit 的時候才推）
    const push = runCmd("git", ["push"]);
    pushResult = push;

    if (push.code !== 0) {
      return res.status(500).json({
        ok: false,
        step: "push",
        stdout: push.stdout,
        stderr: push.stderr,
      });
    }

    pushed = true;
  }

  const statusAfter = runCmd("git", ["status", "--short"]);

  return res.json({
    ok: true,
    nothingToCommit,
    pushed,
    statusBefore: statusBefore.stdout,
    statusAfter: statusAfter.stdout,
    commit: {
      code: commit.code,
      stdout: commit.stdout,
      stderr: commit.stderr,
    },
    push: pushResult && {
      code: pushResult.code,
      stdout: pushResult.stdout,
      stderr: pushResult.stderr,
    },
  });
});

app.post("/ops/concert-events/scrape", async (req, res) => {
  const startAt = typeof req.body?.start_at === "string" ? req.body.start_at : "";
  const endAt = typeof req.body?.end_at === "string" ? req.body.end_at : "";
  const sources = parseSourceInput(req.body?.source ?? req.body?.sources);
  const headless = req.body?.headless === false ? false : process.env.KKTIX_HEADLESS !== "0";
  let context: BrowserContext | null = null;

  try {
    const playwright = await import("playwright");
    const userDataDir = ensureKktixProfileDir();
    context = await playwright.chromium.launchPersistentContext(userDataDir, {
      headless,
      viewport: { width: 1280, height: 800 },
      userAgent: KKTIX_USER_AGENT,
    });
    await context.setExtraHTTPHeaders({
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    });

    const sourceResults: SourceResult[] = [];
    const allEvents: ConcertEventInput[] = [];
    let pagesFetched = 0;

    for (const source of sources) {
      try {
        const maxPages =
          source === KKTIX_SOURCE
            ? clampPageCount(req.body?.max_pages, KKTIX_MAX_PAGES)
            : clampPageCount(req.body?.max_pages, INDIEVOX_MAX_PAGES);
        const result =
          source === KKTIX_SOURCE
            ? await scrapeKktixWithPlaywright(context, startAt, endAt, maxPages)
            : await scrapeIndievoxWithPlaywright(context, startAt, endAt, maxPages);
        sourceResults.push({
          source,
          total: result.events.length,
          pagesFetched: result.pagesFetched,
        });
        allEvents.push(...result.events);
        pagesFetched += result.pagesFetched;
      } catch (error: any) {
        sourceResults.push({
          source,
          total: 0,
          pagesFetched: 0,
          error: error?.message ? String(error.message) : "Scrape failed",
        });
      }
    }

    const successResults = sourceResults.filter((result) => !result.error);
    if (successResults.length === 0) {
      return res.status(500).json({
        ok: false,
        error: sourceResults.map((result) => `${result.source}: ${result.error}`).join("; ") || "Scrape failed",
        sourceResults,
      });
    }

    const dedupedEvents = dedupeEvents(allEvents);
    const errorResults = sourceResults.filter((result) => result.error);

    return res.json({
      ok: true,
      total: dedupedEvents.length,
      pagesFetched,
      events: dedupedEvents,
      sourceResults,
      partial: errorResults.length > 0,
      errors: errorResults.length > 0 ? errorResults : undefined,
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error?.message ? String(error.message) : "Scrape failed",
    });
  } finally {
    if (context) {
      await context.close();
    }
  }
});


// ── Toolbelt 僅保留 API（scrape + git ops）──

app.listen(PORT, HOST, () => {
  console.log(`[toolbelt] http://${HOST}:${PORT}`);
  console.log(`[toolbelt] key: ${TOOLBELT_KEY}`);
  console.log(`[toolbelt] repo: ${REPO}`);
});
