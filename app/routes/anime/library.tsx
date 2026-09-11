import {
  Form,
  Link,
  useLoaderData,
  useSearchParams,
  type LoaderFunctionArgs,
} from "react-router";

import { requireAdmin } from "../../features/admin/admin-auth.server";
import { getAnimeLibraryPage } from "../../features/anime/anime-library.server";
import {
  ANIME_EVALUATIONS,
  ANIME_EVALUATION_TAGS,
  ANIME_SEASONS,
  type AnimeEvaluationKey,
  type AnimePrimaryStatus,
  type AnimeSeason,
} from "../../features/anime/anime.types";
import { requireBlogDb } from "../../lib/d1.server";

const PAGE_SIZE = 48;

const STATUS_OPTIONS: ReadonlyArray<{ value: AnimePrimaryStatus; label: string }> = [
  { value: "SEEN", label: "看過" },
  { value: "WANT", label: "想看" },
  { value: "NOT_SEEN", label: "沒看" },
];

const SEASON_LABELS: Record<AnimeSeason, string> = {
  WINTER: "冬",
  SPRING: "春",
  SUMMER: "夏",
  FALL: "秋",
};

const RATING_LABELS = new Map<AnimeEvaluationKey, string>(
  ANIME_EVALUATIONS.map((evaluation) => [evaluation.key, evaluation.label]),
);

function parseIntegerList(values: string[]): number[] {
  return values
    .map(Number)
    .filter((value) => Number.isInteger(value));
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireAdmin(request, context);
  const url = new URL(request.url);
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);

  return getAnimeLibraryPage(requireBlogDb(context), {
    search: url.searchParams.get("q"),
    statuses: url.searchParams.getAll("status"),
    ratings: url.searchParams.getAll("rating"),
    years: parseIntegerList(url.searchParams.getAll("year")),
    seasons: url.searchParams.getAll("season"),
    tags: url.searchParams.getAll("tag"),
    sort: url.searchParams.get("sort"),
    limit: PAGE_SIZE,
    offset,
  });
}

function StatusBadge({ status }: { status: AnimePrimaryStatus }) {
  const label = STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
  const className = status === "SEEN"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : status === "WANT"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-neutral-100 text-neutral-500 ring-neutral-200";

  return (
    <span className={`rounded-full px-2 py-1 text-[11px] font-black ring-1 ring-inset ${className}`}>
      {label}
    </span>
  );
}

