import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useEffect, useMemo, useState } from "react";
import type { D1Database } from "@cloudflare/workers-types";
import { Gift, Zap, Lock, Unlock, Smartphone } from "lucide-react";

import { requireBlogDb } from "../lib/d1.server";
import { requireBlogImagesPublicBase, buildPublicImageUrl } from "../lib/r2.server";
import { getGifts, type Gift as GiftType } from "../lib/gift.server";

const STAGES = ["idle", "r1", "s1", "s2"] as const;
type Stage = (typeof STAGES)[number];

type StageRow = {
  stage: Stage;
  current_gift_id: string | null;
  round: number;
};

type PlayerRow = {
  id: string;
  name: string;
};

type GiftWithImage = GiftType & { image_url?: string | null; number?: string };

type ActionResponse =
  | { error: string }
  | { success: true; playerId?: string; lastIntent?: string };

async function ensurePlayerColumns(db: D1Database) {
  const { results } = await db.prepare("PRAGMA table_info(players)").all<{ name: string }>();
  const columns = new Set((results ?? []).map((row) => row.name));
  if (!columns.has("age_years")) await db.prepare("ALTER TABLE players ADD COLUMN age_years INTEGER DEFAULT 0").run();
  if (!columns.has("age_months")) await db.prepare("ALTER TABLE players ADD COLUMN age_months INTEGER DEFAULT 0").run();
  if (!columns.has("pk_loss_count")) await db.prepare("ALTER TABLE players ADD COLUMN pk_loss_count INTEGER DEFAULT 0").run();
  if (!columns.has("pk_loss_opponents")) await db.prepare("ALTER TABLE players ADD COLUMN pk_loss_opponents INTEGER DEFAULT 0").run();
}

async function ensureStage(db: D1Database): Promise<StageRow> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS gift_stage (
        id TEXT PRIMARY KEY,
        stage TEXT,
        current_gift_id TEXT,
        current_player_id TEXT,
        message TEXT,
        round INTEGER DEFAULT 1,
        updated_at INTEGER DEFAULT (strftime('%s','now'))
      )`
    )
    .run();
  const existing = await db
    .prepare("SELECT stage, current_gift_id, round FROM gift_stage WHERE id = 'global'")
    .first<StageRow>();
  if (!existing) {
    const row: StageRow = { stage: "idle", current_gift_id: null, round: 1 };
    await db
      .prepare("INSERT INTO gift_stage (id, stage, current_gift_id, round) VALUES ('global', ?, NULL, 1)")
      .bind(row.stage)
      .run();
    return row;
  }
  return existing as StageRow;
}

async function ensureR1Tables(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS gift_r1_picks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        round INTEGER NOT NULL,
        player_id TEXT NOT NULL,
        gift_id TEXT NOT NULL,
        pk_score INTEGER,
        outcome TEXT CHECK(outcome IN ('WIN','LOSE')),
        winner_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(round, player_id)
      )`
    )
    .run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_gift_r1_picks_round ON gift_r1_picks(round)").run();
}

