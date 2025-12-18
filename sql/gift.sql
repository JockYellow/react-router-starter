-- 檔名：schema.sql
DROP TABLE IF EXISTS gift_r1_picks;
DROP TABLE IF EXISTS gift_votes;
DROP TABLE IF EXISTS gifts;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS gift_stage;

CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  age_years INTEGER DEFAULT 0,
  age_months INTEGER DEFAULT 0,
  round_caught INTEGER DEFAULT 0,
  pk_value INTEGER DEFAULT 0,
  pk_loss_count INTEGER DEFAULT 0,
  pk_loss_opponents INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE gifts (
  id TEXT PRIMARY KEY,
  type TEXT CHECK(type IN ('GOOD', 'BAD')) NOT NULL,
  provider_id TEXT NOT NULL,
  holder_id TEXT,
  slogan TEXT NOT NULL,
  tags TEXT,
  image_key TEXT,
  is_locked BOOLEAN DEFAULT 0,
  is_forced BOOLEAN DEFAULT 0,
  vote_count INTEGER DEFAULT 0,
  is_revealed BOOLEAN DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (provider_id) REFERENCES players(id),
  FOREIGN KEY (holder_id) REFERENCES players(id)
);

CREATE TABLE gift_votes (
  gift_id TEXT NOT NULL,
  voter_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  PRIMARY KEY (gift_id, voter_id),
  FOREIGN KEY (gift_id) REFERENCES gifts(id),
  FOREIGN KEY (voter_id) REFERENCES players(id),
  FOREIGN KEY (target_id) REFERENCES players(id)
);

CREATE TABLE gift_stage (
  id TEXT PRIMARY KEY,
  stage TEXT,
  current_gift_id TEXT,
  current_player_id TEXT,
  message TEXT,
  round INTEGER DEFAULT 1,
  updated_at INTEGER DEFAULT (strftime('%s','now')),
  FOREIGN KEY (current_gift_id) REFERENCES gifts(id),
  FOREIGN KEY (current_player_id) REFERENCES players(id)
);

CREATE TABLE gift_r1_picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  gift_id TEXT NOT NULL,
  pk_score INTEGER,
  outcome TEXT CHECK(outcome IN ('WIN', 'LOSE')),
  winner_id TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE (round, player_id),
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (gift_id) REFERENCES gifts(id),
  FOREIGN KEY (winner_id) REFERENCES players(id)
);
