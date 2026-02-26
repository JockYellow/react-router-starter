import { Form } from "react-router";

import type { ConcertEventsQuery } from "../concert-events.shared";
import {
  FIELD_OPTIONS,
  LIMIT_OPTIONS,
  ORDER_OPTIONS,
  SOURCE_FILTER_OPTIONS,
} from "../concert-events.constants";
import { normalizeDateInput } from "../concert-events.shared";
import type { QueryHistoryItem } from "../concert-events.types";

type ConcertFiltersPanelProps = {
  query: ConcertEventsQuery;
  matched: number;
  total: number;
  hasActiveFilters: boolean;
  history: QueryHistoryItem[];
  onApplyHistory: (entry: QueryHistoryItem) => void;
  onClearHistory: () => void;
  onClearFilters: () => void;
};

export const ConcertFiltersPanel = ({
  query,
  matched,
  total,
  hasActiveFilters,
  history,
  onApplyHistory,
  onClearHistory,
  onClearFilters,
}: ConcertFiltersPanelProps) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">查詢與篩選</h2>
        <p className="text-sm text-slate-500">
          可依欄位、來源與日期範圍精準篩選。符合：{matched} 筆
          {hasActiveFilters ? "（已套用篩選）" : ""}
        </p>
      </div>
      <div className="text-sm text-slate-400">總筆數：{total}</div>
    </div>

    <Form method="get" className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          name="q"
          defaultValue={query.q}
          placeholder="輸入關鍵字（名稱 / URL / 來源 ID）"
          className="w-64 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-900"
        />
        <select
          name="field"
          defaultValue={query.field}
          className="rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-900"
        >
          {FIELD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          name="source"
          defaultValue={query.source}
          className="rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-900"
        >
          {SOURCE_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          起日
          <input
            type="date"
            name="start_at"
            defaultValue={normalizeDateInput(query.start_at)}
            className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          迄日
          <input
            type="date"
            name="end_at"
            defaultValue={normalizeDateInput(query.end_at)}
            className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-semibold text-slate-500">
          排序
          <select
            name="order"
            defaultValue={query.order}
            className="ml-2 rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-900"
          >
            {ORDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-500">
          筆數
          <select
            name="limit"
            defaultValue={String(query.limit)}
            className="ml-2 rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-900"
          >
            {LIMIT_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value} 筆
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          套用查詢
        </button>
        <button
          type="button"
          onClick={onClearFilters}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
        >
          清除條件
        </button>
      </div>
    </Form>

    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">查詢紀錄</h3>
        {history.length > 0 ? (
          <button
            type="button"
            onClick={onClearHistory}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600"
          >
            清除紀錄
          </button>
        ) : null}
      </div>
      {history.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {history.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onApplyHistory(entry)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              {entry.label || "未命名條件"}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-400">尚無查詢紀錄。</p>
      )}
    </div>
  </section>
);
