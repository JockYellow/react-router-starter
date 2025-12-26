import { Form, useActionData, useFetcher, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Lock, Gift as GiftIcon, CheckCircle2, Sparkles } from "lucide-react";
import type { D1Database } from "@cloudflare/workers-types";

import { getGifts, toggleLock, type Gift } from "../../lib/gift.server";
import { requireBlogDb } from "../../lib/d1.server";
import { buildPublicImageUrl, requireBlogImagesPublicBase } from "../../lib/r2.server";

type PlayerRow = {
  id: string;
  name: string;
  age: number;
  age_years: number | null;
  age_months: number | null;
  round_caught: number;
};

type PickRow = {
  id: number;
  round: number;
  player_id: string;
  gift_id: string;
  pk_score: number | null;
  outcome: "WIN" | "LOSE" | null;
  winner_id: string | null;
  player_name: string;
};

type GiftWithImage = Gift & { image_url?: string | null };

async function ensurePlayerColumns(db: D1Database) {
  const { results } = await db.prepare("PRAGMA table_info(players)").all<{ name: string }>();
  const columns = new Set((results ?? []).map((row) => row.name));
  if (!columns.has("age_years")) {
    await db.prepare("ALTER TABLE players ADD COLUMN age_years INTEGER DEFAULT 0").run();
  }
  if (!columns.has("age_months")) {
    await db.prepare("ALTER TABLE players ADD COLUMN age_months INTEGER DEFAULT 0").run();
  }
  if (!columns.has("pk_loss_count")) {
    await db.prepare("ALTER TABLE players ADD COLUMN pk_loss_count INTEGER DEFAULT 0").run();
  }
  if (!columns.has("pk_loss_opponents")) {
    await db.prepare("ALTER TABLE players ADD COLUMN pk_loss_opponents INTEGER DEFAULT 0").run();
  }
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
  await db
    .prepare("CREATE INDEX IF NOT EXISTS idx_gift_r1_picks_round ON gift_r1_picks(round)")
    .run();

  const { results } = await db.prepare("PRAGMA table_info(gift_r1_picks)").all<{ name: string }>();
  const columns = new Set((results ?? []).map((row) => row.name));
  if (!columns.has("winner_id")) {
    await db.prepare("ALTER TABLE gift_r1_picks ADD COLUMN winner_id TEXT").run();
  }
}

function buildPickSummary(picks: PickRow[], giftById: Map<string, GiftWithImage>) {
  const byGift = new Map<string, PickRow[]>();
  for (const pick of picks) {
    const list = byGift.get(pick.gift_id) ?? [];
    list.push(pick);
    byGift.set(pick.gift_id, list);
  }
  return Array.from(byGift.entries()).map(([giftId, entries]) => ({
    giftId,
    gift: giftById.get(giftId),
    picks: entries,
  }));
}

function formatAge(player: PlayerRow) {
  const years = player.age_years ?? player.age ?? 0;
  const months = player.age_months ?? 0;
  return `${years}y ${months}m`;
}

