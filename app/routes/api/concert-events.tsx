import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { load } from "cheerio";

import { requireBlogDb } from "../../lib/d1.server";

type ConcertSource = "kktix" | "indievox";

type KktixEvent = {
  slug?: string | null;
  name?: string | null;
  start_at?: number | string | null;
  public_url?: string | null;
};

type KktixPayload = {
  data?: KktixEvent[];
};

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
  saved: number;
  pagesFetched?: number;
  error?: string;
};

type FetchResult = {
  events: ConcertEventInput[];
  pagesFetched: number;
};

const SOURCES = ["kktix", "indievox"] as const;
const DEFAULT_SOURCE: ConcertSource = "kktix";
const MAX_KKTIX_PAGES = 5;
const MAX_INDIEVOX_PAGES = 10;
const KKTIX_SOURCE = "kktix";
const INDIEVOX_SOURCE = "indievox";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const KKTIX_BASE = "https://kktix.com/events";
const INDIEVOX_BASE = "https://www.indievox.com";
const INDIEVOX_LIST_URL = "https://www.indievox.com/activity/get-more-game-list";

const buildKktixHeaders = () =>
  ({
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    Referer: KKTIX_BASE,
    Origin: "https://kktix.com",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  }) satisfies HeadersInit;

const buildIndievoxHeaders = () =>
  ({
    "User-Agent": USER_AGENT,
    "X-Requested-With": "XMLHttpRequest",
    Referer: "https://www.indievox.com/activity",
    Accept: "text/html, */*; q=0.9",
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
  }) satisfies HeadersInit;

const isConcertSource = (value: string): value is ConcertSource =>
  SOURCES.includes(value as ConcertSource);

const parseSourceParams = (params: URLSearchParams): ConcertSource[] => {
  const raw = [...params.getAll("source"), ...params.getAll("sources")];
  if (raw.length === 0) return [DEFAULT_SOURCE];

  const tokens = raw
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.includes("all")) {
    return [...SOURCES];
  }

  const selected = tokens.filter(isConcertSource);
  return selected.length > 0 ? Array.from(new Set(selected)) : [DEFAULT_SOURCE];
};

