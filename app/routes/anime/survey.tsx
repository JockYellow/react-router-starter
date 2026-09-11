import {
  Form,
  Link,
  redirect,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

import { requireAdmin } from "../../features/admin/admin-auth.server";
import { AnimeSeenAutosave } from "../../features/anime/AnimeSeenAutosave";
import { AnimeSurveyHotkeys } from "../../features/anime/AnimeSurveyHotkeys";
import { AnimeSurveyInitializer } from "../../features/anime/AnimeSurveyInitializer";
import { useAnimeSurveyOptimisticQueue } from "../../features/anime/AnimeSurveyOptimisticQueue";
import {
  getAnimePersonalRecord,
  savePrimaryDecision,
  saveSeenDetail,
  saveSeenEvaluation,
  saveSeenNote,
  saveSeenRating,
  toggleSeenTag,
} from "../../features/anime/anime-record.server";
import {
  ensureSurveyInitialization,
  processSurveyLoadStep,
  retrySurveyLoadStep,
} from "../../features/anime/anime-survey-load.server";
import { getSurveyCandidateAtPosition } from "../../features/anime/anime-survey-navigation.server";
import {
  ensureSurveyScopeCandidates,
  getNextUnresolvedSurveyCandidates,
  refreshSurveyProgress,
  type SurveyCandidateRow,
} from "../../features/anime/anime-survey.server";
import {
  ANIME_EVALUATIONS,
  ANIME_EVALUATION_TAGS,
  ANIME_SEASONS,
  type AnimeEvaluationKey,
  type AnimePrimaryStatus,
  type AnimeSeason,
  type AnimeWatchDetail,
} from "../../features/anime/anime.types";
import { requireBlogDb } from "../../lib/d1.server";

const SEASON_LABELS: Record<AnimeSeason, string> = {
  WINTER: "冬季",
  SPRING: "春季",
  SUMMER: "夏季",
  FALL: "秋季",
};

const WATCH_DETAIL_OPTIONS: Array<{ value: AnimeWatchDetail; label: string }> = [
  { value: "COMPLETE", label: "看完" },
  { value: "SEASON_COMPLETE", label: "看完一季／系列未追完" },
  { value: "PARTIAL", label: "看過部分" },
  { value: "DROPPED", label: "棄番" },
  { value: "MOVIE_ONLY", label: "只看電影／特別篇" },
];

function isSeason(value: string | null): value is AnimeSeason {
  return Boolean(value && ANIME_SEASONS.includes(value as AnimeSeason));
}

function parseScope(url: URL) {
  const rawYear = Number(url.searchParams.get("year") ?? 2011);
  const year = Number.isInteger(rawYear) && rawYear >= 1901 && rawYear <= 2100 ? rawYear : 2011;
  const rawSeason = url.searchParams.get("season");
  const season: AnimeSeason = isSeason(rawSeason) ? rawSeason : "WINTER";
  return { type: "TV_SEASON" as const, year, season };
}

function parseScopeFromForm(formData: FormData) {
  const year = Number(formData.get("year"));
  const seasonValue = String(formData.get("season") ?? "");
  if (!Number.isInteger(year) || year < 1901 || year > 2100 || !isSeason(seasonValue)) {
    throw new Response("Invalid survey scope", { status: 400 });
  }
  return { type: "TV_SEASON" as const, year, season: seasonValue };
}

function surveyUrl(year: number, season: AnimeSeason, position?: number | null) {
  const params = new URLSearchParams({ year: String(year), season });
  if (position && position > 0) params.set("position", String(position));
  return `/anime/survey?${params.toString()}`;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireAdmin(request, context);
  const db = requireBlogDb(context);
  const url = new URL(request.url);
  const scope = parseScope(url);
  const rawPosition = Number(url.searchParams.get("position"));
  const requestedPosition = Number.isInteger(rawPosition) && rawPosition > 0 ? rawPosition : null;

  try {
    const initialization = await ensureSurveyInitialization(db, scope, { targetCount: 100 });
    if (!initialization.ready && initialization.state) {
      return {
        scope,
        summary: null,
        candidate: null,
        record: null,
        initialItems: [],
        reviewMode: Boolean(requestedPosition),
        initializing: true,
        loadState: initialization.state,
        error: null as string | null,
      };
    }

    const initialSummary = await ensureSurveyScopeCandidates(db, scope, { limit: 100 });
    const summary = (await refreshSurveyProgress(db, scope)) ?? initialSummary;

    if (requestedPosition) {
      const candidate = await getSurveyCandidateAtPosition(db, scope, requestedPosition);
      const record = candidate ? await getAnimePersonalRecord(db, candidate.animeId) : null;
      return {
        scope,
        summary,
        candidate,
        record,
        initialItems: [],
        reviewMode: true,
        initializing: false,
        loadState: initialization.state,
        error: null as string | null,
      };
    }

    const candidates = await getNextUnresolvedSurveyCandidates(db, scope, { limit: 5 });
    const initialItems = await Promise.all(
      candidates.map(async (candidate) => ({
        candidate,
        record: await getAnimePersonalRecord(db, candidate.animeId),
      })),
    );
    const first = initialItems[0] ?? null;

    return {
      scope,
      summary,
      candidate: first?.candidate ?? null,
      record: first?.record ?? null,
      initialItems,
      reviewMode: false,
      initializing: false,
      loadState: initialization.state,
      error: null as string | null,
    };
  } catch (error) {
    return {
      scope,
      summary: null,
      candidate: null,
      record: null,
      initialItems: [],
      reviewMode: Boolean(requestedPosition),
      initializing: false,
      loadState: null,
      error: error instanceof Error
        ? `這一季的候選資料目前載入失敗：${error.message}`
        : "這一季的候選資料目前載入失敗，可以重新整理再試。",
    };
  }
}

export function shouldRevalidate({
  formData,
  defaultShouldRevalidate,
}: {
  formData?: FormData;
  defaultShouldRevalidate: boolean;
}) {
  const intent = String(formData?.get("intent") ?? "");
  return intent.endsWith("-autosave") ? false : defaultShouldRevalidate;
}

export async function action({ request, context }: ActionFunctionArgs) {
  await requireAdmin(request, context);
  const db = requireBlogDb(context);
  const formData = await request.formData();
  const scope = parseScopeFromForm(formData);
  const intent = String(formData.get("intent") ?? "");

  if (intent === "initialize-step") {
    return Response.json(await processSurveyLoadStep(db, scope, { targetCount: 100 }));
  }

  if (intent === "retry-load") {
    return Response.json({ kind: "RETRYING" as const, state: await retrySurveyLoadStep(db, scope) });
  }

  const animeId = Number(formData.get("animeId"));
  if (!Number.isInteger(animeId) || animeId <= 0) {
    throw new Response("Invalid anime id", { status: 400 });
  }

  if (intent === "seen-detail-autosave") {
    await saveSeenDetail(db, animeId, String(formData.get("detailStatus") ?? "") as AnimeWatchDetail);
    await refreshSurveyProgress(db, scope);
    return Response.json({ ok: true });
  }

  if (intent === "seen-rating-autosave") {
    const detailStatus = String(formData.get("detailStatus") ?? "") as AnimeWatchDetail;
    await saveSeenDetail(db, animeId, detailStatus);
    await saveSeenRating(db, animeId, String(formData.get("rating") ?? "") as AnimeEvaluationKey);
    await refreshSurveyProgress(db, scope);
    return Response.json({ ok: true });
  }

  if (intent === "seen-tag-toggle-autosave") {
    await toggleSeenTag(db, animeId, String(formData.get("tag") ?? ""));
    return Response.json({ ok: true });
  }

  if (intent === "seen-note-autosave") {
    await saveSeenNote(db, animeId, String(formData.get("note") ?? ""));
    return Response.json({ ok: true });
  }

  if (intent === "primary-optimistic") {
    const status = String(formData.get("status") ?? "") as AnimePrimaryStatus;
    if (status !== "WANT" && status !== "NOT_SEEN") {
      throw new Response("Invalid optimistic primary decision", { status: 400 });
    }
    await savePrimaryDecision(db, animeId, status);
    const summary = await refreshSurveyProgress(db, scope);
    return Response.json({ ok: true, summary });
  }

  if (intent === "primary") {
    const status = String(formData.get("status") ?? "") as AnimePrimaryStatus;
    if (status !== "SEEN" && status !== "WANT" && status !== "NOT_SEEN") {
      throw new Response("Invalid primary decision", { status: 400 });
    }
    await savePrimaryDecision(db, animeId, status);
    await refreshSurveyProgress(db, scope);
    return redirect(surveyUrl(scope.year, scope.season));
  }

  if (intent === "seen-evaluation") {
    const detailStatus = String(formData.get("detailStatus") ?? "") as AnimeWatchDetail;
    const rating = String(formData.get("rating") ?? "") as AnimeEvaluationKey;
    const tags = formData.getAll("tags").map(String);
    const note = String(formData.get("note") ?? "");

    await saveSeenEvaluation(db, {
      animeId,
      detailStatus,
      rating,
      tags,
      note,
    });
    await refreshSurveyProgress(db, scope);
    return redirect(surveyUrl(scope.year, scope.season));
  }

  throw new Response("Unknown survey action", { status: 400 });
}

function alternateTitles(candidate: SurveyCandidateRow) {
  const primary = candidate.titleZhTw ?? candidate.titleNative ?? candidate.titleRomaji ?? candidate.titleEnglish;
  return Array.from(
    new Set([candidate.titleNative, candidate.titleRomaji, candidate.titleEnglish].filter(Boolean)),
  ).filter((title) => title !== primary) as string[];
}

function adjacentSeason(year: number, season: AnimeSeason, offset: -1 | 1) {
  const index = ANIME_SEASONS.indexOf(season);
  const nextIndex = index + offset;
  if (nextIndex < 0) return { year: year - 1, season: "FALL" as AnimeSeason };
  if (nextIndex >= ANIME_SEASONS.length) return { year: year + 1, season: "WINTER" as AnimeSeason };
  return { year, season: ANIME_SEASONS[nextIndex] };
}

export default function AnimeSurvey() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submitting = navigation.state !== "idle";
  const previousSeason = adjacentSeason(data.scope.year, data.scope.season, -1);
  const nextSeason = adjacentSeason(data.scope.year, data.scope.season, 1);
  const optimisticEnabled = !data.reviewMode && !data.initializing && !data.error && Boolean(data.summary);
  const optimistic = useAnimeSurveyOptimisticQueue({
    year: data.scope.year,
    season: data.scope.season,
    initialItems: data.initialItems,
    candidateCount: data.summary?.candidateCount ?? 0,
    processedCount: data.summary?.processedCount ?? 0,
    enabled: optimisticEnabled,
  });
  const candidate = data.reviewMode ? data.candidate : optimistic.currentItem?.candidate ?? null;
  const record = data.reviewMode ? data.record : optimistic.currentItem?.record ?? null;
  const processedCount = optimisticEnabled
    ? optimistic.displayProcessedCount
    : data.summary?.processedCount ?? 0;
  const progress = data.summary && data.summary.candidateCount > 0
    ? Math.min(100, (processedCount / data.summary.candidateCount) * 100)
    : 0;
  const previousItemHref = candidate && candidate.position > 1
    ? surveyUrl(data.scope.year, data.scope.season, candidate.position - 1)
    : null;
  const nextReviewHref = candidate && data.reviewMode && data.summary && candidate.position < data.summary.candidateCount
    ? surveyUrl(data.scope.year, data.scope.season, candidate.position + 1)
    : null;
  const seenFormId = candidate ? `anime-seen-${candidate.animeId}` : "anime-seen";

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-6 text-neutral-100 md:py-10">
      {candidate ? (
        <AnimeSurveyHotkeys
          year={data.scope.year}
          season={data.scope.season}
          animeId={candidate.animeId}
          primaryEnabled={record?.status !== "SEEN"}
          previousHref={previousItemHref}
          disabled={submitting || optimistic.waitingForQueue}
          onFastPrimary={data.reviewMode ? undefined : optimistic.answerFast}
        />
      ) : null}

      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/anime" className="rounded-xl border border-neutral-700 px-3 py-2 text-sm font-bold text-neutral-300 hover:bg-neutral-900">
              ← 盤點總覽
            </Link>
            <div>
              <div className="text-xs font-bold text-neutral-500">季度盤點</div>
              <h1 className="text-lg font-black">{data.scope.year} · {SEASON_LABELS[data.scope.season]}</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to={surveyUrl(previousSeason.year, previousSeason.season)} className="rounded-xl px-3 py-2 text-sm font-bold text-neutral-400 hover:bg-neutral-900">上一季</Link>
            <Link to={surveyUrl(nextSeason.year, nextSeason.season)} className="rounded-xl px-3 py-2 text-sm font-bold text-neutral-400 hover:bg-neutral-900">下一季</Link>
          </div>
        </header>

        {data.summary ? (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-bold text-neutral-500">
              <span>{processedCount} / {data.summary.candidateCount}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}

        {!data.reviewMode && (optimistic.savingCount > 0 || optimistic.failedJobs.length > 0 || optimistic.refillError) ? (
          <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-900/70 px-3 py-2 text-xs text-neutral-400">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {optimistic.failedJobs.length > 0
                  ? `${optimistic.failedJobs.length} 筆背景儲存失敗，答案仍保留在本頁。`
                  : optimistic.refillError
                    ? optimistic.refillError
                    : `背景儲存中：${optimistic.savingCount} 筆`}
              </span>
              <div className="flex gap-2">
                {optimistic.failedJobs.length > 0 ? (
                  <button type="button" onClick={optimistic.retryAllFailed} className="font-black text-neutral-200 hover:text-white">
                    重試儲存
                  </button>
                ) : null}
                {optimistic.refillError ? (
                  <button type="button" onClick={optimistic.retryRefill} className="font-black text-neutral-200 hover:text-white">
                    重試載入
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {candidate ? (
          <div className="mt-4 flex min-h-8 items-center justify-between gap-3 text-xs font-bold text-neutral-500">
            <div className="flex gap-2">
              {previousItemHref ? (
                <Link to={previousItemHref} className="rounded-lg px-2.5 py-1.5 hover:bg-neutral-900 hover:text-neutral-300">Z · 上一題</Link>
              ) : null}
              {data.reviewMode ? (
                <Link to={surveyUrl(data.scope.year, data.scope.season)} className="rounded-lg px-2.5 py-1.5 hover:bg-neutral-900 hover:text-neutral-300">回到待答</Link>
              ) : null}
            </div>
            {data.reviewMode && nextReviewHref ? (
              <Link to={nextReviewHref} className="rounded-lg px-2.5 py-1.5 hover:bg-neutral-900 hover:text-neutral-300">下一題 →</Link>
            ) : null}
          </div>
        ) : null}

        {data.error ? (
          <section className="mt-8 rounded-3xl border border-red-900/60 bg-red-950/30 p-6">
            <h2 className="font-black">候選載入失敗</h2>
            <p className="mt-2 text-sm text-red-200/70">{data.error}</p>
            <Link to={surveyUrl(data.scope.year, data.scope.season)} className="mt-4 inline-block rounded-xl bg-white px-4 py-2 text-sm font-black text-neutral-900">
              重新整理
            </Link>
          </section>
        ) : data.initializing && data.loadState ? (
          <AnimeSurveyInitializer year={data.scope.year} season={data.scope.season} initialState={data.loadState} />
        ) : !candidate && optimisticEnabled && !optimistic.isComplete ? (
          <section className="mt-8 rounded-3xl border border-neutral-800 bg-neutral-900 p-8 text-center">
            <h2 className="text-lg font-black">正在準備下一部</h2>
            <p className="mt-2 text-sm text-neutral-500">
              {optimistic.refillError ?? "候選佇列正在補充，已送出的答案仍會在背景保存。"}
            </p>
            {optimistic.refillError ? (
              <button type="button" onClick={optimistic.retryRefill} className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-black text-neutral-950">
                重試載入
              </button>
            ) : null}
          </section>
        ) : candidate ? (
          <section className="mt-3 overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-900 shadow-2xl">
            <div className="grid md:grid-cols-[minmax(260px,38%)_1fr]">
              <div className="bg-neutral-800">
                {candidate.coverUrl ? (
                  <img src={candidate.coverUrl} alt="" className="h-full min-h-[360px] w-full object-cover" />
                ) : (
                  <div className="flex min-h-[360px] items-center justify-center text-sm text-neutral-600">沒有海報</div>
                )}
              </div>

              <div className="p-5 md:p-8">
                <div className="flex items-center justify-between gap-3 text-xs font-bold text-neutral-500">
                  <span>第 {candidate.position} 部{data.reviewMode ? " · 修改模式" : ""}</span>
                  <span>{[candidate.format, candidate.episodes ? `${candidate.episodes} 集` : null, candidate.studio].filter(Boolean).join(" · ")}</span>
                </div>
                <h2 className="mt-4 text-3xl font-black leading-tight md:text-4xl">
                  {candidate.titleZhTw ?? candidate.titleNative ?? candidate.titleRomaji ?? candidate.titleEnglish ?? "未命名作品"}
                </h2>
                {alternateTitles(candidate).length ? (
                  <div className="mt-3 space-y-1 text-sm text-neutral-500">
                    {alternateTitles(candidate).slice(0, 3).map((title) => <div key={title}>{title}</div>)}
                  </div>
                ) : null}

                {record?.status === "SEEN" ? (
                  <div className="mt-7">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black">你看過這部</div>
                        <div className="mt-1 text-xs text-neutral-500">每個選擇都會先存；最後確認只負責前往下一部。</div>
                      </div>
                      <Form method="post" className="flex gap-3">
                        <input type="hidden" name="intent" value="primary" />
                        <input type="hidden" name="year" value={data.scope.year} />
                        <input type="hidden" name="season" value={data.scope.season} />
                        <input type="hidden" name="animeId" value={candidate.animeId} />
                        <button name="status" value="WANT" disabled={submitting} className="text-xs font-bold text-neutral-500 hover:text-neutral-300">改成想看</button>
                        <button name="status" value="NOT_SEEN" disabled={submitting} className="text-xs font-bold text-neutral-500 hover:text-neutral-300">改成沒看</button>
                      </Form>
                    </div>

                    <Form id={seenFormId} method="post" className="space-y-6">
                      <input type="hidden" name="intent" value="seen-evaluation" />
                      <input type="hidden" name="year" value={data.scope.year} />
                      <input type="hidden" name="season" value={data.scope.season} />
                      <input type="hidden" name="animeId" value={candidate.animeId} />

                      <div className="flex justify-end">
                        <AnimeSeenAutosave
                          formId={seenFormId}
                          year={data.scope.year}
                          season={data.scope.season}
                          animeId={candidate.animeId}
                        />
                      </div>

                      <fieldset>
                        <legend className="text-sm font-black">看到哪裡？</legend>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {WATCH_DETAIL_OPTIONS.map((option) => (
                            <label key={option.value} className="cursor-pointer rounded-xl border border-neutral-700 px-3 py-2.5 text-sm has-[:checked]:border-white has-[:checked]:bg-white has-[:checked]:text-neutral-950">
                              <input className="sr-only" required type="radio" name="detailStatus" value={option.value} defaultChecked={record.detailStatus === option.value} />
                              <span className="font-bold">{option.label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <fieldset>
                        <legend className="text-sm font-black">這部在你心裡的位置</legend>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {ANIME_EVALUATIONS.map((evaluation) => (
                            <label key={evaluation.key} className="cursor-pointer rounded-xl border border-neutral-700 px-3 py-2.5 text-center text-sm has-[:checked]:border-white has-[:checked]:bg-white has-[:checked]:text-neutral-950">
                              <input className="sr-only" required type="radio" name="rating" value={evaluation.key} defaultChecked={record.rating === evaluation.key} />
                              <span className="font-black">{evaluation.label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <fieldset>
                        <legend className="text-sm font-black">想留下的印象 <span className="font-normal text-neutral-500">（可複選，也可以全不選）</span></legend>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {ANIME_EVALUATION_TAGS.map((tag) => (
                            <label key={tag.key} className="cursor-pointer rounded-full border border-neutral-700 px-3 py-2 text-xs font-bold text-neutral-300 has-[:checked]:border-neutral-200 has-[:checked]:bg-neutral-200 has-[:checked]:text-neutral-950">
                              <input className="sr-only" type="checkbox" name="tags" value={tag.key} defaultChecked={record.tags.includes(tag.key)} />
                              {tag.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <details className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4" open={Boolean(record.note)}>
                        <summary className="cursor-pointer text-sm font-bold text-neutral-400">還想多留一句話</summary>
                        <textarea
                          name="note"
                          defaultValue={record.note ?? ""}
                          rows={3}
                          maxLength={4000}
                          placeholder="完全可以不寫。離開輸入框時會自動儲存。"
                          className="mt-3 w-full resize-y rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-sm outline-none focus:border-neutral-400"
                        />
                      </details>

                      <button disabled={submitting} className="w-full rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-neutral-950 disabled:opacity-50">
                        {submitting ? "處理中…" : data.reviewMode ? "確認修改並回到待答" : "確認並下一部"}
                      </button>
                    </Form>
                  </div>
                ) : (
                  <Form method="post" className="mt-8">
                    <input type="hidden" name="intent" value="primary" />
                    <input type="hidden" name="year" value={data.scope.year} />
                    <input type="hidden" name="season" value={data.scope.season} />
                    <input type="hidden" name="animeId" value={candidate.animeId} />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <button disabled={submitting} name="status" value="SEEN" className="rounded-2xl bg-white px-5 py-4 font-black text-neutral-950 disabled:opacity-50">
                        看過 <span className="ml-1 text-xs font-bold text-neutral-500">A / ←</span>
                      </button>
                      {data.reviewMode ? (
                        <button disabled={submitting} name="status" value="WANT" className="rounded-2xl border border-neutral-600 px-5 py-4 font-black text-neutral-100 hover:bg-neutral-800 disabled:opacity-50">
                          想看 <span className="ml-1 text-xs font-bold text-neutral-500">W / ↑</span>
                        </button>
                      ) : (
                        <button type="button" onClick={() => optimistic.answerFast("WANT")} className="rounded-2xl border border-neutral-600 px-5 py-4 font-black text-neutral-100 hover:bg-neutral-800">
                          想看 <span className="ml-1 text-xs font-bold text-neutral-500">W / ↑</span>
                        </button>
                      )}
                      {data.reviewMode ? (
                        <button disabled={submitting} name="status" value="NOT_SEEN" className="rounded-2xl border border-neutral-800 px-5 py-4 font-black text-neutral-500 hover:bg-neutral-800 disabled:opacity-50">
                          沒看 <span className="ml-1 text-xs font-bold text-neutral-600">D / →</span>
                        </button>
                      ) : (
                        <button type="button" onClick={() => optimistic.answerFast("NOT_SEEN")} className="rounded-2xl border border-neutral-800 px-5 py-4 font-black text-neutral-500 hover:bg-neutral-800">
                          沒看 <span className="ml-1 text-xs font-bold text-neutral-600">D / →</span>
                        </button>
                      )}
                    </div>
                  </Form>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-8 rounded-3xl border border-emerald-900/50 bg-emerald-950/20 p-8 text-center">
            <div className="text-3xl">✓</div>
            <h2 className="mt-3 text-2xl font-black">這一季盤點完成</h2>
            <p className="mt-2 text-sm text-neutral-500">可以回總覽挑下一季，或直接往下一季繼續。</p>
            <div className="mt-5 flex justify-center gap-2">
              <Link to="/anime" className="rounded-xl border border-neutral-700 px-4 py-2.5 text-sm font-bold">回總覽</Link>
              <Link to={surveyUrl(nextSeason.year, nextSeason.season)} className="rounded-xl bg-white px-4 py-2.5 text-sm font-black text-neutral-950">下一季</Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