// 1. Loader: 讀取資料
export async function loader({ context }: LoaderFunctionArgs) {
  const db = requireBlogDb(context);
  await ensureR1Tables(db);
  await ensurePlayerColumns(db);

  const imageBase = requireBlogImagesPublicBase(context);

  const giftsRaw = await getGifts(db);
  const gifts: GiftWithImage[] = giftsRaw.map((gift) => ({
    ...gift,
    image_url: gift.image_key ? buildPublicImageUrl(imageBase, gift.image_key) : null,
  }));

  const playersResult = await db
    .prepare("SELECT id, name, age, age_years, age_months, round_caught FROM players ORDER BY name")
    .all<PlayerRow>();
  const players = playersResult.results ?? [];

  const goodGifts = gifts.filter((gift) => gift.type === "GOOD");
  const assignedPlayerIds = new Set(
    goodGifts.map((gift) => gift.holder_id).filter(Boolean) as string[]
  );

  const unresolvedRoundRow = await db
    .prepare("SELECT MIN(round) as round FROM gift_r1_picks WHERE outcome IS NULL")
    .first<{ round: number | null }>();

  const maxRoundRow = await db
    .prepare("SELECT MAX(round) as round FROM gift_r1_picks")
    .first<{ round: number | null }>();

  let currentRound = unresolvedRoundRow?.round ? Number(unresolvedRoundRow.round) : 1;
  if (!unresolvedRoundRow?.round) {
    const maxRound = maxRoundRow?.round ? Number(maxRoundRow.round) : 0;
    if (maxRound > 0 && players.some((player) => !assignedPlayerIds.has(player.id))) {
      currentRound = maxRound + 1;
    }
  }

  const picksResult = await db
    .prepare(
      "SELECT p.id, p.round, p.player_id, p.gift_id, p.pk_score, p.outcome, p.winner_id, pl.name as player_name FROM gift_r1_picks p JOIN players pl ON p.player_id = pl.id WHERE p.round = ?"
    )
    .bind(currentRound)
    .all<PickRow>();

  const picks = picksResult.results ?? [];
  const picksByPlayer = new Set(picks.map((pick) => pick.player_id));

  const availableGifts = goodGifts.filter((gift) => !gift.holder_id);
  const eligiblePlayers = players.filter(
    (player) => !assignedPlayerIds.has(player.id) && !picksByPlayer.has(player.id)
  );
  const missingPlayers = players.filter(
    (player) => !assignedPlayerIds.has(player.id) && !picksByPlayer.has(player.id)
  );
  const canResolve = missingPlayers.length === 0 && picks.length > 0;

  return {
    gifts,
    goodGifts,
    players,
    eligiblePlayers,
    availableGifts,
    picks,
    currentRound,
    canResolve,
    missingPlayers,
    isR1Complete: players.every((player) => assignedPlayerIds.has(player.id)),
  };
}

// 2. Action: 鎖定 / R1 選擇 / 結算
export async function action({ request, context }: ActionFunctionArgs) {
  const db = requireBlogDb(context);
  await ensureR1Tables(db);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "lock_gift") {
    const id = formData.get("id") as string;
    const currentStatus = formData.get("current_status") === "true";
    const result = await toggleLock(db, id, currentStatus);
    if (!result.success) {
      return { error: "此禮物已鎖定，無法解除" };
    }
    return { success: true };
  }

  if (intent === "submit_pick") {
    const playerId = (formData.get("player_id") as string) ?? "";
    const giftId = (formData.get("gift_id") as string) ?? "";
    const round = Number(formData.get("round") ?? 1);

    if (!playerId || !giftId) {
      return { error: "請選擇玩家與禮物" };
    }

    const gift = await db
      .prepare("SELECT id, type, holder_id FROM gifts WHERE id = ?")
      .bind(giftId)
      .first<{ id: string; type: string; holder_id: string | null }>();
    if (!gift || gift.type !== "GOOD") {
      return { error: "只能選擇好禮物" };
    }
    if (gift.holder_id) {
      return { error: "這份禮物已有人持有" };
    }

    const existingAssignment = await db
      .prepare("SELECT id FROM gifts WHERE type = 'GOOD' AND holder_id = ?")
      .bind(playerId)
      .first();
    if (existingAssignment) {
      return { error: "該玩家已取得好禮物" };
    }

    const existingPick = await db
      .prepare("SELECT id FROM gift_r1_picks WHERE round = ? AND player_id = ?")
      .bind(round, playerId)
      .first();
    if (existingPick) {
      return { error: "這位玩家已送出本輪選擇" };
    }

    await db
      .prepare("INSERT INTO gift_r1_picks (round, player_id, gift_id) VALUES (?, ?, ?)")
      .bind(round, playerId, giftId)
      .run();

    return { success: true };
  }

  if (intent === "resolve_gift") {
    const giftId = (formData.get("gift_id") as string) ?? "";
    const winnerId = (formData.get("winner_id") as string) ?? "";
    const round = Number(formData.get("round") ?? 1);

    if (!giftId || !winnerId) {
      return { error: "請選擇勝者" };
    }

    const picksResult = await db
      .prepare(
        "SELECT id, player_id, outcome FROM gift_r1_picks WHERE round = ? AND gift_id = ?"
      )
      .bind(round, giftId)
      .all<{ id: number; player_id: string; outcome: string | null }>();
    const picks = picksResult.results ?? [];

    if (picks.length === 0) {
      return { error: "此禮物尚未有人選擇" };
    }

    const pickPlayerIds = new Set(picks.map((pick) => pick.player_id));
    if (!pickPlayerIds.has(winnerId)) {
      return { error: "勝者必須是本輪選擇者" };
    }

    if (picks.some((pick) => pick.outcome)) {
      return { error: "此禮物已結算" };
    }

    const statements: D1PreparedStatement[] = [];
    for (const pick of picks) {
      const outcome = pick.player_id === winnerId ? "WIN" : "LOSE";
      statements.push(
        db
          .prepare("UPDATE gift_r1_picks SET outcome = ?, winner_id = ? WHERE id = ?")
          .bind(outcome, winnerId, pick.id)
      );
    }

    statements.push(
      db.prepare("UPDATE gifts SET holder_id = ? WHERE id = ?").bind(winnerId, giftId)
    );
    statements.push(
      db.prepare("UPDATE players SET round_caught = ? WHERE id = ?").bind(round, winnerId)
    );

    await db.batch(statements);

    const losers = picks.filter((pick) => pick.player_id !== winnerId).map((pick) => pick.player_id);
    for (const loserId of losers) {
      const lossStats = await db
        .prepare(
          "SELECT COUNT(*) as loss_count, COUNT(DISTINCT winner_id) as opponents FROM gift_r1_picks WHERE player_id = ? AND outcome = 'LOSE'"
        )
        .bind(loserId)
        .first<{ loss_count: number; opponents: number }>();

      await db
        .prepare("UPDATE players SET pk_loss_count = ?, pk_loss_opponents = ? WHERE id = ?")
        .bind(lossStats?.loss_count ?? 0, lossStats?.opponents ?? 0, loserId)
        .run();
    }

    return { success: true };
  }

  return null;
}

