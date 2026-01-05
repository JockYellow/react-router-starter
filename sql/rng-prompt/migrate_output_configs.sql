CREATE TABLE IF NOT EXISTS output_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  blocks_json TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_output_configs_active ON output_configs(is_active);
