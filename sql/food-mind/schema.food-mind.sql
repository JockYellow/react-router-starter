CREATE TABLE IF NOT EXISTS food_mind_rooms (
  id TEXT PRIMARY KEY,
  theme_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  current_index INTEGER NOT NULL DEFAULT 0,
  card_ids TEXT NOT NULL,
  created_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS food_mind_players (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slot INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(room_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_food_mind_players_room
  ON food_mind_players(room_id, slot);

CREATE UNIQUE INDEX IF NOT EXISTS idx_food_mind_players_room_name
  ON food_mind_players(room_id, name);

CREATE TABLE IF NOT EXISTS food_mind_answers (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  self_score INTEGER NOT NULL,
  predict_partner_score INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(room_id, card_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_food_mind_answers_room_card
  ON food_mind_answers(room_id, card_id);

CREATE TABLE IF NOT EXISTS food_mind_ranking_answers (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  set_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  self_order TEXT NOT NULL,
  predict_partner_order TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(room_id, set_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_food_mind_ranking_answers_room_set
  ON food_mind_ranking_answers(room_id, set_id);
