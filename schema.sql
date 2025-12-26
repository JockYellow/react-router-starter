DROP TABLE IF EXISTS game_sessions;
CREATE TABLE game_sessions (
    user_id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'IDLE',
    artist_ids TEXT,
    algorithm_state TEXT,
    total_count INTEGER DEFAULT 0,
    updated_at INTEGER
);
