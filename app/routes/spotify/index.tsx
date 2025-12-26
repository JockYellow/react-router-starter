import { useEffect, useMemo, useRef, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import {
  applyChoice,
  getCurrentPairIds,
  getMergeProgress,
  getRankedIds,
  type MergeChoice,
  type MergeState,
} from "../../lib/spotify-ranking";
import {
  fetchAllFollowedArtists,
  fetchArtistPreview,
  fetchArtistsByIds,
  fetchSpotifyProfile,
  type FollowedArtistsProgress,
  type SpotifyArtist,
  type SpotifyProfile,
} from "../../lib/spotify.client";
import { getSpotifyEnv } from "../../lib/spotify.server";

type LoaderData = {
  clientId: string;
  redirectUri: string;
};

type AuthState = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
};

type SessionResponse = {
  status: "IDLE" | "PLAYING" | "FINISHED";
  userId?: string;
  artistIds?: string[] | null;
  state?: MergeState | null;
  totalCount?: number;
  updatedAt?: number | null;
};

const AUTH_STORAGE_KEY = "spotify_auth";
const SPOTIFY_SCOPE = "user-follow-read";

export async function loader({ request, context }: LoaderFunctionArgs): Promise<LoaderData> {
  const { clientId, redirectUri } = getSpotifyEnv(context, request.url, { requireSecrets: false });
  return { clientId, redirectUri };
}