const decodeHtmlEntities = (value: string) =>
  value.replace(/&(#\d+|#x[0-9a-fA-F]+|quot|amp|lt|gt|apos);/g, (full, entity) => {
    switch (entity) {
      case "quot":
        return '"';
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
    return JSON.parse(decoded) as KktixPayload;
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

const normalizeEventInput = (input: Partial<ConcertEventInput> & { start_at?: number | string | null }) => {
  if (!input || typeof input !== "object") return null;
  const source =
    typeof input.source === "string" && input.source.trim() ? input.source.trim() : KKTIX_SOURCE;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const url = typeof input.url === "string" ? input.url.trim() : "";

  let sourceId = typeof input.source_id === "string" ? input.source_id.trim() : "";
  if (!sourceId && url) {
    sourceId = url.split("/").filter(Boolean).pop() ?? "";
  }

  let eventAt = typeof input.event_at === "string" ? input.event_at.trim() : "";
  if (eventAt) {
    const parsed = new Date(eventAt);
    if (Number.isNaN(parsed.getTime())) {
      const epochGuess = Number.parseInt(eventAt, 10);
      eventAt = Number.isNaN(epochGuess) ? "" : toIsoFromEpoch(epochGuess);
    } else {
      eventAt = parsed.toISOString();
    }
  } else {
    const startAt =
      typeof input.start_at === "number"
        ? input.start_at
        : Number.parseInt(String(input.start_at ?? ""), 10);
    eventAt = Number.isNaN(startAt) ? "" : toIsoFromEpoch(startAt);
  }

  if (!source || !sourceId || !title || !url || !eventAt) return null;

  return {
    source,
    source_id: sourceId,
    title,
    event_at: eventAt,
    url,
  };
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

const ensureConcertEventsTable = async (db: D1Database) => {
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS concert_event (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, source_id TEXT NOT NULL, title TEXT NOT NULL, event_at TEXT NOT NULL, url TEXT NOT NULL, first_seen_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')), last_seen_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE (source, source_id))",
    )
    .run();
  await db
    .prepare("CREATE INDEX IF NOT EXISTS idx_concert_event_event_at ON concert_event (event_at DESC)")
    .run();
};

const saveEvents = async (db: D1Database, events: ConcertEventInput[]) => {
  const uniqueEvents = dedupeEvents(events);
  const nowIso = new Date().toISOString();
  const statements = uniqueEvents.map((event) =>
    db
      .prepare(
        "INSERT INTO concert_event (source, source_id, title, event_at, url, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source, source_id) DO UPDATE SET title = excluded.title, event_at = excluded.event_at, url = excluded.url, last_seen_at = excluded.last_seen_at",
      )
      .bind(event.source, event.source_id, event.title, event.event_at, event.url, nowIso, nowIso),
  );

  let saved = 0;
  if (statements.length > 0) {
    const results = await db.batch(statements);
    saved = results.reduce((sum, result) => sum + (result.meta?.changes ?? 0), 0);
  }

  return { saved, total: uniqueEvents.length };
};

const resolveFetchUrl = (target: string, proxyPrefix: string) => {
  const trimmed = proxyPrefix.trim();
  if (!trimmed) return target;
  return `${trimmed}${encodeURIComponent(target)}`;
};

const normalizeSlashDate = (value: string) => (value.includes("-") ? value.replace(/-/g, "/") : value);

const fetchKktixEvents = async (
  startAt: string,
  endAt: string,
  proxyPrefix: string,
  maxPages = MAX_KKTIX_PAGES,
): Promise<FetchResult> => {
  const eventsByKey = new Map<string, ConcertEventInput>();
  let page = 1;
  let pagesFetched = 0;

  while (page <= maxPages) {
    const pageUrl = new URL(KKTIX_BASE);
    pageUrl.searchParams.set("event_tag_ids_in", "1");
    if (startAt) pageUrl.searchParams.set("start_at", startAt);
    if (endAt) pageUrl.searchParams.set("end_at", endAt);
    pageUrl.searchParams.set("page", String(page));

    const targetUrl = resolveFetchUrl(pageUrl.toString(), proxyPrefix);
    const response = await fetch(targetUrl, {
      headers: buildKktixHeaders(),
      redirect: "follow",
    });

    if (!response.ok) {
      const cfMitigated = response.headers.get("cf-mitigated");
      const hint = response.headers.get("content-type")?.includes("text/html") ? " (HTML response)" : "";
      const mitigation = cfMitigated ? ` cf-mitigated=${cfMitigated}` : "";
      throw new Error(`KKTIX fetch failed (${response.status})${hint}${mitigation}`);
    }

    const html = await response.text();
    const events = parseKktixEvents(html);
    pagesFetched += 1;

    for (const event of events) {
      const key = `${event.source}:${event.source_id}`;
      if (!eventsByKey.has(key)) {
        eventsByKey.set(key, event);
      }
    }

    if (events.length === 0) {
      break;
    }

    page += 1;
  }

  return { events: Array.from(eventsByKey.values()), pagesFetched };
};

const fetchIndievoxEvents = async (
  startAt: string,
  endAt: string,
  maxPages = MAX_INDIEVOX_PAGES,
): Promise<FetchResult> => {
  const eventsByKey = new Map<string, ConcertEventInput>();
  let offset = 1;
  let pagesFetched = 0;

  while (offset <= maxPages) {
    const pageUrl = new URL(INDIEVOX_LIST_URL);
    pageUrl.searchParams.set("type", "card");
    if (startAt) pageUrl.searchParams.set("startDate", startAt);
    if (endAt) pageUrl.searchParams.set("endDate", endAt);
    pageUrl.searchParams.set("offset", String(offset));

    const response = await fetch(pageUrl.toString(), {
      headers: buildIndievoxHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Indievox fetch failed (${response.status})`);
    }

    const html = await response.text();
    const events = parseIndievoxEvents(html);
    pagesFetched += 1;

    for (const event of events) {
      const key = `${event.source}:${event.source_id}`;
      if (!eventsByKey.has(key)) {
        eventsByKey.set(key, event);
      }
    }

    if (events.length === 0) {
      break;
    }

    offset += 1;
  }

  return { events: Array.from(eventsByKey.values()), pagesFetched };
};

/**
 * Fetches KKTIX/iNDIEVOX events server-side and upserts them into D1.
 *
 * @param request - HTTP request containing query params like `start_at`, `end_at`, and `source`.
 * @param context - Loader context providing the D1 binding.
 * @returns JSON payload describing scan results and saved counts.
 */
export async function loader({ request, context }: LoaderFunctionArgs): Promise<Response> {
  const db = requireBlogDb(context);
  await ensureConcertEventsTable(db);

  const url = new URL(request.url);
  const startAt = normalizeSlashDate(url.searchParams.get("start_at") ?? "");
  const endAt = normalizeSlashDate(url.searchParams.get("end_at") ?? "");
  const sources = parseSourceParams(url.searchParams);
  const env = (context as any)?.cloudflare?.env ?? (context as any)?.env ?? {};
  const proxyPrefix = typeof env.KKTIX_PROXY_PREFIX === "string" ? env.KKTIX_PROXY_PREFIX : "";

  const sourceResults: SourceResult[] = [];
  const allEvents: ConcertEventInput[] = [];

  for (const source of sources) {
    try {
      let result: FetchResult;
      if (source === KKTIX_SOURCE) {
        result = await fetchKktixEvents(startAt, endAt, proxyPrefix);
      } else {
        result = await fetchIndievoxEvents(startAt, endAt);
      }

      const { saved, total } = await saveEvents(db, result.events);
      sourceResults.push({
        source,
        total,
        saved,
        pagesFetched: result.pagesFetched,
      });
      allEvents.push(...result.events);
    } catch (error) {
      sourceResults.push({
        source,
        total: 0,
        saved: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const errorResults = sourceResults.filter((result) => result.error);
  const successResults = sourceResults.filter((result) => !result.error);
  const total = sourceResults.reduce((sum, result) => sum + result.total, 0);
  const saved = sourceResults.reduce((sum, result) => sum + result.saved, 0);
  const pagesFetched = sourceResults.reduce((sum, result) => sum + (result.pagesFetched ?? 0), 0);
  const dedupedEvents = dedupeEvents(allEvents);

  if (successResults.length === 0) {
    return Response.json(
      {
        success: false,
        ok: false,
        error: errorResults.map((result) => `${result.source}: ${result.error}`).join("; ") || "Scan failed",
        sourceResults,
      },
      { status: 502 },
    );
  }

  return Response.json({
    success: true,
    ok: true,
    partial: errorResults.length > 0,
    total,
    saved,
    pagesFetched: pagesFetched > 0 ? pagesFetched : undefined,
    sourceResults,
    data: dedupedEvents,
    errors: errorResults.length > 0 ? errorResults : undefined,
  });
}

/**
 * Imports pre-parsed event payloads into D1.
 *
 * @param request - HTTP request with JSON payload of events or raw HTML.
 * @param context - Action context providing the D1 binding.
 * @returns JSON payload describing save counts.
 */
export async function action({ request, context }: ActionFunctionArgs): Promise<Response> {
  const db = requireBlogDb(context);
  await ensureConcertEventsTable(db);
  const body = (await request.json().catch(() => null)) as
    | { events?: Array<Partial<ConcertEventInput>>; html?: string }
    | null;

  if (!body || typeof body !== "object") {
    return Response.json({ success: false, ok: false, error: "Invalid payload" }, { status: 400 });
  }

  let events: ConcertEventInput[] = [];

  if (Array.isArray(body.events)) {
    events = body.events.map((item) => normalizeEventInput(item)).filter(Boolean) as ConcertEventInput[];
  } else if (typeof body.html === "string") {
    events = parseKktixEvents(body.html);
  } else {
    return Response.json({ success: false, ok: false, error: "Missing events or html" }, { status: 400 });
  }

  if (events.length === 0) {
    return Response.json({ success: false, ok: false, error: "No events parsed" }, { status: 422 });
  }

  const { saved, total } = await saveEvents(db, events);

  return Response.json({
    success: true,
    ok: true,
    total,
    saved,
  });
}
