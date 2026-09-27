import { useState } from "react";
import {
  Link,
  useLoaderData,
  useRevalidator,
  type LoaderFunctionArgs,
} from "react-router";

import {
  getCsrfToken,
} from "../../features/admin/admin-auth.server";
import {
  getAnimeAcceptanceSnapshot,
  type AnimeAcceptanceSnapshot,
} from "../../features/anime/anime-acceptance.server";
import {
  getReviewedNetflixSeedQueueSummary,
  type NetflixSeedQueueSummary,
} from "../../features/anime/netflix-seed-queue.server";
import { requireBlogDb } from "../../lib/d1.server";

type AcceptanceLoaderData = {
  csrfToken: string;
  summary: NetflixSeedQueueSummary;
  acceptance: AnimeAcceptanceSnapshot;
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  const csrf = await getCsrfToken(request, context);
  const db = requireBlogDb(context);
  const [summary, acceptance] = await Promise.all([
    getReviewedNetflixSeedQueueSummary(db),
    getAnimeAcceptanceSnapshot(db),
  ]);
  return Response.json(
    { csrfToken: csrf.token, summary, acceptance },
    { headers: { "Set-Cookie": csrf.cookie } },
  );
}

function Stat(props: { label: string; value: number | string; note?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="text-xs font-bold text-neutral-400">{props.label}</div>
      <div className="mt-1 text-2xl font-black text-neutral-900">{props.value}</div>
      {props.note ? <div className="mt-1 text-xs text-neutral-500">{props.note}</div> : null}
    </div>
  );
}

export default function AnimeAcceptancePage() {
  const data = useLoaderData() as AcceptanceLoaderData;
  const revalidator = useRevalidator();
  const [running, setRunning] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runBatch = async (limit: 1 | 5) => {
    if (running) return;
    setRunning(limit);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/anime/netflix-seed", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": data.csrfToken,
        },
        body: JSON.stringify({ intent: "resolve", limit }),
      });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        processed?: {
          upgraded?: number;
          selected?: number;
          matched?: number;
          ambiguous?: number;
          unmatched?: number;
          skipped?: number;
          failed?: number;
        };
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      const processed = payload.processed;
      setMessage(
        `已處理 ${processed?.selected ?? 0} 筆：MATCHED ${processed?.matched ?? 0}、AMBIGUOUS ${processed?.ambiguous ?? 0}、UNMATCHED ${processed?.unmatched ?? 0}、ERROR ${processed?.failed ?? 0}${processed?.upgraded ? `；另升級舊 queue ${processed.upgraded} 筆` : ""}`,
      );
      await revalidator.revalidate();
    } catch (error) {
      setMessage(error instanceof Error ? `執行失敗：${error.message}` : "執行失敗");
    } finally {
      setRunning(null);
    }
  };

  const netflix = data.acceptance.netflix;
  const ordering = data.acceptance.ordering;
  const hasCanonicalAnomaly = netflix.matchedWithoutAnimeId > 0 || netflix.matchedWithoutDecision > 0;

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Private acceptance</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Anime Memory 驗收</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              只顯示統計，不輸出 Netflix 標題、觀看內容、評分或筆記。正式資料先用小批次驗證，再決定是否繼續。
            </p>
          </div>
          <Link
            to="/anime"
            className="self-start rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold hover:border-neutral-300"
          >
            返回 Anime Memory
          </Link>
        </header>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Netflix queue</h2>
              <p className="mt-1 text-sm text-neutral-500">resolver v2 與 canonical 寫入狀態。</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Queue 總數" value={netflix.queueTotal} />
            <Stat label="Resolver v2" value={netflix.queueResolverCurrent} />
            <Stat label="待升級舊 payload" value={netflix.queueResolverLegacy} />
            <Stat label="PENDING" value={data.summary.PENDING} />
            <Stat label="MATCHED" value={data.summary.MATCHED} />
            <Stat label="AMBIGUOUS" value={data.summary.AMBIGUOUS} />
            <Stat label="UNMATCHED" value={data.summary.UNMATCHED} />
            <Stat label="ERROR" value={data.summary.ERROR} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat
              label="Canonical matched"
              value={netflix.canonicalMatched}
              note={`其中已有 decision：${netflix.matchedWithDecision}`}
            />
            <Stat
              label="Matched 缺 anime_id"
              value={netflix.matchedWithoutAnimeId}
              note="應為 0"
            />
            <Stat
              label="Matched 缺 decision"
              value={netflix.matchedWithoutDecision}
              note="完成匯入後應為 0"
            />
          </div>

          <div className={`mt-4 rounded-2xl border p-4 text-sm font-bold ${hasCanonicalAnomaly ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {hasCanonicalAnomaly
              ? "目前仍有 canonical 一致性異常，先不要跑全量。"
              : "目前已處理資料沒有 canonical source/decision 一致性異常。"}
          </div>

          <div className="mt-5 rounded-3xl border border-neutral-200 bg-white p-5">
            <h3 className="font-black">小批次正式驗收</h3>
            <p className="mt-1 text-sm leading-6 text-neutral-500">
              按鈕只處理目前 PENDING 的最前面 1 或 5 筆。AMBIGUOUS / UNMATCHED 不會被強制配對，既有手動答案也不會被覆蓋。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(running)}
                onClick={() => void runBatch(1)}
                className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {running === 1 ? "處理中…" : "處理 1 筆"}
              </button>
              <button
                type="button"
                disabled={Boolean(running)}
                onClick={() => void runBatch(5)}
                className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {running === 5 ? "處理中…" : "處理 5 筆"}
              </button>
            </div>
            {message ? (
              <div className="mt-4 rounded-xl bg-neutral-100 px-3 py-2.5 text-sm font-semibold text-neutral-700">
                {message}
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-10 pb-10">
          <h2 className="text-xl font-black">季度排序 migration</h2>
          <p className="mt-1 text-sm text-neutral-500">
            舊季度是在重新開啟該季度時懶遷移，不會一次掃完整個資料庫。
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="TV scopes" value={ordering.tvScopesWithCandidates} />
            <Stat label={`Ordering v${ordering.currentVersion}`} value={ordering.scopesCurrent} />
            <Stat label="待遷移" value={ordering.scopesPendingMigration} />
            <Stat label="Migration error" value={ordering.scopesWithMigrationError} />
            <Stat
              label="遷移後仍缺 Bangumi metrics"
              value={ordering.scopesWithMissingMetrics}
              note="缺 metrics 的作品保持舊相對順序"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
