export const ANIME_SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"] as const;
export type AnimeSeason = (typeof ANIME_SEASONS)[number];

export const ANIME_PRIMARY_STATUSES = ["SEEN", "WANT", "NOT_SEEN"] as const;
export type AnimePrimaryStatus = (typeof ANIME_PRIMARY_STATUSES)[number];

export const ANIME_WATCH_DETAILS = [
  "COMPLETE",
  "SEASON_COMPLETE",
  "PARTIAL",
  "DROPPED",
  "MOVIE_ONLY",
] as const;
export type AnimeWatchDetail = (typeof ANIME_WATCH_DETAILS)[number];

export const ANIME_EVALUATION_KEYS = [
  "FAVORITE",
  "LOVE",
  "RECOMMEND",
  "NEUTRAL",
  "DISLIKE",
  "UNRATED",
] as const;
export type AnimeEvaluationKey = (typeof ANIME_EVALUATION_KEYS)[number];

export const ANIME_EVALUATIONS: ReadonlyArray<{
  key: AnimeEvaluationKey;
  label: string;
}> = [
  { key: "FAVORITE", label: "最喜歡" },
  { key: "LOVE", label: "很喜歡" },
  { key: "RECOMMEND", label: "值得看" },
  { key: "NEUTRAL", label: "普通" },
  { key: "DISLIKE", label: "不太喜歡" },
  { key: "UNRATED", label: "記不清／不評" },
];

export const ANIME_EVALUATION_TAGS = [
  { key: "STORY_ENGAGING", label: "劇情一直有吸引力" },
  { key: "GETS_BETTER", label: "越看越好" },
  { key: "STRONG_START_WEAK_FINISH", label: "前強後弱" },
  { key: "STRONG_ENDING", label: "收尾漂亮" },
  { key: "WEAK_ENDING", label: "收尾可惜" },
  { key: "LIKEABLE_CHARACTERS", label: "角色很討喜" },
  { key: "GREAT_CHARACTER_CHEMISTRY", label: "角色互動很好看" },
  { key: "STRONG_CHARACTER_GROWTH", label: "角色成長寫得好" },
  { key: "COMPELLING_WORLD", label: "世界觀很吸引人" },
  { key: "MEMORABLE_DIRECTION", label: "演出有記憶點" },
  { key: "STRONG_VISUALS", label: "畫面表現很出色" },
  { key: "MUSIC_ADDS_A_LOT", label: "音樂很加分" },
  { key: "GOOD_BUT_NOT_FOR_ME", label: "不是我的菜但做得很好" },
  { key: "FLAWED_BUT_LOVE_IT", label: "有缺點但我很喜歡" },
  { key: "WANT_REWATCH", label: "想重看" },
] as const;

export type AnimeEvaluationTagKey = (typeof ANIME_EVALUATION_TAGS)[number]["key"];

export const ANIME_SURVEY_SCOPE_TYPES = ["TV_SEASON", "MOVIE_YEAR"] as const;
export type AnimeSurveyScopeType = (typeof ANIME_SURVEY_SCOPE_TYPES)[number];

export type AnimeCatalogRecord = {
  anilistId: number;
  malId: number | null;
  titleZhTw: string | null;
  titleNative: string | null;
  titleRomaji: string | null;
  titleEnglish: string | null;
  year: number | null;
  season: AnimeSeason | null;
  format: string | null;
  episodes: number | null;
  coverUrl: string | null;
  studio: string | null;
  genres: string[];
  popularity: number | null;
  averageScore: number | null;
  providerUpdatedAt: number | null;
  syncedAt: number;
};

export type AnimeDecision = {
  anilistId: number;
  status: AnimePrimaryStatus;
  detailStatus: AnimeWatchDetail | null;
  decidedAt: number;
  updatedAt: number;
};

export type AnimeEvaluation = {
  anilistId: number;
  rating: AnimeEvaluationKey | null;
  note: string | null;
  updatedAt: number;
};

export type AnimeSurveyScope =
  | {
      type: "TV_SEASON";
      year: number;
      season: AnimeSeason;
    }
  | {
      type: "MOVIE_YEAR";
      year: number;
    };

export function animeSurveyScopeKey(scope: AnimeSurveyScope): string {
  if (scope.type === "TV_SEASON") {
    return `tv:${scope.year}:${scope.season}`;
  }
  return `movie:${scope.year}`;
}

export function isAnimeEvaluationTagKey(value: string): value is AnimeEvaluationTagKey {
  return ANIME_EVALUATION_TAGS.some((tag) => tag.key === value);
}
