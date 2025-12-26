import { Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { AlertTriangle, ThumbsUp, CheckCircle2 } from "lucide-react";
import type { D1Database } from "@cloudflare/workers-types";

import { getGifts, type Gift } from "../../lib/gift.server";
import { requireBlogDb } from "../../lib/d1.server";
import { buildPublicImageUrl, requireBlogImagesPublicBase } from "../../lib/r2.server";

type PlayerRow = {
  id: string;
  name: string;
  age: number;
  age_years: number | null;
  age_months: number | null;
  round_caught: number | null;
};

type VoteRow = {
  gift_id: string;
  voter_id: string;
  target_id: string;
  weight: number;
};

type GiftWithImage = Gift & { image_url?: string | null };

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

  if (!columns.has("target_id")) {
    await db.prepare("ALTER TABLE gift_votes ADD COLUMN target_id TEXT").run();
  }
  if (!columns.has("weight")) {
    await db.prepare("ALTER TABLE gift_votes ADD COLUMN weight INTEGER DEFAULT 1").run();
  }
  if (!columns.has("created_at")) {
    await db.prepare("ALTER TABLE gift_votes ADD COLUMN created_at INTEGER").run();
  }
}

async function ensurePlayerColumns(db: D1Database) {
  const { results } = await db.prepare("PRAGMA table_info(players)").all<{ name: string }>();
  const columns = new Set((results ?? []).map((row) => row.name));
  if (!columns.has("age_years")) {
    await db.prepare("ALTER TABLE players ADD COLUMN age_years INTEGER DEFAULT 0").run();
  }
  if (!columns.has("age_months")) {
    await db.prepare("ALTER TABLE players ADD COLUMN age_months INTEGER DEFAULT 0").run();
  }
}

function ageScore(player: PlayerRow) {
  const years = player.age_years ?? player.age ?? 0;
  const months = player.age_months ?? 0;
  return years * 12 + months;
}

function sortPlayersForVoting(players: PlayerRow[]) {
  return [...players].sort((a, b) => {
    const roundA = a.round_caught || 999;
    const roundB = b.round_caught || 999;
    if (roundA !== roundB) return roundA - roundB; // 早拿到的在前面顯示
    return ageScore(b) - ageScore(a); // 年長優先
  });
}

function summarizeVotes(votes: VoteRow[], players: PlayerRow[]) {
  const totals = new Map<string, number>();
  let totalWeight = 0;
  for (const vote of votes) {
    const weight = Number(vote.weight) || 1;
    totalWeight += weight;
    totals.set(vote.target_id, (totals.get(vote.target_id) ?? 0) + weight);
  }

  const orderedPlayers = sortPlayersForVoting(players);
  const entries = orderedPlayers.map((player) => ({
    ...player,
    count: totals.get(player.id) ?? 0,
  }));

  const max = Math.max(0, ...entries.map((entry) => entry.count));
  const leaders = entries.filter((entry) => entry.count === max && max > 0).map((entry) => entry.id);

  return { entries, leaders, max, totalWeight };
}