export default function AnimeLibrary() {
  const data = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const activeFilterCount = data.query.statuses.length
    + data.query.ratings.length
    + data.query.years.length
    + data.query.seasons.length
    + data.query.tags.length
    + (data.query.search ? 1 : 0);
  const currentStart = data.total === 0 ? 0 : data.query.offset + 1;
  const currentEnd = Math.min(data.total, data.query.offset + data.items.length);
  const availableYears = Array.from(
    new Set(data.items.map((item) => item.year).filter((year): year is number => year != null)),
  ).sort((a, b) => b - a);

  const pageHref = (offset: number) => {
    const params = new URLSearchParams(searchParams);
    if (offset > 0) params.set("offset", String(offset));
    else params.delete("offset");
    const query = params.toString();
    return query ? `/anime/library?${query}` : "/anime/library";
  };

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Private archive</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Anime Library</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              從已盤點的個人紀錄裡搜尋、篩選與回顧。純 provider catalog 不會出現在這裡。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/anime"
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold hover:border-neutral-300"
            >
              返回盤點總覽
            </Link>
          </div>
        </header>

        <Form method="get" className="mt-8 rounded-3xl border border-neutral-200 bg-white p-4 md:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_auto]">
            <label className="block">
              <span className="sr-only">搜尋動畫</span>
              <input
                type="search"
                name="q"
                defaultValue={data.query.search ?? ""}
                placeholder="搜尋中文、原文、羅馬字或 alias"
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition focus:border-neutral-400 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="sr-only">排序</span>
              <select
                name="sort"
                defaultValue={data.query.sort}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm font-bold outline-none focus:border-neutral-400"
              >
                <option value="RECENT">最近更新</option>
                <option value="TITLE">標題</option>
                <option value="YEAR_DESC">年份新 → 舊</option>
              </select>
            </label>
            <button className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-black text-white hover:bg-neutral-700">
              套用
            </button>
          </div>

          <details className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4" open={activeFilterCount > 0}>
            <summary className="cursor-pointer select-none text-sm font-black text-neutral-700">
              進階篩選{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
            </summary>

            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <fieldset>
                <legend className="text-xs font-black uppercase tracking-wide text-neutral-400">狀態</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((option) => (
                    <label key={option.value} className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-bold has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white">
                      <input
                        className="sr-only"
                        type="checkbox"
                        name="status"
                        value={option.value}
                        defaultChecked={data.query.statuses.includes(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-black uppercase tracking-wide text-neutral-400">評價</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ANIME_EVALUATIONS.map((evaluation) => (
                    <label key={evaluation.key} className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-bold has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white">
                      <input
                        className="sr-only"
                        type="checkbox"
                        name="rating"
                        value={evaluation.key}
                        defaultChecked={data.query.ratings.includes(evaluation.key)}
                      />
                      {evaluation.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-black uppercase tracking-wide text-neutral-400">季度</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ANIME_SEASONS.map((season) => (
                    <label key={season} className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-bold has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white">
                      <input
                        className="sr-only"
                        type="checkbox"
                        name="season"
                        value={season}
                        defaultChecked={data.query.seasons.includes(season)}
                      />
                      {SEASON_LABELS[season]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-black uppercase tracking-wide text-neutral-400">年份</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableYears.length ? availableYears.map((year) => (
                    <label key={year} className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-bold has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white">
                      <input
                        className="sr-only"
                        type="checkbox"
                        name="year"
                        value={year}
                        defaultChecked={data.query.years.includes(year)}
                      />
                      {year}
                    </label>
                  )) : <span className="text-xs text-neutral-400">目前結果沒有年份資料</span>}
                </div>
              </fieldset>
            </div>

            <fieldset className="mt-5 border-t border-neutral-200 pt-5">
              <legend className="text-xs font-black uppercase tracking-wide text-neutral-400">印象標籤</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {ANIME_EVALUATION_TAGS.map((tag) => (
                  <label key={tag.key} className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-600 has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white">
                    <input
                      className="sr-only"
                      type="checkbox"
                      name="tag"
                      value={tag.key}
                      defaultChecked={data.query.tags.includes(tag.key)}
                    />
                    {tag.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-4">
              <button className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-black text-white hover:bg-neutral-700">
                套用篩選
              </button>
              {activeFilterCount > 0 || data.query.sort !== "RECENT" ? (
                <Link to="/anime/library" className="px-2 py-2 text-sm font-bold text-neutral-500 hover:text-neutral-900">
                  清除全部
                </Link>
              ) : null}
            </div>
          </details>
        </Form>

        <section className="mt-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">作品</h2>
              <p className="mt-1 text-sm text-neutral-500">
                {data.total > 0 ? `${currentStart}–${currentEnd} / ${data.total}` : "沒有符合條件的作品"}
              </p>
            </div>
          </div>

          {data.items.length ? (
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {data.items.map((item) => (
                <article key={item.animeId} className="min-w-0">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-sm">
                    {item.coverUrl ? (
                      <img src={item.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center px-3 text-center text-xs font-bold text-neutral-400">
                        沒有海報
                      </div>
                    )}
                    <div className="absolute left-2 top-2">
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  <h3 className="mt-2 line-clamp-2 text-sm font-black leading-5">{item.title}</h3>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-semibold text-neutral-400">
                    {item.year ? <span>{item.year}</span> : null}
                    {item.season ? <span>{SEASON_LABELS[item.season]}</span> : null}
                    {item.format ? <span>{item.format}</span> : null}
                  </div>
                  {item.rating ? (
                    <div className="mt-1 text-xs font-bold text-neutral-600">
                      {RATING_LABELS.get(item.rating) ?? item.rating}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-3xl border border-dashed border-neutral-300 bg-white p-10 text-center">
              <div className="font-black">找不到符合條件的作品</div>
              <p className="mt-2 text-sm text-neutral-500">可以清除部分篩選，或回到季度盤點增加個人紀錄。</p>
              <div className="mt-4 flex justify-center gap-2">
                <Link to="/anime/library" className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-bold">清除篩選</Link>
                <Link to="/anime" className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-black text-white">回盤點</Link>
              </div>
            </div>
          )}

          {data.query.offset > 0 || data.hasMore ? (
            <nav className="mt-10 flex items-center justify-center gap-3 pb-8">
              {data.query.offset > 0 ? (
                <Link
                  to={pageHref(Math.max(0, data.query.offset - PAGE_SIZE))}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold hover:border-neutral-300"
                >
                  ← 上一頁
                </Link>
              ) : null}
              {data.hasMore ? (
                <Link
                  to={pageHref(data.query.offset + PAGE_SIZE)}
                  className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-black text-white hover:bg-neutral-700"
                >
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
