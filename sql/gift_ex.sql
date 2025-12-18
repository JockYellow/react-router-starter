-- seed_gift.sql
-- 1. 先建立幾個玩家
INSERT INTO players (id, name, age, pk_value) VALUES 
('p1', 'Kevin', 30, 88),
('p2', 'Jessica', 25, 12),
('p3', 'Tom', 40, 55),
('p4', 'Eric', 28, 5);

-- 2. 建立幾個禮物
-- p1 (Kevin) 送了一個爛禮物
INSERT INTO gifts (id, type, provider_id, slogan, tags, is_locked) VALUES 
('g1', 'BAD', 'p1', '阿嬤的紫色內衣', '["#Fashion", "#Vintage"]', 0);

-- p2 (Jessica) 送了一個好禮物
INSERT INTO gifts (id, type, provider_id, slogan, tags, is_locked) VALUES 
('g2', 'GOOD', 'p2', 'PS5 Pro', '["#Tech", "#Gaming"]', 0);

-- p3 (Tom) 送了一個爛禮物
INSERT INTO gifts (id, type, provider_id, slogan, tags, is_locked) VALUES 
('g3', 'BAD', 'p3', '過期的一年份掛曆', '["#Paper", "#Useless"]', 0);

-- p4 (Eric) 送了一個好禮物
INSERT INTO gifts (id, type, provider_id, slogan, tags, is_locked) VALUES 
('g4', 'GOOD', 'p4', 'Sogo 禮券 2000元', '["#Money", "#Shopping"]', 0);