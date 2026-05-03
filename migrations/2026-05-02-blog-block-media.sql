ALTER TABLE blog_posts ADD COLUMN content_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE blog_posts ADD COLUMN cover_media_id TEXT;

CREATE TABLE IF NOT EXISTS blog_media_assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  r2_key TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  duration_sec REAL,
  alt TEXT,
  caption TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_blog_media_assets_kind ON blog_media_assets (kind);
CREATE INDEX IF NOT EXISTS idx_blog_media_assets_deleted_at ON blog_media_assets (deleted_at);

CREATE TABLE IF NOT EXISTS blog_post_media (
  post_slug TEXT NOT NULL,
  media_id TEXT NOT NULL,
  usage_type TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (post_slug, media_id, usage_type),
  FOREIGN KEY (media_id) REFERENCES blog_media_assets(id)
);

CREATE INDEX IF NOT EXISTS idx_blog_post_media_post_slug ON blog_post_media (post_slug);
