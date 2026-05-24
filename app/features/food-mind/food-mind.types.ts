export type FoodMindThemeId = "breakfast_shop" | "hotpot" | "bubble_tea";

export type FoodMindThemeMode = "rating" | "ranking";

export type FoodMindThemeConfig = {
  id: FoodMindThemeId;
  mode: FoodMindThemeMode;
  name: string;
  description: string;
  estimatedMinutes: string;
};

export type FoodMindCard = {
  id: string;
  theme: FoodMindThemeId;
  name: string;
  tags: string[];
  group: string;
  description: string;
};

export type FoodMindRankingSet = {
  id: string;
  theme: Extract<FoodMindThemeId, "bubble_tea">;
  title: string;
  options: string[];
  description: string;
};

export type FoodMindScore = 0 | 1 | 2 | 3 | 4 | 5;

export type FoodMindScoreOption = {
  score: FoodMindScore;
  label: string;
  hint: string;
};

export type FoodMindRoomStatus = "waiting" | "playing" | "finished";

export type FoodMindRoom = {
  id: string;
  themeId: FoodMindThemeId;
  status: FoodMindRoomStatus;
  currentIndex: number;
  cardIds: string[];
  createdAt: string;
  finishedAt: string | null;
};

export type FoodMindPlayer = {
  id: string;
  roomId: string;
  name: string;
  slot: 1 | 2;
  createdAt: string;
};

export type FoodMindAnswer = {
  id: string;
  roomId: string;
  cardId: string;
  playerId: string;
  selfScore: FoodMindScore;
  predictPartnerScore: FoodMindScore;
  createdAt: string;
};

export type FoodMindRankingAnswer = {
  id: string;
  roomId: string;
  setId: string;
  playerId: string;
  selfOrder: string[];
  predictPartnerOrder: string[];
  createdAt: string;
};

export type FoodMindAnswerStatus = {
  playerId: string;
  submitted: boolean;
};

export type FoodMindReveal = {
  card: FoodMindCard;
  compatibility: FoodMindCompatibility;
  playerResults: FoodMindPlayerRoundResult[];
};

export type FoodMindRankingReveal = {
  set: FoodMindRankingSet;
  playerResults: FoodMindRankingPlayerResult[];
};

export type FoodMindRankingPlayerResult = {
  player: FoodMindPlayer;
  partner: FoodMindPlayer;
  selfOrder: string[];
  partnerSelfOrder: string[];
  predictPartnerOrder: string[];
  exactMatches: FoodMindRankingDiff[];
  biggestMisses: FoodMindRankingDiff[];
};

export type FoodMindRankingDiff = {
  option: string;
  predictedRank: number;
  actualRank: number;
  error: number;
};

export type FoodMindPlayerRoundResult = {
  player: FoodMindPlayer;
  partner: FoodMindPlayer;
  selfScore: FoodMindScore;
  partnerGuessedSelfScore: FoodMindScore;
  predictPartnerScore: FoodMindScore;
  partnerActualScore: FoodMindScore;
  mindRead: FoodMindMindRead;
};

export type FoodMindCompatibility = {
  key:
    | "mutual_love"
    | "safe_pick"
    | "conditional_open"
    | "one_sided_heat"
    | "hard_no"
    | "mutual_avoid"
    | "normal_split";
  label: string;
  description: string;
};

export type FoodMindMindRead = {
  error: number;
  label: string;
  special: "mine_detected" | "mine_alert" | "underestimated_heat" | null;
  prompt: string;
};

export type FoodMindStatePayload = {
  ok: true;
  theme: FoodMindThemeConfig;
  room: FoodMindRoom;
  players: FoodMindPlayer[];
  currentCard: FoodMindCard | null;
  currentRankingSet: FoodMindRankingSet | null;
  currentCardNumber: number;
  totalCards: number;
  answerStatuses: FoodMindAnswerStatus[];
  myAnswer: FoodMindAnswer | null;
  myRankingAnswer: FoodMindRankingAnswer | null;
  reveal: FoodMindReveal | null;
  rankingReveal: FoodMindRankingReveal | null;
};

export type FoodMindResultItem = {
  card: FoodMindCard;
  compatibility: FoodMindCompatibility;
  scores: {
    playerId: string;
    playerName: string;
    selfScore: FoodMindScore;
    predictPartnerScore: FoodMindScore;
    mindRead: FoodMindMindRead;
  }[];
};

export type FoodMindRankingResultItem = {
  set: FoodMindRankingSet;
  playerResults: FoodMindRankingPlayerResult[];
  sharedTop: string[];
  biggestMisses: FoodMindRankingDiff[];
};

export type FoodMindResultPayload = {
  ok: true;
  mode: FoodMindThemeMode;
  theme: FoodMindThemeConfig;
  room: FoodMindRoom;
  players: FoodMindPlayer[];
  totalTitle: string;
  totalSummary: string;
  nextStarter: string;
  guessSummary: {
    title: string;
    detail: string;
  };
  mutualLoves: FoodMindResultItem[];
  safePicks: FoodMindResultItem[];
  oneSidedHeats: FoodMindResultItem[];
  conditionalItems: FoodMindResultItem[];
  commonPicks: FoodMindResultItem[];
  hardNos: FoodMindResultItem[];
  biggestMisses: FoodMindResultItem[];
  allResults: FoodMindResultItem[];
  rankingResults: FoodMindRankingResultItem[];
};

export type FoodMindSharePayload = {
  ok: true;
  roomId: string;
  themeName: string;
  mode: FoodMindThemeMode;
  totalTitle: string;
  totalSummary: string;
  nextStarter: string;
  highlights: string[];
};
