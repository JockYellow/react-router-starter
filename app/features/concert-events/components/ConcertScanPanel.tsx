import type { ScanResult, SourceOption } from "../concert-events.types";
import { SOURCE_OPTIONS } from "../concert-events.constants";
import { ScanResultCard } from "./ScanResultCard";

type ConcertScanPanelProps = {
  startDate: string;
  endDate: string;
  sourceOption: SourceOption;
  scanning: boolean;
  isRemoteScanning: boolean;
  isLocalScanning: boolean;
  scanResult: ScanResult | null;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onSourceOptionChange: (value: SourceOption) => void;
  onRemoteScan: () => void;
  onLocalScan: () => void;
};

export const ConcertScanPanel = ({
  startDate,
  endDate,
  sourceOption,
  scanning,
  isRemoteScanning,
  isLocalScanning,
  scanResult,
  onStartDateChange,
  onEndDateChange,
  onSourceOptionChange,
  onRemoteScan,
  onLocalScan,
}: ConcertScanPanelProps) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col text-xs font-semibold text-slate-500">
          掃描起日
          <input
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            className="mt-1 w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="flex flex-col text-xs font-semibold text-slate-500">
          掃描迄日
          <input
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
            className="mt-1 w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="flex flex-col text-xs font-semibold text-slate-500">
          掃描來源
          <select
            value={sourceOption}
            onChange={(event) => onSourceOptionChange(event.target.value as SourceOption)}
            className="mt-1 w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
          >
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRemoteScan}
          disabled={scanning}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isRemoteScanning ? "掃描中..." : "雲端掃描"}
        </button>
        <button
          type="button"
          onClick={onLocalScan}
          disabled={scanning}
          className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        >
          {isLocalScanning ? "本地掃描中..." : "本地 Playwright"}
        </button>
      </div>
    </div>
    <p className="mt-3 text-xs text-slate-400">
      本地掃描需要先啟動 `npm run dev:ui`，並安裝 `npx playwright install`。
    </p>
    {scanResult ? <ScanResultCard scanResult={scanResult} /> : null}
  </section>
);
