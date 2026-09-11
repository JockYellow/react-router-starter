import { ensureAnimeSchema } from "./anime.schema.server";
import type { AnimeProviderRecord } from "./providers/anime-provider.types";

const schemaPromises = new WeakMap<object, Promise<void>>();

/**
 * Ensures the provider-specific Bangumi metrics table exists.
 *
 * Safe backfill is intentionally limited to Bangumi-only catalog rows. Rows that
 * also carry an AniList id may contain the legacy AniList popularity scale in
 * anime_items.popularity, so those rows are backfilled only when Bangumi is
 * observed again through the provider cache.
 *
 * @param db - BLOG_DB D1 binding.
 */
export async function ensureAnimeBangumiMetricsSchema(db: D1Database): Promise<void> {
  await ensureAnimeSchema(db);
  const key = db as unknown as object;
  const existing = schemaPromises.get(key);
  if (existing) return existing;

  const pending = db
    .batch([
      db.prepare(
        `CREATE TABLE IF NOT EXISTS anime_bangumi_metrics (
          anime_id INTEGER PRIMARY KEY,
          bangumi_id INTEGER NOT NULL UNIQUE CHECK (bangumi_id > 0),
          collection_total INTEGER CHECK (collection_total IS NULL OR collection_total >= 0),
          average_score INTEGER CHECK (average_score IS NULL OR average_score BETWEEN 0 AND 100),
          format TEXT,
          observed_at INTEGER NOT NULL,
          FOREIGN KEY (anime_id) REFERENCES anime_items(anime_id) ON DELETE CASCADE
        )`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_anime_bangumi_metrics_collection
         ON anime_bangumi_metrics (collection_total DESC, average_score DESC)`,
      ),
      db.prepare(
        `INSERT OR IGNORE INTO anime_bangumi_metrics (
          anime_id, bangumi_id, collection_total, average_score, format, observed_at
        )
        SELECT anime_id, bangumi_id, popularity, average_score, format, updated_at
        FROM anime_items
        WHERE bangumi_id IS NOT NULL
          AND anilist_id IS NULL`,
      ),
    ])
    .then(() => undefined)
    .catch((error) => {
      schemaPromises.delete(key);
      throw error;
    });

  schemaPromises.set(key, pending);
  return pending;
}

/**
 * Stores Bangumi collection metrics without mixing them into AniList popularity.
 *
 * @param db - BLOG_DB D1 binding.
 * @param animeId - Canonical Anime Memory id.
 * @param record - Provider record; non-Bangumi records are ignored.
 */
export async function upsertAnimeBangumiMetrics(
  db: D1Database,
  animeId: number,
  record: AnimeProviderRecord,
): Promise<void> {
  if (record.provider !== "BANGUMI" || !record.bangumiId) return;
  await ensureAnimeBangumiMetricsSchema(db);

  await db
    .prepare(
      `INSERT INTO anime_bangumi_metrics (
        anime_id, bangumi_id, collection_total, average_score, format, observed_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(anime_id) DO UPDATE SET
        bangumi_id = excluded.bangumi_id,
        collection_total = excluded.collection_total,
        average_score = excluded.average_score,
        format = COALESCE(excluded.format, anime_bangumi_metrics.format),
        observed_at = excluded.observed_at`,
    )
    .bind(
      animeId,
      record.bangumiId,
      record.popularity,
      record.averageScore,
      record.format,
      Date.now(),
    )
    .run();
}
