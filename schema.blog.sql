CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  body TEXT NOT NULL,
  tags TEXT,
  category_id TEXT,
  subcategory_id TEXT,
  published_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts (slug);
