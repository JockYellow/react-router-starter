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
import {
  getAnimePersonalRecord,
  savePrimaryDecision,
  saveSeenEvaluation,
} from "../../features/anime/anime-record.server";
import {
  ensureSurveyScopeCandidates,
  getNextUnresolvedSurveyCandidate,
  refreshSurveyProgress,
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

function surveyUrl(year: number, season: AnimeSeason) {
  return `/anime/survey?year=${year}&season=${season}`;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireAdmin(request, context);
  const db = requireBlogDb(context);
  const scope = parseScope(new URL(request.url));

  try {
    const initialSummary = await ensureSurveyScopeCandidates(db, scope, { limit: 100 });
    const summary = (await refreshSurveyProgress(db, scope)) ?? initialSummary;
    const candidate = await getNextUnresolvedSurveyCandidate(db, scope);
    const record = candidate ? await getAnimePersonalRecord(db, candidate.anilistId) : null;
    return { scope, summary, candidate, record, error: null as string | null };
  } catch {
    return {
      scope,
      summary: null,
      candidate: null,
      record: null,
      error: "這一季的候選資料目前載入失敗，可以稍後重新整理再試。",
    };
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  await requireAdmin(request, context);
  const db = requireBlogDb(context);
  const formData = await request.formData();
  const scope = parseScopeFromForm(formData);
  const anilistId = Number(formData.get("anilistId"));
  if (!Number.isInteger(anilistId) || anilistId <= 0) {
    throw new Response("Invalid anime id", { status: 400 });
  }

  const intent = String(formData.get("intent") ?? "");

  if (intent === "primary") {
    const status = String(formData.get("status") ?? "") as AnimePrimaryStatus;
    if (status !== "SEEN" && status !== "WANT" && status !== "NOT_SEEN") {
      throw new Response("Invalid primary decision", { status: 400 });
    }
    await savePrimaryDecision(db, anilistId, status);
    await refreshSurveyProgress(db, scope);
    return redirect(surveyUrl(scope.year, scope.season));
  }

  if (intent === "seen-evaluation") {
    const detailStatus = String(formData.get("detailStatus") ?? "") as AnimeWatchDetail;
    const rating = String(formData.get("rating") ?? "") as AnimeEvaluationKey;
    const tags = formData.getAll("tags").map(String);
    const note = String(formData.get("note") ?? "");

    await saveSeenEvaluation(db, {
      anilistId,
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

function alternateTitles(candidate: NonNullable<Awaited<ReturnType<typeof loader>>["candidate"]>) {
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
  const previous = adjacentSeason(data.scope.year, data.scope.season, -1);
  const next = adjacentSeason(data.scope.year, data.scope.season, 1);
  const candidate = data.candidate;
  const record = data.record;
  const progress = data.summary && data.summary.candidateCount > 0
    ? Math.min(100, (data.summary.processedCount / data.summary.candidateCount) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-6 text-neutral-100 md:py-10">
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
            <Link to={surveyUrl(previous.year, previous.season)} className="rounded-xl px-3 py-2 text-sm font-bold text-neutral-400 hover:bg-neutral-900">上一季</Link>
            <Link to={surveyUrl(next.year, next.season)} className="rounded-xl px-3 py-2 text-sm font-bold text-neutral-400 hover:bg-neutral-900">下一季</Link>
          </div>
        </header>

        {data.summary ? (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-bold text-neutral-500">
              <span>{data.summary.processedCount} / {data.summary.candidateCount}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
            </div>
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
        ) : candidate ? (
          <section className="mt-7 overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-900 shadow-2xl">
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
                  <span>第 {candidate.position} 部</span>
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
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black">你看過這部</div>
                        <div className="mt-1 text-xs text-neutral-500">補完觀看狀態與總評後，這題才會算完成。</div>
                      </div>
                      <Form method="post">
                        <input type="hidden" name="intent" value="primary" />
                        <input type="hidden" name="year" value={data.scope.year} />
                        <input type="hidden" name="season" value={data.scope.season} />
                        <input type="hidden" name="anilistId" value={candidate.anilistId} />
                        <button name="status" value="NOT_SEEN" disabled={submitting} className="text-xs font-bold text-neutral-500 hover:text-neutral-300">
                          改成沒看
                        </button>
                      </Form>
                    </div>

                    <Form method="post" className="space-y-6">
                      <input type="hidden" name="intent" value="seen-evaluation" />
                      <input type="hidden" name="year" value={data.scope.year} />
                      <input type="hidden" name="season" value={data.scope.season} />
                      <input type="hidden" name="anilistId" value={candidate.anilistId} />

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

                      <details className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4">
                        <summary className="cursor-pointer text-sm font-bold text-neutral-400">還想多留一句話</summary>
                        <textarea
                          name="note"
                          defaultValue={record.note ?? ""}
                          rows={3}
                          maxLength={4000}
                          placeholder="完全可以不寫。只在真的有什麼想留下時再寫。"
                          className="mt-3 w-full resize-y rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-sm outline-none focus:border-neutral-400"
                        />
                      </details>

                      <button disabled={submitting} className="w-full rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-neutral-950 disabled:opacity-50">
                        {submitting ? "儲存中…" : "儲存並下一部"}
                      </button>
                    </Form>
                  </div>
                ) : (
                  <Form method="post" className="mt-8">
                    <input type="hidden" name="intent" value="primary" />
                    <input type="hidden" name="year" value={data.scope.year} />
                    <input type="hidden" name="season" value={data.scope.season} />
                    <input type="hidden" name="anilistId" value={candidate.anilistId} />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <button disabled={submitting} name="status" value="SEEN" className="rounded-2xl bg-white px-5 py-4 font-black text-neutral-950 disabled:opacity-50">
                        看過
                      </button>
                      <button disabled={submitting} name="status" value="WANT" className="rounded-2xl border border-neutral-600 px-5 py-4 font-black text-neutral-100 hover:bg-neutral-800 disabled:opacity-50">
                        想看
                      </button>
                      <button disabled={submitting} name="status" value="NOT_SEEN" className="rounded-2xl border border-neutral-800 px-5 py-4 font-black text-neutral-500 hover:bg-neutral-800 disabled:opacity-50">
                        沒看
                      </button>
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
              <Link to={surveyUrl(next.year, next.season)} className="rounded-xl bg-white px-4 py-2.5 text-sm font-black text-neutral-950">下一季</Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
