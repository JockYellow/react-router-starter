import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import type { D1Database } from "@cloudflare/workers-types";
import { AlertTriangle, CheckCircle2, Clock3, Gift as GiftIcon, Lock, Unlock, Users } from "lucide-react";

import { requireBlogDb } from "../../lib/d1.server";
import { getGifts, type Gift as GiftType } from "../../features/gift/gift.server";
import { buildPublicImageUrl, requireBlogImagesPublicBase } from "../../lib/r2.server";

const STAGES = ["idle", "r1_pick", "pk_result", "s1_vote", "s2_swap", "lock_prompt"] as const;
type Stage = (typeof STAGES)[number];

type PlayerRow = {
  id: string;
  name: string;
  age: number;
  age_years: number | null;
  age_months: number | null;
  round_caught: number | null;
  pk_loss_count?: number | null;
  pk_loss_opponents?: number | null;
  vote_count?: number | null;
};

type StageRow = {
  stage: Stage;
  current_gift_id: string | null;
  current_player_id: string | null;
  message: string | null;
  round: number;
};

type Gift = GiftType & { image_url?: string | null; number?: string };

type VoteEntry = { target_id: string; count: number };

async function ensurePlayerColumns(db: D1Database) {
  const { results } = await db.prepare("PRAGMA table_info(players)").all<{ name: string }>();
  const columns = new Set((results ?? []).map((row) => row.name));
  if (!columns.has("age_years")) await db.prepare("ALTER TABLE players ADD COLUMN age_years INTEGER DEFAULT 0").run();
  if (!columns.has("age_months")) await db.prepare("ALTER TABLE players ADD COLUMN age_months INTEGER DEFAULT 0").run();
  if (!columns.has("pk_loss_count")) await db.prepare("ALTER TABLE players ADD COLUMN pk_loss_count INTEGER DEFAULT 0").run();
  if (!columns.has("pk_loss_opponents")) await db.prepare("ALTER TABLE players ADD COLUMN pk_loss_opponents INTEGER DEFAULT 0").run();
}

async function ensureGiftStage(db: D1Database) {
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
    .prepare("SELECT stage, current_gift_id, current_player_id, message, round FROM gift_stage WHERE id = 'global'")
    .first<StageRow>();
  if (!existing) {
    await db
      .prepare(
        "INSERT INTO gift_stage (id, stage, current_gift_id, current_player_id, message, round) VALUES ('global', 'idle', NULL, NULL, NULL, 1)"
      )
      .run();
    return { stage: "idle", current_gift_id: null, current_player_id: null, message: null, round: 1 } as StageRow;
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

function numberGifts(gifts: Gift[]) {
  return gifts.map((gift, idx) => ({ ...gift, number: String(idx + 1).padStart(2, "0") }));
}

function ageScore(player: PlayerRow) {
  const years = player.age_years ?? player.age ?? 0;
  const months = player.age_months ?? 0;
  return years * 12 + months;
}

function sortOrder(players: PlayerRow[]) {
  return [...players].sort((a, b) => {
    const roundA = a.round_caught ?? 0;
    const roundB = b.round_caught ?? 0;
    if (roundA !== roundB) return roundB - roundA;
    const lossA = a.pk_loss_count ?? 0;
    const lossB = b.pk_loss_count ?? 0;
    if (lossA !== lossB) return lossB - lossA;
    const oppA = a.pk_loss_opponents ?? 0;
    const oppB = b.pk_loss_opponents ?? 0;
    if (oppA !== oppB) return oppB - oppA;
    const voteA = a.vote_count ?? 0;
    const voteB = b.vote_count ?? 0;
    if (voteA !== voteB) return voteA - voteB;
    return ageScore(b) - ageScore(a);
  });
}

export async function loader({ context }: LoaderFunctionArgs) {
  const db = requireBlogDb(context);
  await ensurePlayerColumns(db);
  await ensureR1Tables(db);
  await ensureS1Tables(db);
  const stage = await ensureGiftStage(db);

  const imageBase = requireBlogImagesPublicBase(context);
  const giftsRaw = await getGifts(db);
  const gifts: Gift[] = giftsRaw.map((gift) => ({
    ...gift,
    image_url: gift.image_key ? buildPublicImageUrl(imageBase, gift.image_key) : null,
  }));
  const goodGifts = numberGifts(gifts.filter((g) => g.type === "GOOD"));
  const badGifts = gifts.filter((g) => g.type === "BAD");
  const unlockedGifts = gifts.filter((g) => !g.is_locked);

  const playersRes = await db
    .prepare(
      "SELECT id, name, age, age_years, age_months, round_caught, pk_loss_count, pk_loss_opponents FROM players"
    )
    .all<PlayerRow>();
  const players = playersRes.results ?? [];

  const order = sortOrder(players);

  let voteSummary: VoteEntry[] = [];
  if (stage.current_gift_id) {
    const votesRes = await db
      .prepare("SELECT target_id, SUM(weight) as count FROM gift_votes WHERE gift_id = ? GROUP BY target_id")
      .bind(stage.current_gift_id)
      .all<VoteEntry>();
    voteSummary = votesRes.results ?? [];
  }

  return { stage, gifts, goodGifts, badGifts, unlockedGifts, players, order, voteSummary };
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.35em] text-white/80">
      {children}
    </span>
  );
}

