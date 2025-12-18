import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ReactNode } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useMemo } from "react";
import type { D1Database } from "@cloudflare/workers-types";
import { Monitor, Lock, Unlock, Edit3, Eye, EyeOff, Gavel, Users, RefreshCw } from "lucide-react";

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

type ActionResponse = { error?: string; success?: boolean };

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

  const goodLockedCount = gifts.filter((g) => g.type === "GOOD" && g.is_locked).length;
  const goodTotal = gifts.filter((g) => g.type === "GOOD").length;

  return { gifts, players, stage, goodLockedCount, goodTotal };
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

  if (intent === "stage") {
    const nextStage = (formData.get("stage") as Stage) ?? "idle";
    const currentGiftId = (formData.get("current_gift_id") as string) || null;
    const round = Number(formData.get("round") ?? stage.round ?? 1) || 1;

    if (nextStage === "r1") {
      // 開啟許願時清空當前回合的玩家選擇，讓狀態重新開始
      await db.prepare("DELETE FROM gift_r1_picks WHERE round = ?").bind(round).run();
    }

    await db
      .prepare(
        "INSERT INTO gift_stage (id, stage, current_gift_id, round) VALUES ('global', ?, ?, ?) ON CONFLICT(id) DO UPDATE SET stage = excluded.stage, current_gift_id = excluded.current_gift_id, round = excluded.round, updated_at = strftime('%s','now')"
      )
      .bind(nextStage, currentGiftId, round)
      .run();
    return { success: true } satisfies ActionResponse;
  }

  if (intent === "reset_all") {
    await db.batch([
      db.prepare("UPDATE gifts SET holder_id = NULL, is_locked = 0, is_forced = 0, vote_count = 0, is_revealed = 0"),
      db.prepare("DELETE FROM gift_r1_picks"),
      db.prepare("DELETE FROM gift_votes"),
      db.prepare("UPDATE gift_stage SET stage = 'idle', current_gift_id = NULL, round = 1, updated_at = strftime('%s','now') WHERE id = 'global'"),
    ]);
    return { success: true } satisfies ActionResponse;
  }

  if (intent === "assign") {
    const giftId = (formData.get("gift_id") as string) ?? "";
    const playerId = (formData.get("player_id") as string) ?? "";
    if (!giftId || !playerId) return { error: "缺少禮物或玩家" } satisfies ActionResponse;

    await db.prepare("UPDATE gifts SET holder_id = ? WHERE id = ?").bind(playerId, giftId).run();
    await db
      .prepare("UPDATE gift_r1_picks SET outcome = CASE WHEN player_id = ? THEN 'WIN' ELSE 'LOSE' END, winner_id = ? WHERE gift_id = ?")
      .bind(playerId, playerId, giftId)
      .run();
    return { success: true } satisfies ActionResponse;
  }

  if (intent === "delete_player") {
    const playerId = (formData.get("player_id") as string) ?? "";
    if (!playerId) return { error: "缺少玩家" } satisfies ActionResponse;

    const giftIdsRes = await db
      .prepare("SELECT id FROM gifts WHERE provider_id = ?")
      .bind(playerId)
      .all<{ id: string }>();
    const giftIds = (giftIdsRes.results ?? []).map((g) => g.id);

    const statements: ReturnType<D1Database["prepare"]>[] = [];
    if (giftIds.length > 0) {
      const placeholders = giftIds.map(() => "?").join(",");
      statements.push(db.prepare(`DELETE FROM gift_votes WHERE gift_id IN (${placeholders})`).bind(...giftIds));
      statements.push(db.prepare(`DELETE FROM gift_r1_picks WHERE gift_id IN (${placeholders})`).bind(...giftIds));
      statements.push(db.prepare(`DELETE FROM gifts WHERE id IN (${placeholders})`).bind(...giftIds));
    }
    statements.push(db.prepare("DELETE FROM gift_votes WHERE voter_id = ? OR target_id = ?").bind(playerId, playerId));
    statements.push(db.prepare("DELETE FROM gift_r1_picks WHERE player_id = ?").bind(playerId));
    statements.push(db.prepare("DELETE FROM players WHERE id = ?").bind(playerId));

    await db.batch(statements);
    return { success: true } satisfies ActionResponse;
  }

  if (intent === "toggle_lock") {
    const giftId = (formData.get("gift_id") as string) ?? "";
    if (!giftId) return { error: "缺少禮物" } satisfies ActionResponse;
    const row = await db.prepare("SELECT is_locked FROM gifts WHERE id = ?").bind(giftId).first<{ is_locked: number }>();
    const newVal = row?.is_locked ? 0 : 1;
    await db.prepare("UPDATE gifts SET is_locked = ? WHERE id = ?").bind(newVal, giftId).run();
    return { success: true } satisfies ActionResponse;
  }

  if (intent === "reveal") {
    const giftId = (formData.get("gift_id") as string) ?? "";
    await db.prepare("UPDATE gifts SET is_revealed = 1 WHERE id = ?").bind(giftId).run();
    return { success: true } satisfies ActionResponse;
  }

  return { error: "未知操作" } satisfies ActionResponse;
}

