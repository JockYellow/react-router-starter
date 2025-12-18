import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useEffect, useMemo, useState } from "react";
import type { D1Database } from "@cloudflare/workers-types";
import { Gift, Zap, Lock, Smartphone } from "lucide-react";

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
  birthday?: string | null;
};

type GiftWithImage = GiftType & { image_url?: string | null; number?: string };
type PickRow = { player_id: string; gift_id: string };

type ActionResponse = {
  error?: string;
  success?: true;
  playerId?: string;
  lastIntent?: string;
  needsGift?: boolean;
  pendingName?: string;
  pendingBirthday?: string;
};

async function ensurePlayerColumns(db: D1Database) {
  const { results } = await db.prepare("PRAGMA table_info(players)").all<{ name: string }>();
  const columns = new Set((results ?? []).map((row) => row.name));
  if (!columns.has("age_years")) await db.prepare("ALTER TABLE players ADD COLUMN age_years INTEGER DEFAULT 0").run();
  if (!columns.has("age_months")) await db.prepare("ALTER TABLE players ADD COLUMN age_months INTEGER DEFAULT 0").run();
  if (!columns.has("pk_loss_count")) await db.prepare("ALTER TABLE players ADD COLUMN pk_loss_count INTEGER DEFAULT 0").run();
  if (!columns.has("pk_loss_opponents")) await db.prepare("ALTER TABLE players ADD COLUMN pk_loss_opponents INTEGER DEFAULT 0").run();
  if (!columns.has("birthday")) await db.prepare("ALTER TABLE players ADD COLUMN birthday TEXT").run();
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

  const { results } = await db.prepare("PRAGMA table_info(gift_r1_picks)").all<{ name: string }>();
  const columns = new Set((results ?? []).map((row) => row.name));
  if (!columns.has("winner_id")) {
    await db.prepare("ALTER TABLE gift_r1_picks ADD COLUMN winner_id TEXT").run();
  }
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

  const { results } = await db.prepare("PRAGMA table_info(gift_votes)").all<{ name: string }>();
  const columns = new Set((results ?? []).map((row) => row.name));
  if (!columns.has("target_id")) await db.prepare("ALTER TABLE gift_votes ADD COLUMN target_id TEXT").run();
  if (!columns.has("weight")) await db.prepare("ALTER TABLE gift_votes ADD COLUMN weight INTEGER DEFAULT 1").run();
  if (!columns.has("created_at")) await db.prepare("ALTER TABLE gift_votes ADD COLUMN created_at INTEGER").run();
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

  const picksRes = await db
    .prepare("SELECT player_id, gift_id FROM gift_r1_picks WHERE round = ?")
    .bind(stage.round ?? 1)
    .all<PickRow>();
  const picks = picksRes.results ?? [];

  return { gifts, players, stage, picks };
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

  if (intent === "login") {
    const name = (formData.get("player_name") as string)?.trim();
    const birthday = (formData.get("birthday") as string)?.trim();
    if (!name || !birthday) return { error: "請填寫名字與生日" } satisfies ActionResponse;

    const existing = await db.prepare("SELECT id, birthday FROM players WHERE name = ?").bind(name).first<{ id: string; birthday: string | null }>();
    if (existing) {
      if (existing.birthday && existing.birthday !== birthday) {
        return { error: "這個名字已被使用，但生日不一致，請確認帳號" } satisfies ActionResponse;
      }
      if (!existing.birthday) {
        await db.prepare("UPDATE players SET birthday = ? WHERE id = ?").bind(birthday, existing.id).run();
      }
      return { success: true, playerId: existing.id, lastIntent: "login" } satisfies ActionResponse;
    }

    return {
      needsGift: true,
      pendingName: name,
      pendingBirthday: birthday,
      lastIntent: "login",
    } satisfies ActionResponse;
  }

  if (intent === "register") {
    const name = (formData.get("player_name") as string)?.trim();
    const birthday = (formData.get("birthday") as string)?.trim();
    const goodSlogan = (formData.get("good_slogan") as string)?.trim();
    const goodTags = (formData.get("good_tags") as string)?.trim() ?? "";
    const badSlogan = (formData.get("bad_slogan") as string)?.trim();
    const badTags = (formData.get("bad_tags") as string)?.trim() ?? "";

    if (!name || !birthday || !goodSlogan || !badSlogan) {
      return { error: "請填寫名字、生日與兩個禮物描述" } satisfies ActionResponse;
    }

    const existing = await db.prepare("SELECT id, birthday FROM players WHERE name = ?").bind(name).first<{ id: string; birthday: string | null }>();
    if (existing) {
      if (existing.birthday && existing.birthday !== birthday) {
        return { error: "這個名字已被使用，但生日不一致，請確認帳號" } satisfies ActionResponse;
      }
      return { success: true, playerId: existing.id, lastIntent: "register" } satisfies ActionResponse;
    }

    const playerId = crypto.randomUUID();
    const goodId = crypto.randomUUID();
    const badId = crypto.randomUUID();

    await db.batch([
      db.prepare("INSERT INTO players (id, name, birthday, age, age_years, age_months, round_caught, pk_value, pk_loss_count, pk_loss_opponents) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 0)").bind(playerId, name, birthday),
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

    return { success: true, playerId, lastIntent: "register" } satisfies ActionResponse;
  }

  if (intent === "wish") {
    const playerId = (formData.get("player_id") as string) ?? "";
    const giftId = (formData.get("gift_id") as string) ?? "";
    if (!playerId || !giftId) return { error: "缺少玩家或禮物" } satisfies ActionResponse;

    if (stage.stage !== "r1") {
      return { error: "主控台尚未開啟許願" } satisfies ActionResponse;
    }

    const player = await db.prepare("SELECT id FROM players WHERE id = ?").bind(playerId).first<{ id: string }>();
    if (!player) return { error: "玩家不存在，請重新登入" } satisfies ActionResponse;

    const giftRow = await db
      .prepare("SELECT id, type, is_locked FROM gifts WHERE id = ?")
      .bind(giftId)
      .first<{ id: string; type: string; is_locked: number }>();
    if (!giftRow || giftRow.type !== "GOOD") return { error: "只能對好禮物許願" } satisfies ActionResponse;
    if (giftRow.is_locked) return { error: "這個禮物已被鎖定" } satisfies ActionResponse;

    const existingPick = await db
      .prepare("SELECT gift_id FROM gift_r1_picks WHERE player_id = ? AND round = ?")
      .bind(playerId, stage.round ?? 1)
      .first<{ gift_id: string }>();
    if (existingPick) {
      if (existingPick.gift_id === giftId) {
        return { success: true, lastIntent: "wish" } satisfies ActionResponse;
      }
      return { error: "你已選擇其他禮物，請等待主持人" } satisfies ActionResponse;
    }

    await db
      .prepare(
        "INSERT INTO gift_r1_picks (round, player_id, gift_id) VALUES (?, ?, ?) ON CONFLICT(round, player_id) DO NOTHING"
      )
      .bind(stage.round ?? 1, playerId, giftId)
      .run();

    return { success: true, lastIntent: "wish" } satisfies ActionResponse;
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
    if (actionData && actionData.playerId) {
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
  const { gifts, players, stage, picks } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionResponse>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const submittingGiftId =
    navigation.formData?.get("intent") === "wish"
      ? (navigation.formData.get("gift_id") as string | null)
      : null;

  const { playerId, player } = usePlayerState(players, actionData);
  const myPick = useMemo(
    () => (stage.stage === "r1" ? picks.find((p) => p.player_id === playerId) ?? null : null),
    [picks, playerId, stage.stage]
  );
  const hasPick = stage.stage === "r1" && Boolean(myPick);
  const [poolType, setPoolType] = useState<"GOOD" | "BAD">("GOOD");

  if (!player) {
    return (
      <>
        {actionData?.error && (
          <div className="p-3 text-sm text-red-200 bg-red-500/20 border border-red-500/50 rounded-md mx-4 mt-4">
            {actionData.error}
          </div>
        )}
        {actionData?.needsGift && actionData.pendingName && actionData.pendingBirthday ? (
          <GiftSetupScreen
            pendingName={actionData.pendingName}
            pendingBirthday={actionData.pendingBirthday}
            isSubmitting={isSubmitting}
          />
        ) : (
          <LoginScreen isSubmitting={isSubmitting} />
        )}
      </>
    );
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
            hasPick={hasPick}
            myPickGiftId={myPick?.gift_id ?? null}
            playerId={playerId}
            isSubmitting={isSubmitting}
            submittingGiftId={submittingGiftId}
            stage={stage}
          />
        ))}
      </div>
    </div>
  );
}

function GiftCard({
  gift,
  isMine,
  hasPick,
  myPickGiftId,
  playerId,
  isSubmitting,
  submittingGiftId,
  stage,
}: {
  gift: GiftWithImage;
  isMine: boolean;
  hasPick: boolean;
  myPickGiftId: string | null;
  playerId: string;
  isSubmitting: boolean;
  submittingGiftId: string | null;
  stage: StageRow;
}) {
  const isChosen = Boolean(gift.holder_id);
  const isWishOpen = stage.stage === "r1";
  const isMyPick = myPickGiftId === gift.id;
  const isSubmittingThis = submittingGiftId === gift.id;

  return (
    <div
      className={`relative border rounded-xl overflow-hidden transition-all duration-300 ${
        isMine ? "border-green-500 ring-1 ring-green-500/50" : "border-gray-800 bg-gray-900"
      } ${!isMine && isChosen ? "opacity-80" : ""} ${
        gift.type === "GOOD" && isWishOpen && !isChosen ? "bg-gradient-to-r from-amber-900/40 to-amber-700/10" : ""
      } ${isMyPick ? "ring-2 ring-yellow-400 border-yellow-400 bg-amber-900/40" : ""}`}
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
            {gift.holder_name ? (
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
                {gift.type === "BAD" ? "尚未指派" : "尚未鎖定"}
              </div>
            )}
          </div>

          <div>
            {gift.type === "GOOD" && (
              <>
                {isWishOpen && !isChosen ? (
                  <Form method="post">
                    <input type="hidden" name="intent" value="wish" />
                    <input type="hidden" name="player_id" value={playerId} />
                    <input type="hidden" name="gift_id" value={gift.id} />
                    <button
                      type="submit"
                      disabled={(hasPick && !isMyPick) || isSubmitting || isSubmittingThis}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        hasPick && !isMyPick
                          ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                          : "bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg"
                      }`}
                    >
                      {isSubmittingThis ? "⏳ 送出中" : isMyPick ? "✅ 已選" : "✅ 確定"}
                    </button>
                  </Form>
                ) : (
                  <div className="text-[11px] text-gray-600">
                    {isChosen ? "等待主控台鎖定 / 公布" : "等待主控台開啟許願"}
                  </div>
                )}
              </>
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
        <p className="text-gray-400 text-sm mt-2">先登入，已填過禮物直接進入池子</p>
      </div>

      <Form method="post" className="space-y-6 bg-gray-900/50 p-6 rounded-2xl border border-gray-800 backdrop-blur-sm max-h-[70vh] overflow-y-auto">
        <input type="hidden" name="intent" value="login" />
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

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Birthday (當作密碼)</label>
          <div className="grid grid-cols-1 gap-2">
            <input
              type="date"
              name="birthday"
              max={new Date().toISOString().split("T")[0]}
              className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-white text-sm focus:border-yellow-500 outline-none transition-colors placeholder:text-gray-700"
              required
            />
            <p className="text-[11px] text-gray-500">同名同生日視為同一帳號，生日不同會提醒錯誤。請選擇正確生日。</p>
          </div>
        </div>

        <div className="space-y-3 pt-2 bg-yellow-900/10 p-4 rounded-xl border border-yellow-500/20">
          <div className="flex items-center gap-2 text-yellow-500 font-bold text-sm uppercase tracking-wider">
            <Gift size={14} /> 第一次登入後會請你填兩個禮物
          </div>
          <div className="text-xs text-gray-500">老帳號直接進入池子，不會再要你填禮物。</div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-white hover:bg-gray-100 text-black font-black py-4 rounded-xl text-lg shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
        >
          先登入
        </button>
      </Form>
    </div>
  );
}

function GiftSetupScreen({
  pendingName,
  pendingBirthday,
  isSubmitting,
}: {
  pendingName: string;
  pendingBirthday: string;
  isSubmitting: boolean;
}) {
  return (
    <div className="min-h-screen bg-black p-6 flex flex-col justify-center animate-in fade-in zoom-in duration-500">
      <div className="text-center mb-6">
        <div className="inline-block p-4 bg-gradient-to-br from-purple-500 to-orange-600 rounded-full mb-4 shadow-[0_0_30px_rgba(168,85,247,0.35)]">
          <Zap size={48} className="text-white" />
        </div>
        <h2 className="text-3xl font-black text-white tracking-tight">填寫你的兩個禮物</h2>
        <p className="text-gray-400 text-sm mt-2">
          登入資訊：{pendingName} / {pendingBirthday}
        </p>
      </div>

      <Form method="post" className="space-y-6 bg-gray-900/60 p-6 rounded-2xl border border-gray-800 backdrop-blur-sm">
        <input type="hidden" name="intent" value="register" />
        <input type="hidden" name="player_name" value={pendingName} />
        <input type="hidden" name="birthday" value={pendingBirthday} />

        <div className="space-y-3 pt-2 bg-yellow-900/10 p-4 rounded-xl border border-yellow-500/20">
          <div className="flex items-center gap-2 text-yellow-500 font-bold text-sm uppercase tracking-wider">
            <Gift size={14} /> 禮物 A (好禮物)
          </div>
          <div className="grid gap-3">
            <input
              type="text"
              name="good_slogan"
              placeholder="一句話形容這個禮物什麼時候(情境、時間、場合)可以用上"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-yellow-500 outline-none placeholder:text-gray-700"
              required
            />
            <input
              type="text"
              name="good_tags"
              placeholder="#標籤 (空白分隔、寫一兩個給予參考)"
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
              placeholder="一句話形容這個禮物什麼時候(情境、時間、場合)可以用上"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-purple-500 outline-none placeholder:text-gray-700"
              required
            />
            <input
              type="text"
              name="bad_tags"
              placeholder="#標籤 (空白分隔、寫一兩個給予參考)"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-purple-500 outline-none placeholder:text-gray-700"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-white hover:bg-gray-100 text-black font-black py-4 rounded-xl text-lg shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
        >
          送出禮物並進入池子
        </button>
      </Form>
    </div>
  );
}
