import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";

import {
  getAnimeDashboardData,
  type AnimeSeasonProgressCell,
} from "../../features/anime/anime-dashboard.server";
import { requireAdmin } from "../../features/admin/admin-auth.server";
import { requireBlogDb } from "../../lib/d1.server";

const SEASON_LABELS = {
  WINTER: "冬",
  SPRING: "春",
  SUMMER: "夏",
  FALL: "秋",
} as const;

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireAdmin(request, context);
  return getAnimeDashboardData(requireBlogDb(context));
}

function ProgressCell({ cell }: { cell: AnimeSeasonProgressCell }) {
  const label = SEASON_LABELS[cell.season];
  const href = `/anime/survey?year=${cell.year}&season=${cell.season}`;

  return (
    <Link
      to={href}
      className={`group rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:shadow-sm ${
        cell.completed
          ? "border-emerald-200 bg-emerald-50"
          : cell.started
            ? "border-amber-200 bg-amber-50"
            : "border-neutral-200 bg-white hover:border-neutral-300"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-black text-neutral-900">{label}</span>
        <span className="text-[11px] font-bold text-neutral-400">
          {cell.completed ? "完成" : cell.started ? "進行中" : "未開始"}
        </span>
      </div>
      <div className="mt-2 text-xs text-neutral-500">
        {cell.started ? `${cell.processedCount} / ${cell.candidateCount}` : "點擊開始盤點"}
      </div>
      {cell.started && cell.candidateCount > 0 ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
          <div
            className="h-full rounded-full bg-neutral-700 transition-all"
            style={{ width: `${Math.min(100, (cell.processedCount / cell.candidateCount) * 100)}%` }}
          />
        </div>
      ) : null}
    </Link>
  );
}

function statusLabel(status: string, detail: string | null) {
  if (status === "WANT") return "想看";
  if (status === "NOT_SEEN") return "沒看";
  if (detail === "COMPLETE") return "看完";
  if (detail === "SEASON_COMPLETE") return "看完一季";
  if (detail === "PARTIAL") return "看過部分";
  if (detail === "DROPPED") return "棄番";
  if (detail === "MOVIE_ONLY") return "只看電影／特別篇";
  return "看過 · 待補評價";
}

export default function AnimeDashboard() {
  const data = useLoaderData<typeof loader>();
  const years = Array.from(new Set(data.seasons.map((cell) => cell.year)));

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Private archive</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Anime Memory</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              依年份與季度把看過的動畫慢慢拼回來。每一題都可以停下，進度會留在 D1。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.latestScope ? (
              <Link
                className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-700"
                to={`/anime/survey?year=${data.latestScope.year}&season=${data.latestScope.season}`}
              >
                繼續盤點 · {data.latestScope.year} {SEASON_LABELS[data.latestScope.season]}
              </Link>
            ) : (
              <Link
                className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-700"
                to="/anime/survey?year=2011&season=WINTER"
              >
                從 2011 冬季開始
              </Link>
            )}
            <Link className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold" to="/jock_space">
              返回首頁
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl border border-neutral-200 bg-white p-5">
            <div className="text-xs font-bold text-neutral-400">看過</div>
            <div className="mt-2 text-3xl font-black">{data.stats.seen}</div>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-5">
            <div className="text-xs font-bold text-neutral-400">想看</div>
            <div className="mt-2 text-3xl font-black">{data.stats.want}</div>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-5">
            <div className="text-xs font-bold text-neutral-400">最喜歡</div>
            <div className="mt-2 text-3xl font-black">{data.stats.favorite}</div>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">季度盤點</h2>
              <p className="mt-1 text-sm text-neutral-500">每季各自紀錄進度，不做一條巨大總進度。</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {years.map((year) => {
              const cells = data.seasons.filter((cell) => cell.year === year);
              return (
                <div key={year} className="grid gap-3 rounded-3xl border border-neutral-200 bg-neutral-100/60 p-3 md:grid-cols-[72px_repeat(4,1fr)] md:items-stretch">
                  <div className="flex items-center px-2 text-xl font-black text-neutral-700">{year}</div>
                  {cells.map((cell) => <ProgressCell key={`${year}-${cell.season}`} cell={cell} />)}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10 pb-10">
          <h2 className="text-xl font-black">最近紀錄</h2>
          {data.recent.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {data.recent.map((item) => (
                <div key={item.anilistId} className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-3">
                  {item.coverUrl ? (
                    <img src={item.coverUrl} alt="" className="h-20 w-14 rounded-lg object-cover" />
                  ) : (
                    <div className="h-20 w-14 rounded-lg bg-neutral-100" />
                  )}
                  <div className="min-w-0 py-1">
                    <div className="truncate font-bold">{item.title}</div>
                    <div className="mt-1 text-xs font-semibold text-neutral-500">{statusLabel(item.status, item.detailStatus)}</div>
                    <div className="mt-2 text-[11px] text-neutral-400">
                      {new Date(item.updatedAt).toLocaleDateString("zh-TW")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-500">
              還沒有盤點紀錄。從任一季度開始即可。
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
