import { useEffect } from "react";
import { Link, useFetcher } from "react-router";

import type { AnimeSurveyLoadState, SurveyLoadStepResult } from "./anime-survey-load.server";
import type { AnimeSeason } from "./anime.types";

type LoaderActionData = SurveyLoadStepResult | {
  kind: "RETRYING";
  state: AnimeSurveyLoadState;
};

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
  const state = fetcher.data?.state ?? initialState;
  const inFlight = fetcher.state !== "idle";
  const busyElsewhere = fetcher.data?.kind === "BUSY";

  useEffect(() => {
    if (inFlight || state.phase === "READY" || state.phase === "ERROR") return;

    const timer = window.setTimeout(() => {
      fetcher.submit(
        {
          intent: "initialize-step",
          year: String(year),
          season,
        },
        { method: "post" },
      );
    }, busyElsewhere ? 1_200 : 250);

    return () => window.clearTimeout(timer);
  }, [busyElsewhere, fetcher, inFlight, season, state.fetchedCount, state.nextPage, state.phase, year]);

  const denominator = Math.max(1, state.targetCount);
  const percentage = state.phase === "READY"
    ? 100
    : Math.min(100, Math.round((state.fetchedCount / denominator) * 100));

  const statusText = state.phase === "ERROR"
    ? "資料讀取中斷"
    : state.phase === "BUILDING_SCOPE"
      ? "動畫資料已取得，正在建立這一季的固定候選順序…"
      : busyElsewhere
        ? "另一個讀取程序正在處理這一季，正在同步進度…"
        : inFlight
          ? `正在取得並寫入下一批動畫（最多 50 部）…`
          : `準備取得下一批動畫…`;

  return (
    <section className="mt-8 rounded-3xl border border-neutral-800 bg-neutral-900 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-neutral-500">建立季度資料</div>
          <h2 className="mt-2 text-2xl font-black">{year} · {SEASON_LABELS[season]}</h2>
          <p className="mt-2 text-sm text-neutral-400">第一次開啟這一季時才需要執行。完成後之後直接讀 D1，不會每次重新抓 AniList。</p>
        </div>
        <div className="rounded-2xl bg-neutral-950 px-4 py-3 text-right">
          <div className="text-2xl font-black">{state.fetchedCount} / {state.targetCount}</div>
          <div className="mt-1 text-xs font-bold text-neutral-500">已取得動畫</div>
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
      </div>

      <div className="mt-5 grid gap-2 text-xs text-neutral-500 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-800 px-3 py-2">AniList：每批最多 50 部</div>
        <div className="rounded-xl border border-neutral-800 px-3 py-2">429 / 5xx / timeout：自動退避重試</div>
        <div className="rounded-xl border border-neutral-800 px-3 py-2">重新整理：從已保存進度續接</div>
      </div>

      {state.phase === "ERROR" ? (
        <div className="mt-6 rounded-2xl border border-red-900/60 bg-red-950/30 p-4">
          <div className="font-black text-red-200">停在 {state.fetchedCount} / {state.targetCount}</div>
          <p className="mt-2 break-words text-xs leading-5 text-red-200/70">{state.lastError ?? "外部資料來源暫時無法完成這一步。"}</p>
          <p className="mt-2 text-xs text-neutral-500">系統內部的短暫錯誤已自動重試；這顆按鈕只重試失敗的這一步，不會清掉前面已取得的資料。</p>
          <fetcher.Form method="post" className="mt-4 flex flex-wrap gap-2">
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
        <p className="mt-5 text-xs leading-5 text-neutral-500">畫面仍有進度變化時不需要重新整理或重複點擊。若另一個分頁已經在載入，這裡會等待並自動同步。</p>
      )}
    </section>
  );
}
