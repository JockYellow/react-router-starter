export const DEFAULT_LIMIT = 200;
export const DEFAULT_ORDER = "event_desc";

export type ConcertEventRow = {
  id: number;
  source: string;
  source_id: string;
  title: string;
  event_at: string;
  url: string;
  first_seen_at: string;
  last_seen_at: string;
};

export type ConcertEventsQuery = {
  q: string;
  limit: number;
  field: string;
  source: string;
  start_at: string;
  end_at: string;
  order: string;
};

export type LoaderData = {
  events: ConcertEventRow[];
  stats: {
    total: number;
    matched: number;
    first_seen_at: string | null;
    last_seen_at: string | null;
  };
  query: ConcertEventsQuery;
};

export const normalizeDateInput = (value: string) => value.trim().replace(/\//g, "-");