export default function GiftHostPage() {
  const { gifts, players, stage, goodLockedCount, goodTotal } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionResponse>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const goodGifts = useMemo(() => gifts.filter((g) => g.type === "GOOD"), [gifts]);
  const badGifts = useMemo(() => gifts.filter((g) => g.type === "BAD"), [gifts]);
  const wishOpen = stage.stage === "r1";

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 pb-20 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex justify-between items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-2">
              <Monitor /> 主控台 Dashboard
            </h1>
            <p className="text-slate-400 text-sm">控制許願、投票、鎖定與持有人</p>
          </div>
          <Form method="post">
            <input type="hidden" name="intent" value="reset_all" />
            <button
              type="submit"
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 text-sm font-bold hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50"
              disabled={isSubmitting}
            >
              <RefreshCw size={16} /> 重置所有禮物狀態
            </button>
          </Form>
        </header>

        {actionData?.error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {actionData.error}
          </div>
        )}

        <Section title="許願控制" note="開啟後玩家點選好禮會直接鎖定並指派持有人">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-slate-400">目前狀態</div>
                <div className={`text-lg font-bold ${wishOpen ? "text-amber-300" : "text-slate-200"}`}>
                  {wishOpen ? "許願開啟中" : "許願已暫停"}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  已鎖定 {goodLockedCount}/{goodTotal} 個好禮
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Form method="post">
                  <input type="hidden" name="intent" value="stage" />
                  <input type="hidden" name="stage" value="r1" />
                  <input type="hidden" name="round" value={stage.round ?? 1} />
                  <button
                    type="submit"
                    disabled={isSubmitting || wishOpen}
                    className="px-4 py-2 rounded-lg bg-amber-400 text-black font-bold hover:bg-amber-300 disabled:opacity-50"
                  >
                    開啟許願
                  </button>
                </Form>
                <Form method="post">
                  <input type="hidden" name="intent" value="stage" />
                  <input type="hidden" name="stage" value="idle" />
                  <input type="hidden" name="round" value={stage.round ?? 1} />
                  <button
                    type="submit"
                    disabled={isSubmitting || !wishOpen}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 font-bold border border-slate-600 hover:bg-slate-700 disabled:opacity-50"
                  >
                    暫停許願
                  </button>
                </Form>
              </div>
            </div>
          </Card>
        </Section>

        <Section title="R1 好禮物" note="可分別設定持有人與鎖定，許願只記錄選擇">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goodGifts.map((gift) => (
              <Card key={gift.id} highlight={Boolean(gift.is_locked)}>
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div className="text-xs text-slate-500">#{gift.number}</div>
                    <h3 className="font-bold text-lg text-yellow-400">{gift.slogan}</h3>
                    <div className="text-xs text-slate-500 mt-1">
                      From: {gift.is_revealed ? gift.provider_name : "隱藏"}
                    </div>
                    <div className="text-sm mt-3 text-slate-300">
                      目前持有:{" "}
                      {gift.holder_name ? (
                        <span className="text-green-400 font-bold text-lg">{gift.holder_name}</span>
                      ) : (
                        <span className="text-slate-500 italic">尚未有人鎖定</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      狀態: {gift.is_locked ? "已鎖定" : "未鎖定"}
                    </div>
                  </div>
                  <PopoverAssign giftId={gift.id} players={players} label="設定持有者" isSubmitting={isSubmitting} />
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Form method="post">
                    <input type="hidden" name="intent" value="reveal" />
                    <input type="hidden" name="gift_id" value={gift.id} />
                    <button
                      type="submit"
                      disabled={gift.is_revealed || isSubmitting}
                      className="w-full bg-blue-600/20 border border-blue-600 text-blue-400 py-2 rounded font-bold hover:bg-blue-600/40 disabled:opacity-30 flex items-center justify-center gap-2"
                    >
                      {gift.is_revealed ? (
                        <>
                          <Eye size={16} /> 已揭曉
                        </>
                      ) : (
                        <>
                          <EyeOff size={16} /> 揭曉來源
                        </>
                      )}
                    </button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="intent" value="toggle_lock" />
                    <input type="hidden" name="gift_id" value={gift.id} />
                    <button
                      type="submit"
                      className={`w-full py-2 rounded font-bold flex items-center justify-center gap-2 border ${
                        gift.is_locked
                          ? "bg-red-500/20 border-red-500 text-red-400"
                          : "bg-slate-700 border-slate-600 text-slate-300"
                      }`}
                      disabled={isSubmitting}
                    >
                      {gift.is_locked ? (
                        <>
                          <Unlock size={16} /> 解鎖
                        </>
                      ) : (
                        <>
                          <Lock size={16} /> 鎖定
                        </>
                      )}
                    </button>
                  </Form>
                </div>
              </Card>
            ))}
          </div>
        </Section>

        <Section title="鬧禮物" note="持有人與鎖定可分開設定；需要時可揭曉來源">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {badGifts.map((gift) => (
              <Card key={gift.id} highlight={gift.is_locked}>
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div className="text-xs text-slate-500">#{gift.number}</div>
                    <h3 className="font-bold text-lg text-white">{gift.slogan}</h3>
                    <div className="text-xs text-slate-500 mt-1">From: {gift.is_revealed ? gift.provider_name : "隱藏"}</div>
                    {gift.holder_name && (
                      <div className="text-xs text-slate-500 mt-1">Holder: {gift.holder_name}</div>
                    )}
                    <div className="text-xs text-slate-500 mt-1">
                      狀態: {gift.is_locked ? "已鎖定" : "未鎖定"} {stage.current_gift_id === gift.id ? "(投票中)" : ""}
                    </div>
                  </div>
                  <PopoverAssign giftId={gift.id} players={players} label="指派受害者 (鎖定)" isSubmitting={isSubmitting} />
                </div>

                <div className="space-y-2 mt-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Form method="post">
                      <input type="hidden" name="intent" value="reveal" />
                      <input type="hidden" name="gift_id" value={gift.id} />
                      <button
                        type="submit"
                        disabled={gift.is_revealed || isSubmitting}
                        className="w-full bg-blue-600/20 border border-blue-600 text-blue-400 py-2 rounded font-bold hover:bg-blue-600/40 disabled:opacity-30 flex items-center justify-center gap-2"
                      >
                        {gift.is_revealed ? (
                          <>
                            <Eye size={16} /> 已揭曉
                          </>
                        ) : (
                          <>
                            <EyeOff size={16} /> 揭曉來源
                          </>
                        )}
                      </button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="intent" value="toggle_lock" />
                      <input type="hidden" name="gift_id" value={gift.id} />
                      <button
                        type="submit"
                        className={`w-full py-2 rounded font-bold flex items-center justify-center gap-2 border ${
                          gift.is_locked
                            ? "bg-red-500/20 border-red-500 text-red-400"
                            : "bg-slate-700 border-slate-600 text-slate-300"
                        }`}
                        disabled={isSubmitting}
                      >
                        {gift.is_locked ? (
                          <>
                            <Gavel size={16} /> 鎖定中
                          </>
                        ) : (
                          <>
                            <Unlock size={16} /> 解除鎖定
                          </>
                        )}
                      </button>
                    </Form>
                  </div>

                  <div className="mt-2">
                    <PopoverAssign giftId={gift.id} players={players} label="指派持有者" isSubmitting={isSubmitting} full />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Section>

        <Section title="玩家管理" note="刪除玩家會同時刪除他提供的禮物與相關投票/紀錄">
          <div className="grid gap-2 md:grid-cols-2">
            {players.map((p) => (
              <Card key={p.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.id.slice(0, 8)}</div>
                  </div>
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete_player" />
                    <input type="hidden" name="player_id" value={p.id} />
                    <button
                      type="submit"
                      className="px-3 py-1 rounded bg-red-500/20 border border-red-500 text-red-200 text-xs font-bold hover:bg-red-500/40 disabled:opacity-50"
                      disabled={isSubmitting}
                    >
                      刪除
                    </button>
                  </Form>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <Users className="h-4 w-4" />
        <span className="font-semibold">{title}</span>
        {note && <span className="text-xs text-slate-500">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Card({ children, highlight }: { children: ReactNode; highlight?: boolean }) {
  return (
    <div
      className={`bg-slate-800 border p-4 rounded-xl relative ${
        highlight ? "border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.2)]" : "border-slate-700"
      }`}
    >
      {children}
    </div>
  );
}

function PopoverAssign({
  giftId,
  players,
  label,
  isSubmitting,
  full,
}: {
  giftId: string;
  players: PlayerRow[];
  label: string;
  isSubmitting: boolean;
  full?: boolean;
}) {
  return (
    <Form method="post" className={full ? "col-span-2" : undefined}>
      <input type="hidden" name="intent" value="assign" />
      <input type="hidden" name="gift_id" value={giftId} />
      <div className="flex gap-2">
        <select
          name="player_id"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          required
          disabled={isSubmitting}
        >
          <option value="">選擇玩家</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-3 py-2 rounded-lg bg-yellow-500 text-black font-bold flex items-center gap-1 hover:bg-yellow-400 disabled:opacity-50"
          disabled={isSubmitting}
        >
          <Edit3 size={14} /> {label}
        </button>
      </div>
    </Form>
  );
}
