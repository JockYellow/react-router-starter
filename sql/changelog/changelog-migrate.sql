CREATE TABLE IF NOT EXISTS changelogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '[]',
  tag TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_changelogs_date ON changelogs (date DESC);

INSERT INTO changelogs (slug, date, title, notes, tag, created_at, updated_at)
VALUES ('2025-11-12-update', '2025-11-12', '增加地端管理選單', '["新增管理UI功能","新增管理後台","把Changelog Page 的更新方式放到後台裡面"]', 'add', '2026-02-23T10:25:20.009Z', '2026-02-23T10:25:20.009Z')
ON CONFLICT(slug) DO UPDATE SET
  date = excluded.date,
  title = excluded.title,
  notes = excluded.notes,
  tag = excluded.tag,
  updated_at = excluded.updated_at;

INSERT INTO changelogs (slug, date, title, notes, tag, created_at, updated_at)
VALUES ('2025-11-13-update', '2025-11-13', '更新選單功能 UI進行更新', '["新增Git add & push","寫更完整的 Git 紀錄","確認可以一鍵到布署"]', 'add', '2026-02-23T10:25:20.009Z', '2026-02-23T10:25:20.009Z')
ON CONFLICT(slug) DO UPDATE SET
  date = excluded.date,
  title = excluded.title,
  notes = excluded.notes,
  tag = excluded.tag,
  updated_at = excluded.updated_at;

INSERT INTO changelogs (slug, date, title, notes, tag, created_at, updated_at)
VALUES ('2025-11-14-update', '2025-11-14', '首頁改版', '["模組切換建在頁面頂部直接切換文案、點擊平滑捲動。","樣式同步調整；Hero 配色和字色更新以維持足夠對比。"]', 'add', '2026-02-23T10:25:20.009Z', '2026-02-23T10:25:20.009Z')
ON CONFLICT(slug) DO UPDATE SET
  date = excluded.date,
  title = excluded.title,
  notes = excluded.notes,
  tag = excluded.tag,
  updated_at = excluded.updated_at;

INSERT INTO changelogs (slug, date, title, notes, tag, created_at, updated_at)
VALUES ('2025-11-18-blog', '2025-11-18', '新增BLOG 功能', '["有兩層階的項目管理","目前可以貼純文字","編輯更新篩選等基本功能都上去了"]', 'add', '2026-02-23T10:25:20.009Z', '2026-02-23T10:25:20.009Z')
ON CONFLICT(slug) DO UPDATE SET
  date = excluded.date,
  title = excluded.title,
  notes = excluded.notes,
  tag = excluded.tag,
  updated_at = excluded.updated_at;

INSERT INTO changelogs (slug, date, title, notes, tag, created_at, updated_at)
VALUES ('2025-11-20-blog', '2025-11-20', 'BLOG 編輯功能線上版(研究中)', '["將文章完全轉移進了DB","預計讓blog可以線上編輯、使用帳密登入"]', 'add', '2026-02-23T10:25:20.009Z', '2026-02-23T10:25:20.009Z')
ON CONFLICT(slug) DO UPDATE SET
  date = excluded.date,
  title = excluded.title,
  notes = excluded.notes,
  tag = excluded.tag,
  updated_at = excluded.updated_at;

INSERT INTO changelogs (slug, date, title, notes, tag, created_at, updated_at)
VALUES ('2025-11-21-update', '2025-11-21', '新增"外掛"用空間路由', '["嘗試增加複雜的頁面","讓AI生成的漂亮網頁可以被執行"]', 'add', '2026-02-23T10:25:20.009Z', '2026-02-23T10:25:20.009Z')
ON CONFLICT(slug) DO UPDATE SET
  date = excluded.date,
  title = excluded.title,
  notes = excluded.notes,
  tag = excluded.tag,
  updated_at = excluded.updated_at;

INSERT INTO changelogs (slug, date, title, notes, tag, created_at, updated_at)
VALUES ('2025-11-24-update', '2025-11-24', '更新自適應部落格功能~ 還在研究中', '["可以上傳圖片","用上了儲存空間"]', 'add', '2026-02-23T10:25:20.009Z', '2026-02-23T10:25:20.009Z')
ON CONFLICT(slug) DO UPDATE SET
  date = excluded.date,
  title = excluded.title,
  notes = excluded.notes,
  tag = excluded.tag,
  updated_at = excluded.updated_at;

INSERT INTO changelogs (slug, date, title, notes, tag, created_at, updated_at)
VALUES ('2025-11-27-update', '2025-11-27', '更新封面、多加投票小工具', '[]', 'add', '2026-02-23T10:25:20.009Z', '2026-02-23T10:25:20.009Z')
ON CONFLICT(slug) DO UPDATE SET
  date = excluded.date,
  title = excluded.title,
  notes = excluded.notes,
  tag = excluded.tag,
  updated_at = excluded.updated_at;