async function ensureS1Tables(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS gift_votes (
        gift_id TEXT NOT NULL,
        voter_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        weight INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (gift_id, voter_id)
      )`
    )
    .run();
}

function numberGifts(gifts: GiftWithImage[]) {
  return gifts.map((gift, idx) => ({ ...gift, number: String(idx + 1).padStart(2, "0") }));
}

export async function loader({ context }: LoaderFunctionArgs) {
  const db = requireBlogDb(context);
  await ensurePlayerColumns(db);
  await ensureR1Tables(db);
  await ensureS1Tables(db);

  const imageBase = requireBlogImagesPublicBase(context);
  const giftsRaw = await getGifts(db);
  const gifts: GiftWithImage[] = numberGifts(
    giftsRaw.map((gift) => ({
      ...gift,
      image_url: gift.image_key ? buildPublicImageUrl(imageBase, gift.image_key) : null,
    }))
  );

  const playersRes = await db.prepare("SELECT id, name FROM players ORDER BY created_at DESC").all<PlayerRow>();
  const players = playersRes.results ?? [];
  const stage = await ensureStage(db);

  return { gifts, players, stage };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const db = requireBlogDb(context);
  await ensurePlayerColumns(db);
  await ensureStage(db);
  await ensureR1Tables(db);
  await ensureS1Tables(db);
  const stage = await ensureStage(db);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "join") {
    const name = (formData.get("player_name") as string)?.trim();
    const goodSlogan = (formData.get("good_slogan") as string)?.trim();
    const goodTags = (formData.get("good_tags") as string)?.trim() ?? "";
    const badSlogan = (formData.get("bad_slogan") as string)?.trim();
    const badTags = (formData.get("bad_tags") as string)?.trim() ?? "";

    if (!name || !goodSlogan || !badSlogan) {
      return { error: "請填寫名字與兩個禮物描述" } satisfies ActionResponse;
    }

    const existing = await db.prepare("SELECT id FROM players WHERE name = ?").bind(name).first();
    if (existing) {
      return { error: "這個名字已被使用，換一個吧" } satisfies ActionResponse;
    }

    const playerId = crypto.randomUUID();
    const goodId = crypto.randomUUID();
    const badId = crypto.randomUUID();

    await db.batch([
      db.prepare("INSERT INTO players (id, name, age, age_years, age_months, round_caught, pk_value, pk_loss_count, pk_loss_opponents) VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0)").bind(playerId, name),
      db
        .prepare(
          "INSERT INTO gifts (id, type, provider_id, slogan, tags, image_key, is_locked, is_forced, vote_count, is_revealed) VALUES (?, 'GOOD', ?, ?, ?, NULL, 0, 0, 0, 0)"
        )
        .bind(goodId, playerId, goodSlogan, JSON.stringify(goodTags.split(/\s+/).filter(Boolean))),
      db
        .prepare(
          "INSERT INTO gifts (id, type, provider_id, slogan, tags, image_key, is_locked, is_forced, vote_count, is_revealed) VALUES (?, 'BAD', ?, ?, ?, NULL, 0, 0, 0, 0)"
        )
        .bind(badId, playerId, badSlogan, JSON.stringify(badTags.split(/\s+/).filter(Boolean))),
    ]);

    return { success: true, playerId, lastIntent: "join" } satisfies ActionResponse;
  }

  if (intent === "wish") {
    const playerId = (formData.get("player_id") as string) ?? "";
    const giftId = (formData.get("gift_id") as string) ?? "";
    if (!playerId || !giftId) return { error: "缺少玩家或禮物" } satisfies ActionResponse;

    await db
      .prepare(
        "INSERT INTO gift_r1_picks (round, player_id, gift_id) VALUES (?, ?, ?) ON CONFLICT(round, player_id) DO UPDATE SET gift_id = excluded.gift_id, pk_score = NULL, outcome = NULL, winner_id = NULL"
      )
      .bind(stage.round ?? 1, playerId, giftId)
      .run();

    return { success: true, lastIntent: "wish" } satisfies ActionResponse;
  }

  if (intent === "vote" && stage.current_gift_id) {
    const playerId = (formData.get("player_id") as string) ?? "";
    const targetId = (formData.get("target_id") as string) ?? "";
    if (!playerId || !targetId) return { error: "請選擇投票者與目標" } satisfies ActionResponse;

    const gift = await db
      .prepare("SELECT id, provider_id, type FROM gifts WHERE id = ?")
      .bind(stage.current_gift_id)
      .first<{ id: string; provider_id: string; type: string }>();
    if (!gift || gift.type !== "BAD") return { error: "目前沒有進行中的鬧禮物" } satisfies ActionResponse;

    const weight = gift.provider_id === playerId ? 2 : 1;
    await db
      .prepare(
        "INSERT INTO gift_votes (gift_id, voter_id, target_id, weight) VALUES (?, ?, ?, ?) ON CONFLICT(gift_id, voter_id) DO UPDATE SET target_id = excluded.target_id, weight = excluded.weight"
      )
      .bind(gift.id, playerId, targetId, weight)
      .run();

    return { success: true, lastIntent: "vote" } satisfies ActionResponse;
  }

  return { error: "未知操作" } satisfies ActionResponse;
}

function usePlayerState(players: PlayerRow[], actionData?: ActionResponse) {
  const [playerId, setPlayerId] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("gift_player_id");
      if (saved) setPlayerId(saved);
    }
  }, []);

  useEffect(() => {
    if (actionData && "playerId" in actionData && actionData.playerId) {
      setPlayerId(actionData.playerId);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("gift_player_id", actionData.playerId);
      }
    }
  }, [actionData]);

  const player = useMemo(() => players.find((p) => p.id === playerId) ?? null, [playerId, players]);
  const set = (id: string) => {
    setPlayerId(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("gift_player_id", id);
    }
  };
  return { playerId, player, setPlayerId: set };
}

export default function GiftPlayerPage() {
  const { gifts, players, stage } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionResponse>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const { playerId, player, setPlayerId } = usePlayerState(players, actionData);
  const hasGood = useMemo(
    () => gifts.some((g) => g.type === "GOOD" && g.holder_id === playerId),
    [gifts, playerId]
  );
  const [poolType, setPoolType] = useState<"GOOD" | "BAD">("GOOD");
  const activeVotingGiftId = stage.stage === "s1" ? stage.current_gift_id : null;

  if (!player) {
    return <LoginScreen isSubmitting={isSubmitting} />;
  }

  const filtered = gifts.filter((g) => g.type === poolType);

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      <header className="sticky top-0 z-20 bg-gray-950/90 backdrop-blur-md border-b border-gray-800">
        <div className="p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full flex items-center justify-center text-white font-bold border border-gray-600">
              {player.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-white font-bold">{player.name}</div>
              <div className="text-[10px] text-gray-400 flex items-center gap-1">
                <Smartphone size={10} /> 手機端
              </div>
            </div>
          </div>
          <div className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-[10px] text-gray-400 flex items-center gap-1">
            階段：{stage.stage}
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="flex bg-gray-900 p-1 rounded-xl border border-gray-800">
            <button
              onClick={() => setPoolType("GOOD")}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                poolType === "GOOD" ? "bg-yellow-500 text-black shadow-lg" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Gift size={16} /> 好禮物
            </button>
            <button
              onClick={() => setPoolType("BAD")}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                poolType === "BAD" ? "bg-purple-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Zap size={16} /> 鬧禮物
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-3">
        {filtered.map((gift) => (
          <GiftCard
            key={gift.id}
            gift={gift}
            isMine={gift.holder_id === playerId}
            hasGood={hasGood}
            activeVotingGiftId={activeVotingGiftId}
            playerId={playerId}
            isSubmitting={isSubmitting}
          />
        ))}
      </div>

      <FloatingForms
        playerId={playerId}
        players={players}
        gifts={gifts}
        hasGood={hasGood}
        activeVotingGiftId={activeVotingGiftId}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

function GiftCard({
  gift,
  isMine,
  hasGood,
  activeVotingGiftId,
  playerId,
  isSubmitting,
}: {
  gift: GiftWithImage;
  isMine: boolean;
  hasGood: boolean;
  activeVotingGiftId: string | null;
  playerId: string;
  isSubmitting: boolean;
}) {
  const isChosen = Boolean(gift.holder_id);
  const isVoting = activeVotingGiftId === gift.id;

  return (
    <div
      className={`relative bg-gray-900 border rounded-xl overflow-hidden transition-all duration-300 ${
        isMine ? "border-green-500 ring-1 ring-green-500/50" : "border-gray-800"
      } ${isVoting ? "border-purple-500 ring-2 ring-purple-500" : ""} ${!isMine && isChosen ? "opacity-70" : ""}`}
    >
      {gift.is_locked && (
        <div className="absolute top-2 right-2 z-10 bg-red-500/90 text-white text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1 backdrop-blur-sm shadow-lg">
          <Lock size={10} /> 已鎖
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className={`font-bold text-lg ${isChosen ? "text-gray-300" : "text-white"}`}>
            {gift.slogan}
          </h3>
          <span className="text-xs text-gray-500">#{gift.number}</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {gift.tags.map((t, i) => (
            <span
              key={i}
              className="text-[10px] bg-gray-950 text-gray-500 px-1.5 py-0.5 rounded border border-gray-800"
            >
              {t}
            </span>
          ))}
        </div>

        <div className="pt-3 border-t border-gray-800 flex justify-between items-center min-h-[40px]">
          <div className="text-sm">
            {isChosen ? (
              <div className="space-y-0.5">
                {gift.is_revealed || gift.provider_id === playerId ? (
                  <div className="text-gray-500 text-xs">From: {gift.provider_name}</div>
                ) : (
                  <div className="text-gray-600 text-xs flex items-center gap-1">
                    From: <span className="blur-[3px] opacity-70">Secret</span>
                  </div>
                )}
                <div className="text-white font-bold flex items-center gap-1">
                  Holder: <span className={isMine ? "text-green-400" : "text-white"}>{gift.holder_name}</span>
                </div>
              </div>
            ) : (
              <div className="text-gray-600 text-xs italic flex items-center gap-1">
                {gift.type === "BAD" ? "等待主控台發起投票" : "等待抽出..."}
              </div>
            )}
          </div>

          <div>
            {gift.type === "BAD" && !isChosen && (
              isVoting ? (
                <span className="text-purple-300 text-xs font-bold px-2">投票進行中</span>
              ) : (
                <span className="text-gray-600 text-xs font-bold px-2">等待主控台...</span>
              )
            )}

            {gift.type === "GOOD" && !isChosen && (
              <Form method="post">
                <input type="hidden" name="intent" value="wish" />
                <input type="hidden" name="player_id" value={playerId} />
                <input type="hidden" name="gift_id" value={gift.id} />
                <button
                  type="submit"
                  disabled={hasGood || isSubmitting}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    hasGood
                      ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                      : "bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg"
                  }`}
                >
                  🙏 許願
                </button>
              </Form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ isSubmitting }: { isSubmitting: boolean }) {
  return (
    <div className="min-h-screen bg-black p-6 flex flex-col justify-center animate-in fade-in zoom-in duration-500">
      <div className="text-center mb-8">
        <div className="inline-block p-4 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-full mb-4 shadow-[0_0_30px_rgba(234,179,8,0.4)]">
          <Gift size={48} className="text-white" />
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight">GIFT WAR</h1>
        <p className="text-gray-400 text-sm mt-2">輸入你的大名與禮物線索</p>
      </div>

      <Form method="post" className="space-y-6 bg-gray-900/50 p-6 rounded-2xl border border-gray-800 backdrop-blur-sm max-h-[70vh] overflow-y-auto">
        <input type="hidden" name="intent" value="join" />
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Player Name</label>
          <input
            type="text"
            name="player_name"
            placeholder="你的暱稱"
            className="w-full bg-gray-950 border border-gray-700 rounded-xl p-4 text-white text-lg focus:border-yellow-500 outline-none transition-colors placeholder:text-gray-700"
            required
          />
        </div>

        <div className="space-y-3 pt-2 bg-yellow-900/10 p-4 rounded-xl border border-yellow-500/20">
          <div className="flex items-center gap-2 text-yellow-500 font-bold text-sm uppercase tracking-wider">
            <Gift size={14} /> 禮物 A (好禮物)
          </div>
          <div className="grid gap-3">
            <input
              type="text"
              name="good_slogan"
              placeholder="一句話形容 (Slogan)"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-yellow-500 outline-none placeholder:text-gray-700"
              required
            />
            <input
              type="text"
              name="good_tags"
              placeholder="#標籤 (空白分隔)"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-yellow-500 outline-none placeholder:text-gray-700"
            />
          </div>
        </div>

        <div className="space-y-3 pt-2 bg-purple-900/10 p-4 rounded-xl border border-purple-500/20">
          <div className="flex items-center gap-2 text-purple-400 font-bold text-sm uppercase tracking-wider">
            <Zap size={14} /> 禮物 B (鬧禮物)
          </div>
          <div className="grid gap-3">
            <input
              type="text"
              name="bad_slogan"
              placeholder="一句話形容 (Slogan)"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-purple-500 outline-none placeholder:text-gray-700"
              required
            />
            <input
              type="text"
              name="bad_tags"
              placeholder="#標籤 (空白分隔)"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-purple-500 outline-none placeholder:text-gray-700"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-white hover:bg-gray-100 text-black font-black py-4 rounded-xl text-lg shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
        >
          加入戰局
        </button>
      </Form>
    </div>
  );
}

