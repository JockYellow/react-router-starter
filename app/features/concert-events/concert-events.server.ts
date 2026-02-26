import type { LoaderFunctionArgs } from "react-router";

import { requireBlogDb } from "../../lib/d1.server";
import { DEFAULT_LIMIT, DEFAULT_ORDER, normalizeDateInput, type ConcertEventsQuery, type LoaderData } from "./concert-events.shared";

const ORDER_MAP: Record<string, string> = {
  event_desc: "event_at DESC, id DESC",
  event_asc: "event_at ASC, id ASC",
  first_seen_desc: "first_seen_at DESC, id DESC",
  last_seen_desc: "last_seen_at DESC, id DESC",
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

const clampLimit = (value: string | null) => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 20), 2000);
};

const toIsoBoundary = (value: string, edge: "start" | "end") => {
  const normalized = normalizeDateInput(value);
  if (!normalized) return "";
  const time = edge === "start" ? "00:00:00.000" : "23:59:59.999";
  const date = new Date(`${normalized}T${time}+08:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
};

const readQuery = (url: URL): ConcertEventsQuery => ({
  q: url.searchParams.get("q")?.trim() ?? "",
  limit: clampLimit(url.searchParams.get("limit")),
  field: url.searchParams.get("field")?.trim() ?? "all",
  source: url.searchParams.get("source")?.trim() ?? "all",
  start_at: url.searchParams.get("start_at")?.trim() ?? "",
  end_at: url.searchParams.get("end_at")?.trim() ?? "",
  order: url.searchParams.get("order")?.trim() ?? DEFAULT_ORDER,
});

const buildWhereClause = (query: ConcertEventsQuery) => {
  const params: Array<string | number> = [];
  const whereParts: string[] = [];

  if (query.q) {
    const needle = `%${query.q}%`;
    if (query.field === "title") {
      whereParts.push("title LIKE ?");
      params.push(needle);
    } else if (query.field === "url") {
      whereParts.push("url LIKE ?");
      params.push(needle);
    } else if (query.field === "source_id") {
      whereParts.push("source_id LIKE ?");
      params.push(needle);
    } else {
      whereParts.push("(title LIKE ? OR url LIKE ? OR source_id LIKE ?)");
      params.push(needle, needle, needle);
    }
  }

  if (query.source && query.source !== "all") {
    whereParts.push("source = ?");
    params.push(query.source);
  }

  const startAtIso = toIsoBoundary(query.start_at, "start");
  if (startAtIso) {
    whereParts.push("event_at >= ?");
    params.push(startAtIso);
  }

  const endAtIso = toIsoBoundary(query.end_at, "end");
  if (endAtIso) {
    whereParts.push("event_at <= ?");
    params.push(endAtIso);
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
  const orderBy = ORDER_MAP[query.order] ?? ORDER_MAP[DEFAULT_ORDER];

  return { whereClause, orderBy, params };
};

/**
 * Loads concert events with filters for the admin tool UI.
 *
 * @param request - Incoming HTTP request with query params for filters.
 * @param context - React Router loader context with D1 bindings.
 * @returns JSON payload containing events, stats, and applied query.
 */
export async function loadConcertEvents({ request, context }: LoaderFunctionArgs): Promise<Response> {
  const db = requireBlogDb(context);
  await ensureConcertEventsTable(db);

  const url = new URL(request.url);
  const query = readQuery(url);
  const { whereClause, orderBy, params } = buildWhereClause(query);

  const eventsQuery = `SELECT id, source, source_id, title, event_at, url, first_seen_at, last_seen_at FROM concert_event ${whereClause} ORDER BY ${orderBy} LIMIT ?`;
  const eventsRes = await db
    .prepare(eventsQuery)
    .bind(...params, query.limit)
    .all<LoaderData["events"][number]>();
  const matchRow = await db
    .prepare(`SELECT COUNT(*) as total FROM concert_event ${whereClause}`)
    .bind(...params)
    .first<{ total: number | null }>();
  const statsRow = await db
    .prepare("SELECT COUNT(*) as total, MIN(first_seen_at) as first_seen_at, MAX(last_seen_at) as last_seen_at FROM concert_event")
    .first<{
      total: number | null;
      first_seen_at: string | null;
      last_seen_at: string | null;
    }>();

  return Response.json({
    events: eventsRes.results ?? [],
    stats: {
      total: Number(statsRow?.total ?? 0),
      matched: Number(matchRow?.total ?? 0),
      first_seen_at: statsRow?.first_seen_at ?? null,
      last_seen_at: statsRow?.last_seen_at ?? null,
    },
    query,
  } satisfies LoaderData);
}
