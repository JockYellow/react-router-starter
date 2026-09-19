import { Form, Link } from "react-router";

import type {
  AnimeWatchlistQueueBoard,
  AnimeWatchlistQueueItem,
} from "./anime-watchlist-queue.server";
import type { AnimeSeason } from "./anime.types";

const SEASON_LABELS: Record<AnimeSeason, string> = {
  WINTER: "冬",
  SPRING: "春",
  SUMMER: "夏",
  FALL: "秋",
};

function WatchlistCard({
  item,
  returnTo,
  position,
  next = false,
}: {
  item: AnimeWatchlistQueueItem;
  returnTo: string;
  position?: number;
  next?: boolean;
}) {
  const detailParams = new URLSearchParams({ returnTo });
  const detailHref = `/anime/library/${item.animeId}?${detailParams.toString()}`;

  return (
    <article
      className={
        next
          ? "flex gap-4 rounded-3xl border-2 border-neutral-900 bg-white p-4"
          : "flex gap-4 rounded-3xl border border-neutral-200 bg-white p-4"
      }
    >
      <Link to={detailHref} className="shrink-0">
        <div className="h-32 w-[86px] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
          {item.coverUrl ? (
            <img src={item.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center p-2 text-center text-[11px] font-bold text-neutral-400">
              沒有海報
            </div>
          )}
        </div>
      </Link>

      <div className="min-w-0 flex-1">
        {position != null ? (
          <div className="mb-1 text-xs font-black text-neutral-500">
            #{position} {next ? "· 下一部" : ""}
          </div>
        ) : null}
        <Link to={detailHref} className="line-clamp-2 font-black leading-5 hover:underline">
          {item.title}
        </Link>
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-semibold text-neutral-400">
          {item.year ? <span>{item.year}</span> : null}
          {item.season ? <span>{SEASON_LABELS[item.season]}</span> : null}
          {item.format ? <span>{item.format}</span> : null}
          {item.episodes != null ? <span>{item.episodes} 話</span> : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Form method="post">
            <input type="hidden" name="intent" value="start-seen" />
            <input type="hidden" name="animeId" value={item.animeId} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button className="rounded-xl bg-neutral-900 px-3 py-2 text-xs font-black text-white hover:bg-neutral-700">
              看過了 → 補評價
            </button>
          </Form>
          <Link to={detailHref} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold hover:border-neutral-300">
            編輯狀態
          </Link>
          <Form method="post">
            <input type="hidden" name="intent" value="remove-want" />
            <input type="hidden" name="animeId" value={item.animeId} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button className="rounded-xl px-3 py-2 text-xs font-bold text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
              移出想看
            </button>
          </Form>
        </div>
      </div>
    </article>
  );
}

function QueueSection({
  title,
  items,
  returnTo,
}: {
  title: string;
  items: AnimeWatchlistQueueItem[];
  returnTo: string;
}) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-neutral-100/60 p-4 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-black">{title}</h2>
          <p className="mt-1 text-xs text-neutral-500">
            {items.length ? `下一部：${items[0].title}` : "目前沒有排隊作品"}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-neutral-500">
          {items.length} 部
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        {items.length ? (
          items.map((item, index) => (
            <WatchlistCard
              key={item.animeId}
              item={item}
              returnTo={returnTo}
              position={index + 1}
              next={index === 0}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
            從「整理排序」加入這條線。
          </div>
        )}
      </div>
    </section>
  );
}

function OtherSection({
  title,
  description,
  items,
  returnTo,
}: {
  title: string;
  description: string;
  items: AnimeWatchlistQueueItem[];
  returnTo: string;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">{title} · {items.length}</h2>
          <p className="mt-1 text-sm text-neutral-500">{description}</p>
        </div>
      </div>
      {items.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => <WatchlistCard key={item.animeId} item={item} returnTo={returnTo} />)}
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-400">目前沒有作品。</p>
      )}
    </section>
  );
}

export function AnimeWatchlistBoardView({
  board,
  returnTo,
  stale,
}: {
  board: AnimeWatchlistQueueBoard;
  returnTo: string;
  stale: boolean;
}) {
  const total = board.meal.length + board.focus.length + board.pending.length + board.unavailable.length;

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Personal backlog</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">想看清單</h1>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              這裡直接依照你安排的順位呈現。配飯與專心各有一部「下一部」，沒得看不參與排序。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/anime/watchlist/manage" className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-black text-white hover:bg-neutral-700">
              整理排序
            </Link>
            <Link to="/anime/watchlist?view=all" className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold hover:border-neutral-300">
              全部搜尋／其他排序
            </Link>
            <Link to="/anime" className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold hover:border-neutral-300">
              盤點總覽
            </Link>
          </div>
        </header>

        {stale ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            這部作品的狀態已由其他操作改變，因此沒有覆寫；清單已重新整理。
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2 text-xs font-black text-neutral-600">
          <span className="rounded-full bg-white px-3 py-2">全部 {total}</span>
          <span className="rounded-full bg-white px-3 py-2">配飯 {board.meal.length}</span>
          <span className="rounded-full bg-white px-3 py-2">專心 {board.focus.length}</span>
          <span className="rounded-full bg-white px-3 py-2">待整理 {board.pending.length}</span>
          <span className="rounded-full bg-white px-3 py-2">沒得看 {board.unavailable.length}</span>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-2">
          <QueueSection title="配飯線" items={board.meal} returnTo={returnTo} />
          <QueueSection title="專心線" items={board.focus} returnTo={returnTo} />
        </div>

        <OtherSection
          title="待整理"
          description="新加入的想看作品先留在這裡，不會擅自排進任何佇列。"
          items={board.pending}
          returnTo={returnTo}
        />
        <OtherSection
          title="沒得看"
          description="沒有收看管道的作品獨立存放，不顯示順位；可以看時再到整理頁安排。"
          items={board.unavailable}
          returnTo={returnTo}
        />
      </div>
    </main>
  );
}
