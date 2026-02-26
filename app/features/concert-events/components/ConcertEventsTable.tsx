import { SOURCE_LABELS } from "../concert-events.constants";
import type { ConcertEventRow } from "../concert-events.shared";
import { formatDateTime } from "../concert-events.utils";

type ConcertEventsTableProps = {
  events: ConcertEventRow[];
};

export const ConcertEventsTable = ({ events }: ConcertEventsTableProps) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="mt-1 overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="py-3">活動</th>
            <th className="py-3">活動日期（台北）</th>
            <th className="py-3">來源</th>
            <th className="py-3">首次發現</th>
            <th className="py-3">最後更新</th>
            <th className="py-3">連結</th>
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
              <td className="py-4 text-slate-500">{SOURCE_LABELS[event.source] ?? event.source}</td>
              <td className="py-4 text-slate-500">{formatDateTime(event.first_seen_at)}</td>
              <td className="py-4 text-slate-500">{formatDateTime(event.last_seen_at)}</td>
              <td className="py-4">
                <a
                  href={event.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:text-slate-700"
                >
                  開啟
                </a>
              </td>
            </tr>
          ))}
          {events.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-10 text-center text-sm text-slate-400">
                沒有符合條件的資料，請調整篩選或先執行掃描。
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  </section>
);
