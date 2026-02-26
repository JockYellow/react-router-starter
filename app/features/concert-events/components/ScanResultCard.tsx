import { SOURCE_LABELS } from "../concert-events.constants";
import type { ScanResult } from "../concert-events.types";

type ScanResultCardProps = {
  scanResult: ScanResult;
};

export const ScanResultCard = ({ scanResult }: ScanResultCardProps) => (
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
    {scanResult.sources && scanResult.sources.length > 0 ? (
      <div className="mt-2 text-xs">
        {scanResult.sources.map((source) => {
          const label = SOURCE_LABELS[source.source] ?? source.source;
          if (source.error) {
            return (
              <div key={source.source} className="text-rose-600">
                {label}: {source.error}
              </div>
            );
          }

          return (
            <div key={source.source}>
              {label}: Total {source.total ?? "-"} · Saved {source.saved ?? "-"} · Pages{" "}
              {source.pagesFetched ?? "-"}
            </div>
          );
        })}
      </div>
    ) : null}
  </div>
);
