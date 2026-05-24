import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { requireBlogDb } from "../../lib/d1.server";
import {
  getFoodMindCard,
  getFoodMindCards,
  getFoodMindFixedPlayer,
  getFoodMindItemIdsByTheme,
  getFoodMindRankingSet,
  getFoodMindRankingSets,
  getFoodMindTheme,
} from "./food-mind.cards";
import {
  buildRankingReveal,
  buildResultPayload,
  buildReveal,
  isFoodMindScore,
  normalizeRankingOrder,
} from "./food-mind.rules";
import type {
  FoodMindAnswer,
  FoodMindPlayer,
  FoodMindRankingAnswer,
  FoodMindRoom,
  FoodMindRoomStatus,
  FoodMindScore,
  FoodMindSharePayload,
  FoodMindStatePayload,
  FoodMindThemeId,
} from "./food-mind.types";

type Context = LoaderFunctionArgs["context"] | ActionFunctionArgs["context"];

type RoomRow = {
  id: string;
  theme_id: string;
  status: string;
  current_index: number;
  card_ids: string;
  created_at: string;
  finished_at: string | null;
};

type PlayerRow = {
  id: string;
  room_id: string;
  name: string;
  slot: number;
  created_at: string;
};

type AnswerRow = {
  id: string;
  room_id: string;
  card_id: string;
  player_id: string;
  self_score: number;
  predict_partner_score: number;
  created_at: string;
};

