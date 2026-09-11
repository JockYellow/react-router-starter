import type { AnimeSeason } from "../anime.types";

export type AnimeCatalogProvider = "BANGUMI" | "ANILIST";

export type AnimeProviderRecord = {
  provider: AnimeCatalogProvider;
  providerId: number;
  malId: number | null;
  anilistId: number | null;
  bangumiId: number | null;
  titleZhTw: string | null;
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

export type AnimeProviderBatch = {
  records: AnimeProviderRecord[];
  nextCursor: string | null;
  done: boolean;
  step: number;
  stepTotal: number;
  label: string;
};
