import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";

import type { AnimeSurveyLoadState, SurveyLoadStepResult } from "./anime-survey-load.server";
import type { AnimeSeason } from "./anime.types";
import { fetchAniListSeasonPageFromBrowser } from "./providers/anilist-browser";

type LoaderActionData = SurveyLoadStepResult | {
  kind: "RETRYING";
  state: AnimeSurveyLoadState;
} | {
  kind: "FETCH_BROWSER";
  state: AnimeSurveyLoadState;
  page: number;
  perPage: number;
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
  const state = fetcher.data?.state ?? initialState;
  const [browserFetching, setBrowserFetching] = useState(false);
  const browserRequestKey = useRef<string | null>(null);
  const inFlight = fetcher.state !== "idle" || browserFetching;
  const busyElsewhere = fetcher.data?.kind === "BUSY";

  useEffect(() => {
    if (fetcher.state !== "idle" || browserFetching || state.phase === "READY" || state.phase === "ERROR") return;

    if (fetcher.data?.kind === "FETCH_BROWSER") {
      const request = fetcher.data;
      const key = `${year}:${season}:${request.page}:${state.updatedAt}`;
      if (browserRequestKey.current === key) return;
      browserRequestKey.current = key;
      setBrowserFetching(true);

      void (async () => {
        try {
          const batch = await fetchAniListSeasonPageFromBrowser({
            year,
            season,
            page: request.page,
            perPage: request.perPage,
          });
          fetcher.submit(
            {
              intent: "ingest-browser-page",
              year: String(year),
              season,
              page: String(request.page),
              hasNextPage: batch.hasNextPage ? "1" : "0",
              recordsJson: JSON.stringify(batch.records),
            },
            { method: "post", action: LOAD_ACTION },
          );
        } catch (error) {
          fetcher.submit(
            {
              intent: "browser-load-error",
              year: String(year),
              season,
              page: String(request.page),
              message: error instanceof Error ? error.message : "AniList browser request failed",
            },
            { method: "post", action: LOAD_ACTION },
          );
        } finally {
          setBrowserFetching(false);
        }
      })();
      return;
    }

    const timer = window.setTimeout(() => {
      fetcher.submit(
        {
          intent: state.phase === "FETCHING_PROVIDER" ? "claim-browser-load" : "initialize-step",
          year: String(year),
          season,
        },
        { method: "post", action: LOAD_ACTION },
      );
    }, busyElsewhere ? 1_200 : 250);

    return () => window.clearTimeout(timer);
  }, [browserFetching, busyElsewhere, fetcher, season, state.fetchedCount, state.nextPage, state.phase, state.updatedAt, year]);

  const denominator = Math.max(1, state.targetCount);
  const percentage = state.phase === "READY"
    ? 100
    : Math.min(100, Math.round((state.fetchedCount / denominator) * 100));
  const wasWorkerBlocked = Boolean(state.lastError?.includes("manually blocked") || state.lastError?.includes("principal's office"));

  const statusText = state.phase === "ERROR"
    ? "資料讀取中斷"
    : state.phase === "BUILDING_SCOPE"
      ? "動畫資料已取得，正在建立這一季的固定候選順序…"
      : busyElsewhere
        ? "另一個讀取程序正在處理這一季，正在同步進度…"
        : browserFetching
          ? "正在由你的瀏覽器直接取得 AniList 資料…"
          : fetcher.state !== "idle"
            ? "正在鎖定並確認下一批讀取進度…"
            : "準備取得下一批動畫…";

  return (
    <section className="mt-8 rounded-3xl border border-neutral-800 bg-neutral-900 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-neutral-500">建立季度資料</div>
          <h2 className="mt-2 text-2xl font-black">{year} · {SEASON_LABELS[season]}</h2>
          <p className="mt-2 text-sm text-neutral-400">第一次開啟這一季時才需要執行。AniList 清單由瀏覽器直接取得，再交給本站驗證並寫入 D1；完成後不會每次重新抓。</p>
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
        <div className="rounded-xl border border-neutral-800 px-3 py-2">AniList：瀏覽器直連，每批最多 50 部</div>
        <div className="rounded-xl border border-neutral-800 px-3 py-2">429 / 5xx / timeout：自動退避重試</div>
        <div className="rounded-xl border border-neutral-800 px-3 py-2">D1：鎖定進度，重新整理可續接</div>
      </div>

      {state.phase === "ERROR" ? (
        <div className="mt-6 rounded-2xl border border-red-900/60 bg-red-950/30 p-4">
          <div className="font-black text-red-200">停在 {state.fetchedCount} / {state.targetCount}</div>
          {wasWorkerBlocked ? (
            <p className="mt-2 text-xs leading-5 text-amber-200/80">這是 AniList 封鎖 Cloudflare Worker 出口造成的 403。新版會改由你的瀏覽器直接連 AniList；按下面重試即可從目前進度續接。</p>
          ) : null}
          <p className="mt-2 break-words text-xs leading-5 text-red-200/70">{state.lastError ?? "外部資料來源暫時無法完成這一步。"}</p>
          <p className="mt-2 text-xs text-neutral-500">系統內部的短暫錯誤已自動重試；這顆按鈕只重試失敗的這一步，不會清掉前面已取得的資料。</p>
          <fetcher.Form method="post" action={LOAD_ACTION} className="mt-4 flex flex-wrap gap-2">
            <input type="hidden" name="intent" value="retry-load" />
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="season" value={season} />
            <button disabled={inFlight} className="rounded-xl bg-white px-4 py-2.5 text-sm font-black text-neutral-950 disabled:opacity-50">
              {inFlight ? "重試中…" : wasWorkerBlocked ? "改用瀏覽器重試" : "重試失敗步驟"}
            </button>
            <Link to="/anime" className="rounded-xl border border-neutral-700 px-4 py-2.5 text-sm font-bold text-neutral-300">回總覽</Link>
          </fetcher.Form>
          {state.retryCount > 0 ? <div className="mt-3 text-[11px] text-neutral-600">此季度初始化曾中斷 {state.retryCount} 次。</div> : null}
        </div>
      ) : (
        <p className="mt-5 text-xs leading-5 text-neutral-500">畫面仍有進度變化時不需要重新整理或重複點擊。多分頁同時開啟時，只有取得 D1 短鎖的分頁會向 AniList 讀取下一批。</p>
      )}
    </section>
  );
}