type RankingAnswerRow = {
  id: string;
  room_id: string;
  set_id: string;
  player_id: string;
  self_order: string;
  predict_partner_order: string;
  created_at: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function createRoomId(): string {
  return `fm_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

function parseCardIds(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toRoom(row: RoomRow): FoodMindRoom {
  const status: FoodMindRoomStatus =
    row.status === "playing" || row.status === "finished" ? row.status : "waiting";
  const theme = getFoodMindTheme(row.theme_id);
  return {
    id: row.id,
    themeId: theme.id,
    status,
    currentIndex: row.current_index,
    cardIds: parseCardIds(row.card_ids),
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

function toPlayer(row: PlayerRow): FoodMindPlayer {
  return {
    id: row.id,
    roomId: row.room_id,
    name: row.name,
    slot: row.slot === 2 ? 2 : 1,
    createdAt: row.created_at,
  };
}

function toAnswer(row: AnswerRow): FoodMindAnswer {
  const selfScore = isFoodMindScore(row.self_score) ? row.self_score : 0;
  const predictPartnerScore = isFoodMindScore(row.predict_partner_score) ? row.predict_partner_score : 0;
  return {
    id: row.id,
    roomId: row.room_id,
    cardId: row.card_id,
    playerId: row.player_id,
    selfScore,
    predictPartnerScore,
    createdAt: row.created_at,
  };
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toRankingAnswer(row: RankingAnswerRow): FoodMindRankingAnswer {
  return {
    id: row.id,
    roomId: row.room_id,
    setId: row.set_id,
    playerId: row.player_id,
    selfOrder: parseStringArray(row.self_order),
    predictPartnerOrder: parseStringArray(row.predict_partner_order),
    createdAt: row.created_at,
  };
}

/**
 * Ensures the food mind room, player, and answer tables exist in D1.
 *
 * @param db - Cloudflare D1 database binding.
 * @returns A promise that resolves after schema creation.
 */
export async function ensureFoodMindTables(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS food_mind_rooms (
        id TEXT PRIMARY KEY,
        theme_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'waiting',
        current_index INTEGER NOT NULL DEFAULT 0,
        card_ids TEXT NOT NULL,
        created_at TEXT NOT NULL,
        finished_at TEXT
      )`,
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS food_mind_players (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slot INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(room_id, slot)
      )`,
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS food_mind_answers (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        card_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        self_score INTEGER NOT NULL,
        predict_partner_score INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(room_id, card_id, player_id)
      )`,
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS food_mind_ranking_answers (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        set_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        self_order TEXT NOT NULL,
        predict_partner_order TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(room_id, set_id, player_id)
      )`,
    )
    .run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_food_mind_players_room ON food_mind_players(room_id, slot)").run();
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_food_mind_players_room_name ON food_mind_players(room_id, name)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_food_mind_answers_room_card ON food_mind_answers(room_id, card_id)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_food_mind_ranking_answers_room_set ON food_mind_ranking_answers(room_id, set_id)").run();
}

/**
 * Creates a food mind room for the selected Phase 2 theme.
 *
 * @param context - React Router loader/action context with the D1 binding.
 * @returns The created room.
 */
export async function createFoodMindRoom(context: Context, themeId: string | null = null): Promise<FoodMindRoom> {
  const db = requireBlogDb(context);
  await ensureFoodMindTables(db);

  const theme = getFoodMindTheme(themeId);
  const roomId = createRoomId();
  const cardIds = getFoodMindItemIdsByTheme(theme.id);
  await db
    .prepare(
      "INSERT INTO food_mind_rooms (id, theme_id, status, current_index, card_ids, created_at, finished_at) VALUES (?, ?, 'waiting', 0, ?, ?, NULL)",
    )
    .bind(roomId, theme.id, JSON.stringify(cardIds), nowIso())
    .run();

  return getFoodMindRoom(context, roomId);
}

/**
 * Loads one food mind room or throws a 404 response.
 *
 * @param context - React Router loader/action context with the D1 binding.
 * @param roomId - Room id from the URL.
 * @returns The room domain object.
 * @throws {Response} When the room is missing.
 */
export async function getFoodMindRoom(context: Context, roomId: string): Promise<FoodMindRoom> {
  const db = requireBlogDb(context);
  await ensureFoodMindTables(db);
  const row = await db
    .prepare("SELECT id, theme_id, status, current_index, card_ids, created_at, finished_at FROM food_mind_rooms WHERE id = ?")
    .bind(roomId)
    .first<RoomRow>();
  if (!row) {
    throw Response.json({ ok: false, error: "Room not found" }, { status: 404 });
  }
  return toRoom(row);
}

/**
 * Selects one of the two fixed identities for a single game room.
 *
 * @param context - React Router action context with the D1 binding.
 * @param roomId - Room id from the URL.
 * @param playerKey - Fixed player key selected by the user.
 * @returns The joined player.
 * @throws {Response} When the room is full or invalid.
 */
export async function joinFoodMindRoom(context: Context, roomId: string, playerKey: string): Promise<FoodMindPlayer> {
  const db = requireBlogDb(context);
  await ensureFoodMindTables(db);
  const fixedPlayer = getFoodMindFixedPlayer(playerKey);
  if (!fixedPlayer) {
    throw Response.json({ ok: false, error: "請選擇柔安或彥禎" }, { status: 400 });
  }

  const room = await getFoodMindRoom(context, roomId);
  if (room.status === "finished") {
    throw Response.json({ ok: false, error: "這個房間已經結束" }, { status: 409 });
  }

  const players = await listFoodMindPlayers(db, roomId);
  const existing = players.find((player) => player.name === fixedPlayer.name);
  if (existing) {
    return existing;
  }

  const player: FoodMindPlayer = {
    id: crypto.randomUUID(),
    roomId,
    name: fixedPlayer.name,
    slot: fixedPlayer.slot,
    createdAt: nowIso(),
  };

  await db
    .prepare("INSERT INTO food_mind_players (id, room_id, name, slot, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(player.id, roomId, player.name, player.slot, player.createdAt)
    .run();

  if (players.length + 1 >= 2) {
    await db.prepare("UPDATE food_mind_rooms SET status = 'playing' WHERE id = ? AND status = 'waiting'").bind(roomId).run();
  }

  return player;
}

async function listFoodMindPlayers(db: D1Database, roomId: string): Promise<FoodMindPlayer[]> {
  const { results } = await db
    .prepare("SELECT id, room_id, name, slot, created_at FROM food_mind_players WHERE room_id = ? ORDER BY slot ASC")
    .bind(roomId)
    .all<PlayerRow>();
  return (results ?? []).map(toPlayer);
}

async function listFoodMindAnswers(db: D1Database, roomId: string): Promise<FoodMindAnswer[]> {
  const { results } = await db
    .prepare(
      "SELECT id, room_id, card_id, player_id, self_score, predict_partner_score, created_at FROM food_mind_answers WHERE room_id = ? ORDER BY created_at ASC",
    )
    .bind(roomId)
    .all<AnswerRow>();
  return (results ?? []).map(toAnswer);
}

async function listFoodMindRankingAnswers(db: D1Database, roomId: string): Promise<FoodMindRankingAnswer[]> {
  const { results } = await db
    .prepare(
      "SELECT id, room_id, set_id, player_id, self_order, predict_partner_order, created_at FROM food_mind_ranking_answers WHERE room_id = ? ORDER BY created_at ASC",
    )
    .bind(roomId)
    .all<RankingAnswerRow>();
  return (results ?? []).map(toRankingAnswer);
}

/**
 * Builds the polling state payload for a room.
 *
 * @param context - React Router loader/action context with the D1 binding.
 * @param roomId - Room id from the URL.
 * @param playerId - Optional current player id for including `myAnswer`.
 * @returns Stable JSON state payload for the room page.
 */
export async function getFoodMindState(
  context: Context,
  roomId: string,
  playerId: string | null,
): Promise<FoodMindStatePayload> {
  const db = requireBlogDb(context);
  await ensureFoodMindTables(db);
  const room = await getFoodMindRoom(context, roomId);
  const theme = getFoodMindTheme(room.themeId);
  const players = await listFoodMindPlayers(db, roomId);
  const answers = await listFoodMindAnswers(db, roomId);
  const rankingAnswers = await listFoodMindRankingAnswers(db, roomId);
  const currentItemId = room.cardIds[room.currentIndex] ?? null;
  const currentCard = theme.mode === "rating" && currentItemId ? getFoodMindCard(theme.id, currentItemId) : null;
  const currentRankingSet =
    theme.mode === "ranking" && currentItemId ? getFoodMindRankingSet(theme.id, currentItemId) : null;
  const currentAnswers = currentCard ? answers.filter((answer) => answer.cardId === currentCard.id) : [];
  const currentRankingAnswers = currentRankingSet
    ? rankingAnswers.filter((answer) => answer.setId === currentRankingSet.id)
    : [];
  const reveal = currentCard ? buildReveal(currentCard, players, currentAnswers) : null;
  const rankingReveal = currentRankingSet ? buildRankingReveal(currentRankingSet, players, currentRankingAnswers) : null;

  return {
    ok: true,
    theme,
    room,
    players,
    currentCard,
    currentRankingSet,
    currentCardNumber: currentCard || currentRankingSet ? room.currentIndex + 1 : room.cardIds.length,
    totalCards: room.cardIds.length,
    answerStatuses: players.map((player) => ({
      playerId: player.id,
      submitted:
        theme.mode === "ranking"
          ? currentRankingAnswers.some((answer) => answer.playerId === player.id)
          : currentAnswers.some((answer) => answer.playerId === player.id),
    })),
    myAnswer: playerId ? currentAnswers.find((answer) => answer.playerId === playerId) ?? null : null,
    myRankingAnswer: playerId ? currentRankingAnswers.find((answer) => answer.playerId === playerId) ?? null : null,
    reveal,
    rankingReveal,
  };
}

/**
 * Stores or updates the current player's answer for the current card.
 *
 * @param context - React Router action context with the D1 binding.
 * @param roomId - Room id from the URL.
 * @param playerId - Player id submitting the answer.
 * @param selfScore - Player's own score.
 * @param predictPartnerScore - Player's prediction for the partner.
 * @returns Updated room state payload.
 */
export async function answerFoodMindCard(
  context: Context,
  roomId: string,
  playerId: string,
  selfScore: FoodMindScore,
  predictPartnerScore: FoodMindScore,
): Promise<FoodMindStatePayload> {
  const db = requireBlogDb(context);
  await ensureFoodMindTables(db);
  const room = await getFoodMindRoom(context, roomId);
  const theme = getFoodMindTheme(room.themeId);
  if (theme.mode !== "rating") {
    throw Response.json({ ok: false, error: "這一局不是評分題" }, { status: 400 });
  }
  const players = await listFoodMindPlayers(db, roomId);
  const player = players.find((item) => item.id === playerId);
  const currentCardId = room.cardIds[room.currentIndex] ?? null;
  if (!player || !currentCardId) {
    throw Response.json({ ok: false, error: "無法送出這一題" }, { status: 400 });
  }
  if (room.status !== "playing") {
    throw Response.json({ ok: false, error: "房間尚未開始或已結束" }, { status: 409 });
  }

  await db
    .prepare(
      "INSERT INTO food_mind_answers (id, room_id, card_id, player_id, self_score, predict_partner_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(room_id, card_id, player_id) DO UPDATE SET self_score = excluded.self_score, predict_partner_score = excluded.predict_partner_score, created_at = excluded.created_at",
    )
    .bind(crypto.randomUUID(), roomId, currentCardId, playerId, selfScore, predictPartnerScore, nowIso())
    .run();

  return getFoodMindState(context, roomId, playerId);
}

/**
 * Stores or updates the current player's ranking answer for the current set.
 *
 * @param context - React Router action context with the D1 binding.
 * @param roomId - Room id from the URL.
 * @param playerId - Player id submitting the ranking.
 * @param selfOrder - Player's own order.
 * @param predictPartnerOrder - Player's predicted partner order.
 * @returns Updated room state payload.
 */
export async function answerFoodMindRankingSet(
  context: Context,
  roomId: string,
  playerId: string,
  selfOrder: string[],
  predictPartnerOrder: string[],
): Promise<FoodMindStatePayload> {
  const db = requireBlogDb(context);
  await ensureFoodMindTables(db);
  const room = await getFoodMindRoom(context, roomId);
  const theme = getFoodMindTheme(room.themeId);
  if (theme.mode !== "ranking") {
    throw Response.json({ ok: false, error: "這一局不是排序題" }, { status: 400 });
  }
  const players = await listFoodMindPlayers(db, roomId);
  const player = players.find((item) => item.id === playerId);
  const currentSetId = room.cardIds[room.currentIndex] ?? null;
  const currentSet = currentSetId ? getFoodMindRankingSet(theme.id, currentSetId) : null;
  if (!player || !currentSet) {
    throw Response.json({ ok: false, error: "無法送出這一組排序" }, { status: 400 });
  }
  if (room.status !== "playing") {
    throw Response.json({ ok: false, error: "房間尚未開始或已結束" }, { status: 409 });
  }

  const normalizedSelfOrder = normalizeRankingOrder(selfOrder, currentSet.options);
  const normalizedPrediction = normalizeRankingOrder(predictPartnerOrder, currentSet.options);
  if (!normalizedSelfOrder || !normalizedPrediction) {
    throw Response.json({ ok: false, error: "排序內容不完整" }, { status: 400 });
  }

  await db
    .prepare(
      "INSERT INTO food_mind_ranking_answers (id, room_id, set_id, player_id, self_order, predict_partner_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(room_id, set_id, player_id) DO UPDATE SET self_order = excluded.self_order, predict_partner_order = excluded.predict_partner_order, created_at = excluded.created_at",
    )
    .bind(
      crypto.randomUUID(),
      roomId,
      currentSet.id,
      playerId,
      JSON.stringify(normalizedSelfOrder),
      JSON.stringify(normalizedPrediction),
      nowIso(),
    )
    .run();

  return getFoodMindState(context, roomId, playerId);
}

/**
 * Advances a room to the next card after both current answers are present.
 *
 * @param context - React Router action context with the D1 binding.
 * @param roomId - Room id from the URL.
 * @param expectedIndex - Current index observed by the caller.
 * @returns Updated room state payload.
 */
export async function advanceFoodMindRoom(
  context: Context,
  roomId: string,
  expectedIndex: number,
): Promise<FoodMindStatePayload> {
  const db = requireBlogDb(context);
  await ensureFoodMindTables(db);
  const room = await getFoodMindRoom(context, roomId);
  const theme = getFoodMindTheme(room.themeId);
  if (room.status !== "playing") {
    return getFoodMindState(context, roomId, null);
  }
  if (room.currentIndex !== expectedIndex) {
    return getFoodMindState(context, roomId, null);
  }

  const players = await listFoodMindPlayers(db, roomId);
  const currentItemId = room.cardIds[room.currentIndex] ?? null;
  if (!currentItemId || players.length < 2) {
    throw Response.json({ ok: false, error: "目前不能前往下一題" }, { status: 409 });
  }

  const { results } =
    theme.mode === "ranking"
      ? await db
          .prepare("SELECT player_id FROM food_mind_ranking_answers WHERE room_id = ? AND set_id = ?")
          .bind(roomId, currentItemId)
          .all<{ player_id: string }>()
      : await db
          .prepare("SELECT player_id FROM food_mind_answers WHERE room_id = ? AND card_id = ?")
          .bind(roomId, currentItemId)
          .all<{ player_id: string }>();
  const submitted = new Set((results ?? []).map((row) => row.player_id));
  if (!players.every((player) => submitted.has(player.id))) {
    throw Response.json({ ok: false, error: "雙方都作答後才能下一題" }, { status: 409 });
  }

  if (room.currentIndex >= room.cardIds.length - 1) {
    await db
      .prepare("UPDATE food_mind_rooms SET status = 'finished', finished_at = ? WHERE id = ? AND current_index = ?")
      .bind(nowIso(), roomId, expectedIndex)
      .run();
  } else {
    await db
      .prepare("UPDATE food_mind_rooms SET current_index = current_index + 1 WHERE id = ? AND current_index = ?")
      .bind(roomId, expectedIndex)
      .run();
  }

  return getFoodMindState(context, roomId, null);
}

/**
 * Builds the result payload for a completed or in-progress room.
 *
 * @param context - React Router loader context with the D1 binding.
 * @param roomId - Room id from the URL.
 * @returns Result statistics for the room.
 */
export async function getFoodMindResult(context: Context, roomId: string): Promise<ReturnType<typeof buildResultPayload>> {
  const db = requireBlogDb(context);
  await ensureFoodMindTables(db);
  const room = await getFoodMindRoom(context, roomId);
  const theme = getFoodMindTheme(room.themeId);
  const players = await listFoodMindPlayers(db, roomId);
  const answers = await listFoodMindAnswers(db, roomId);
  const rankingAnswers = await listFoodMindRankingAnswers(db, roomId);
  const cards = getFoodMindCards(theme.id, room.cardIds);
  const rankingSets = getFoodMindRankingSets(theme.id, room.cardIds);
  return buildResultPayload(theme, room, players, cards, answers, rankingSets, rankingAnswers);
}

/**
 * Builds a compact read-only sharing payload for a completed or in-progress room.
 *
 * @param context - React Router loader context with the D1 binding.
 * @param roomId - Room id from the URL.
 * @returns Share-safe summary payload.
 */
export async function getFoodMindShare(context: Context, roomId: string): Promise<FoodMindSharePayload> {
  const result = await getFoodMindResult(context, roomId);
  const highlights =
    result.mode === "ranking"
      ? result.rankingResults.flatMap((item) => [
          item.sharedTop.length > 0 ? `${item.set.title}共同高順位：${item.sharedTop.join("、")}` : "",
          item.biggestMisses[0] ? `${item.set.title}最大誤判：${item.biggestMisses[0].option}` : "",
        ]).filter(Boolean)
      : [
          result.mutualLoves[0] ? `共同喜歡：${result.mutualLoves[0].card.name}` : "",
          result.safePicks[0] ? `安全可吃：${result.safePicks[0].card.name}` : "",
          result.hardNos[0] ? `明確地雷：${result.hardNos[0].card.name}` : "",
          result.biggestMisses[0] ? `最大誤判：${result.biggestMisses[0].card.name}` : "",
          result.guessSummary.title,
        ].filter(Boolean);

  return {
    ok: true,
    roomId: result.room.id,
    themeName: result.theme.name,
    mode: result.mode,
    totalTitle: result.totalTitle,
    totalSummary: result.totalSummary,
    nextStarter: result.nextStarter,
    highlights: highlights.slice(0, 6),
  };
}
