import type { SOURCE_OPTIONS } from "./concert-events.constants";

export type SourceOption = (typeof SOURCE_OPTIONS)[number]["value"];

export type SourceReport = {
  source: string;
  total?: number;
  saved?: number;
  pagesFetched?: number;
  error?: string;
};

export type ScanResult = {
  ok: boolean;
  message: string;
  total?: number;
  saved?: number;
  pagesFetched?: number;
  sources?: SourceReport[];
};

export type ToolbeltScrapePayload = {
  ok?: boolean;
  error?: string;
  total?: number;
  pagesFetched?: number;
  events?: unknown[];
  sourceResults?: SourceReport[];
  partial?: boolean;
  errors?: SourceReport[];
};

export type ApiScanPayload = {
  success?: boolean;
  error?: string;
  total?: number;
  saved?: number;
  pagesFetched?: number;
  sourceResults?: SourceReport[];
  partial?: boolean;
};

export type ImportPayload = {
  success?: boolean;
  error?: string;
  saved?: number;
  total?: number;
};

export type QueryHistoryItem = {
  id: string;
  label: string;
  params: Record<string, string>;
  createdAt: number;
};
