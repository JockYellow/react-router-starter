CREATE TABLE IF NOT EXISTS concert_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  event_at TEXT NOT NULL,
  url TEXT NOT NULL,
  first_seen_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_concert_event_event_at ON concert_event (event_at DESC);
