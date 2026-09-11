const schemaInitPromises = new WeakMap<object, Promise<void>>();

async function createAnimeSchema(db: D1Database) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS anime_catalog (
      anilist_id INTEGER PRIMARY KEY CHECK (anilist_id > 0),
      mal_id INTEGER,
      title_zh_tw TEXT,
      title_native TEXT,
      title_romaji TEXT,
      title_english TEXT,
      year INTEGER CHECK (year IS NULL OR year > 1900),
      season TEXT CHECK (season IS NULL OR season IN ('WINTER', 'SPRING', 'SUMMER', 'FALL')),
      format TEXT,
      episodes INTEGER CHECK (episodes IS NULL OR episodes >= 0),
      cover_url TEXT,
      studio TEXT,
      genres_json TEXT NOT NULL DEFAULT '[]',
      popularity INTEGER CHECK (popularity IS NULL OR popularity >= 0),
      average_score INTEGER CHECK (average_score IS NULL OR average_score BETWEEN 0 AND 100),
      provider_updated_at INTEGER,
      synced_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS anime_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anilist_id INTEGER NOT NULL,
      alias TEXT NOT NULL,
      normalized_alias TEXT NOT NULL CHECK (length(normalized_alias) > 0),
      source TEXT NOT NULL,
      language TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
      created_at INTEGER NOT NULL,
      UNIQUE (anilist_id, normalized_alias, source),
      FOREIGN KEY (anilist_id) REFERENCES anime_catalog(anilist_id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS anime_decisions (
      anilist_id INTEGER PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('SEEN', 'WANT', 'NOT_SEEN')),
      detail_status TEXT CHECK (
        detail_status IS NULL OR detail_status IN (
          'COMPLETE',
          'SEASON_COMPLETE',
          'PARTIAL',
          'DROPPED',
          'MOVIE_ONLY'
        )
      ),
      decided_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (anilist_id) REFERENCES anime_catalog(anilist_id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS anime_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anilist_id INTEGER,
      source TEXT NOT NULL,
      source_ref TEXT NOT NULL,
      source_title TEXT,
      source_status TEXT,
      source_date TEXT,
      match_status TEXT NOT NULL DEFAULT 'MATCHED' CHECK (
        match_status IN ('MATCHED', 'AMBIGUOUS', 'UNMATCHED')
      ),
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (source, source_ref),
      FOREIGN KEY (anilist_id) REFERENCES anime_catalog(anilist_id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS anime_evaluations (
      anilist_id INTEGER PRIMARY KEY,
      rating TEXT CHECK (
        rating IS NULL OR rating IN (
          'FAVORITE',
          'LOVE',
          'RECOMMEND',
          'NEUTRAL',
          'DISLIKE',
          'UNRATED'
        )
      ),
      note TEXT,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (anilist_id) REFERENCES anime_catalog(anilist_id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS anime_evaluation_tags (
      anilist_id INTEGER NOT NULL,
      tag_key TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (anilist_id, tag_key),
      FOREIGN KEY (anilist_id) REFERENCES anime_catalog(anilist_id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS anime_survey_progress (
      scope_key TEXT PRIMARY KEY,
      scope_type TEXT NOT NULL CHECK (scope_type IN ('TV_SEASON', 'MOVIE_YEAR')),
      year INTEGER NOT NULL CHECK (year > 1900),
      season TEXT CHECK (season IS NULL OR season IN ('WINTER', 'SPRING', 'SUMMER', 'FALL')),
      candidate_count INTEGER NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
      last_position INTEGER NOT NULL DEFAULT 0 CHECK (last_position >= 0),
      completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
      started_at INTEGER,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS anime_survey_candidates (
      scope_key TEXT NOT NULL,
      anilist_id INTEGER NOT NULL,
      position INTEGER NOT NULL CHECK (position > 0),
      added_at INTEGER NOT NULL,
      PRIMARY KEY (scope_key, anilist_id),
      UNIQUE (scope_key, position),
      FOREIGN KEY (scope_key) REFERENCES anime_survey_progress(scope_key) ON DELETE CASCADE,
      FOREIGN KEY (anilist_id) REFERENCES anime_catalog(anilist_id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS anime_survey_load_state (
      scope_key TEXT PRIMARY KEY,
      scope_type TEXT NOT NULL CHECK (scope_type IN ('TV_SEASON', 'MOVIE_YEAR')),
      year INTEGER NOT NULL CHECK (year > 1900),
      season TEXT CHECK (season IS NULL OR season IN ('WINTER', 'SPRING', 'SUMMER', 'FALL')),
      phase TEXT NOT NULL CHECK (phase IN ('FETCHING_PROVIDER', 'BUILDING_SCOPE', 'READY', 'ERROR')),
      resume_phase TEXT CHECK (resume_phase IS NULL OR resume_phase IN ('FETCHING_PROVIDER', 'BUILDING_SCOPE')),
      target_count INTEGER NOT NULL DEFAULT 100 CHECK (target_count >= 0),
      fetched_count INTEGER NOT NULL DEFAULT 0 CHECK (fetched_count >= 0),
      next_page INTEGER NOT NULL DEFAULT 1 CHECK (next_page > 0),
      retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
      locked_until INTEGER,
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (scope_key) REFERENCES anime_survey_progress(scope_key) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS anime_seed_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      source_ref TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      queue_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
        queue_status IN ('PENDING', 'MATCHED', 'AMBIGUOUS', 'UNMATCHED', 'SKIPPED', 'ERROR')
      ),
      attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (source, source_ref)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_anime_catalog_year_season_format
      ON anime_catalog (year, season, format)`,
    `CREATE INDEX IF NOT EXISTS idx_anime_catalog_mal_id
      ON anime_catalog (mal_id)`,
    `CREATE INDEX IF NOT EXISTS idx_anime_aliases_normalized_alias
      ON anime_aliases (normalized_alias)`,
    `CREATE INDEX IF NOT EXISTS idx_anime_aliases_anilist_id
      ON anime_aliases (anilist_id)`,
    `CREATE INDEX IF NOT EXISTS idx_anime_decisions_status_detail
      ON anime_decisions (status, detail_status)`,
    `CREATE INDEX IF NOT EXISTS idx_anime_sources_source_match
      ON anime_sources (source, match_status)`,
    `CREATE INDEX IF NOT EXISTS idx_anime_sources_anilist_id
      ON anime_sources (anilist_id)`,
    `CREATE INDEX IF NOT EXISTS idx_anime_evaluations_rating
      ON anime_evaluations (rating)`,
    `CREATE INDEX IF NOT EXISTS idx_anime_evaluation_tags_tag_key
      ON anime_evaluation_tags (tag_key, anilist_id)`,
    `CREATE INDEX IF NOT EXISTS idx_anime_survey_progress_updated
      ON anime_survey_progress (updated_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_anime_survey_candidates_scope_position
      ON anime_survey_candidates (scope_key, position)`,
    `CREATE INDEX IF NOT EXISTS idx_anime_survey_load_state_phase
      ON anime_survey_load_state (phase, updated_at)`,
    `CREATE INDEX IF NOT EXISTS idx_anime_seed_queue_source_status
      ON anime_seed_queue (source, queue_status, updated_at)`,
  ].map((sql) => db.prepare(sql));

  await db.batch(statements);
}

/**
 * Ensures the Anime Memory tables exist in the application's existing D1 database.
 *
 * Initialization is cached per D1 binding object for the lifetime of the Worker isolate.
 * If initialization fails, the cached promise is cleared so a later request may retry.
 */
export function ensureAnimeSchema(db: D1Database): Promise<void> {
  const cacheKey = db as unknown as object;
  const existing = schemaInitPromises.get(cacheKey);
  if (existing) return existing;

  const pending = createAnimeSchema(db).catch((error) => {
    schemaInitPromises.delete(cacheKey);
    throw error;
  });

  schemaInitPromises.set(cacheKey, pending);
  return pending;
}
