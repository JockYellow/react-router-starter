import { TOOLBELT_ORIGIN } from "./concert-events.constants";
import type { ApiScanPayload, ImportPayload, SourceOption, ToolbeltScrapePayload } from "./concert-events.types";

export const fetchRemoteScan = async (params: URLSearchParams) => {
  const response = await fetch(`/api/concert-events?${params.toString()}`);
  const payload = (await response.json().catch(() => null)) as ApiScanPayload | null;
  return { response, payload };
};

const fetchToolbeltKey = async () => {
  const response = await fetch(`${TOOLBELT_ORIGIN}/key`);
  if (!response.ok) {
    throw new Error("Toolbelt is not running");
  }
  const payload = (await response.json().catch(() => null)) as { key?: string } | null;
  if (!payload?.key) {
    throw new Error("Toolbelt key missing");
  }
  return String(payload.key);
};

export const runToolbeltScrape = async (startAt: string, endAt: string, source: SourceOption) => {
  const key = await fetchToolbeltKey();
  const response = await fetch(`${TOOLBELT_ORIGIN}/ops/concert-events/scrape`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-toolbelt-key": key,
    },
    body: JSON.stringify({ start_at: startAt, end_at: endAt, source }),
  });
  const payload = (await response.json().catch(() => null)) as ToolbeltScrapePayload | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ? String(payload.error) : "Toolbelt scan failed");
  }
  return {
    events: payload?.events ?? [],
    pagesFetched: payload?.pagesFetched,
    total: payload?.total,
    sourceResults: payload?.sourceResults,
    partial: payload?.partial,
    errors: payload?.errors,
  };
};

export const importEvents = async (events: unknown[]) => {
  const response = await fetch("/api/concert-events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events }),
  });
  const payload = (await response.json().catch(() => null)) as ImportPayload | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error ? String(payload.error) : "Import failed");
  }
  return payload;
};