function FloatingForms({
  playerId,
  gifts,
  players,
  hasGood,
  activeVotingGiftId,
  isSubmitting,
}: {
  playerId: string;
  gifts: GiftWithImage[];
  players: PlayerRow[];
  hasGood: boolean;
  activeVotingGiftId: string | null;
  isSubmitting: boolean;
}) {
  if (!playerId) return null;
  const currentBad = gifts.find((g) => g.id === activeVotingGiftId);
  const otherPlayers = players.filter((p) => p.id !== playerId);

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-gray-950/95 backdrop-blur-md border-t border-gray-800 px-4 py-3 shadow-[0_-10px_30px_rgba(0,0,0,0.45)]">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 text-sm text-white">
        <div>
          <div className="text-xs text-gray-400">你是 {playerId.slice(0, 6)}</div>
          <div className="font-bold">{hasGood ? "你已拿到好禮" : "尚未拿到好禮"}</div>
        </div>

        {currentBad ? (
          <Form method="post" className="flex items-center gap-2">
            <input type="hidden" name="intent" value="vote" />
            <input type="hidden" name="player_id" value={playerId} />
            <input type="hidden" name="gift_id" value={currentBad.id} />
            <select
              name="target_id"
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              required
              disabled={isSubmitting}
            >
              <option value="">把鬧禮物塞給...</option>
              {otherPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              disabled={isSubmitting}
            >
              投票
            </button>
          </Form>
        ) : (
          <div className="text-xs text-gray-500">等待主控台發起投票 / 交換</div>
        )}
      </div>
    </div>
  );
}