export async function loader({ context }: LoaderFunctionArgs) {
  const db = requireBlogDb(context);
  await ensureS1Tables(db);
  await ensurePlayerColumns(db);

  const imageBase = requireBlogImagesPublicBase(context);

  const giftsRaw = await getGifts(db);
  const gifts: GiftWithImage[] = giftsRaw.map((gift) => ({
    ...gift,
    image_url: gift.image_key ? buildPublicImageUrl(imageBase, gift.image_key) : null,
  }));

  const badGifts = gifts.filter((gift) => gift.type === "BAD");

  const playersResult = await db
    .prepare("SELECT id, name, age, age_years, age_months, round_caught FROM players")
    .all<PlayerRow>();
  const players = playersResult.results ?? [];
  const orderedPlayers = sortPlayersForVoting(players);

  const votesResult = await db
    .prepare("SELECT gift_id, voter_id, target_id, weight FROM gift_votes")
    .all<VoteRow>();
  const votes = votesResult.results ?? [];

  const votesByGift = new Map<string, VoteRow[]>();
  for (const vote of votes) {
    const list = votesByGift.get(vote.gift_id) ?? [];
    list.push(vote);
    votesByGift.set(vote.gift_id, list);
  }

  const summaries = badGifts.map((gift) => {
    const summary = summarizeVotes(votesByGift.get(gift.id) ?? [], players);
    return { giftId: gift.id, summary };
  });

  const playerCount = players.length;
  const threshold = playerCount ? Math.ceil((playerCount * 2) / 3) : 0;

  return { badGifts, players: orderedPlayers, summaries, playerCount, threshold };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const db = requireBlogDb(context);
  await ensureS1Tables(db);
  await ensurePlayerColumns(db);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "cast_vote") {
    const giftId = (formData.get("gift_id") as string) ?? "";
    const voterId = (formData.get("voter_id") as string) ?? "";
    const targetId = (formData.get("target_id") as string) ?? "";

    if (!giftId || !voterId || !targetId) {
      return { error: "請選擇投票者與目標玩家" };
    }

    const gift = await db
      .prepare("SELECT id, type, provider_id, holder_id FROM gifts WHERE id = ?")
      .bind(giftId)
      .first<{ id: string; type: string; provider_id: string; holder_id: string | null }>();

    if (!gift || gift.type !== "BAD") {
      return { error: "只能投票給鬧禮物" };
    }
    if (gift.holder_id) {
      return { error: "此禮物已結算，無法再投票" };
    }

    const weight = gift.provider_id === voterId ? 2 : 1;

    await db
      .prepare(
        `INSERT INTO gift_votes (gift_id, voter_id, target_id, weight)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(gift_id, voter_id) DO UPDATE SET target_id = excluded.target_id, weight = excluded.weight`
      )
      .bind(giftId, voterId, targetId, weight)
      .run();

    return { success: true };
  }

  if (intent === "resolve_vote") {
    const giftId = (formData.get("gift_id") as string) ?? "";
    if (!giftId) {
      return { error: "缺少禮物資訊" };
    }

    const gift = await db
      .prepare("SELECT id, type, provider_id, holder_id FROM gifts WHERE id = ?")
      .bind(giftId)
      .first<{ id: string; type: string; provider_id: string; holder_id: string | null }>();

    if (!gift || gift.type !== "BAD") {
      return { error: "只能結算鬧禮物" };
    }
    if (gift.holder_id) {
      return { error: "此禮物已結算" };
    }

    const votesResult = await db
      .prepare("SELECT gift_id, voter_id, target_id, weight FROM gift_votes WHERE gift_id = ?")
      .bind(giftId)
      .all<VoteRow>();
    const votes = votesResult.results ?? [];
    if (votes.length === 0) {
      return { error: "此禮物尚未有人投票" };
    }

    const playersResult = await db
      .prepare("SELECT id, name, age, age_years, age_months, round_caught FROM players")
      .all<PlayerRow>();
    const players = playersResult.results ?? [];

    const summary = summarizeVotes(votes, players);
    const leaders = summary.leaders.length > 0 ? summary.leaders : players.map((p) => p.id);
    const winnerId = leaders[Math.floor(Math.random() * leaders.length)];
    const winnerVotes = summary.entries.find((entry) => entry.id === winnerId)?.count ?? 0;

    const playerCount = players.length;
    const threshold = playerCount ? Math.ceil((playerCount * 2) / 3) : 0;
    const forced = threshold > 0 && winnerVotes >= threshold;

    await db
      .prepare(
        "UPDATE gifts SET holder_id = ?, vote_count = ?, is_forced = ?, is_locked = ? WHERE id = ?"
      )
      .bind(winnerId, winnerVotes, forced ? 1 : 0, forced ? 1 : 0, giftId)
      .run();

    return redirect(`/gift/order`);
  }

  return null;
}

