import {
  Form,
  Link,
  redirect,
  useLoaderData,
  useSearchParams,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

import { requireAdmin } from "../../features/admin/admin-auth.server";
import {
  getAnimeWatchlistPage,
  transitionWantDecision,
} from "../../features/anime/anime-watchlist.server";
import {
  sanitizeAnimeWatchlistReturnTo,
  type AnimeWatchlistSort,
} from "../../features/anime/anime-watchlist";
import type { AnimeSeason } from "../../features/anime/anime.types";
import { requireBlogDb } from "../../lib/d1.server";

const PAGE_SIZE = 48;

const SEASON_LABELS: Record<AnimeSeason, string> = {
  WINTER: "冬",
  SPRING: "春",
  SUMMER: "夏",
  FALL: "秋",
};

const SORT_OPTIONS: ReadonlyArray<{ value: AnimeWatchlistSort; label: string }> = [
  { value: "ADDED_DESC", label: "最近加入" },
  { value: "YEAR_DESC", label: "年份新 → 舊" },
  { value: "SCORE_DESC", label: "外部評分" },
];

function parseAnimeId(value: FormDataEntryValue | null): number {
  const animeId = Number(value);
  if (!Number.isInteger(animeId) || animeId <= 0) throw new Response("Invalid anime id", { status: 400 });
  return animeId;
}

function watchlistHref(requestUrl: URL): string {
  const params = new URLSearchParams(requestUrl.searchParams);
  params.delete("stale");
  const query = params.toString();
  return query ? `/anime/watchlist?${query}` : "/anime/watchlist";
}

function staleHref(returnTo: string): string {
  return `${returnTo}${returnTo.includes("?") ? "&" : "?"}stale=1`;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireAdmin(request, context);
  const url = new URL(request.url);
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
  const page = await getAnimeWatchlistPage(requireBlogDb(context), {
    search: url.searchParams.get("q"),
    sort: url.searchParams.get("sort"),
    limit: PAGE_SIZE,
    offset,
  });

  return {
    ...page,
    returnTo: watchlistHref(url),
    stale: url.searchParams.get("stale") === "1",
  };
}

export async function action({ request, context }: ActionFunctionArgs) {
  await requireAdmin(request, context);
  const formData = await request.formData();
  const animeId = parseAnimeId(formData.get("animeId"));
  const intent = String(formData.get("intent") ?? "");
  const returnTo = sanitizeAnimeWatchlistReturnTo(String(formData.get("returnTo") ?? ""));
  const db = requireBlogDb(context);

  if (intent === "start-seen") {
    const changed = await transitionWantDecision(db, animeId, "SEEN");
    if (!changed) return redirect(staleHref(returnTo));
    const detailParams = new URLSearchParams({ returnTo });
    return redirect(`/anime/library/${animeId}?${detailParams.toString()}`);
  }

  if (intent === "remove-want") {
    const changed = await transitionWantDecision(db, animeId, "NOT_SEEN");
    if (!changed) return redirect(staleHref(returnTo));
    return redirect(returnTo);
  }

  throw new Response("Invalid action", { status: 400 });
}

export default function AnimeWatchlistRoute() {
  const data = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const currentStart = data.total === 0 ? 0 : data.query.offset + 1;
  const currentEnd = Math.min(data.total, data.query.offset + data.items.length);

  const pageHref = (offset: number) => {
    const params = new URLSearchParams(searchParams);
    params.delete("stale");
    if (offset > 0) params.set("offset", String(offset));
    else params.delete("offset");
    const query = params.toString();
    return query ? `/anime/watchlist?${query}` : "/anime/watchlist";
  };

  const detailHref = (animeId: number) => {
    const params = new URLSearchParams({ returnTo: data.returnTo });
    return `/anime/library/${animeId}?${params.toString()}`;
  };

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Personal backlog</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Anime Watchlist</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              專門整理「想看」作品。依加入時間、年份或外部評分排序；Bangumi 收藏數只顯示，不與其他 provider 的 popularity 混排。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/anime/library" className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold hover:border-neutral-300">
              Library
            </Link>
            <Link to="/anime" className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold hover:border-neutral-300">
              盤點總覽
            </Link>
          </div>
        </header>

        {data.stale ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            這部作品的狀態已由其他操作改變，因此沒有覆寫；清單已重新整理。
          </div>
        ) : null}

        <Form method="get" className="mt-8 grid gap-3 rounded-3xl border border-neutral-200 bg-white p-4 md:grid-cols-[1fr_220px_auto] md:p-5">
          <input
            type="search"
            name="q"
            defaultValue={data.query.search ?? ""}
            placeholder="搜尋標題或 alias"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition focus:border-neutral-400 focus:bg-white"
          />
          <select
            name="sort"
            defaultValue={data.query.sort}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm font-bold outline-none focus:border-neutral-400"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-black text-white hover:bg-neutral-700">
            套用
          </button>
        </Form>

        <section className="mt-7">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">想看清單</h2>
              <p className="mt-1 text-sm text-neutral-500">
                {data.total > 0 ? `${currentStart}–${currentEnd} / ${data.total}` : "目前沒有想看的作品"}
              </p>
            </div>
          </div>

          {data.items.length ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.items.map((item) => (
                <article key={item.animeId} className="flex gap-4 rounded-3xl border border-neutral-200 bg-white p-4">
                  <Link to={detailHref(item.animeId)} className="shrink-0">
                    <div className="h-32 w-[86px] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
                      {item.coverUrl ? (
                        <img src={item.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center p-2 text-center text-[11px] font-bold text-neutral-400">沒有海報</div>
                      )}
                    </div>
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link to={detailHref(item.animeId)} className="line-clamp-2 font-black leading-5 hover:underline">
                      {item.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-semibold text-neutral-400">
                      {item.year ? <span>{item.year}</span> : null}
                      {item.season ? <span>{SEASON_LABELS[item.season]}</span> : null}
                      {item.format ? <span>{item.format}</span> : null}
                      {item.episodes != null ? <span>{item.episodes} 話</span> : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-neutral-500">
                      <span className="rounded-full bg-neutral-100 px-2 py-1">
                        加入／更新 {new Date(item.addedAt).toLocaleDateString("zh-TW")}
                      </span>
                      {item.externalScore != null ? (
                        <span className="rounded-full bg-neutral-100 px-2 py-1">
                          {item.scoreSource ?? "外部"} 評分 {item.externalScore}/100
                        </span>
                      ) : null}
                      {item.bangumiCollectionTotal != null ? (
                        <span className="rounded-full bg-neutral-100 px-2 py-1">Bangumi 收藏 {item.bangumiCollectionTotal.toLocaleString()}</span>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Form method="post">
                        <input type="hidden" name="intent" value="start-seen" />
                        <input type="hidden" name="animeId" value={item.animeId} />
                        <input type="hidden" name="returnTo" value={data.returnTo} />
                        <button className="rounded-xl bg-neutral-900 px-3 py-2 text-xs font-black text-white hover:bg-neutral-700">
                          看過了 → 補評價
                        </button>
                      </Form>
                      <Link to={detailHref(item.animeId)} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold hover:border-neutral-300">
                        編輯狀態
                      </Link>
                      <Form method="post">
                        <input type="hidden" name="intent" value="remove-want" />
                        <input type="hidden" name="animeId" value={item.animeId} />
                        <input type="hidden" name="returnTo" value={data.returnTo} />
                        <button className="rounded-xl px-3 py-2 text-xs font-bold text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
                          移出想看
                        </button>
                      </Form>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-3xl border border-dashed border-neutral-300 bg-white p-10 text-center">
              <div className="font-black">Watchlist 目前是空的</div>
              <p className="mt-2 text-sm text-neutral-500">盤點時選擇「想看」，或從 Library Detail 改成 Want，就會出現在這裡。</p>
              <Link to="/anime/library" className="mt-4 inline-block rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-black text-white">瀏覽 Library</Link>
            </div>
          )}

          {data.query.offset > 0 || data.hasMore ? (
            <nav className="mt-10 flex items-center justify-center gap-3 pb-8">
              {data.query.offset > 0 ? (
                <Link to={pageHref(Math.max(0, data.query.offset - PAGE_SIZE))} className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold hover:border-neutral-300">
                  ← 上一頁
                </Link>
              ) : null}
              {data.hasMore ? (
                <Link to={pageHref(data.query.offset + PAGE_SIZE)} className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-black text-white hover:bg-neutral-700">
                  下一頁 →
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
      </div>
    </main>
  );
}
