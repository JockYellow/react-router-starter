import { Form, useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useMemo, useState } from "react";

import { requireBlogDb } from "../../lib/d1.server";

type ConcertEventRow = {
  id: number;
  source: string;
  source_id: string;
  title: string;
  event_at: string;
  url: string;
  first_seen_at: string;
  last_seen_at: string;
};

type LoaderData = {
  events: ConcertEventRow[];
  stats: {
    total: number;
    first_seen_at: string | null;
    last_seen_at: string | null;
  };
  query: {
    q: string;
    limit: number;
  };
};

type ScanResult = {
  ok: boolean;
  message: string;
  total?: number;
  saved?: number;
  pagesFetched?: number;
};

const DEFAULT_LIMIT = 200;
const LIMIT_OPTIONS = [50, 200, 500, 1000];
const TOOLBELT_ORIGIN = "http://127.0.0.1:43210";

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

const toDateInputValue = (value: Date) => value.toISOString().slice(0, 10);
const toKktixDate = (value: string) => value.replace(/-/g, "/");

const fetchToolbeltKey = async () => {
  const response = await fetch(`${TOOLBELT_ORIGIN}/key`);
  if (!response.ok) {
    throw new Error("Toolbelt is not running");
  }
  const payload = await response.json();
  if (!payload?.key) {
    throw new Error("Toolbelt key missing");
  }
  return String(payload.key);
};

const runToolbeltScrape = async (startAt: string, endAt: string) => {
  const key = await fetchToolbeltKey();
  const response = await fetch(`${TOOLBELT_ORIGIN}/ops/concert-events/scrape`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-toolbelt-key": key,
    },
    body: JSON.stringify({ start_at: startAt, end_at: endAt }),
  });
  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ? String(payload.error) : "Toolbelt scan failed");
  }
  return payload as { events: unknown[]; pagesFetched?: number; total?: number };
};

const importEvents = async (events: unknown[]) => {
  const response = await fetch("/api/concert-events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events }),
  });
  const payload = await response.json();
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error ? String(payload.error) : "Import failed");
  }
  return payload as { saved?: number; total?: number };
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei",
  }).format(date);
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  const db = requireBlogDb(context);
  await ensureConcertEventsTable(db);

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limit = clampLimit(url.searchParams.get("limit"));

  const params: Array<string | number> = [];
  let whereClause = "";

  if (q) {
    whereClause = "WHERE title LIKE ? OR url LIKE ? OR source_id LIKE ?";
    const needle = `%${q}%`;
    params.push(needle, needle, needle);
  }

  const eventsQuery = `SELECT id, source, source_id, title, event_at, url, first_seen_at, last_seen_at FROM concert_event ${whereClause} ORDER BY event_at DESC, id DESC LIMIT ?`;
  params.push(limit);

  const eventsRes = await db.prepare(eventsQuery).bind(...params).all<ConcertEventRow>();
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
      first_seen_at: statsRow?.first_seen_at ?? null,
      last_seen_at: statsRow?.last_seen_at ?? null,
    },
    query: { q, limit },
  } satisfies LoaderData);
}

