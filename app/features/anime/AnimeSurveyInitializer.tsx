import { useEffect, useRef, useState } from "react";
import { Link, useFetcher, useRevalidator } from "react-router";

import { prefetchAnimeCreditsWithProgress } from "./anime-credits.client";
import type { AnimeSurveyLoadState, SurveyLoadStepResult } from "./anime-survey-load.server";
import type { AnimeSeason } from "./anime.types";

type LoaderActionData = SurveyLoadStepResult | {
  kind: "RETRYING";
  state: AnimeSurveyLoadState;
};

type CreditsPrepState = {
  phase: "IDLE" | "FETCHING_QUEUE" | "PREFETCHING" | "DONE" | "ERROR";
  completed: number;
  total: number;
  error: string | null;
};

const LOAD_ACTION = "/api/admin/anime/survey-load";
const INITIAL_CREDITS_COUNT = 20;

const SEASON_LABELS: Record<AnimeSeason, string> = {
  WINTER: "冬季",
  SPRING: "春季",
  SUMMER: "夏季",
  FALL: "秋季",
};

function parseQueueAnimeIds(value: unknown): number[] {
  if (!value || typeof value !== "object") return [];
  const items = (value as Record<string, unknown>).items;
  if (!Array.isArray(items)) return [];
  const ids: number[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const candidate = (item as Record<string, unknown>).candidate;
    if (!candidate || typeof candidate !== "object") continue;
    const animeId = Number((candidate as Record<string, unknown>).animeId);
    if (Number.isInteger(animeId) && animeId > 0 && !ids.includes(animeId)) ids.push(animeId);
    if (ids.length >= INITIAL_CREDITS_COUNT) break;
  }
  return ids;
}

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
  const [creditsPrep, setCreditsPrep] = useState<CreditsPrepState>({
    phase: "IDLE",
    completed: 0,
    total: INITIAL_CREDITS_COUNT,
    error: null,
  });
  const [creditsAttempt, setCreditsAttempt] = useState(0);
  const prepKeyRef = useRef("");

  useEffect(() => {
    if (state.phase === "READY" || inFlight || state.phase === "ERROR") return;

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
    season,
    state.fetchedCount,
    state.nextPage,
    state.phase,
    state.providerStep,
    year,
  ]);

  useEffect(() => {
    if (state.phase !== "READY") return;
    const prepKey = `${year}:${season}:${creditsAttempt}`;
    if (prepKeyRef.current === prepKey) return;
    prepKeyRef.current = prepKey;
    let cancelled = false;

    void (async () => {
      setCreditsPrep({
        phase: "FETCHING_QUEUE",
        completed: 0,
        total: INITIAL_CREDITS_COUNT,
        error: null,
      });

      const params = new URLSearchParams({
        year: String(year),
        season,
        limit: String(INITIAL_CREDITS_COUNT),
      });
      const response = await fetch(`/api/anime/survey-queue?${params.toString()}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`作答佇列準備失敗（HTTP ${response.status}）`);
      const payload: unknown = await response.json().catch(() => null);
      const animeIds = parseQueueAnimeIds(payload);
      if (cancelled) return;

      if (!animeIds.length) {
        setCreditsPrep({ phase: "DONE", completed: 0, total: 0, error: null });
        if (revalidator.state === "idle") revalidator.revalidate();
        return;
      }

      setCreditsPrep({ phase: "PREFETCHING", completed: 0, total: animeIds.length, error: null });
      await prefetchAnimeCreditsWithProgress(
        animeIds,
        (completed, total) => {
          if (!cancelled) {
            setCreditsPrep({ phase: "PREFETCHING", completed, total, error: null });
          }
        },
        4,
      );
      if (cancelled) return;

      setCreditsPrep({ phase: "DONE", completed: animeIds.length, total: animeIds.length, error: null });
      if (revalidator.state === "idle") revalidator.revalidate();
    })().catch((error) => {
      if (cancelled) return;
      setCreditsPrep((current) => ({
        ...current,
        phase: "ERROR",
        error: error instanceof Error ? error.message : "製作資訊準備失敗",
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [creditsAttempt, revalidator, season, state.phase, year]);

  const providerPercentage = state.providerStepTotal > 0
    ? Math.min(100, Math.max(0, Math.round(((state.providerStep - 1) / state.providerStepTotal) * 100)))
    : 0;
  const percentage = state.phase === "READY"
    ? creditsPrep.phase === "DONE"
      ? 100
      : creditsPrep.phase === "PREFETCHING" && creditsPrep.total > 0
        ? 90 + Math.round((creditsPrep.completed / creditsPrep.total) * 10)
        : 90
    : state.phase === "BUILDING_SCOPE"
      ? 88
      : Math.round(providerPercentage * 0.85);

  const statusText = state.phase === "ERROR"
    ? "資料讀取中斷"
    : state.phase === "BUILDING_SCOPE"
      ? "季度資料已取得，正在依人氣與評分固定候選順序…"
      : state.phase === "READY"
        ? creditsPrep.phase === "ERROR"
          ? "製作資訊準備中斷"
          : creditsPrep.phase === "DONE"
            ? "準備完成，正在進入作答…"
            : creditsPrep.phase === "PREFETCHING"
              ? `正在準備製作資訊：${creditsPrep.completed} / ${creditsPrep.total}`
              : "季度候選完成，正在準備前 20 部製作資訊…"
        : busyElsewhere
          ? "另一個讀取程序正在處理這一季，正在同步進度…"
          : inFlight
            ? `正在從 Bangumi 取得 ${state.providerLabel}…`
            : `準備取得 ${state.providerLabel}…`;

  const retryCredits = () => {
    prepKeyRef.current = "";
    setCreditsPrep({
      phase: "IDLE",
      completed: 0,
      total: INITIAL_CREDITS_COUNT,
      error: null,
    });
    setCreditsAttempt((value) => value + 1);
  };

  return (
    <section className="mt-8 rounded-3xl border border-neutral-800 bg-neutral-900 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-neutral-500">建立季度資料</div>
          <h2 className="mt-2 text-2xl font-black">{year} · {SEASON_LABELS[season]}</h2>
          <p className="mt-2 text-sm text-neutral-400">
            第一次開啟這一季時，先掃描三個月份的 TV 與 WEB 動畫，再準備前 20 部的製作資訊；完成後才進入作答。
          </p>
        </div>
        <div className="rounded-2xl bg-neutral-950 px-4 py-3 text-right">
          <div className="text-2xl font-black">{state.fetchedCount} 部</div>
          <div className="mt-1 text-xs font-bold text-neutral-500">目前已保留候選</div>
        </div>
      </div>

      <div className="mt-7">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className={state.phase === "ERROR" || creditsPrep.phase === "ERROR" ? "font-bold text-red-300" : "font-bold text-neutral-300"}>{statusText}</span>
          <span className="font-black text-neutral-500">{percentage}%</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-800">
          <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: `${percentage}%` }} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-xs font-black text-neutral-300">
            <span>季度候選</span>
            <span>{state.phase === "READY" ? "完成" : state.phase === "BUILDING_SCOPE" ? "排序中" : `${state.providerStep} / ${state.providerStepTotal} 段`}</span>
          </div>
          <div className="mt-2 text-xs leading-5 text-neutral-500">
            {state.phase === "FETCHING_PROVIDER"
              ? `${state.providerLabel} · 已保留 ${state.fetchedCount} 部`
              : state.phase === "BUILDING_SCOPE"
                ? `已掃描 ${state.fetchedCount} 部，正在固定候選順序`
                : state.phase === "READY"
                  ? `季度候選完成，共 ${state.fetchedCount} 部`
                  : `已保留 ${state.fetchedCount} 部`}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-xs font-black text-neutral-300">
            <span>製作資訊</span>
            <span>
              {state.phase !== "READY"
                ? "等待中"
                : creditsPrep.phase === "DONE"
                  ? `${creditsPrep.total} / ${creditsPrep.total}`
                  : creditsPrep.phase === "PREFETCHING"
                    ? `${creditsPrep.completed} / ${creditsPrep.total}`
                    : creditsPrep.phase === "ERROR"
                      ? "中斷"
                      : "準備中"}
            </span>
          </div>
          <div className="mt-2 text-xs leading-5 text-neutral-500">
            {state.phase !== "READY"
              ? "季度候選完成後，會先預抓前 20 部的製作公司與導演。"
              : creditsPrep.phase === "FETCHING_QUEUE"
                ? "正在取得前 20 部作答佇列…"
                : creditsPrep.phase === "PREFETCHING"
                  ? "每 4 部完成一批，進度只在本頁計數，不額外輪詢。"
                  : creditsPrep.phase === "DONE"
                    ? "首批製作資訊已準備完成。"
                    : creditsPrep.phase === "ERROR"
                      ? creditsPrep.error
                      : "即將開始準備製作資訊。"}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-2 text-xs text-neutral-500 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-800 px-3 py-2">Bangumi：TV + WEB，每 25 筆回報一次</div>
        <div className="rounded-xl border border-neutral-800 px-3 py-2">429 / 5xx / timeout：自動退避重試</div>
        <div className="rounded-xl border border-neutral-800 px-3 py-2">D1：保存候選與製作資訊快取</div>
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
      ) : creditsPrep.phase === "ERROR" ? (
        <div className="mt-6 rounded-2xl border border-red-900/60 bg-red-950/30 p-4">
          <div className="font-black text-red-200">製作資訊尚未準備完成</div>
          <p className="mt-2 break-words text-xs leading-5 text-red-200/70">{creditsPrep.error}</p>
          <button type="button" onClick={retryCredits} className="mt-4 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-neutral-950">
            重試製作資訊
          </button>
        </div>
      ) : (
        <p className="mt-5 text-xs leading-5 text-neutral-500">
          畫面進度仍在變化時不用重新整理或重複點擊。多分頁同時開啟時，D1 短鎖會避免同一季度重複抓取。
        </p>
      )}
    </section>
  );
}
