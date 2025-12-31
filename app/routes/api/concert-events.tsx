import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { requireBlogDb } from "../../lib/d1.server";

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

const MAX_PAGES = 5;
const SOURCE = "kktix";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const KKTIX_BASE = "https://kktix.com/events";

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
      source: SOURCE,
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
  const source = typeof input.source === "string" && input.source.trim() ? input.source.trim() : SOURCE;
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

export async function loader({ request, context }: LoaderFunctionArgs) {
  const db = requireBlogDb(context);
  await ensureConcertEventsTable(db);

  const url = new URL(request.url);
  const startAt = url.searchParams.get("start_at") ?? "";
  const endAt = url.searchParams.get("end_at") ?? "";
  const env = (context as any)?.cloudflare?.env ?? (context as any)?.env ?? {};
  const proxyPrefix = typeof env.KKTIX_PROXY_PREFIX === "string" ? env.KKTIX_PROXY_PREFIX : "";

  const eventsByKey = new Map<string, ConcertEventInput>();
  let page = 1;
  let pagesFetched = 0;

  try {
    while (page <= MAX_PAGES) {
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
        const hint = response.headers.get("content-type")?.includes("text/html")
          ? " (HTML response)"
          : "";
        return Response.json(
          {
            success: false,
            error: `KKTIX fetch failed (${response.status})${hint}`,
            cfMitigated,
          },
          { status: 502 },
        );
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
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }

  const { saved } = await saveEvents(db, Array.from(eventsByKey.values()));

  return Response.json({
    success: true,
    total: eventsByKey.size,
    saved,
    pagesFetched,
    data: Array.from(eventsByKey.values()),
  });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const db = requireBlogDb(context);
  await ensureConcertEventsTable(db);
  const body = (await request.json().catch(() => null)) as
    | { events?: Array<Partial<ConcertEventInput>>; html?: string }
    | null;

  if (!body || typeof body !== "object") {
    return Response.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  let events: ConcertEventInput[] = [];

  if (Array.isArray(body.events)) {
    events = body.events.map((item) => normalizeEventInput(item)).filter(Boolean) as ConcertEventInput[];
  } else if (typeof body.html === "string") {
    events = parseKktixEvents(body.html);
  } else {
    return Response.json({ success: false, error: "Missing events or html" }, { status: 400 });
  }

  if (events.length === 0) {
    return Response.json({ success: false, error: "No events parsed" }, { status: 422 });
  }

  const { saved, total } = await saveEvents(db, events);

  return Response.json({
    success: true,
    total,
    saved,
  });
}
