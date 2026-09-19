export const ANIME_WATCHLIST_LANES = ["MEAL", "FOCUS"] as const;
export type AnimeWatchlistLane = (typeof ANIME_WATCHLIST_LANES)[number];

export const ANIME_WATCHLIST_LANE_LABELS: Record<AnimeWatchlistLane, string> = {
  MEAL: "配飯線",
  FOCUS: "專心線",
};

export function isAnimeWatchlistLane(value: string): value is AnimeWatchlistLane {
  return ANIME_WATCHLIST_LANES.includes(value as AnimeWatchlistLane);
}

export function otherAnimeWatchlistLane(lane: AnimeWatchlistLane): AnimeWatchlistLane {
  return lane === "MEAL" ? "FOCUS" : "MEAL";
}
