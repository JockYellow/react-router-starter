import type { ReactNode } from "react";
import {
  Form,
  Link,
  redirect,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

import { requireAdmin } from "../../features/admin/admin-auth.server";
import {
  assignAnimeWatchlistLane,
  getAnimeWatchlistQueueBoard,
  markAnimeWatchlistUnavailable,
  moveAnimeWatchlistQueueItem,
  resetAnimeWatchlistQueue,
  type AnimeWatchlistQueueItem,
} from "../../features/anime/anime-watchlist-queue.server";
import {
  ANIME_WATCHLIST_LANE_LABELS,
  isAnimeWatchlistLane,
  otherAnimeWatchlistLane,
  type AnimeWatchlistLane,
} from "../../features/anime/anime-watchlist-queue";
import type { AnimeSeason } from "../../features/anime/anime.types";
import { requireBlogDb } from "../../lib/d1.server";

const SEASON_LABELS: Record<AnimeSeason, string> = {
  WINTER: "冬",
  SPRING: "春",
  SUMMER: "夏",
  FALL: "秋",
};

function parseAnimeId(value: FormDataEntryValue | null): number {
  const animeId = Number(value);
  if (!Number.isInteger(animeId) || animeId <= 0) {
    throw new Response("Invalid anime id", { status: 400 });
  }
  return animeId;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireAdmin(request, context);
  const board = await getAnimeWatchlistQueueBoard(requireBlogDb(context));
  return {
    ...board,
    stale: new URL(request.url).searchParams.get("stale") === "1",
  };
}

export async function action({ request, context }: ActionFunctionArgs) {
  await requireAdmin(request, context);
  const db = requireBlogDb(context);
  const formData = await request.formData();
  const animeId = parseAnimeId(formData.get("animeId"));
  const intent = String(formData.get("intent") ?? "");

  let changed = false;
  if (intent === "assign-lane") {
    const laneValue = String(formData.get("lane") ?? "");
    if (!isAnimeWatchlistLane(laneValue)) {
      throw new Response("Invalid watchlist lane", { status: 400 });
    }
    changed = await assignAnimeWatchlistLane(db, animeId, laneValue);
  } else if (intent === "unavailable") {
    changed = await markAnimeWatchlistUnavailable(db, animeId);
  } else if (intent === "pending") {
    changed = await resetAnimeWatchlistQueue(db, animeId);
  } else if (intent === "move-up" || intent === "move-down" || intent === "move-top") {
    const direction = intent === "move-up" ? "UP" : intent === "move-down" ? "DOWN" : "TOP";
    changed = await moveAnimeWatchlistQueueItem(db, animeId, direction);
  } else {
    throw new Response("Invalid watchlist queue action", { status: 400 });
  }

  const params = new URLSearchParams();
  if (!changed) params.set("stale", "1");
  const query = params.toString();
  return redirect(query ? `/anime/watchlist/manage?${query}` : "/anime/watchlist/manage");
}

function QueueAction({
  animeId,
  intent,
  lane,
  children,
  primary = false,
}: {
  animeId: number;
  intent: string;
  lane?: AnimeWatchlistLane;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="animeId" value={animeId} />
      <input type="hidden" name="intent" value={intent} />
      {lane ? <input type="hidden" name="lane" value={lane} /> : null}
      <button
        className={
          primary
            ? "rounded-lg bg-neutral-900 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-neutral-700"
            : "rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-neutral-600 hover:border-neutral-400"
        }
      >
        {children}
      </button>
    </Form>
  );
}

function ItemMeta({ item }: { item: AnimeWatchlistQueueItem }) {
  return (
    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-semibold text-neutral-400">
      {item.year ? <span>{item.year}</span> : null}
      {item.season ? <span>{SEASON_LABELS[item.season]}</span> : null}
      {item.format ? <span>{item.format}</span> : null}
      {item.episodes != null ? <span>{item.episodes} 話</span> : null}
    </div>
  );
}

function QueueCard({
  item,
  index,
  lane,
}: {
  item: AnimeWatchlistQueueItem;
  index: number;
  lane: AnimeWatchlistLane;
}) {
  const otherLane = otherAnimeWatchlistLane(lane);

  return (
    <article
      className={
        index === 0
          ? "rounded-2xl border-2 border-neutral-900 bg-white p-3"
          : "rounded-2xl border border-neutral-200 bg-white p-3"
      }
    >
      <div className="flex gap-3">
        <div className="flex w-7 shrink-0 flex-col items-center">
          <span className="text-sm font-black text-neutral-400">#{index + 1}</span>
          {index === 0 ? (
            <span className="mt-1 rounded-full bg-neutral-900 px-2 py-0.5 text-[9px] font-black text-white">
              下一部
            </span>
          ) : null}
        </div>

        <Link to={`/anime/library/${item.animeId}?returnTo=/anime/watchlist/manage`} className="shrink-0">
          <div className="h-24 w-16 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
            {item.coverUrl ? (
              <img src={item.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center p-1 text-center text-[9px] font-bold text-neutral-400">
                沒有海報
              </div>
            )}
          </div>
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            to={`/anime/library/${item.animeId}?returnTo=/anime/watchlist/manage`}
            className="line-clamp-2 text-sm font-black leading-5 hover:underline"
          >
            {item.title}
          </Link>
          <ItemMeta item={item} />

          <div className="mt-3 flex flex-wrap gap-1.5">
            <QueueAction animeId={item.animeId} intent="move-top">置頂</QueueAction>
            <QueueAction animeId={item.animeId} intent="move-up">↑</QueueAction>
            <QueueAction animeId={item.animeId} intent="move-down">↓</QueueAction>
            <QueueAction animeId={item.animeId} intent="assign-lane" lane={otherLane}>
              → {ANIME_WATCHLIST_LANE_LABELS[otherLane]}
            </QueueAction>
            <QueueAction animeId={item.animeId} intent="unavailable">沒得看</QueueAction>
          </div>
        </div>
      </div>
    </article>
  );
}

function PendingCard({ item }: { item: AnimeWatchlistQueueItem }) {
  return (
    <article className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-3">
      <Link to={`/anime/library/${item.animeId}?returnTo=/anime/watchlist/manage`} className="shrink-0">
        <div className="h-24 w-16 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
          {item.coverUrl ? (
            <img src={item.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center p-1 text-center text-[9px] font-bold text-neutral-400">
              沒有海報
            </div>
          )}
        </div>
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={`/anime/library/${item.animeId}?returnTo=/anime/watchlist/manage`}
          className="line-clamp-2 text-sm font-black leading-5 hover:underline"
        >
          {item.title}
        </Link>
        <ItemMeta item={item} />
        <div className="mt-3 flex flex-wrap gap-1.5">
          <QueueAction animeId={item.animeId} intent="assign-lane" lane="MEAL" primary>
            配飯
          </QueueAction>
          <QueueAction animeId={item.animeId} intent="assign-lane" lane="FOCUS" primary>
            專心
          </QueueAction>
          <QueueAction animeId={item.animeId} intent="unavailable">沒得看</QueueAction>
        </div>
      </div>
    </article>
  );
}

function UnavailableCard({ item }: { item: AnimeWatchlistQueueItem }) {
  return (
    <article className="flex gap-3 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-3">
      <Link to={`/anime/library/${item.animeId}?returnTo=/anime/watchlist/manage`} className="shrink-0">
        <div className="h-24 w-16 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {item.coverUrl ? (
            <img src={item.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover opacity-75" />
          ) : (
            <div className="flex h-full items-center justify-center p-1 text-center text-[9px] font-bold text-neutral-400">
              沒有海報
            </div>
          )}
        </div>
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={`/anime/library/${item.animeId}?returnTo=/anime/watchlist/manage`}
          className="line-clamp-2 text-sm font-black leading-5 hover:underline"
        >
          {item.title}
        </Link>
        <ItemMeta item={item} />
        <div className="mt-2 text-[11px] font-bold text-neutral-400">暫時沒有收看管道，不參與任何順位。</div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <QueueAction animeId={item.animeId} intent="assign-lane" lane="MEAL" primary>
            可看了 → 配飯
          </QueueAction>
          <QueueAction animeId={item.animeId} intent="assign-lane" lane="FOCUS" primary>
            可看了 → 專心
          </QueueAction>
          <QueueAction animeId={item.animeId} intent="pending">回待整理</QueueAction>
        </div>
      </div>
    </article>
  );
}

export default function AnimeWatchlistManageRoute() {
  const data = useLoaderData<typeof loader>();
  const total = data.meal.length + data.focus.length + data.pending.length + data.unavailable.length;

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">
              Watchlist queue
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">待看片排序</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
              配飯與專心是兩條獨立佇列；每條線最前面就是下一部。沒得看的作品另外放，不占順位。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/anime/watchlist"
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold hover:border-neutral-300"
            >
              一般清單
            </Link>
            <Link
              to="/anime"
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold hover:border-neutral-300"
            >
              盤點總覽
            </Link>
          </div>
        </header>

        {data.stale ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            這部作品已經不是「想看」狀態，因此沒有改動排序；清單已重新整理。
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-2 text-center text-xs font-black sm:grid-cols-5">
          <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-3">全部 {total}</div>
          <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-3">配飯 {data.meal.length}</div>
          <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-3">專心 {data.focus.length}</div>
          <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-3">待整理 {data.pending.length}</div>
          <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-3">沒得看 {data.unavailable.length}</div>
        </div>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          {([
            ["MEAL", data.meal],
            ["FOCUS", data.focus],
          ] as const).map(([lane, items]) => (
            <div key={lane} className="rounded-3xl border border-neutral-200 bg-neutral-100/70 p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">{ANIME_WATCHLIST_LANE_LABELS[lane]}</h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    {items.length ? `下一部：${items[0].title}` : "目前沒有排隊作品"}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-neutral-500">
                  {items.length} 部
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {items.length ? (
                  items.map((item, index) => (
                    <QueueCard key={item.animeId} item={item} index={index} lane={lane} />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm font-bold text-neutral-400">
                    從待整理區加入這條線。
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border border-neutral-200 bg-white p-4 md:p-5">
          <div>
            <h2 className="text-xl font-black">待整理</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Survey 新增的「想看」先留在這裡；不需要在盤點當下多做決定。
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.pending.length ? (
              data.pending.map((item) => <PendingCard key={item.animeId} item={item} />)
            ) : (
              <div className="text-sm font-bold text-neutral-400">目前沒有待整理作品。</div>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-neutral-200 bg-neutral-100 p-4 md:p-5">
          <div>
            <h2 className="text-xl font-black">沒得看</h2>
            <p className="mt-1 text-sm text-neutral-500">
              這些作品不參與配飯或專心排序；真的有管道之後再決定放進哪條線。
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.unavailable.length ? (
              data.unavailable.map((item) => <UnavailableCard key={item.animeId} item={item} />)
            ) : (
              <div className="text-sm font-bold text-neutral-400">目前沒有標記為沒得看的作品。</div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
