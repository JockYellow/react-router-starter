import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { Crown, PauseCircle, Zap, Lock } from "lucide-react";
import type { D1Database } from "@cloudflare/workers-types";

import { requireBlogDb } from "../lib/d1.server";

function ensurePlayerColumns(db: D1Database) {
  return db
    .prepare("PRAGMA table_info(players)")
    .all<{ name: string }>()
    .then(async ({ results }) => {
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
    });
}

type PlayerRow = {
  id: string;
  name: string;
  age: number;
  age_years: number | null;
  age_months: number | null;
  round_caught: number;
  pk_value: number;
  pk_loss_count: number | null;
  pk_loss_opponents: number | null;
};

type GiftRow = {
  id: string;
  type: "GOOD" | "BAD";
  holder_id: string | null;
  is_locked: number | boolean | null;
  vote_count: number | null;
  slogan: string | null;
};

type PlayerOrder = PlayerRow & {
  vote_count: number;
  held_count: number;
  held_slogan?: string;
  status: "PASS" | "READY" | "UNASSIGNED";
};

function ageScore(player: PlayerRow) {
  const years = player.age_years ?? player.age ?? 0;
  const months = player.age_months ?? 0;
  return years * 12 + months;
}

export async function loader({ context }: LoaderFunctionArgs) {
  const db = requireBlogDb(context);
  await ensurePlayerColumns(db);

  const playersResult = await db
    .prepare(
      "SELECT id, name, age, age_years, age_months, round_caught, pk_value, pk_loss_count, pk_loss_opponents FROM players"
    )
    .all<PlayerRow>();
  const giftsResult = await db
    .prepare("SELECT id, type, holder_id, is_locked, vote_count, slogan FROM gifts")
    .all<GiftRow>();

  const players = playersResult.results ?? [];
  const gifts = giftsResult.results ?? [];

  const giftsByHolder = new Map<string, GiftRow[]>();
  for (const gift of gifts) {
    if (!gift.holder_id) continue;
    const list = giftsByHolder.get(gift.holder_id) ?? [];
    list.push(gift);
    giftsByHolder.set(gift.holder_id, list);
  }

  const order: PlayerOrder[] = players.map((player) => {
    const held = giftsByHolder.get(player.id) ?? [];
    const heldCount = held.length;
    const voteCount = held.reduce((sum, gift) => sum + (gift.vote_count ?? 0), 0);
    const allLocked = heldCount > 0 && held.every((gift) => Boolean(gift.is_locked));
    const status = heldCount === 0 ? "UNASSIGNED" : allLocked ? "PASS" : "READY";

    return {
      ...player,
      vote_count: voteCount,
      held_count: heldCount,
      held_slogan: held[0]?.slogan ?? undefined,
      status,
    };
  });

  order.sort((a, b) => {
    if (a.round_caught !== b.round_caught) return b.round_caught - a.round_caught;
    const lossA = a.pk_loss_count ?? 0;
    const lossB = b.pk_loss_count ?? 0;
    if (lossA !== lossB) return lossB - lossA; // 輸更多優先
    const oppA = a.pk_loss_opponents ?? 0;
    const oppB = b.pk_loss_opponents ?? 0;
    if (oppA !== oppB) return oppB - oppA;
    if (a.vote_count !== b.vote_count) return a.vote_count - b.vote_count;
    return ageScore(b) - ageScore(a);
  });

  const unlockedGifts = gifts.filter((gift) => !gift.is_locked);

  return { order, unlockedGifts, players };
}

export default function GiftOrderPage() {
  const { order, unlockedGifts, players } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-amber-300/70">S2 · Turn Order</p>
            <h1 className="font-[Unbounded,_system-ui,_sans-serif] text-2xl md:text-3xl">
              搶奪順序與鎖定概況
            </h1>
          </div>
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/70">
            鎖定不可逆（需要重置請人工操作）
          </span>
        </div>
        <div className="mt-4 grid gap-2 text-xs text-white/60 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">1. R 輪次（越晚越優先）</div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">2. PK 記錄（輸更多優先）</div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">3. S1 票數（越低越優先）</div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">4. 年齡（年/月，年長優先）</div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/70">Lock Status</p>
            <h2 className="text-xl font-semibold">禮物鎖定狀況</h2>
          </div>
          <span className="text-xs text-white/50">未鎖定 {unlockedGifts.length}</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {unlockedGifts.map((gift) => (
            <div
              key={gift.id}
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white"
            >
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-200" />
                <span className="font-semibold">{gift.slogan ?? "未命名禮物"}</span>
              </div>
              <p className="mt-1 text-xs text-white/60">{gift.type === "GOOD" ? "好禮" : "鬧禮"}</p>
            </div>
          ))}
          {unlockedGifts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
              全數已鎖定
            </div>
          )}
        </div>
      </section>

      <div className="space-y-3">
        {order.map((player, index) => (
          <div
            key={player.id}
            className={[
              "rounded-3xl border px-5 py-4 transition",
              player.status === "READY"
                ? "border-amber-400/40 bg-amber-400/10"
                : player.status === "PASS"
                  ? "border-white/10 bg-white/5 opacity-70"
                  : "border-cyan-400/20 bg-cyan-500/10",
            ].join(" ")}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-sm font-bold">
                  #{index + 1}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">{player.name}</h2>
                    {index === 0 && <Crown className="h-4 w-4 text-amber-300" />}
                  </div>
                  <p className="text-xs text-white/50">
                    {player.held_slogan ? `持有：${player.held_slogan}` : "尚未分配禮物"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                {player.status === "READY" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/20 px-2 py-1 text-amber-100">
                    <Zap className="h-3 w-3" />
                    READY
                  </span>
                )}
                {player.status === "PASS" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2 py-1 text-white/60">
                    <PauseCircle className="h-3 w-3" />
                    PASS
                  </span>
                )}
                {player.status === "UNASSIGNED" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-cyan-100">
                    待命
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/60 sm:grid-cols-5">
              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">R 輪次 {player.round_caught}</div>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">PK 輸 {player.pk_loss_count ?? 0}</div>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">對手 {player.pk_loss_opponents ?? 0}</div>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">票數 {player.vote_count}</div>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">年齡 {player.age_years ?? player.age} 年 {player.age_months ?? 0} 月</div>
            </div>
          </div>
        ))}

        {players.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-white/60">
            尚未建立玩家資料
          </div>
        )}
      </div>
    </div>
  );
}
