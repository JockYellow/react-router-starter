import { useEffect, useState } from "react";

import { DEFAULT_LIMIT, DEFAULT_ORDER, normalizeDateInput, type ConcertEventsQuery } from "../concert-events.shared";
import {
  FIELD_OPTIONS,
  HISTORY_KEY,
  HISTORY_LIMIT,
  ORDER_OPTIONS,
  SOURCE_FILTER_OPTIONS,
} from "../concert-events.constants";
import { formatRangeLabel, serializeParams } from "../concert-events.utils";
import type { QueryHistoryItem } from "../concert-events.types";

export const useQueryHistory = (query: ConcertEventsQuery) => {
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(HISTORY_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as QueryHistoryItem[];
      if (Array.isArray(parsed)) {
        setHistory(parsed);
      }
    } catch {
      window.localStorage.removeItem(HISTORY_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasFilters =
      Boolean(query.q) ||
      query.source !== "all" ||
      query.field !== "all" ||
      query.order !== DEFAULT_ORDER ||
      Boolean(query.start_at) ||
      Boolean(query.end_at) ||
      query.limit !== DEFAULT_LIMIT;
    if (!hasFilters) return;

    const params: Record<string, string> = {};
    if (query.q) params.q = query.q;
    if (query.source && query.source !== "all") params.source = query.source;
    if (query.field && query.field !== "all") params.field = query.field;
    if (query.start_at) params.start_at = normalizeDateInput(query.start_at);
    if (query.end_at) params.end_at = normalizeDateInput(query.end_at);
    if (query.order && query.order !== DEFAULT_ORDER) params.order = query.order;
    if (query.limit !== DEFAULT_LIMIT) params.limit = String(query.limit);

    const orderLabel = ORDER_OPTIONS.find((option) => option.value === query.order)?.label ?? query.order;
    const sourceLabel = SOURCE_FILTER_OPTIONS.find((option) => option.value === query.source)?.label ?? query.source;
    const fieldLabel = FIELD_OPTIONS.find((option) => option.value === query.field)?.label ?? query.field;
    const rangeLabel = formatRangeLabel(query.start_at, query.end_at);

    const labelParts = [
      query.q ? `關鍵字: ${query.q}` : "",
      query.field !== "all" ? `欄位: ${fieldLabel}` : "",
      query.source !== "all" ? `來源: ${sourceLabel}` : "",
      rangeLabel ? `日期: ${rangeLabel}` : "",
      query.order !== DEFAULT_ORDER ? `排序: ${orderLabel}` : "",
      query.limit !== DEFAULT_LIMIT ? `筆數: ${query.limit}` : "",
    ].filter(Boolean);

    const paramsId = serializeParams(params);
    const entry: QueryHistoryItem = {
      id: paramsId,
      label: labelParts.join(" · "),
      params,
      createdAt: Date.now(),
    };

    setHistory((prev) => {
      if (prev[0]?.id === entry.id) return prev;
      const next = [entry, ...prev.filter((item) => item.id !== entry.id)].slice(0, HISTORY_LIMIT);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, [query]);

  const clearHistory = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  return { history, clearHistory };
};
