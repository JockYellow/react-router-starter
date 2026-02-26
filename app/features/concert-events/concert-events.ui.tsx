import { useMemo, useState } from "react";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";

import type { LoaderData } from "./concert-events.shared";
import { DEFAULT_LIMIT, DEFAULT_ORDER } from "./concert-events.shared";
import { importEvents, fetchRemoteScan, runToolbeltScrape } from "./concert-events.api";
import { toDateInputValue, toKktixDate, formatDateTime } from "./concert-events.utils";
import type { QueryHistoryItem, ScanResult, SourceOption } from "./concert-events.types";
import { useQueryHistory } from "./hooks/useQueryHistory";
import { ConcertEventsTable } from "./components/ConcertEventsTable";
import { ConcertFiltersPanel } from "./components/ConcertFiltersPanel";
import { ConcertScanPanel } from "./components/ConcertScanPanel";
import { ConcertStatsHeader } from "./components/ConcertStatsHeader";

export default function ConcertEventsTool() {
  const { events, stats, query } = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const { history, clearHistory } = useQueryHistory(query);
  const [startDate, setStartDate] = useState(() => toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return toDateInputValue(date);
  });
  const [sourceOption, setSourceOption] = useState<SourceOption>("kktix");
  const [scanMode, setScanMode] = useState<"remote" | "local" | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const scanning = scanMode !== null;
  const isRemoteScanning = scanMode === "remote";
  const isLocalScanning = scanMode === "local";
  const hasActiveFilters =
    Boolean(query.q) ||
    query.source !== "all" ||
    query.field !== "all" ||
    query.order !== DEFAULT_ORDER ||
    Boolean(query.start_at) ||
    Boolean(query.end_at) ||
    query.limit !== DEFAULT_LIMIT;

  const formattedStats = useMemo(
    () => ({
      first_seen_at: stats.first_seen_at ? formatDateTime(stats.first_seen_at) : "-",
      last_seen_at: stats.last_seen_at ? formatDateTime(stats.last_seen_at) : "-",
    }),
    [stats.first_seen_at, stats.last_seen_at],
  );

  const handleRemoteScan = async () => {
    setScanMode("remote");
    setScanResult(null);

    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start_at", toKktixDate(startDate));
      if (endDate) params.set("end_at", toKktixDate(endDate));
      if (sourceOption) params.set("source", sourceOption);
      const { response, payload } = await fetchRemoteScan(params);

      if (!response.ok || !payload?.success) {
        setScanResult({
          ok: false,
          message: payload?.error ? String(payload.error) : "Scan failed",
          sources: Array.isArray(payload?.sourceResults) ? payload.sourceResults : undefined,
        });
      } else {
        const sources = Array.isArray(payload?.sourceResults) ? payload.sourceResults : undefined;
        const hasWarnings = Boolean(payload?.partial) || sources?.some((item) => Boolean(item?.error));
        setScanResult({
          ok: true,
          message: hasWarnings ? "Scan completed with warnings" : "Scan completed",
          total: payload.total,
          saved: payload.saved,
          pagesFetched: payload.pagesFetched,
          sources,
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
      const scrape = await runToolbeltScrape(startAt, endAt, sourceOption);
      const imported = await importEvents(scrape.events ?? []);
      const total = imported.total ?? scrape.total;
      let sources = Array.isArray(scrape.sourceResults) ? scrape.sourceResults : undefined;
      if (!sources && sourceOption !== "all") {
        sources = [
          {
            source: sourceOption,
            total,
            pagesFetched: scrape.pagesFetched,
          },
        ];
      }
      if (sources && sources.length === 1 && imported.saved !== undefined) {
        sources = [{ ...sources[0], saved: imported.saved }];
      }
      const hasWarnings = Boolean(scrape.partial) || sources?.some((item) => Boolean(item?.error));
      setScanResult({
        ok: true,
        message: hasWarnings ? "Local scan completed with warnings" : "Local scan completed",
        total,
        saved: imported.saved,
        pagesFetched: scrape.pagesFetched,
        sources,
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

  const applyHistory = (entry: QueryHistoryItem) => {
    const params = new URLSearchParams(entry.params);
    navigate({ search: params.toString() ? `?${params.toString()}` : "" });
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <ConcertStatsHeader
          total={stats.total}
          firstSeen={formattedStats.first_seen_at}
          lastSeen={formattedStats.last_seen_at}
        />
        <ConcertScanPanel
          startDate={startDate}
          endDate={endDate}
          sourceOption={sourceOption}
          scanning={scanning}
          isRemoteScanning={isRemoteScanning}
          isLocalScanning={isLocalScanning}
          scanResult={scanResult}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onSourceOptionChange={setSourceOption}
          onRemoteScan={handleRemoteScan}
          onLocalScan={handleLocalScan}
        />
        <ConcertFiltersPanel
          query={query}
          matched={stats.matched}
          total={stats.total}
          hasActiveFilters={hasActiveFilters}
          history={history}
          onApplyHistory={applyHistory}
          onClearHistory={clearHistory}
          onClearFilters={() => navigate({ search: "" })}
        />
        <ConcertEventsTable events={events} />
      </div>
    </div>
  );
}
