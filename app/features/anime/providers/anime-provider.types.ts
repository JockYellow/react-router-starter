import type { AnimeSeason } from "../anime.types";

export type AnimeCatalogProvider = "JIKAN" | "ANILIST";

export type AnimeProviderRecord = {
  provider: AnimeCatalogProvider;
  providerId: number;
  malId: number | null;
  anilistId: number | null;
  bangumiId: number | null;
  title: {
    romaji: string | null;
    english: string | null;
    native: string | null;
  };
  synonyms: string[];
  season: AnimeSeason | null;
  seasonYear: number | null;
  format: string | null;
  episodes: number | null;
  coverUrl: string | null;
  genres: string[];
  popularity: number | null;
  averageScore: number | null;
  providerUpdatedAt: number | null;
  studio: string | null;
};

export type AnimeProviderPageBatch = {
  records: AnimeProviderRecord[];
  page: number;
  hasNextPage: boolean;
};
