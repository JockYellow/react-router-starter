CREATE TABLE IF NOT EXISTS profile_documents (
  id TEXT PRIMARY KEY CHECK (id = 'primary'),
  draft_json TEXT NOT NULL,
  published_json TEXT NOT NULL,
  published_revision INTEGER NOT NULL DEFAULT 1,
  draft_updated_at TEXT NOT NULL,
  published_at TEXT NOT NULL
);