function GiftGrid({ gifts }: { gifts: Gift[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {gifts.map((gift) => (
        <div
          key={gift.id}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        >
          {gift.is_locked && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-white">
              <Lock className="h-10 w-10" />
            </div>
          )}
          {gift.image_url ? (
            <img src={gift.image_url} alt={gift.slogan} className="h-36 w-full object-cover" />
          ) : (
            <div className="h-36 w-full flex items-center justify-center bg-black/40 text-white/60">
              <GiftIcon className="h-8 w-8" />
            </div>
          )}
          <div className="p-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>#{gift.number ?? "--"}</span>
              <span className={gift.type === "GOOD" ? "text-amber-300" : "text-fuchsia-300"}>{gift.type}</span>
            </div>
            <div className="text-sm font-semibold text-white line-clamp-2">{gift.slogan}</div>
            <div className="text-xs text-white/60">提供者：{gift.provider_name}</div>
            <div className="text-xs text-white/60">持有者：{gift.holder_name ?? "未分配"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function GiftDisplayPage() {
  const { stage, goodGifts, badGifts, unlockedGifts, players, order, voteSummary, gifts } =
    useLoaderData<typeof loader>();

  const currentGift = stage.current_gift_id
    ? gifts.find((gift) => gift.id === stage.current_gift_id)
    : undefined;
  const currentPlayer = stage.current_player_id
    ? players.find((p) => p.id === stage.current_player_id)
    : undefined;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_20%,rgba(255,193,7,0.14),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(244,63,94,0.16),transparent_38%),linear-gradient(180deg,rgba(0,0,0,0.85),rgba(0,0,0,0.95))]" />
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 space-y-6">
          <header className="flex items-center justify-between">
            <div>
              <Badge>Big Screen</Badge>
              <h1 className="mt-2 text-3xl font-[Unbounded,_system-ui,_sans-serif]">交換禮物 · 場控畫面</h1>
              <p className="text-sm text-white/60">同步手機控制器，所有玩家請看此畫面。</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/70">
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 flex items-center gap-1">
                <Clock3 className="h-3 w-3" /> {stage.stage} R{stage.round ?? 1}
              </span>
              {currentPlayer && (
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 flex items-center gap-1">
                  <Users className="h-3 w-3" /> {currentPlayer.name}
                </span>
              )}
            </div>
          </header>

          {stage.stage === "idle" && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-lg text-white/80">
              等待主持人開始，請保持手機連線。
            </div>
          )}

          {stage.stage === "r1_pick" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                所有玩家請用手機輸入禮物編號，主持人點名公布結果。
              </div>
              <GiftGrid gifts={goodGifts} />
            </div>
          )}

          {stage.stage === "pk_result" && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center space-y-3">
              <h2 className="text-2xl font-bold">PK 結果</h2>
              <p className="text-lg text-white/80">{stage.message ?? "請參考主持人宣佈"}</p>
            </div>
          )}

          {stage.stage === "s1_vote" && (
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
                <Badge>正在表決的鬧禮物</Badge>
                <div className="flex gap-4 items-center">
                  <div className="h-48 w-48 overflow-hidden rounded-2xl bg-black/40 flex items-center justify-center">
                    {currentGift?.image_url ? (
                      <img src={currentGift.image_url} alt={currentGift.slogan} className="h-full w-full object-cover" />
                    ) : (
                      <GiftIcon className="h-10 w-10 text-white/50" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">{currentGift?.slogan ?? "(未指定)"}</h2>
                    <p className="text-sm text-white/60">提供者：{currentGift?.provider_name ?? "-"}</p>
                    <p className="text-sm text-white/60">持有者：{currentGift?.holder_name ?? "未分配"}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-3">
                <Badge>投票結果</Badge>
                <div className="space-y-2">
                  {voteSummary.length === 0 && <p className="text-sm text-white/60">尚無投票</p>}
                  {voteSummary.map((vote) => {
                    const player = players.find((p) => p.id === vote.target_id);
                    return (
                      <div key={vote.target_id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
                        <span>{player?.name ?? vote.target_id}</span>
                        <span className="font-semibold">{vote.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {stage.stage === "s2_swap" && (
            <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  交換回合：{currentPlayer ? `${currentPlayer.name} 思考中...` : "等待主持人安排"}
                </div>
                <GiftGrid gifts={unlockedGifts} />
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-3">
                <Badge>鎖定狀態</Badge>
                <div className="space-y-2 text-sm text-white/70">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-300" /> 已鎖：{gifts.filter((g) => g.is_locked).length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Unlock className="h-4 w-4 text-emerald-300" /> 未鎖：{unlockedGifts.length}
                  </div>
                </div>
              </div>
            </div>
          )}

          {stage.stage === "lock_prompt" && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center space-y-3">
              <h2 className="text-2xl font-bold">鎖定倒數中</h2>
              <p className="text-lg text-white/80">請在手機決定是否鎖定剛拿到的禮物。</p>
              {currentGift && <p className="text-sm text-white/60">{currentGift.slogan}</p>}
            </div>
          )}

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Users className="h-4 w-4" /> 交換順序（資訊參考）
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {order.map((player, idx) => (
                <div key={player.id} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">#{idx + 1}</span>
                    <span className="text-xs text-white/50">R{player.round_caught ?? 0}</span>
                  </div>
                  <div className="text-lg font-semibold">{player.name}</div>
                  <div className="text-xs text-white/60">年齡 {player.age_years ?? player.age} 年 {player.age_months ?? 0} 月</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-red-500/10 p-4 text-sm text-red-100 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>若手機端未更新，主持人可重新設定階段；若鎖定衝突需人工重置。</div>
          </div>
        </div>
      </div>
    </div>
  );
}
