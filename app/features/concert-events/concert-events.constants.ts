export const LIMIT_OPTIONS = [50, 200, 500, 1000];
export const HISTORY_LIMIT = 8;
export const HISTORY_KEY = "concert-events-query-history";
export const TOOLBELT_ORIGIN = "http://127.0.0.1:43210";

export const SOURCE_OPTIONS = [
  { value: "all", label: "全部來源" },
  { value: "kktix", label: "KKTIX" },
  { value: "indievox", label: "iNDIEVOX" },
] as const;

export const SOURCE_FILTER_OPTIONS = [
  { value: "all", label: "全部來源" },
  { value: "kktix", label: "KKTIX" },
  { value: "indievox", label: "iNDIEVOX" },
] as const;

export const FIELD_OPTIONS = [
  { value: "all", label: "全部欄位" },
  { value: "title", label: "活動名稱" },
  { value: "source_id", label: "來源 ID" },
  { value: "url", label: "活動網址" },
] as const;

export const ORDER_OPTIONS = [
  { value: "event_desc", label: "活動日期新 → 舊" },
  { value: "event_asc", label: "活動日期舊 → 新" },
  { value: "first_seen_desc", label: "首次發現新 → 舊" },
  { value: "last_seen_desc", label: "最後更新新 → 舊" },
] as const;

export const SOURCE_LABELS: Record<string, string> = {
  kktix: "KKTIX",
  indievox: "iNDIEVOX",
};