export default function ConcertEventsTool() {
  const { events, stats, query } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [startDate, setStartDate] = useState(() => toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return toDateInputValue(date);
  });
  const [scanMode, setScanMode] = useState<"remote" | "local" | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const scanning = scanMode !== null;
  const isRemoteScanning = scanMode === "remote";
  const isLocalScanning = scanMode === "local";

  const formattedStats = useMemo(() => {
    return {
      first_seen_at: stats.first_seen_at ? formatDateTime(stats.first_seen_at) : "-",
      last_seen_at: stats.last_seen_at ? formatDateTime(stats.last_seen_at) : "-",
    };
  }, [stats.first_seen_at, stats.last_seen_at]);

  const handleScan = async () => {
    setScanMode("remote");
    setScanResult(null);

    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start_at", toKktixDate(startDate));
      if (endDate) params.set("end_at", toKktixDate(endDate));
      const response = await fetch(`/api/concert-events?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        setScanResult({
          ok: false,
          message: payload?.error ? String(payload.error) : "Scan failed",
        });
      } else {
        setScanResult({
          ok: true,
          message: "Scan completed",
          total: payload.total,
          saved: payload.saved,
          pagesFetched: payload.pagesFetched,
        });
        revalidator.revalidate();
      }
    } catch (error) {
      setScanResult({
        ok: false,
        message: error instanceof Error ? error.message : "Scan failed",
      });
    } finally {
      setScanMode(null);
    }
  };

  const handleLocalScan = async () => {
    setScanMode("local");
    setScanResult(null);
    const startAt = startDate ? toKktixDate(startDate) : "";
    const endAt = endDate ? toKktixDate(endDate) : "";

    try {
      const scrape = await runToolbeltScrape(startAt, endAt);
      const imported = await importEvents(scrape.events ?? []);
      setScanResult({
        ok: true,
        message: "Local scan completed",
        total: imported.total ?? scrape.total,
        saved: imported.saved,
        pagesFetched: scrape.pagesFetched,
      });
      revalidator.revalidate();
    } catch (error) {
      setScanResult({
        ok: false,
        message: error instanceof Error ? error.message : "Local scan failed",
      });
    } finally {
      setScanMode(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Concert Monitor</p>
              <h1 className="text-2xl font-semibold text-slate-900">KKTIX Sync Console</h1>
              <p className="text-sm text-slate-500">
                Source: kktix · Table: concert_event · Total: {stats.total}
              </p>
            </div>
            <div className="text-sm text-slate-500">
              <div>First seen: {formattedStats.first_seen_at}</div>
              <div>Last seen: {formattedStats.last_seen_at}</div>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col text-xs font-semibold text-slate-500">
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-1 w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="flex flex-col text-xs font-semibold text-slate-500">
                End date
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="mt-1 w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleScan}
                disabled={scanning}
                className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isRemoteScanning ? "Scanning..." : "Run scan"}
              </button>
              <button
                type="button"
                onClick={handleLocalScan}
                disabled={scanning}
                className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
              >
                {isLocalScanning ? "Local scanning..." : "Local Playwright"}
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Local Playwright requires `npm run dev:ui` and `npx playwright install`.
          </p>
          {scanResult ? (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                scanResult.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              <div className="font-semibold">{scanResult.message}</div>
              {scanResult.ok ? (
                <div className="mt-1 text-xs text-emerald-700">
                  Total: {scanResult.total ?? "-"} · Saved: {scanResult.saved ?? "-"} · Pages:{" "}
                  {scanResult.pagesFetched ?? "-"}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Saved events</h2>
              <p className="text-sm text-slate-500">Search now, expand filters later.</p>
            </div>
            <Form method="get" className="flex flex-wrap gap-3">
              <input
                type="text"
                name="q"
                defaultValue={query.q}
                placeholder="Search title / url / slug"
                className="w-60 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-900"
              />
              <select
                name="limit"
                defaultValue={String(query.limit)}
                className="rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-900"
              >
                {LIMIT_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value} rows
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              >
                Apply
              </button>
            </Form>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-3">Event</th>
                  <th className="py-3">Date (Asia/Taipei)</th>
                  <th className="py-3">Source</th>
                  <th className="py-3">First seen</th>
                  <th className="py-3">Last seen</th>
                  <th className="py-3">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((event) => (
                  <tr key={event.id} className="align-top">
                    <td className="py-4 pr-4">
                      <div className="font-semibold text-slate-900">{event.title}</div>
                      <div className="text-xs text-slate-500">{event.source_id}</div>
                    </td>
                    <td className="py-4 text-slate-700">{formatDateTime(event.event_at)}</td>
                    <td className="py-4 text-slate-500">{event.source}</td>
                    <td className="py-4 text-slate-500">{formatDateTime(event.first_seen_at)}</td>
                    <td className="py-4 text-slate-500">{formatDateTime(event.last_seen_at)}</td>
                    <td className="py-4">
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:text-slate-700"
                      >
                        Open
                      </a>
                    </td>
                  </tr>
                ))}
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-slate-400">
                      No data yet. Run a scan to fetch events.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
