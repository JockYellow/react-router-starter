CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
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
