import { useState } from "react";
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
import { getAnimeLibraryDetail } from "../../features/anime/anime-detail.server";
import {
  normalizeAnimeRecordEdit,
  sanitizeAnimeLibraryReturnTo,
} from "../../features/anime/anime-record-edit";
import { saveAnimeRecordEdit } from "../../features/anime/anime-record-edit.server";
import {
  ANIME_EVALUATIONS,
  ANIME_EVALUATION_TAGS,
  type AnimePrimaryStatus,
  type AnimeSeason,
  type AnimeWatchDetail,
} from "../../features/anime/anime.types";
import { requireBlogDb } from "../../lib/d1.server";

const STATUS_OPTIONS: ReadonlyArray<{ value: AnimePrimaryStatus; label: string; hint: string }> = [
  { value: "SEEN", label: "看過", hint: "保留觀看進度、評價、標籤與筆記" },
  { value: "WANT", label: "想看", hint: "加入想看清單，會清除既有 Seen 評價" },
  { value: "NOT_SEEN", label: "沒看", hint: "標記為尚未看過，會清除既有 Seen 評價" },
];

const WATCH_DETAIL_OPTIONS: ReadonlyArray<{ value: AnimeWatchDetail; label: string }> = [
  { value: "COMPLETE", label: "看完" },
  { value: "SEASON_COMPLETE", label: "看完一季／系列未追完" },
  { value: "PARTIAL", label: "看過部分" },
  { value: "DROPPED", label: "棄番" },
  { value: "MOVIE_ONLY", label: "只看電影／特別篇" },
];

const SEASON_LABELS: Record<AnimeSeason, string> = {
  WINTER: "冬",
  SPRING: "春",
  SUMMER: "夏",
  FALL: "秋",
};

function parseAnimeId(value: string | undefined): number {
  const animeId = Number(value);
  if (!Number.isInteger(animeId) || animeId <= 0) {
    throw new Response("Invalid anime id", { status: 400 });
  }
  return animeId;
}

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  await requireAdmin(request, context);
  const animeId = parseAnimeId(params.animeId);
  const detail = await getAnimeLibraryDetail(requireBlogDb(context), animeId);
  if (!detail) throw new Response("Anime record not found", { status: 404 });

  const url = new URL(request.url);
  return {
    detail,
    returnTo: sanitizeAnimeLibraryReturnTo(url.searchParams.get("returnTo")),
    saved: url.searchParams.get("saved") === "1",
  };
}

export async function action({ request, context, params }: ActionFunctionArgs) {
  await requireAdmin(request, context);
  const animeId = parseAnimeId(params.animeId);
  const db = requireBlogDb(context);
  const existing = await getAnimeLibraryDetail(db, animeId);
  if (!existing) throw new Response("Anime record not found", { status: 404 });

  const formData = await request.formData();
  if (String(formData.get("intent") ?? "") !== "save-record") {
    throw new Response("Invalid action", { status: 400 });
  }

  let edit;
  try {
    edit = normalizeAnimeRecordEdit({
      status: String(formData.get("status") ?? ""),
      detailStatus: String(formData.get("detailStatus") ?? ""),
      rating: String(formData.get("rating") ?? ""),
      tags: formData.getAll("tags").map(String),
      note: String(formData.get("note") ?? ""),
    });
  } catch (error) {
    throw new Response(error instanceof Error ? error.message : "Invalid Anime record", { status: 400 });
  }

  await saveAnimeRecordEdit(db, animeId, edit);
  const returnTo = sanitizeAnimeLibraryReturnTo(String(formData.get("returnTo") ?? ""));
  const next = new URLSearchParams({ saved: "1", returnTo });
  return redirect(`/anime/library/${animeId}?${next.toString()}`);
}

