CREATE TABLE IF NOT EXISTS guestbook_messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT,
  company      TEXT,
  contact      TEXT,
  message      TEXT,
  want_contact INTEGER NOT NULL DEFAULT 0,
  ip           TEXT,
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guestbook_created_at
  ON guestbook_messages(created_at);
