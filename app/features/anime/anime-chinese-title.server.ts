import * as OpenCC from "opencc-js/core";
import * as Locale from "opencc-js/preset";

import { distinctAnimeAliases, normalizeAnimeAlias } from "./anime-title";
import { ensureAnimeSchema } from "./anime.schema.server";
import {
  searchBangumiAnime,
  type BangumiAnimeCandidate,
} from "./providers/bangumi.server";

const toTaiwanTraditional = OpenCC.ConverterFactory(Locale.from.cn, Locale.to.tw);

export function toTaiwanTraditionalChinese(value: string): string {
  const trimmed = value.trim();
  return trimmed ? toTaiwanTraditional(trimmed) : "";
}

type CatalogTitleContext = {
  anilist_id: number;
  title_zh_tw: string | null;
  title_native: string | null;
  title_romaji: string | null;
  title_english: string | null;
  year: number | null;
};

type AliasRow = { alias: string };

export type ChineseTitleEnrichmentResult =
  | { status: "CACHED"; titleZhTw: string }
  | { status: "ENRICHED"; titleZhTw: string; bangumiId: number; sourceTitle: string }
  | { status: "NO_MATCH"; titleZhTw: null }
  | { status: "NO_CHINESE_TITLE"; titleZhTw: null };

function bangumiYear(candidate: BangumiAnimeCandidate): number | null {
  const match = candidate.date?.match(/^(\d{4})-/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function sameOrUnknownYear(candidate: BangumiAnimeCandidate, expectedYear: number | null): boolean {
  const candidateYear = bangumiYear(candidate);
  return expectedYear == null || candidateYear == null || candidateYear === expectedYear;
}

async function loadTitleContext(db: D1Database, anilistId: number) {
  const catalog = await db
    .prepare(
      `SELECT
        anilist_id,
        title_zh_tw,
        title_native,
        title_romaji,
        title_english,
        year
      FROM anime_catalog
      WHERE anilist_id = ?`,
    )
    .bind(anilistId)
    .first<CatalogTitleContext>();

  if (!catalog) return null;

  const aliases = await db
    .prepare("SELECT alias FROM anime_aliases WHERE anilist_id = ? ORDER BY is_primary DESC, id ASC")
    .bind(anilistId)
    .all<AliasRow>();

  return {
    catalog,
    aliases: (aliases.results ?? []).map((row) => row.alias),
  };
}

async function resolveBangumiCandidate(
  context: CatalogTitleContext,
  aliases: readonly string[],
): Promise<BangumiAnimeCandidate | null> {
  const identityAliases = distinctAnimeAliases([
    context.title_native,
    context.title_romaji,
    context.title_english,
    ...aliases,
  ]);
  const normalizedAliases = new Set(identityAliases.map(normalizeAnimeAlias).filter(Boolean));
  const queries = distinctAnimeAliases([
    context.title_native,
    context.title_romaji,
    context.title_english,
  ]).slice(0, 3);

  const collected = new Map<number, BangumiAnimeCandidate>();

  for (const query of queries) {
    const results = await searchBangumiAnime(query, { limit: 10 });
    for (const candidate of results) collected.set(candidate.id, candidate);

    const exact = results.filter(
      (candidate) =>
        normalizedAliases.has(normalizeAnimeAlias(candidate.name)) &&
        sameOrUnknownYear(candidate, context.year),
    );

    if (exact.length === 1) return exact[0];
  }

  const exact = [...collected.values()].filter(
    (candidate) =>
      normalizedAliases.has(normalizeAnimeAlias(candidate.name)) &&
      sameOrUnknownYear(candidate, context.year),
  );

  return exact.length === 1 ? exact[0] : null;
}

async function persistChineseTitle(
  db: D1Database,
  anilistId: number,
  candidate: BangumiAnimeCandidate,
  titleZhTw: string,
) {
  const now = Date.now();
  const statements = [
    db
      .prepare(
        `UPDATE anime_catalog
        SET title_zh_tw = COALESCE(title_zh_tw, ?),
            updated_at = ?
        WHERE anilist_id = ?`,
      )
      .bind(titleZhTw, now, anilistId),
  ];

  const aliases = [
    {
      alias: candidate.nameCn,
      source: `bangumi:${candidate.id}:name_cn`,
      language: "zh-CN",
      isPrimary: 0,
    },
    {
      alias: titleZhTw,
      source: "resolved:zh-tw",
      language: "zh-TW",
      isPrimary: 1,
    },
  ].filter((entry): entry is { alias: string; source: string; language: string; isPrimary: number } => Boolean(entry.alias));

  for (const alias of aliases) {
    const normalized = normalizeAnimeAlias(alias.alias);
    if (!normalized) continue;
    statements.push(
      db
        .prepare(
          `INSERT INTO anime_aliases (
            anilist_id,
            alias,
            normalized_alias,
            source,
            language,
            is_primary,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(anilist_id, normalized_alias, source) DO UPDATE SET
            alias = excluded.alias,
            language = excluded.language,
            is_primary = MAX(anime_aliases.is_primary, excluded.is_primary)`,
        )
        .bind(
          anilistId,
          alias.alias,
          normalized,
          alias.source,
          alias.language,
          alias.isPrimary,
          now,
        ),
    );
  }

  await db.batch(statements);
}

export async function ensureAnimeChineseTitle(
  db: D1Database,
  anilistId: number,
): Promise<ChineseTitleEnrichmentResult> {
  await ensureAnimeSchema(db);
  const loaded = await loadTitleContext(db, anilistId);
  if (!loaded) return { status: "NO_MATCH", titleZhTw: null };

  if (loaded.catalog.title_zh_tw?.trim()) {
    return { status: "CACHED", titleZhTw: loaded.catalog.title_zh_tw.trim() };
  }

  const candidate = await resolveBangumiCandidate(loaded.catalog, loaded.aliases);
  if (!candidate) return { status: "NO_MATCH", titleZhTw: null };
  if (!candidate.nameCn?.trim()) return { status: "NO_CHINESE_TITLE", titleZhTw: null };

  const titleZhTw = toTaiwanTraditionalChinese(candidate.nameCn);
  if (!titleZhTw) return { status: "NO_CHINESE_TITLE", titleZhTw: null };

  await persistChineseTitle(db, anilistId, candidate, titleZhTw);
  return {
    status: "ENRICHED",
    titleZhTw,
    bangumiId: candidate.id,
    sourceTitle: candidate.nameCn,
  };
}
