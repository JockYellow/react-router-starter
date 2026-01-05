DROP TABLE IF EXISTS game_sessions;
CREATE TABLE game_sessions (
    user_id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'IDLE',
    artist_ids TEXT,
    algorithm_state TEXT,
    total_count INTEGER DEFAULT 0,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS spotify_followed_artists (
    dataset_key TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    imported_at INTEGER NOT NULL,
    PRIMARY KEY (dataset_key, artist_id)
);
CREATE INDEX IF NOT EXISTS idx_spotify_followed_artists_dataset
    ON spotify_followed_artists (dataset_key, imported_at);
