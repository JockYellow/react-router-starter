import { distinctAnimeAliases, normalizeAnimeAlias } from "./anime-title";
import type { AniListAnime } from "./providers/anilist.server";
import { searchAniListAnime } from "./providers/anilist.server";
import type { BangumiAnimeCandidate } from "./providers/bangumi.server";
import { searchBangumiAnime } from "./providers/bangumi.server";

export type AniListTitleResolution =
  | {
      status: "MATCHED";
      anime: AniListAnime;
      reason: "EXACT_ALIAS" | "EXACT_ALIAS_AND_YEAR";
      candidates: AniListAnime[];
    }
  | {
      status: "AMBIGUOUS";
      reason: "MULTIPLE_EXACT_ALIASES" | "SEARCH_RESULTS_WITHOUT_EXACT_ALIAS";
      candidates: AniListAnime[];
    }
  | {
      status: "UNMATCHED";
      reason: "NO_RESULTS" | "EMPTY_TITLE";
      candidates: AniListAnime[];
    };

function aniListAliases(anime: AniListAnime): string[] {
  return distinctAnimeAliases([
    anime.title.romaji,
    anime.title.english,
    anime.title.native,
    ...anime.synonyms,
  ]);
}

function hasExactAlias(anime: AniListAnime, normalizedTitle: string): boolean {
  return aniListAliases(anime).some(
    (alias) => normalizeAnimeAlias(alias) === normalizedTitle,
  );
}

export async function resolveAniListByTitle(
  title: string,
  options: { year?: number | null; searchLimit?: number } = {},
): Promise<AniListTitleResolution> {
  const normalizedTitle = normalizeAnimeAlias(title);
  if (!normalizedTitle) {
    return { status: "UNMATCHED", reason: "EMPTY_TITLE", candidates: [] };
  }

  const candidates = await searchAniListAnime(title, {
    limit: options.searchLimit ?? 10,
  });
  if (!candidates.length) {
    return { status: "UNMATCHED", reason: "NO_RESULTS", candidates: [] };
  }

  const exact = candidates.filter((anime) => hasExactAlias(anime, normalizedTitle));
  if (exact.length === 1) {
    return {
      status: "MATCHED",
      anime: exact[0],
      reason:
        options.year != null && exact[0].seasonYear === options.year
          ? "EXACT_ALIAS_AND_YEAR"
          : "EXACT_ALIAS",
      candidates,
    };
  }

  if (exact.length > 1 && options.year != null) {
    const sameYear = exact.filter((anime) => anime.seasonYear === options.year);
    if (sameYear.length === 1) {
      return {
        status: "MATCHED",
        anime: sameYear[0],
        reason: "EXACT_ALIAS_AND_YEAR",
        candidates,
      };
    }
  }

  return {
    status: "AMBIGUOUS",
    reason:
      exact.length > 1
        ? "MULTIPLE_EXACT_ALIASES"
        : "SEARCH_RESULTS_WITHOUT_EXACT_ALIAS",
    candidates,
  };
}

function bangumiYear(candidate: BangumiAnimeCandidate): number | null {
  const match = candidate.date?.match(/^(\d{4})-/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

export async function resolveBangumiForAniList(
  anime: AniListAnime,
): Promise<
  | { status: "MATCHED"; candidate: BangumiAnimeCandidate; nameCn: string | null }
  | { status: "AMBIGUOUS"; candidates: BangumiAnimeCandidate[] }
  | { status: "UNMATCHED"; candidates: BangumiAnimeCandidate[] }
> {
  const aliases = aniListAliases(anime);
  const normalizedAliases = new Set(aliases.map(normalizeAnimeAlias).filter(Boolean));
  const queries = distinctAnimeAliases([
    anime.title.native,
    anime.title.romaji,
    anime.title.english,
  ]).slice(0, 3);

  const collected = new Map<number, BangumiAnimeCandidate>();
  for (const query of queries) {
    const results = await searchBangumiAnime(query, { limit: 10 });
    for (const candidate of results) collected.set(candidate.id, candidate);

    const exactFromThisQuery = results.filter((candidate) =>
      normalizedAliases.has(normalizeAnimeAlias(candidate.name)),
    );
    if (exactFromThisQuery.length === 1) {
      const candidate = exactFromThisQuery[0];
      const year = bangumiYear(candidate);
      if (anime.seasonYear == null || year == null || anime.seasonYear === year) {
        return { status: "MATCHED", candidate, nameCn: candidate.nameCn };
      }
    }
  }

  const candidates = [...collected.values()];
  const exact = candidates.filter((candidate) =>
    normalizedAliases.has(normalizeAnimeAlias(candidate.name)),
  );

  const sameYear = exact.filter((candidate) => {
    const year = bangumiYear(candidate);
    return anime.seasonYear == null || year == null || year === anime.seasonYear;
  });

  if (sameYear.length === 1) {
    return {
      status: "MATCHED",
      candidate: sameYear[0],
      nameCn: sameYear[0].nameCn,
    };
  }

  if (exact.length || candidates.length) {
    return { status: "AMBIGUOUS", candidates: exact.length ? exact : candidates };
  }

  return { status: "UNMATCHED", candidates: [] };
}
