import {
  ANIME_EVALUATION_KEYS,
  ANIME_PRIMARY_STATUSES,
  ANIME_WATCH_DETAILS,
  isAnimeEvaluationTagKey,
  type AnimeEvaluationKey,
  type AnimeEvaluationTagKey,
  type AnimePrimaryStatus,
  type AnimeWatchDetail,
} from "./anime.types";

export type AnimeRecordEditInput = {
  status: string;
  detailStatus?: string | null;
  rating?: string | null;
  tags?: readonly string[];
  note?: string | null;
};

export type NormalizedAnimeRecordEdit = {
  status: AnimePrimaryStatus;
  detailStatus: AnimeWatchDetail | null;
  rating: AnimeEvaluationKey | null;
  tags: AnimeEvaluationTagKey[];
  note: string | null;
};

export function normalizeAnimeRecordEdit(input: AnimeRecordEditInput): NormalizedAnimeRecordEdit {
  if (!ANIME_PRIMARY_STATUSES.includes(input.status as AnimePrimaryStatus)) {
    throw new Error("Invalid Anime primary status");
  }

  const status = input.status as AnimePrimaryStatus;
  if (status !== "SEEN") {
    return {
      status,
      detailStatus: null,
      rating: null,
      tags: [],
      note: null,
    };
  }

  const rawDetail = input.detailStatus?.trim() || null;
  const rawRating = input.rating?.trim() || null;
  if (rawDetail && !ANIME_WATCH_DETAILS.includes(rawDetail as AnimeWatchDetail)) {
    throw new Error("Invalid Anime watch detail");
  }
  if (rawRating && !ANIME_EVALUATION_KEYS.includes(rawRating as AnimeEvaluationKey)) {
    throw new Error("Invalid Anime evaluation");
  }
  if (rawRating && !rawDetail) {
    throw new Error("Viewing detail is required before rating");
  }

  const tags = [...new Set(input.tags ?? [])].filter(isAnimeEvaluationTagKey);
  const note = input.note?.trim().slice(0, 4000) || null;

  return {
    status,
    detailStatus: rawDetail as AnimeWatchDetail | null,
    rating: rawRating as AnimeEvaluationKey | null,
    tags,
    note,
  };
}

export function sanitizeAnimeLibraryReturnTo(value: string | null | undefined): string {
  const candidate = value?.trim();
  if (!candidate || candidate.length > 2000) return "/anime/library";
  if (candidate === "/anime/library" || candidate.startsWith("/anime/library?")) {
    return candidate;
  }
  return "/anime/library";
}
