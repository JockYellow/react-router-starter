-- 1. 分類表 (存畫風、服裝...等設定)
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    group_name TEXT,
    type TEXT DEFAULT 'req',
    is_multi BOOLEAN DEFAULT 0,
    min_select INTEGER DEFAULT 1,
    max_select INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
);

-- 2. 項目表 (存具體的咒語)
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- 3. 群組規則表
CREATE TABLE IF NOT EXISTS group_rules (
    group_name TEXT PRIMARY KEY,
    min_select INTEGER DEFAULT 1,
    max_select INTEGER DEFAULT 1
);

-- 4. 模板與其他設定
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);