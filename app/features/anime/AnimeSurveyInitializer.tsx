import { useEffect } from "react";
import { Link, useFetcher, useRevalidator } from "react-router";

import type { AnimeSurveyLoadState, SurveyLoadStepResult } from "./anime-survey-load.server";
import type { AnimeSeason } from "./anime.types";

type LoaderActionData = SurveyLoadStepResult | {
  kind: "RETRYING";
  state: AnimeSurveyLoadState;
};

const LOAD_ACTION = "/api/admin/anime/survey-load";

const SEASON_LABELS: Record<AnimeSeason, string> = {
  WINTER: "冬季",
  SPRING: "春季",
  SUMMER: "夏季",
  FALL: "秋季",
};

export function AnimeSurveyInitializer({
  year,
  season,
  initialState,
}: {
  year: number;
  season: AnimeSeason;
  initialState: AnimeSurveyLoadState;
}) {
  const fetcher = useFetcher<LoaderActionData>();
  const revalidator = useRevalidator();
  const state = fetcher.data?.state ?? initialState;
  const inFlight = fetcher.state !== "idle";
  const busyElsewhere = fetcher.data?.kind === "BUSY";

  useEffect(() => {
    if (state.phase === "READY") {
      if (revalidator.state === "idle") revalidator.revalidate();
      return;
    }
    if (inFlight || state.phase === "ERROR") return;

    const timer = window.setTimeout(() => {
      fetcher.submit(
        {
          intent: "initialize-step",
          year: String(year),
          season,
        },
        { method: "post", action: LOAD_ACTION },
      );
    }, busyElsewhere ? 1_500 : 900);

    return () => window.clearTimeout(timer);
  }, [
    busyElsewhere,
    fetcher,
    inFlight,
    revalidator,
    season,
    state.fetchedCount,
    state.nextPage,
    state.phase,
    state.providerStep,
    year,
  ]);

  const percentage = state.phase === "READY"
    ? 100
    : state.providerStepTotal > 0
      ? Math.min(99, Math.max(0, Math.round(((state.providerStep - 1) / state.providerStepTotal) * 100)))
      : 0;

  const statusText = state.phase === "ERROR"
    ? "資料讀取中斷"
    : state.phase === "BUILDING_SCOPE"
      ? "季度資料已取得，正在依人氣與評分固定候選順序…"
      : busyElsewhere
        ? "另一個讀取程序正在處理這一季，正在同步進度…"
        : inFlight
          ? `正在從 Bangumi 取得 ${state.providerLabel}…`
          : `準備取得 ${state.providerLabel}…`;

  return (
    <section className="mt-8 rounded-3xl border border-neutral-800 bg-neutral-900 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-neutral-500">建立季度資料</div>
          <h2 className="mt-2 text-2xl font-black">{year} · {SEASON_LABELS[season]}</h2>
          <p className="mt-2 text-sm text-neutral-400">
            第一次開啟這一季時，會掃描該季三個月份的 TV 與 WEB 動畫。完成後資料固定存在 D1，不會每次重新抓。
          </p>
        </div>
        <div className="rounded-2xl bg-neutral-950 px-4 py-3 text-right">
          <div className="text-2xl font-black">{state.fetchedCount} 部</div>
          <div className="mt-1 text-xs font-bold text-neutral-500">目前已建立候選</div>
        </div>
      </div>

      <div className="mt-7">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className={state.phase === "ERROR" ? "font-bold text-red-300" : "font-bold text-neutral-300"}>{statusText}</span>
          <span className="font-black text-neutral-500">{percentage}%</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-800">
          <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: `${percentage}%` }} />
        </div>
        {state.phase === "FETCHING_PROVIDER" ? (
          <div className="mt-2 text-xs font-semibold text-neutral-600">
            第 {state.providerStep} / {state.providerStepTotal} 段 · {state.providerLabel}
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-2 text-xs text-neutral-500 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-800 px-3 py-2">來源：Bangumi · TV + WEB 完整掃描</div>
        <div className="rounded-xl border border-neutral-800 px-3 py-2">429 / 5xx / timeout：自動退避重試</div>
        <div className="rounded-xl border border-neutral-800 px-3 py-2">D1：保存進度，重新整理可續接</div>
      </div>

      {state.phase === "ERROR" ? (
        <div className="mt-6 rounded-2xl border border-red-900/60 bg-red-950/30 p-4">
          <div className="font-black text-red-200">已保留 {state.fetchedCount} 部候選</div>
          <p className="mt-2 break-words text-xs leading-5 text-red-200/70">{state.lastError ?? "外部資料來源暫時無法完成這一步。"}</p>
          <p className="mt-2 text-xs text-neutral-500">
            系統已先自動處理短暫錯誤。手動重試只會從目前月份／分類續接，不會清除前面已寫入的候選或你的作答。
          </p>
          <fetcher.Form method="post" action={LOAD_ACTION} className="mt-4 flex flex-wrap gap-2">
            <input type="hidden" name="intent" value="retry-load" />
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="season" value={season} />
            <button disabled={inFlight} className="rounded-xl bg-white px-4 py-2.5 text-sm font-black text-neutral-950 disabled:opacity-50">
              {inFlight ? "重試中…" : "重試失敗步驟"}
            </button>
            <Link to="/anime" className="rounded-xl border border-neutral-700 px-4 py-2.5 text-sm font-bold text-neutral-300">回總覽</Link>
          </fetcher.Form>
          {state.retryCount > 0 ? <div className="mt-3 text-[11px] text-neutral-600">此季度初始化曾中斷 {state.retryCount} 次。</div> : null}
        </div>
      ) : (
        <p className="mt-5 text-xs leading-5 text-neutral-500">
          畫面進度仍在變化時不用重新整理或重複點擊。多分頁同時開啟時，D1 短鎖會避免同一季度重複抓取。
        </p>
      )}
    </section>
  );
}
