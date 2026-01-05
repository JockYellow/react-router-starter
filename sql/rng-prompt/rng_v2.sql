CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    ui_group TEXT DEFAULT 'Default',  -- UI 分組
    is_optional BOOLEAN DEFAULT 0,    -- 是否選填
    pick_min INTEGER DEFAULT 1,       -- 最小抽取數
    pick_max INTEGER DEFAULT 1,       -- 最大抽取數
    sort_order INTEGER DEFAULT 0
);
-- 1. 匯入 Categories
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('畫風', '畫風', 'Base', 0, 1, 1, 1);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('體型', '體型', 'Base', 0, 1, 1, 2);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('場景', '場景', 'character', 0, 1, 1, 3);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('特別場景', '特別場景', 'character', 1, 1, 1, 4);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('服裝搭配', '穿搭', 'character', 0, 1, 1, 5);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('服裝設計', '服設', 'character', 0, 1, 1, 6);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('胸部姿勢', '胸姿', 'pose', 0, 1, 1, 7);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('臀部姿勢', '臀姿', 'pose', 0, 1, 1, 8);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('腿部姿勢', '腿姿', 'pose', 0, 1, 1, 9);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('體位姿勢', '體姿', 'pose', 0, 1, 1, 10);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('臉型', '臉型', 'Look', 0, 1, 1, 11);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('髮型', '髮型', 'Look', 0, 1, 1, 12);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('髮色', '髮色', 'Look', 1, 1, 1, 13);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('表情', '表情', 'Look', 1, 1, 1, 14);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('基本配件', '基本配件', 'Decorations', 1, 1, 1, 15);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('頭配件', '頭', 'Decorations', 1, 1, 1, 16);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('上半配件', '上半', 'Decorations', 1, 1, 1, 17);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('下半配件', '下半', 'Decorations', 1, 1, 1, 18);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('全身配件', '全身', 'Decorations', 1, 1, 1, 19);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('特級配件', '特級', 'Decorations', 1, 1, 1, 20);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('瞳色', '瞳色', 'FaceDetail', 1, 1, 1, 21);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('虹膜', '虹膜', 'FaceDetail', 1, 1, 1, 22);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('眼睫毛', '眼睫毛', 'FaceDetail', 1, 1, 1, 23);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('眼妝', '眼妝', 'FaceDetail', 1, 1, 1, 24);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('唇狀', '唇狀', 'FaceDetail', 1, 1, 1, 25);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('唇色', '唇色', 'FaceDetail', 1, 1, 1, 26);
INSERT INTO categories (slug, label, ui_group, is_optional, pick_min, pick_max, sort_order) VALUES ('唇感', '唇感', 'FaceDetail', 1, 1, 1, 27);