// 3. UI Component
export default function GiftPoolPage() {
  const {
    gifts,
    goodGifts,
    players,
    eligiblePlayers,
    availableGifts,
    picks,
    currentRound,
    canResolve,
    missingPlayers,
    isR1Complete,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const lockedCount = gifts.filter((gift) => gift.is_locked).length;
  const badCount = gifts.filter((gift) => gift.type === "BAD").length;
  const goodCount = goodGifts.length;

  const giftById = new Map(gifts.map((gift) => [gift.id, gift]));
  const pickSummary = buildPickSummary(picks, giftById);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-amber-300/70">R1 · Gift Pool</p>
            <h1 className="font-[Unbounded,_system-ui,_sans-serif] text-2xl md:text-3xl">
              禮物池與鎖定狀態
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-amber-200">
              好禮 {goodCount}
            </span>
            <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-1 text-fuchsia-200">
              鬧禮 {badCount}
            </span>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-cyan-200">
              已鎖 {lockedCount}
            </span>
          </div>
        </div>
        <p className="mt-3 text-sm text-white/60">
          鎖定一旦確認就不可解除。每份禮物請由現場玩家確認後再點擊鎖定。
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/70">R1 · Selection</p>
            <h2 className="text-xl font-semibold">所有人選好禮物 → 再開始分配</h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/70">
            目前回合 R{currentRound}
          </span>
        </div>

        {actionData?.error && (
          <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {actionData.error}
          </div>
        )}

        {isR1Complete ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
            R1 已完成，所有玩家都取得好禮物。
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <Form method="post" className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input type="hidden" name="intent" value="submit_pick" />
              <input type="hidden" name="round" value={currentRound} />
              <select
                name="player_id"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white"
                required
              >
                <option value="">選擇玩家</option>
                {eligiblePlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} · {formatAge(player)}
                  </option>
                ))}
              </select>
              <select
                name="gift_id"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white"
                required
              >
                <option value="">選擇好禮物</option>
                {availableGifts.map((gift) => (
                  <option key={gift.id} value={gift.id}>
                    {gift.slogan}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-400/20 px-4 py-2 text-sm font-semibold text-cyan-100"
              >
                <Sparkles className="h-4 w-4" />
                送出選擇
              </button>
            </Form>

            {missingPlayers.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/70">
                尚未選擇：{missingPlayers.map((player) => player.name).join("、")}
              </div>
            )}
          </div>
        )}

        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.32em] text-white/50">本輪選擇</p>
          {pickSummary.length === 0 ? (
            <p className="mt-2 text-sm text-white/50">尚未有選擇，等待玩家提交。</p>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {pickSummary.map((item) => (
                <div
                  key={item.giftId}
                  className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                >
                  <div className="text-sm font-semibold text-white">
                    {item.gift?.slogan ?? "未知禮物"}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {item.picks.map((pick) => (
                      <span
                        key={pick.id}
                        className={[
                          "rounded-full border px-2 py-1 text-white/70",
                          pick.outcome === "WIN"
                            ? "border-emerald-400/40 bg-emerald-400/20 text-emerald-100"
                            : pick.outcome === "LOSE"
                              ? "border-white/10 bg-white/10"
                              : "border-white/10 bg-white/10",
                        ].join(" ")}
                      >
                        {pick.player_name}
                        {pick.outcome === "WIN" && <span className="ml-1 text-[10px]">WIN</span>}
                        {pick.outcome === "LOSE" && <span className="ml-1 text-[10px]">LOSE</span>}
                      </span>
                    ))}
                  </div>

                  <Form method="post" className="mt-3">
                    <input type="hidden" name="intent" value="resolve_gift" />
                    <input type="hidden" name="gift_id" value={item.giftId} />
                    <input type="hidden" name="round" value={currentRound} />
                    <select
                      name="winner_id"
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                      required
                      disabled={!canResolve || item.picks.some((pick) => pick.outcome)}
                    >
                      <option value="">選擇勝者</option>
                      {item.picks.map((pick) => (
                        <option key={pick.player_id} value={pick.player_id}>
                          {pick.player_name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="mt-2 w-full rounded-2xl border border-amber-400/40 bg-amber-400/20 px-4 py-2 text-sm font-semibold text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!canResolve || item.picks.some((pick) => pick.outcome)}
                    >
                      {item.picks.some((pick) => pick.outcome) ? "已結算" : "確認勝者"}
                    </button>
                  </Form>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {gifts.map((gift) => (
          <GiftCard key={gift.id} gift={gift} />
        ))}
      </div>
    </div>
  );
}

// 獨立出來的卡片元件
function GiftCard({ gift }: { gift: GiftWithImage }) {
  const fetcher = useFetcher();

  const isSubmitting =
    fetcher.formData?.get("intent") === "lock_gift" &&
    fetcher.formData?.get("id") === gift.id;
  const optimisticLocked = gift.is_locked || isSubmitting;

  const isBad = gift.type === "BAD";

  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border transition-all duration-300",
        isBad
          ? "border-fuchsia-500/30 bg-fuchsia-900/10"
          : "border-amber-500/30 bg-amber-900/10",
        optimisticLocked ? "grayscale opacity-70" : "opacity-100",
      ].join(" ")}
    >
      {optimisticLocked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
          <Lock className="h-12 w-12 text-white drop-shadow-lg" />
        </div>
      )}

      <div className="p-4 flex gap-4">
        <div className="h-20 w-20 rounded-2xl overflow-hidden bg-black/40 flex items-center justify-center shrink-0">
          {gift.image_url ? (
            <img
              src={gift.image_url}
              alt={gift.slogan}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <GiftIcon className="text-white/60" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold truncate text-lg pr-2">{gift.slogan}</h3>
            <span
              className={[
                "text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wide",
                isBad ? "bg-fuchsia-600 text-white" : "bg-amber-400 text-black",
              ].join(" ")}
            >
              {gift.type}
            </span>
          </div>

          {gift.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 mb-3">
              {gift.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] text-white/60 border border-white/10 px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex justify-between items-end">
            <div className="text-xs text-white/50">
              <div>
                提供者: <span className="text-white/80">{gift.provider_name}</span>
              </div>
              <div className="mt-1 text-white/60">
                持有者: <span className="text-white/80">{gift.holder_name ?? "未分配"}</span>
              </div>
            </div>

            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="lock_gift" />
              <input type="hidden" name="id" value={gift.id} />
              <input type="hidden" name="current_status" value={String(gift.is_locked)} />

              <button
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition z-30 relative disabled:cursor-not-allowed disabled:opacity-50"
                title={gift.is_locked ? "已鎖定" : "鎖定"}
                disabled={gift.is_locked}
              >
                <Lock size={18} />
              </button>
            </fetcher.Form>
          </div>
        </div>
      </div>
    </div>
  );
}
