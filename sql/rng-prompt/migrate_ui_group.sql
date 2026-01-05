BEGIN TRANSACTION;

ALTER TABLE categories ADD COLUMN ui_group TEXT DEFAULT 'Default';
ALTER TABLE categories ADD COLUMN is_optional BOOLEAN DEFAULT 0;

UPDATE categories
SET
  ui_group = CASE slug
    WHEN '畫風' THEN 'Base'
    WHEN '體型' THEN 'Base'
    WHEN '場景' THEN 'character'
    WHEN '特別場景' THEN 'character'
    WHEN '服裝搭配' THEN 'character'
    WHEN '服裝設計' THEN 'character'
    WHEN '胸部姿勢' THEN 'pose'
    WHEN '臀部姿勢' THEN 'pose'
    WHEN '腿部姿勢' THEN 'pose'
    WHEN '體位姿勢' THEN 'pose'
    WHEN '臉型' THEN 'Look'
    WHEN '髮型' THEN 'Look'
    WHEN '髮色' THEN 'Look'
    WHEN '表情' THEN 'Look'
    WHEN '基本配件' THEN 'Decorations'
    WHEN '頭配件' THEN 'Decorations'
    WHEN '上半配件' THEN 'Decorations'
    WHEN '下半配件' THEN 'Decorations'
    WHEN '全身配件' THEN 'Decorations'
    WHEN '特級配件' THEN 'Decorations'
    WHEN '瞳色' THEN 'FaceDetail'
    WHEN '虹膜' THEN 'FaceDetail'
    WHEN '眼睫毛' THEN 'FaceDetail'
    WHEN '眼妝' THEN 'FaceDetail'
    WHEN '唇狀' THEN 'FaceDetail'
    WHEN '唇色' THEN 'FaceDetail'
    WHEN '唇感' THEN 'FaceDetail'
    ELSE COALESCE(ui_group, 'Default')
  END,
  is_optional = CASE slug
    WHEN '畫風' THEN 0
    WHEN '體型' THEN 0
    WHEN '場景' THEN 0
    WHEN '特別場景' THEN 1
    WHEN '服裝搭配' THEN 0
    WHEN '服裝設計' THEN 0
    WHEN '胸部姿勢' THEN 0
    WHEN '臀部姿勢' THEN 0
    WHEN '腿部姿勢' THEN 0
    WHEN '體位姿勢' THEN 0
    WHEN '臉型' THEN 0
    WHEN '髮型' THEN 0
    WHEN '髮色' THEN 1
    WHEN '表情' THEN 1
    WHEN '基本配件' THEN 1
    WHEN '頭配件' THEN 1
    WHEN '上半配件' THEN 1
    WHEN '下半配件' THEN 1
    WHEN '全身配件' THEN 1
    WHEN '特級配件' THEN 1
    WHEN '瞳色' THEN 1
    WHEN '虹膜' THEN 1
    WHEN '眼睫毛' THEN 1
    WHEN '眼妝' THEN 1
    WHEN '唇狀' THEN 1
    WHEN '唇色' THEN 1
    WHEN '唇感' THEN 1
    ELSE CASE WHEN type = 'optional' THEN 1 ELSE 0 END
  END;

COMMIT;
