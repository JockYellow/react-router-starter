CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  ui_group TEXT DEFAULT 'Default',
  is_optional BOOLEAN DEFAULT 0,
  type TEXT DEFAULT 'required',
  min_count INTEGER DEFAULT 1,
  max_count INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_slug TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT,
  is_active BOOLEAN DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category_slug);

CREATE TABLE IF NOT EXISTS output_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  blocks_json TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_output_configs_active ON output_configs(is_active);