export default function SpotifyRankingPage() {
  const { clientId, redirectUri } = useLoaderData<typeof loader>();
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionResponse["status"]>("IDLE");
  const [pendingState, setPendingState] = useState<MergeState | null>(null);
  const [mergeState, setMergeState] = useState<MergeState | null>(null);
  const [fetchProgress, setFetchProgress] = useState<FollowedArtistsProgress | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [artistMap, setArtistMap] = useState<Record<string, SpotifyArtist>>({});
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [allArtistIds, setAllArtistIds] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as AuthState;
      if (parsed?.accessToken) {
        setAuthState(parsed);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (!authState?.accessToken) return;
    if (authState.expiresAt && Date.now() > authState.expiresAt - 60_000) {
      setAuthError("Spotify 授權已過期，請重新登入。");
      setAuthState(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
  }, [authState]);

  useEffect(() => {
    if (!authState?.accessToken) return;
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const info = await fetchSpotifyProfile(authState.accessToken);
        if (!cancelled) {
          setProfile(info);
          setAuthError(null);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setAuthError("無法讀取 Spotify 使用者資料，請重新登入。 ");
          setAuthState(null);
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [authState?.accessToken]);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;

    const loadSession = async () => {
      try {
        const res = await fetch(`/api/session/${profile.id}`);
        if (!res.ok) {
          throw new Error(`Session fetch failed: ${res.status}`);
        }
        const data = (await res.json()) as SessionResponse;
        if (cancelled) return;
        setSessionStatus(data.status ?? "IDLE");
        setAllArtistIds(data.artistIds ?? []);
        if (data.state && data.status !== "IDLE") {
          setPendingState(data.state);
        } else {
          setPendingState(null);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setActionMessage("無法讀取儲存進度，請稍後再試。");
        }
      }
    };

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const authUrl = useMemo(() => {
    if (!clientId) return "#";
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: SPOTIFY_SCOPE,
      show_dialog: "true",
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }, [clientId, redirectUri]);

  const clearAuth = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    setAuthState(null);
    setProfile(null);
    setPendingState(null);
    setMergeState(null);
    setSessionStatus("IDLE");
    setActionMessage(null);
  };

  const startNewSession = async () => {
    if (!authState?.accessToken || !profile?.id) return;
    setIsFetching(true);
    setActionMessage(null);
    setFetchProgress(null);
    setSaveError(null);

    try {
      const { ids } = await fetchAllFollowedArtists(authState.accessToken, (progress) => {
        setFetchProgress(progress);
      });

      if (ids.length === 0) {
        setActionMessage("你目前沒有關注任何歌手，請先在 Spotify 追蹤一些藝人。");
        setIsFetching(false);
        return;
      }

      const initRes = await fetch("/api/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id, artistIds: ids }),
      });

      const initData = (await initRes.json()) as { state?: MergeState; status?: SessionResponse["status"] };
      if (!initRes.ok || !initData.state) {
        throw new Error("初始化失敗");
      }

      setAllArtistIds(ids);
      setMergeState(initData.state);
      setSessionStatus(initData.status ?? "PLAYING");
      setPendingState(null);
    } catch (err) {
      console.error(err);
      setActionMessage("初始化失敗，請稍後再試。");
    } finally {
      setIsFetching(false);
    }
  };

  const resumeSession = () => {
    if (!pendingState) return;
    setMergeState(pendingState);
    setPendingState(null);
  };

  const handleChoice = async (choice: MergeChoice) => {
    if (!mergeState || !profile?.id) return;
    setSaveError(null);
    const nextState = applyChoice(mergeState, choice);
    setMergeState(nextState);
    setSessionStatus(nextState.status);
    setIsSaving(true);

    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id, state: nextState }),
      });

      if (!res.ok) {
        throw new Error("Save failed");
      }
    } catch (err) {
      console.error(err);
      setSaveError("進度儲存失敗，請確認網路連線。");
    } finally {
      setIsSaving(false);
    }
  };

  const currentPairIds = useMemo(() => {
    if (!mergeState) return null;
    return getCurrentPairIds(mergeState);
  }, [mergeState]);

  useEffect(() => {
    if (!currentPairIds || !authState?.accessToken) return;
    const missingIds = currentPairIds.filter((id) => !artistMap[id]);
    if (missingIds.length === 0) return;

    let cancelled = false;

    const loadArtists = async () => {
      try {
        const artists = await fetchArtistsByIds(authState.accessToken, missingIds);
        if (cancelled) return;
        setArtistMap((prev) => {
          const next = { ...prev };
          for (const artist of artists) {
            next[artist.id] = artist;
          }
          return next;
        });
      } catch (err) {
        console.error(err);
      }
    };

    loadArtists();

    return () => {
      cancelled = true;
    };
  }, [authState?.accessToken, artistMap, currentPairIds]);

  useEffect(() => {
    if (!mergeState || mergeState.status !== "FINISHED" || !authState?.accessToken) return;
    const rankedIds = getRankedIds(mergeState);
    const missingIds = rankedIds.filter((id) => !artistMap[id]);
    if (missingIds.length === 0) return;

    let cancelled = false;

    const loadAllArtists = async () => {
      for (let i = 0; i < missingIds.length; i += 50) {
        const batch = missingIds.slice(i, i + 50);
        try {
          const artists = await fetchArtistsByIds(authState.accessToken, batch);
          if (cancelled) return;
          setArtistMap((prev) => {
            const next = { ...prev };
            for (const artist of artists) {
              next[artist.id] = artist;
            }
            return next;
          });
        } catch (err) {
          console.error(err);
        }
      }
    };

    loadAllArtists();

    return () => {
      cancelled = true;
    };
  }, [authState?.accessToken, artistMap, mergeState]);

  const leftArtist = currentPairIds ? artistMap[currentPairIds[0]] : null;
  const rightArtist = currentPairIds ? artistMap[currentPairIds[1]] : null;

  const mergedProgress = mergeState ? getMergeProgress(mergeState) : null;
  const rankedIds = mergeState?.status === "FINISHED" ? getRankedIds(mergeState) : [];
  const isRanking = mergeState && mergeState.status === "PLAYING";

  const playPreview = async (artistId: string) => {
    if (!authState?.accessToken) return;
    setPreviewStatus(null);

    try {
      const previewUrl = await fetchArtistPreview(authState.accessToken, artistId);
      if (!previewUrl) {
        setPreviewStatus("沒有可用的試聽片段。");
        return;
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(previewUrl);
      audioRef.current = audio;
      await audio.play();
    } catch (err) {
      console.error(err);
      setPreviewStatus("試聽播放失敗。");
    }
  };

  const displayName = profile?.display_name ?? "Spotify 使用者";
  const totalArtists = mergeState?.totalCount ?? allArtistIds.length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_15%,_#d1fae5_0%,_transparent_45%),radial-gradient(circle_at_75%_20%,_#fef3c7_0%,_transparent_55%),linear-gradient(180deg,_#f8fafc_0%,_#f1f5f9_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <header className="relative overflow-hidden rounded-[32px] border border-emerald-100 bg-white/80 p-8 shadow-[0_28px_60px_rgba(15,23,42,0.08)]">
          <div className="absolute right-[-40px] top-[-40px] h-48 w-48 rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="absolute bottom-[-60px] left-[-40px] h-44 w-44 rounded-full bg-lime-200/40 blur-3xl" />
          <div className="relative z-10 space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Spotify Ranking Lab
            </span>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">全關注歌手排位賽</h1>
            <p className="max-w-2xl text-sm text-slate-600 md:text-base">
              連結 Spotify 後一次抓取所有關注歌手，透過兩兩對決完成你的終極排名。每一步都會自動儲存，手機也能續玩。
            </p>
          </div>
        </header>

        <section className="mt-10 grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_22px_50px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">帳號狀態</h2>
                <p className="text-sm text-slate-500">連結 Spotify 才能開始排位賽</p>
              </div>
              {authState && (
                <button
                  type="button"
                  onClick={clearAuth}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:border-slate-300"
                >
                  登出
                </button>
              )}
            </div>

            <div className="mt-6 space-y-4">
              {!clientId && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  尚未設定 Spotify Client ID，請在 wrangler.json 加入 SPOTIFY_CLIENT_ID。
                </div>
              )}

              {authError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {authError}
                </div>
              )}

              {authState ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4">
                  <p className="text-sm text-emerald-800">已登入：{displayName}</p>
                  <p className="mt-1 text-xs text-emerald-700">Token 會自動過期，請在需要時重新登入。</p>
                </div>
              ) : (
                <a
                  href={authUrl}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200/60 transition hover:-translate-y-0.5 hover:bg-emerald-600"
                >
                  連結 Spotify 帳號
                </a>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_22px_50px_rgba(15,23,42,0.06)]">
            <h2 className="text-lg font-semibold">進度與操作</h2>
            <p className="text-sm text-slate-500">抓取歌手清單、恢復或重置進度</p>

            <div className="mt-6 space-y-4">
              {!authState && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  請先登入 Spotify 才能開始。
                </div>
              )}

              {authState && pendingState && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-4">
                  <p className="text-sm font-semibold text-emerald-800">找到儲存的進度</p>
                  <p className="mt-1 text-xs text-emerald-700">上次停在第 {pendingState.comparisonCount} 次比較。</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={resumeSession}
                      className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white"
                    >
                      繼續排位
                    </button>
                    <button
                      type="button"
                      onClick={startNewSession}
                      className="rounded-full border border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-700"
                    >
                      重新開始
                    </button>
                  </div>
                </div>
              )}

              {authState && !pendingState && !mergeState && (
                <button
                  type="button"
                  onClick={startNewSession}
                  disabled={isFetching}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-200/70 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isFetching ? "抓取中..." : "開始新的排位賽"}
                </button>
              )}

              {mergeState && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-700">目前狀態：{sessionStatus}</p>
                  <p className="mt-1 text-xs text-slate-500">總歌手數：{totalArtists || "-"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={startNewSession}
                      className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600"
                    >
                      重新抓取
                    </button>
                  </div>
                </div>
              )}

              {fetchProgress && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-4">
                  <p className="text-sm font-semibold text-emerald-800">已讀取 {fetchProgress.count} 位歌手...</p>
                  <div className="mt-3 h-2 w-full rounded-full bg-emerald-100">
                    <div
                      className="h-2 rounded-full bg-emerald-500 transition-all"
                      style={{
                        width: `${fetchProgress.total ? Math.min(100, (fetchProgress.count / fetchProgress.total) * 100) : 40}%`,
                      }}
                    />
                  </div>
                  {fetchProgress.total && (
                    <p className="mt-2 text-xs text-emerald-700">預估總數：{fetchProgress.total} 位</p>
                  )}
                </div>
              )}

              {actionMessage && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {actionMessage}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">對決區</h2>
              <p className="text-sm text-slate-500">點選你更喜歡的歌手卡片</p>
            </div>
            {mergeState && (
              <div className="rounded-full border border-slate-200 px-4 py-1 text-xs font-semibold text-slate-600">
                比較次數 {mergeState.comparisonCount}
              </div>
            )}
          </div>

          {!mergeState && (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
              準備就緒後，這裡會顯示兩位歌手的對決卡片。
            </div>
          )}

          {isRanking && currentPairIds && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <ArtistCard
                artist={leftArtist}
                label="A"
                onSelect={() => handleChoice("left")}
                onPreview={() => playPreview(currentPairIds[0])}
                disabled={isSaving}
              />
              <ArtistCard
                artist={rightArtist}
                label="B"
                onSelect={() => handleChoice("right")}
                onPreview={() => playPreview(currentPairIds[1])}
                disabled={isSaving}
              />
            </div>
          )}

          {mergeState && mergedProgress && (
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>合併進度</span>
                <span>{mergedProgress.mergedCount}/{mergedProgress.total}</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-slate-900 transition-all"
                  style={{ width: `${mergedProgress.percent}%` }}
                />
              </div>
              {isSaving && (
                <p className="mt-2 text-xs text-slate-500">進度自動儲存中...</p>
              )}
              {saveError && (
                <p className="mt-2 text-xs text-rose-600">{saveError}</p>
              )}
              {previewStatus && (
                <p className="mt-2 text-xs text-amber-600">{previewStatus}</p>
              )}
            </div>
          )}
        </section>

        {mergeState?.status === "FINISHED" && (
          <section className="mt-10 rounded-[32px] border border-emerald-100 bg-emerald-50/60 p-6 shadow-[0_24px_60px_rgba(16,185,129,0.15)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-emerald-900">最終排名完成</h2>
                <p className="text-sm text-emerald-800">共 {rankedIds.length} 位歌手</p>
              </div>
              <button
                type="button"
                onClick={startNewSession}
                className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
              >
                再玩一次
              </button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {rankedIds.map((id, index) => {
                const artist = artistMap[id];
                return (
                  <div key={id} className="flex items-center gap-3 rounded-2xl bg-white/80 p-3 shadow-sm">
                    <div className="text-xs font-semibold text-emerald-600">#{index + 1}</div>
                    {artist?.images?.[0]?.url ? (
                      <img
                        src={artist.images[0].url}
                        alt={artist.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-emerald-100" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {artist?.name ?? id}
                      </p>
                      {artist?.genres?.length ? (
                        <p className="truncate text-xs text-slate-500">{artist.genres.slice(0, 2).join(" · ")}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

type ArtistCardProps = {
  artist: SpotifyArtist | null;
  label: string;
  onSelect: () => void;
  onPreview: () => void;
  disabled?: boolean;
};

function ArtistCard({ artist, label, onSelect, onPreview, disabled }: ArtistCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="group flex h-full flex-col items-start gap-4 rounded-[28px] border border-slate-200 bg-white p-5 text-left shadow-[0_14px_30px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_20px_45px_rgba(16,185,129,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="flex w-full items-center justify-between">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">選項 {label}</span>
        <span className="text-xs text-slate-400">點選卡片投票</span>
      </div>
      <div className="flex w-full items-center gap-4">
        {artist?.images?.[0]?.url ? (
          <img
            src={artist.images[0].url}
            alt={artist.name}
            className="h-20 w-20 rounded-[20px] object-cover"
          />
        ) : (
          <div className="h-20 w-20 rounded-[20px] bg-slate-100" />
        )}
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-slate-900">
            {artist?.name ?? "載入中..."}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {artist?.followers?.total ? `${artist.followers.total.toLocaleString()} 位追蹤者` : ""}
          </p>
          {artist?.genres?.length ? (
            <p className="mt-1 truncate text-xs text-slate-400">{artist.genres.slice(0, 2).join(" · ")}</p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onPreview();
        }}
        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-600"
      >
        試聽片段
      </button>
    </button>
  );
}