export default function AnimeLibraryDetailRoute() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [selectedStatus, setSelectedStatus] = useState<AnimePrimaryStatus>(
    data.detail.record.status ?? "SEEN",
  );
  const saving = navigation.state !== "idle";
  const detail = data.detail;

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={data.returnTo}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold hover:border-neutral-300"
          >
            ← 返回 Library
          </Link>
          <Link to="/anime" className="px-2 py-2 text-sm font-bold text-neutral-500 hover:text-neutral-900">
            盤點總覽
          </Link>
        </div>

        {data.saved ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            已儲存這部作品的個人紀錄。
          </div>
        ) : null}

        <header className="mt-7 grid gap-5 sm:grid-cols-[140px_1fr] sm:items-end">
          <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-sm">
            {detail.coverUrl ? (
              <img src={detail.coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-center text-xs font-bold text-neutral-400">
                沒有海報
              </div>
            )}
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Personal record</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">{detail.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold text-neutral-500">
              {detail.year ? <span>{detail.year}</span> : null}
              {detail.season ? <span>{SEASON_LABELS[detail.season]}</span> : null}
              {detail.format ? <span>{detail.format}</span> : null}
              {detail.episodes != null ? <span>{detail.episodes} 話</span> : null}
            </div>
            <div className="mt-2 text-xs text-neutral-400">
              最近更新：{new Date(detail.updatedAt).toLocaleString("zh-TW")}
            </div>
          </div>
        </header>

        <section className="mt-8 rounded-3xl border border-neutral-200 bg-white p-5 md:p-7">
          <div>
            <h2 className="text-xl font-black">我的紀錄</h2>
            <p className="mt-1 text-sm text-neutral-500">這裡是主要資料；下方作品資訊只作為外部 metadata 參考。</p>
          </div>

          <Form method="post" className="mt-6">
            <input type="hidden" name="intent" value="save-record" />
            <input type="hidden" name="returnTo" value={data.returnTo} />

            <fieldset>
              <legend className="text-sm font-black">觀看狀態</legend>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {STATUS_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="cursor-pointer rounded-2xl border border-neutral-200 p-4 has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-50"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="status"
                        value={option.value}
                        defaultChecked={detail.record.status === option.value}
                        onChange={() => setSelectedStatus(option.value)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block font-black">{option.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-neutral-500">{option.hint}</span>
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>

            {selectedStatus === "SEEN" ? (
              <div className="mt-7 space-y-7 border-t border-neutral-200 pt-7">
                <label className="block">
                  <span className="text-sm font-black">看到哪裡</span>
                  <select
                    name="detailStatus"
                    defaultValue={detail.record.detailStatus ?? ""}
                    className="mt-2 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm outline-none focus:border-neutral-400"
                  >
                    <option value="">尚未設定</option>
                    {WATCH_DETAIL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <fieldset>
                  <legend className="text-sm font-black">整體評價</legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="cursor-pointer rounded-full border border-neutral-200 px-3 py-2 text-xs font-bold has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white">
                      <input
                        className="sr-only"
                        type="radio"
                        name="rating"
                        value=""
                        defaultChecked={!detail.record.rating}
                      />
                      尚未評價
                    </label>
                    {ANIME_EVALUATIONS.map((evaluation) => (
                      <label
                        key={evaluation.key}
                        className="cursor-pointer rounded-full border border-neutral-200 px-3 py-2 text-xs font-bold has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white"
                      >
                        <input
                          className="sr-only"
                          type="radio"
                          name="rating"
                          value={evaluation.key}
                          defaultChecked={detail.record.rating === evaluation.key}
                        />
                        {evaluation.label}
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-neutral-400">設定評價前必須先填「看到哪裡」；也可以暫時維持尚未評價。</p>
                </fieldset>

                <fieldset>
                  <legend className="text-sm font-black">印象標籤</legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ANIME_EVALUATION_TAGS.map((tag) => (
                      <label
                        key={tag.key}
                        className="cursor-pointer rounded-full border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-600 has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white"
                      >
                        <input
                          className="sr-only"
                          type="checkbox"
                          name="tags"
                          value={tag.key}
                          defaultChecked={detail.record.tags.includes(tag.key)}
                        />
                        {tag.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="block">
                  <span className="text-sm font-black">筆記</span>
                  <textarea
                    name="note"
                    rows={5}
                    maxLength={4000}
                    defaultValue={detail.record.note ?? ""}
                    placeholder="可留空；最多 4000 字。"
                    className="mt-2 w-full resize-y rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 outline-none focus:border-neutral-400 focus:bg-white"
                  />
                </label>
              </div>
            ) : (
              <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                儲存後會移除這部作品原本的 Seen 詳細狀態、評價、標籤與筆記。
              </div>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-5">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-black text-white hover:bg-neutral-700 disabled:cursor-wait disabled:opacity-50"
              >
                {saving ? "儲存中…" : "儲存變更"}
              </button>
              <Link to={data.returnTo} className="px-3 py-2.5 text-sm font-bold text-neutral-500 hover:text-neutral-900">
                取消
              </Link>
            </div>
          </Form>
        </section>

        <section className="mt-6 rounded-3xl border border-neutral-200 bg-white p-5 md:p-7">
          <h2 className="text-xl font-black">作品資訊</h2>
          <p className="mt-1 text-sm text-neutral-500">外部來源 metadata；不會覆蓋上面的個人紀錄。</p>

          <dl className="mt-5 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
            {detail.titleZhTw ? <><dt className="font-bold text-neutral-400">繁中標題</dt><dd>{detail.titleZhTw}</dd></> : null}
            {detail.titleNative ? <><dt className="font-bold text-neutral-400">原文標題</dt><dd>{detail.titleNative}</dd></> : null}
            {detail.titleRomaji ? <><dt className="font-bold text-neutral-400">羅馬字</dt><dd>{detail.titleRomaji}</dd></> : null}
            {detail.titleEnglish ? <><dt className="font-bold text-neutral-400">英文標題</dt><dd>{detail.titleEnglish}</dd></> : null}
            {detail.studio ? <><dt className="font-bold text-neutral-400">Studio</dt><dd>{detail.studio}</dd></> : null}
            <dt className="font-bold text-neutral-400">Metadata source</dt><dd>{detail.metadataSource}</dd>
            {detail.bangumiId ? <><dt className="font-bold text-neutral-400">Bangumi ID</dt><dd>{detail.bangumiId}</dd></> : null}
            {detail.anilistId ? <><dt className="font-bold text-neutral-400">AniList ID</dt><dd>{detail.anilistId}</dd></> : null}
            {detail.malId ? <><dt className="font-bold text-neutral-400">MAL ID</dt><dd>{detail.malId}</dd></> : null}
          </dl>

          {detail.genres.length ? (
            <div className="mt-6 border-t border-neutral-200 pt-5">
              <div className="text-xs font-black uppercase tracking-wide text-neutral-400">Genres</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {detail.genres.map((genre) => (
                  <span key={genre} className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-600">{genre}</span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
