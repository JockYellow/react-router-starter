import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ReactNode } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useMemo } from "react";
import type { D1Database } from "@cloudflare/workers-types";
import { Monitor, Trophy, Lock, Unlock, Play, StopCircle, Edit3, Eye, EyeOff, Gavel, Users, RefreshCw } from "lucide-react";

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

type ActionResponse = { error?: string; success?: boolean };

type VoteRow = { target_id: string; count: number };

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

  let voteSummary: VoteRow[] = [];
  if (stage.current_gift_id) {
    const votesRes = await db
      .prepare("SELECT target_id, SUM(weight) as count FROM gift_votes WHERE gift_id = ? GROUP BY target_id")
      .bind(stage.current_gift_id)
      .all<VoteRow>();
    voteSummary = votesRes.results ?? [];
  }

  return { gifts, players, stage, voteSummary };
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

    await db
      .prepare(
        "INSERT INTO gift_stage (id, stage, current_gift_id, round) VALUES ('global', ?, ?, ?) ON CONFLICT(id) DO UPDATE SET stage = excluded.stage, current_gift_id = excluded.current_gift_id, round = excluded.round, updated_at = strftime('%s','now')"
      )
      .bind(nextStage, currentGiftId, round)
      .run();
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

  if (intent === "start_vote") {
    const giftId = (formData.get("gift_id") as string) ?? "";
    if (!giftId) return { error: "缺少禮物" } satisfies ActionResponse;
    await db
      .prepare(
        "INSERT INTO gift_stage (id, stage, current_gift_id, round) VALUES ('global', 's1', ?, ?) ON CONFLICT(id) DO UPDATE SET stage='s1', current_gift_id=excluded.current_gift_id, round = excluded.round, updated_at=strftime('%s','now')"
      )
      .bind(giftId, stage.round ?? 1)
      .run();
    return { success: true } satisfies ActionResponse;
  }

  if (intent === "end_vote") {
    const giftId = (formData.get("gift_id") as string) ?? "";
    if (!giftId) return { error: "缺少禮物" } satisfies ActionResponse;

    const votesRes = await db
      .prepare("SELECT target_id, SUM(weight) as count FROM gift_votes WHERE gift_id = ? GROUP BY target_id ORDER BY count DESC")
      .bind(giftId)
      .all<VoteRow>();
    const votes = votesRes.results ?? [];
    if (votes.length === 0) return { error: "目前沒有投票" } satisfies ActionResponse;
    const winnerId = votes[0].target_id;
    const voteCount = votes[0].count ?? 0;

    await db
      .prepare("UPDATE gifts SET holder_id = ?, vote_count = ? WHERE id = ?")
      .bind(winnerId, voteCount, giftId)
      .run();

    await db
      .prepare("UPDATE gift_stage SET stage='idle', current_gift_id=NULL, updated_at=strftime('%s','now') WHERE id='global'")
      .run();

    return { success: true } satisfies ActionResponse;
  }

  return { error: "未知操作" } satisfies ActionResponse;
}

