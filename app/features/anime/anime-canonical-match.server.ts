import { normalizeAnimeAlias } from "./anime-title";
import { ensureAnimeSchema } from "./anime.schema.server";

export type AnimeCanonicalExternalIds = {
  malId?: number | null;
  anilistId?: number | null;
  bangumiId?: number | null;
};

export type AnimeCanonicalMatchInput = {
  externalIds?: AnimeCanonicalExternalIds;
  aliases?: readonly string[];
  year?: number | null;
};

function positiveInteger(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function normalizedAliases(values: readonly string[]): string[] {
  return Array.from(
    new Set(values.map((value) => normalizeAnimeAlias(value)).filter(Boolean)),
  );
}

/**
 * Resolves an existing canonical Anime Memory row by provider ids.
 *
 * External ids are stronger identity evidence than titles, so callers should
 * always try this path before exact-alias reconciliation.
 */
export async function findCanonicalAnimeIdByExternalIds(
  db: D1Database,
  ids: AnimeCanonicalExternalIds,
): Promise<number | null> {
  await ensureAnimeSchema(db);

  const candidates = [
    ["mal_id", positiveInteger(ids.malId)],
    ["anilist_id", positiveInteger(ids.anilistId)],
    ["bangumi_id", positiveInteger(ids.bangumiId)],
  ] as const;

  for (const [column, value] of candidates) {
    if (!value) continue;
    const row = await db
      .prepare(`SELECT anime_id FROM anime_items WHERE ${column} = ?`)
      .bind(value)
      .first<{ anime_id: number }>();
    if (row?.anime_id) return row.anime_id;
  }

  return null;
}

/**
 * Resolves a unique canonical row by exact normalized alias plus compatible year.
 *
 * This intentionally refuses alias-only matching without a year. The product
 * contract favors unresolved provenance over a plausible but unsafe merge.
 */
export async function findUniqueCanonicalAnimeIdByExactAliases(
  db: D1Database,
  aliases: readonly string[],
  year: number | null | undefined,
): Promise<number | null> {
  await ensureAnimeSchema(db);
  if (!year || !Number.isInteger(year) || year <= 1900) return null;

  const normalized = normalizedAliases(aliases);
  if (!normalized.length) return null;

  const matchingIds = new Set<number>();
  for (const alias of normalized) {
    const rows = await db
      .prepare(
        `SELECT DISTINCT i.anime_id
         FROM anime_item_aliases a
         JOIN anime_items i ON i.anime_id = a.anime_id
         WHERE a.normalized_alias = ?
           AND (i.year = ? OR i.year IS NULL)
         LIMIT 3`,
      )
      .bind(alias, year)
      .all<{ anime_id: number }>();

    for (const row of rows.results ?? []) matchingIds.add(row.anime_id);
    if (matchingIds.size > 1) return null;
  }

  return matchingIds.size === 1 ? [...matchingIds][0] : null;
}

/**
 * Shared conservative canonical matcher for provider cache and future imports.
 *
 * Order of evidence:
 * 1. exact provider/external id
 * 2. unique exact normalized alias + compatible year
 */
export async function findCanonicalAnimeId(
  db: D1Database,
  input: AnimeCanonicalMatchInput,
): Promise<number | null> {
  const byExternalId = input.externalIds
    ? await findCanonicalAnimeIdByExternalIds(db, input.externalIds)
    : null;
  if (byExternalId) return byExternalId;

  return findUniqueCanonicalAnimeIdByExactAliases(
    db,
    input.aliases ?? [],
    input.year,
  );
}
