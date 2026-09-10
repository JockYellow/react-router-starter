import type { AnimePrimaryStatus, AnimeWatchDetail } from "./anime.types";

export const NETFLIX_REVIEW_STATUSES = [
  "看完",
  "看完一季／系列未追完",
  "看過一部分",
  "棄番",
  "沒看",
  "只看特別篇／電影",
  "誤判",
  "之後再確認",
] as const;

export type NetflixReviewStatus = (typeof NETFLIX_REVIEW_STATUSES)[number];

export type ReviewedNetflixSeedRow = {
  title: string;
  category?: string | null;
  format?: string | null;
  viewingRecordCount?: number | null;
  distinctTitleCount?: number | null;
  firstWatchedAt?: string | null;
  lastWatchedAt?: string | null;
  reviewStatus: string;
  evidence?: string | null;
  verificationStatus?: string | null;
  verificationUrl?: string | null;
  sourceRowNumber?: number | null;
};

export type NetflixDecisionMapping = {
  include: boolean;
  status: AnimePrimaryStatus | null;
  detailStatus: AnimeWatchDetail | null;
  reason: "MAPPED" | "EXCLUDED_FALSE_POSITIVE" | "DEFERRED" | "UNKNOWN_STATUS";
};

export function mapNetflixReviewStatus(reviewStatus: string): NetflixDecisionMapping {
  switch (reviewStatus.trim()) {
    case "看完":
      return { include: true, status: "SEEN", detailStatus: "COMPLETE", reason: "MAPPED" };
    case "看完一季／系列未追完":
      return {
        include: true,
        status: "SEEN",
        detailStatus: "SEASON_COMPLETE",
        reason: "MAPPED",
      };
    case "看過一部分":
      return { include: true, status: "SEEN", detailStatus: "PARTIAL", reason: "MAPPED" };
    case "棄番":
      return { include: true, status: "SEEN", detailStatus: "DROPPED", reason: "MAPPED" };
    case "沒看":
      return { include: true, status: "NOT_SEEN", detailStatus: null, reason: "MAPPED" };
    case "只看特別篇／電影":
      return { include: true, status: "SEEN", detailStatus: "MOVIE_ONLY", reason: "MAPPED" };
    case "誤判":
      return {
        include: false,
        status: null,
        detailStatus: null,
        reason: "EXCLUDED_FALSE_POSITIVE",
      };
    case "之後再確認":
      return { include: false, status: null, detailStatus: null, reason: "DEFERRED" };
    default:
      return { include: false, status: null, detailStatus: null, reason: "UNKNOWN_STATUS" };
  }
}

export function netflixSourceRef(row: ReviewedNetflixSeedRow): string {
  // A reviewed row represents one normalized title-level conclusion, not an
  // individual Netflix viewing event. Keep the reference stable across imports.
  return row.title.normalize("NFKC").trim();
}