export default function GiftHostPage() {
  const { gifts, players, stage, voteSummary } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionResponse>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const goodGifts = useMemo(() => gifts.filter((g) => g.type === "GOOD"), [gifts]);
  const badGifts = useMemo(() => gifts.filter((g) => g.type === "BAD"), [gifts]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 pb-20 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-2">
              <Monitor /> 主控台 Dashboard
            </h1>
            <p className="text-slate-400 text-sm">上帝視角控制中心</p>
          </div>
          <StageForm stage={stage} gifts={gifts} isSubmitting={isSubmitting} />
        </header>

        {actionData?.error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {actionData.error}
          </div>
        )}

        <Section title="R1 好禮物">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goodGifts.map((gift) => (
              <Card key={gift.id}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-yellow-400">{gift.slogan}</h3>
                    <div className="text-xs text-slate-500 mt-1">From: {gift.provider_name}</div>
                    <div className="text-sm mt-3 text-slate-300">
                      目前持有: {gift.holder_name ? <span className="text-green-400 font-bold text-lg">{gift.holder_name}</span> : <span className="text-slate-500 italic">等待抽出...</span>}
                    </div>
                  </div>
                  {gift.holder_id && (
                    <PopoverAssign giftId={gift.id} players={players} label="變更持有" isSubmitting={isSubmitting} />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  {!gift.holder_id ? (
                    <PopoverAssign giftId={gift.id} players={players} label="公布得主 / PK" isSubmitting={isSubmitting} full />
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </Section>

        <Section title="S1 鬧禮物投票">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {badGifts.map((gift) => (
              <Card key={gift.id} highlight={stage.current_gift_id === gift.id}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-white">{gift.slogan}</h3>
                    <div className="text-xs text-slate-500 mt-1">From: {gift.provider_name}</div>
                    {gift.holder_name && (
                      <div className="text-xs text-slate-500 mt-1">Holder: {gift.holder_name}</div>
                    )}
                  </div>
                  {gift.holder_id && (
                    <PopoverAssign giftId={gift.id} players={players} label="變更持有" isSubmitting={isSubmitting} />
                  )}
                </div>

                <div className="space-y-2 mt-4">
                  {!gift.holder_id ? (
                    stage.current_gift_id === gift.id ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="end_vote" />
                        <input type="hidden" name="gift_id" value={gift.id} />
                        <button
                          type="submit"
                          className="w-full bg-red-600 hover:bg-red-500 text-white py-3 rounded font-bold flex items-center justify-center gap-2"
                          disabled={isSubmitting}
                        >
                          <StopCircle /> 結束投票 & 產生受害者
                        </button>
                      </Form>
                    ) : (
                      <Form method="post">
                        <input type="hidden" name="intent" value="start_vote" />
                        <input type="hidden" name="gift_id" value={gift.id} />
                        <button
                          type="submit"
                          disabled={stage.current_gift_id !== null || isSubmitting}
                          className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded font-bold flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Play /> 發起投票
                        </button>
                      </Form>
                    )
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
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
                              <Gavel size={16} /> 強制鎖定
                            </>
                          ) : (
                            <>
                              <Unlock size={16} /> 解除鎖定
                            </>
                          )}
                        </button>
                      </Form>
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
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {stage.current_gift_id && voteSummary.length > 0 && (
            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 mt-4">
              <div className="text-xs text-purple-200 mb-2">投票累計 (目前進行中的鬧禮物)</div>
              <div className="grid gap-2 md:grid-cols-2">
                {voteSummary.map((vote) => {
                  const player = players.find((p) => p.id === vote.target_id);
                  return (
                    <div key={vote.target_id} className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 flex justify-between text-sm">
                      <span>{player?.name ?? vote.target_id}</span>
                      <span className="font-bold">{vote.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Section>

        <Section title="S2 最終交換 (資訊)" note="點擊 R1/S1 的鉛筆可手動變更持有者，或用投票結果產生受害者。">
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6 text-center space-y-2">
            <RefreshCw size={32} className="mx-auto text-red-400" />
            <p className="text-slate-200">交換流程請參考現場節奏，手機端控制器會顯示相應按鈕。</p>
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
          <option value="">選擇勝者</option>
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

function StageForm({ stage, gifts, isSubmitting }: { stage: StageRow; gifts: GiftWithImage[]; isSubmitting: boolean }) {
  return (
    <Form method="post" className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
      <input type="hidden" name="intent" value="stage" />
      <select
        name="stage"
        defaultValue={stage.stage}
        className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
      >
        <option value="idle">idle</option>
        <option value="r1">r1</option>
        <option value="s1">s1</option>
        <option value="s2">s2</option>
      </select>
      <select
        name="current_gift_id"
        defaultValue={stage.current_gift_id ?? undefined}
        className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
      >
        <option value="">(可選) 指定鬧禮物</option>
        {gifts
          .filter((g) => g.type === "BAD")
          .map((g) => (
            <option key={g.id} value={g.id}>
              {g.slogan}
            </option>
          ))}
      </select>
      <input
        type="number"
        name="round"
        defaultValue={stage.round ?? 1}
        className="w-20 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
        placeholder="回合"
      />
      <button
        type="submit"
        className="px-3 py-2 rounded-lg bg-amber-400 text-black font-bold flex items-center gap-1 hover:bg-amber-300 disabled:opacity-50"
        disabled={isSubmitting}
      >
        <RefreshCw size={14} /> 更新
      </button>
    </Form>
  );
}