export default function GiftVotePage() {
  const { badGifts, players, summaries, playerCount, threshold } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-fuchsia-300/70">S1 · Voting</p>
            <h1 className="font-[Unbounded,_system-ui,_sans-serif] text-2xl md:text-3xl">
              鬧禮投票
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-white/70">
              玩家數 {playerCount || "?"}
            </span>
            <span className="rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1 text-red-200">
              2/3 強制鎖定：{threshold || "?"} 票
            </span>
          </div>
        </div>
        <p className="mt-3 text-sm text-white/60">
          每個鬧禮物逐一投票，提供者擁有 2 票。排序依「拿到好禮物順序」；同順序依年齡（年/月）較大者優先顯示。
        </p>
      </section>

      {actionData?.error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          {actionData.error}
        </div>
      )}
      {actionData?.success && (
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          <CheckCircle2 className="mr-2 inline h-4 w-4" />
          投票已更新
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {badGifts.map((gift) => {
          const summary = summaries.find((item) => item.giftId === gift.id)?.summary;
          return (
            <VoteCard
              key={gift.id}
              gift={gift}
              players={players}
              summary={summary}
              threshold={threshold}
              disabled={isSubmitting}
            />
          );
        })}
        {badGifts.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-white/60">
            目前沒有鬧禮物
          </div>
        )}
      </div>
    </div>
  );
}

function VoteCard({
  gift,
  players,
  summary,
  threshold,
  disabled,
}: {
  gift: GiftWithImage;
  players: PlayerRow[];
  summary?: ReturnType<typeof summarizeVotes>;
  threshold: number;
  disabled: boolean;
}) {
  const forced = gift.is_forced || (threshold > 0 && (summary?.max ?? 0) >= threshold);
  const resolved = Boolean(gift.holder_id);

  return (
    <div
      className={[
        "rounded-3xl border p-5 transition",
        forced
          ? "border-red-500/60 bg-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.25)]"
          : "border-fuchsia-400/30 bg-fuchsia-500/10",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="h-16 w-16 overflow-hidden rounded-xl bg-black/30 flex-shrink-0 flex items-center justify-center">
            {gift.image_url ? (
              <img src={gift.image_url} alt={gift.slogan} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-white/60">No Image</span>
            )}
          </div>
          <div>
            <p className="text-xs text-fuchsia-200/70">鬧禮物</p>
            <h2 className="text-lg font-semibold text-white">{gift.slogan}</h2>
            <p className="mt-1 text-xs text-white/50">提供者: {gift.provider_name}</p>
            {gift.holder_name && (
              <p className="text-xs text-white/50">目前歸屬: {gift.holder_name}</p>
            )}
          </div>
        </div>
        {forced && (
          <span className="flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/20 px-2 py-1 text-[10px] font-bold uppercase text-red-100">
            <AlertTriangle className="h-3 w-3" />
            Forced Lock
          </span>
        )}
      </div>

      {gift.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {gift.tags.map((tag) => (
            <span key={tag} className="text-[10px] text-white/60 border border-white/10 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {(summary?.entries ?? players.map((player) => ({ ...player, count: 0 }))).map((entry) => (
          <div key={entry.id} className="flex items-center justify-between text-xs text-white/60">
            <span>
              {entry.name} <span className="text-white/30">({entry.round_caught || "?"}/{ageScore(entry)}m)</span>
            </span>
            <span className={entry.count === summary?.max && entry.count > 0 ? "text-amber-200" : ""}>
              {entry.count}
            </span>
          </div>
        ))}
      </div>

      <Form method="post" className="mt-4 grid gap-2">
        <input type="hidden" name="intent" value="cast_vote" />
        <input type="hidden" name="gift_id" value={gift.id} />
        <select
          name="voter_id"
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white"
          required
          disabled={resolved || disabled}
        >
          <option value="">選擇投票者</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
        <select
          name="target_id"
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white"
          required
          disabled={resolved || disabled}
        >
          <option value="">選擇目標玩家</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white/70 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={resolved || disabled}
        >
          <ThumbsUp className="h-4 w-4" />
          {resolved ? "已結算" : "送出投票"}
        </button>
      </Form>

      <Form method="post" className="mt-2">
        <input type="hidden" name="intent" value="resolve_vote" />
        <input type="hidden" name="gift_id" value={gift.id} />
        <button
          type="submit"
          className="w-full rounded-2xl border border-amber-400/40 bg-amber-400/20 px-4 py-2 text-sm font-semibold text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={resolved || disabled}
        >
          {resolved ? "已結算" : "結算投票"}
        </button>
      </Form>
    </div>
  );
}
