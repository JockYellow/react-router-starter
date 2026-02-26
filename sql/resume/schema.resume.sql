CREATE TABLE IF NOT EXISTS company_pages (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  slug               TEXT UNIQUE NOT NULL,
  company_name       TEXT NOT NULL,
  why_this_company   TEXT,
  relevant_experience TEXT DEFAULT '[]',  -- JSON array of strings
  what_i_bring       TEXT,
  questions_or_ideas TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_company_pages_slug ON company_pages (slug);
