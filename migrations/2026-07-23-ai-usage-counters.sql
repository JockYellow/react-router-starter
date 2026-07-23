CREATE TABLE IF NOT EXISTS ai_usage_counters (
  scope TEXT NOT NULL,
  identifier_hash TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (scope, identifier_hash, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_counters_updated_at
  ON ai_usage_counters (updated_at);
