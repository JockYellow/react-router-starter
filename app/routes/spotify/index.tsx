import { useEffect, useMemo, useRef, useState } from "react";

import {
  applyGroupSelection,
  getPyramidTargets,
  getRoyaleProgress,
  isRoyaleState,
  type RoyaleState,
} from "../../lib/spotify-ranking";
import {
  fetchArtistPreview,
  fetchArtistsByIds,
  fetchLatestRelease,
  fetchStoredArtistIds,
  type LatestReleaseInfo,
  type SpotifyArtist,
} from "../../lib/spotify.client";

type SessionResponse = {
  status: "IDLE" | "ROUND_1" | "ROUND_2" | "ROUND_3" | "FINISHED";
  userId?: string;
  artistIds?: string[] | null;
  state?: RoyaleState | null;
  totalCount?: number;
  updatedAt?: number | null;
};

const DATASET_KEY = "default";
const TIER_ORDER = ["S", "A", "B", "C", "D", "E", "F"];
const TIER_COLORS: Record<string, string> = {
  S: "bg-emerald-500",
  A: "bg-lime-500",
  B: "bg-sky-500",
  C: "bg-amber-500",
  D: "bg-orange-500",
  E: "bg-rose-400",
  F: "bg-slate-400",
};

export default function SpotifyRankingPage() {
  const [sessionStatus, setSessionStatus] = useState<SessionResponse["status"]>("IDLE");
  const [pendingState, setPendingState] = useState<RoyaleState | null>(null);
  const [royaleState, setRoyaleState] = useState<RoyaleState | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [artistMap, setArtistMap] = useState<Record<string, SpotifyArtist>>({});
  const [latestReleaseMap, setLatestReleaseMap] = useState<Record<string, LatestReleaseInfo | null>>({});
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [allArtistIds, setAllArtistIds] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const applySessionData = (data: SessionResponse, options?: { resume?: boolean }) => {
    setSessionStatus(data.status ?? "IDLE");
    setAllArtistIds(data.artistIds ?? []);
    if (data.state && !isRoyaleState(data.state) && data.status !== "IDLE") {
      setActionMessage("偵測到舊版進度，請重新開始。");
      setRoyaleState(null);
      setPendingState(null);
      return;
    }
    if (data.state && isRoyaleState(data.state) && data.status !== "IDLE") {
      if (options?.resume) {
        setRoyaleState(data.state);
        setPendingState(null);
      } else {
        setPendingState(data.state);
      }
    } else {
      setPendingState(null);
      if (options?.resume) {
        setRoyaleState(null);
      }
    }
  };

  const fetchSession = async (options?: { resume?: boolean }) => {
    const res = await fetch(`/api/session/${DATASET_KEY}`);
    if (!res.ok) {
      throw new Error(`Session fetch failed: ${res.status}`);
    }
    const data = (await res.json()) as SessionResponse;
    applySessionData(data, options);
  };

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        await fetchSession();
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
  }, []);

  const resumeSession = () => {
    if (!pendingState) return;
    setRoyaleState(pendingState);
    setPendingState(null);
  };

  const startRoyale = async () => {
    if (royaleState || pendingState) {
      const ok = confirm("重新開始會清除目前進度，確定要繼續嗎？");
      if (!ok) return;
    }
    setIsFetching(true);
    setActionMessage(null);
    setSaveError(null);

    try {
      const ids = await fetchStoredArtistIds(DATASET_KEY);
      if (ids.length === 0) {
        setActionMessage("資料庫沒有歌手 ID，請先執行匯入腳本。");
        return;
      }

      const initRes = await fetch("/api/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: DATASET_KEY, artistIds: ids }),
      });

      const initData = (await initRes.json()) as { state?: RoyaleState; status?: SessionResponse["status"] };
      if (!initRes.ok || !initData.state) {
        throw new Error("初始化失敗");
      }

      setAllArtistIds(ids);
      setRoyaleState(initData.state);
      setSessionStatus(initData.status ?? "ROUND_1");
      setPendingState(null);
    } catch (err) {
      console.error(err);
      setActionMessage("初始化失敗，請稍後再試。");
    } finally {
      setIsFetching(false);
    }
  };

  const refreshSession = async () => {
    setIsRefreshing(true);
    setActionMessage(null);
    try {
      await fetchSession({ resume: true });
    } catch (err) {
      console.error(err);
      setActionMessage("重新載入進度失敗，請稍後再試。");
    } finally {
      setIsRefreshing(false);
    }
  };

  const saveRoyaleState = async (state: RoyaleState) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: DATASET_KEY, state }),
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

  const currentGroup = royaleState?.currentGroups[royaleState.currentIndex] ?? null;
  const currentGroupKey = currentGroup?.ids.join("|") ?? "";

  useEffect(() => {
    setSelectedIds([]);
    setSelectionError(null);
  }, [currentGroupKey]);

  const toggleSelect = (id: string) => {
    setSelectionError(null);
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 2) {
        setSelectionError("最多只能選 2 位歌手。");
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSubmitSelection = async () => {
    if (!royaleState || !currentGroup) return;
    if (selectedIds.length < 1 || selectedIds.length > 2) {
      setSelectionError("請選 1~2 位歌手再送出。");
      return;
    }
    setSaveError(null);
    const nextState = applyGroupSelection(royaleState, selectedIds);
    setRoyaleState(nextState);
    setSessionStatus(nextState.status);
    await saveRoyaleState(nextState);
  };

  const groupIds = currentGroup?.ids ?? [];

  useEffect(() => {
    if (groupIds.length === 0) return;
    const missingIds = groupIds.filter((id) => !artistMap[id]);
    if (missingIds.length === 0) return;

    let cancelled = false;

    const loadArtists = async () => {
      try {
        const artists = await fetchArtistsByIds(missingIds);
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
  }, [artistMap, groupIds]);

  useEffect(() => {
    if (groupIds.length === 0) return;
    const missingIds = groupIds.filter((id) => !(id in latestReleaseMap));
    if (missingIds.length === 0) return;

    let cancelled = false;

    const loadLatest = async () => {
      try {
        const results = await Promise.all(
          missingIds.map(async (id) => ({
            id,
            info: await fetchLatestRelease(id),
          })),
        );
        if (cancelled) return;
        setLatestReleaseMap((prev) => {
          const next = { ...prev };
          for (const item of results) {
            next[item.id] = item.info;
          }
          return next;
        });
      } catch (err) {
        console.error(err);
      }
    };

    loadLatest();

    return () => {
      cancelled = true;
    };
  }, [groupIds, latestReleaseMap]);

  const leaderboardIds = useMemo(() => {
    if (!royaleState) return [];
    return Object.values(royaleState.artists)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((artist) => artist.id);
  }, [royaleState]);

  const leaderboardMax = useMemo(() => {
    if (!royaleState || leaderboardIds.length === 0) return 1;
    return royaleState.artists[leaderboardIds[0]]?.score ?? 1;
  }, [leaderboardIds, royaleState]);

  useEffect(() => {
    if (leaderboardIds.length === 0) return;
    const missingIds = leaderboardIds.filter((id) => !artistMap[id]);
    if (missingIds.length === 0) return;

    let cancelled = false;

    const loadLeaderboard = async () => {
      try {
        const artists = await fetchArtistsByIds(missingIds);
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

    loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [artistMap, leaderboardIds]);

  useEffect(() => {
    if (!royaleState || royaleState.status !== "FINISHED") return;
    const allIds = [
      ...TIER_ORDER.flatMap((tier) => royaleState.tiers[tier] ?? []),
    ];
    const missingIds = allIds.filter((id) => !artistMap[id]);
    if (missingIds.length === 0) return;

    let cancelled = false;

    const loadAllArtists = async () => {
      for (let i = 0; i < missingIds.length; i += 50) {
        const batch = missingIds.slice(i, i + 50);
        try {
          const artists = await fetchArtistsByIds(batch);
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
  }, [artistMap, royaleState]);

  useEffect(() => {
    if (!royaleState || royaleState.status !== "FINISHED") return;
    const tierIds = TIER_ORDER.flatMap((tier) => royaleState.tiers[tier] ?? []);
    const missingIds = tierIds.filter((id) => !(id in latestReleaseMap));
    if (missingIds.length === 0) return;

    let cancelled = false;

    const loadReleases = async () => {
      const batchSize = 3;
      for (let i = 0; i < missingIds.length; i += batchSize) {
        const batch = missingIds.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (id) => {
            try {
              const info = await fetchLatestRelease(id);
              return { id, info };
            } catch (err) {
              console.error(err);
              return { id, info: null };
            }
          }),
        );
        if (cancelled) return;
        setLatestReleaseMap((prev) => {
          const next = { ...prev };
          for (const item of results) {
            next[item.id] = item.info;
          }
          return next;
        });
      }
    };

    loadReleases();

    return () => {
      cancelled = true;
    };
  }, [latestReleaseMap, royaleState]);

  const progress = royaleState ? getRoyaleProgress(royaleState) : null;
  const isRanking = royaleState && royaleState.status !== "FINISHED";
  const currentRoundIndex = useMemo(() => {
    if (!royaleState) return -1;
    if (royaleState.status === "ROUND_1") return 0;
    if (royaleState.status === "ROUND_2") return 1;
    if (royaleState.status === "ROUND_3") return 2;
    if (royaleState.status === "FINISHED") return 2;
    return -1;
  }, [royaleState]);

  const roundStats = useMemo(() => {
    const stats = [0, 1, 2].map((round) => ({
      round,
      counts: { 3: 0, 1: 0, 0: 0 },
      completed: 0,
      total: 0,
      percent: 0,
    }));
    if (!royaleState) return stats;

    const artistNodes = Object.values(royaleState.artists);
    const total = artistNodes.length;
    for (const artist of artistNodes) {
      const history = artist.matchHistory;
      stats.forEach((stat, index) => {
        const value = history[index];
        if (value === undefined) return;
        stat.completed += 1;
        if (value === 3) stat.counts[3] += 1;
        else if (value === 1) stat.counts[1] += 1;
        else stat.counts[0] += 1;
      });
    }

    for (const stat of stats) {
      stat.total = total;
      stat.percent = total ? Math.round((stat.completed / total) * 100) : 0;
    }
    return stats;
  }, [royaleState]);

  const totalArtistCount = useMemo(() => {
    if (allArtistIds.length) return allArtistIds.length;
    if (royaleState) return Object.keys(royaleState.artists).length;
    return 0;
  }, [allArtistIds, royaleState]);

  const groupsPerRound = useMemo(() => {
    if (!totalArtistCount) return 0;
    return Math.ceil(totalArtistCount / 4);
  }, [totalArtistCount]);

  const overallProgress = useMemo(() => {
    if (!royaleState || !groupsPerRound) return null;
    const status = royaleState.status;
    const completedRounds =
      status === "ROUND_1"
        ? 0
        : status === "ROUND_2"
          ? 1
          : status === "ROUND_3"
            ? 2
            : status === "FINISHED"
              ? 3
              : 0;
    const totalGroups = groupsPerRound * 3;
    const completedGroups =
      status === "FINISHED"
        ? totalGroups
        : Math.min(totalGroups, completedRounds * groupsPerRound + royaleState.currentIndex);
    const remainingGroups = Math.max(0, totalGroups - completedGroups);
    const percent = totalGroups ? Math.round((completedGroups / totalGroups) * 100) : 0;
    return { totalGroups, completedGroups, remainingGroups, percent, groupsPerRound };
  }, [groupsPerRound, royaleState]);

  const pyramidTargets = useMemo(() => {
    if (!totalArtistCount) return [];
    return getPyramidTargets(totalArtistCount);
  }, [totalArtistCount]);

  const roundSteps = useMemo(() => {
    const labels = ["R1 海選", "R2 晉級", "R3 決戰"];
    return labels.map((label, index) => {
      if (!royaleState) {
        return { label, state: "pending" as const };
      }
      const isDone = royaleState.status === "FINISHED" || currentRoundIndex > index;
      const isActive = royaleState.status !== "FINISHED" && currentRoundIndex === index;
      return { label, state: isDone ? "done" : isActive ? "active" : "pending" };
    });
  }, [currentRoundIndex, royaleState]);

  const actionLabel =
    selectedIds.length === 1
      ? "確認單選 (+3分) 🏆"
      : selectedIds.length === 2
        ? "確認雙選 (+1分) ⚖️"
        : "請先選 1~2 位";

  const playPreview = async (artistId: string) => {
    setPreviewStatus(null);

    try {
      const previewUrl = await fetchArtistPreview(artistId);
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_15%,_#d1fae5_0%,_transparent_45%),radial-gradient(circle_at_75%_20%,_#fef3c7_0%,_transparent_55%),linear-gradient(180deg,_#f8fafc_0%,_#f1f5f9_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <header className="relative overflow-hidden rounded-[28px] border border-emerald-100 bg-white/80 p-6 shadow-[0_24px_50px_rgba(15,23,42,0.08)]">
          <div className="absolute right-[-40px] top-[-40px] h-48 w-48 rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="absolute bottom-[-60px] left-[-40px] h-44 w-44 rounded-full bg-lime-200/40 blur-3xl" />
          <div className="relative z-10 space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Spotify Battle Royale
            </span>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">加權積分分級賽</h1>
            <p className="max-w-2xl text-sm text-slate-600 md:text-base">
              每組 4 人，每輪可選 1~2 位；累積三輪後依金字塔分級輸出 Tier List。
            </p>
          </div>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="rounded-[36px] border border-slate-200 bg-white/90 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold md:text-2xl">本輪對戰</h2>
                <p className="text-sm text-slate-500">選 1~2 位你最喜歡的歌手</p>
              </div>
            {royaleState && progress && progress.current !== undefined && progress.total !== undefined && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-slate-200 px-4 py-1 text-xs font-semibold text-slate-600">
                  {progress.label}
                </div>
                <div className="rounded-full border border-slate-200 px-4 py-1 text-xs font-semibold text-slate-600">
                    {progress.current}/{progress.total}
                  </div>
                </div>
              )}
            </div>

            {!royaleState && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {pendingState && (
                  <button
                    type="button"
                    onClick={resumeSession}
                    className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white"
                  >
                    繼續排位
                  </button>
                )}
                <button
                  type="button"
                  onClick={startRoyale}
                  disabled={isFetching}
                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  {isFetching ? "載入中..." : "從 DB 開始"}
                </button>
              </div>
            )}

            {!royaleState && (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center text-sm text-slate-500">
                準備就緒後，這裡會顯示 4 人對戰。
              </div>
            )}

            {isRanking && currentGroup && (
              <div className="mt-6">
                <div className="grid gap-4 md:grid-cols-2">
                  {currentGroup.ids.map((id) => (
                    <GroupArtistCard
                      key={id}
                      artist={artistMap[id]}
                      latestRelease={latestReleaseMap[id] ?? null}
                      selected={selectedIds.includes(id)}
                      onSelect={() => toggleSelect(id)}
                      onPreview={() => playPreview(id)}
                      disabled={isSaving}
                    />
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSubmitSelection}
                    disabled={selectedIds.length < 1 || selectedIds.length > 2 || isSaving}
                    className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-200/70 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {actionLabel}
                  </button>
                  <div className="text-xs text-slate-500">
                    已選 {selectedIds.length}/2 位
                  </div>
                </div>

                {selectionError && (
                  <p className="mt-3 text-xs text-rose-600">{selectionError}</p>
                )}
              </div>
            )}

            {royaleState && progress && (
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>本輪進度</span>
                  <span>{progress.percent}%</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-slate-900 transition-all"
                    style={{ width: `${progress.percent}%` }}
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
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">進度總覽</h3>
                <span className="text-xs text-slate-400">
                  {royaleState ? progress?.label ?? "進行中" : "尚未開始"}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {roundSteps.map((step) => {
                    const tone =
                      step.state === "done"
                        ? "bg-emerald-100 text-emerald-700"
                        : step.state === "active"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-500";
                    return (
                      <span
                        key={step.label}
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${tone}`}
                      >
                        {step.label}
                      </span>
                    );
                  })}
                </div>
                {!overallProgress && (
                  <p className="text-xs text-slate-400">尚未開始，啟動後顯示完整進度。</p>
                )}
                {overallProgress && (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                      <div className="flex items-center justify-between">
                        <span>總對戰組數</span>
                        <span>
                          {overallProgress.completedGroups}/{overallProgress.totalGroups}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-white">
                        <div
                          className="h-1.5 rounded-full bg-emerald-500"
                          style={{ width: `${overallProgress.percent}%` }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                        <span>每輪 {overallProgress.groupsPerRound} 組</span>
                        <span>剩餘 {overallProgress.remainingGroups} 組</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                      <span className="rounded-full bg-slate-100 px-3 py-1">
                        歌手 {totalArtistCount} 位
                      </span>
                      {royaleState?.status === "FINISHED" ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          排位完成
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          目前組別 {royaleState?.currentIndex + 1}/{royaleState?.currentGroups.length}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">目前排名</h3>
                <span className="text-xs text-slate-400">Top 12</span>
              </div>
              <div className="mt-4 space-y-2">
                {leaderboardIds.length === 0 && (
                  <p className="text-xs text-slate-400">尚無排名</p>
                )}
                {leaderboardIds.map((id, index) => (
                  <LeaderboardRow
                    key={id}
                    rank={index + 1}
                    artist={artistMap[id]}
                    score={royaleState?.artists[id]?.score ?? 0}
                    maxScore={leaderboardMax}
                    history={royaleState?.artists[id]?.matchHistory ?? []}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">每輪分數分布</h3>
                <span className="text-xs text-slate-400">+3 / +1 / 0</span>
              </div>
              {!royaleState && (
                <p className="mt-4 text-xs text-slate-400">尚未開始</p>
              )}
              {royaleState && (
                <div className="mt-4 space-y-4">
                  {roundStats.map((stat) => (
                    <div key={stat.round} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-3">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>第 {stat.round + 1} 輪</span>
                        <span>
                          {stat.completed}/{stat.total || allArtistIds.length}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
                        <div className="rounded-lg bg-emerald-50 px-2 py-1">+3 {stat.counts[3]}</div>
                        <div className="rounded-lg bg-sky-50 px-2 py-1">+1 {stat.counts[1]}</div>
                        <div className="rounded-lg bg-slate-100 px-2 py-1">0 {stat.counts[0]}</div>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-white">
                        <div
                          className="h-1.5 rounded-full bg-emerald-400"
                          style={{ width: `${stat.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">金字塔配置</h3>
                <span className="text-xs text-slate-400">
                  {totalArtistCount ? `共 ${totalArtistCount} 位` : "尚未載入"}
                </span>
              </div>
              {pyramidTargets.length === 0 ? (
                <p className="mt-4 text-xs text-slate-400">載入歌手後會顯示各層級人數。</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {pyramidTargets.map((tier) => {
                    const width = totalArtistCount
                      ? Math.max(6, Math.round((tier.count / totalArtistCount) * 100))
                      : 0;
                    const tone = TIER_COLORS[tier.label] ?? "bg-slate-400";
                    return (
                      <div key={tier.label} className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="w-6 font-semibold text-slate-600">{tier.label}</span>
                        <div className="h-2 flex-1 rounded-full bg-slate-100">
                          <div className={`h-2 rounded-full ${tone}`} style={{ width: `${width}%` }} />
                        </div>
                        <span className="w-10 text-right text-[11px] text-slate-400">{tier.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {royaleState?.status === "FINISHED" && (
          <section className="mt-8 space-y-4">
            <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/60 p-6 shadow-[0_24px_60px_rgba(16,185,129,0.15)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-emerald-900">Tier List 完成</h2>
                  <p className="text-sm text-emerald-800">共 {allArtistIds.length} 位歌手</p>
                </div>
                <button
                  type="button"
                  onClick={startRoyale}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
                >
                  再玩一次
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              {TIER_ORDER.map((tier) => (
                <TierGroup
                  key={tier}
                  tier={tier}
                  ids={royaleState.tiers[tier] ?? []}
                  artistMap={artistMap}
                  scoreMap={royaleState.artists}
                  releaseMap={latestReleaseMap}
                />
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">快速操作</h2>
              <p className="text-xs text-slate-500">不影響排位，只是輔助說明</p>
            </div>
            <span className="rounded-full border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-700">
              dataset: {DATASET_KEY}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {pendingState && (
              <button
                type="button"
                onClick={resumeSession}
                className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white"
              >
                繼續排位
              </button>
            )}
            <button
              type="button"
              onClick={refreshSession}
              disabled={isRefreshing}
              className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              {isRefreshing ? "更新中..." : "重新載入進度"}
            </button>
            <button
              type="button"
              onClick={startRoyale}
              disabled={isFetching}
              className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              {isFetching ? "載入中..." : "重新開始（清除進度）"}
            </button>
          </div>
          {actionMessage && (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              {actionMessage}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

type GroupArtistCardProps = {
  artist: SpotifyArtist | null;
  latestRelease?: LatestReleaseInfo | null;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  disabled?: boolean;
};

function GroupArtistCard({ artist, latestRelease, selected, onSelect, onPreview, disabled }: GroupArtistCardProps) {
  const spotifyUrl = artist?.external_urls?.spotify ?? (artist?.id ? `https://open.spotify.com/artist/${artist.id}` : null);
  const releaseLine =
    latestRelease?.date
      ? `最新作品${latestRelease.name ? ` ${latestRelease.name}` : ""} · ${latestRelease.date}`
      : null;

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!artist?.name) return;
    try {
      await navigator.clipboard.writeText(artist.name);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = () => {
    if (!artist?.name) return;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(artist.name)}`, "_blank");
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`flex h-full w-full flex-col gap-4 rounded-[28px] border p-5 text-left shadow-[0_14px_30px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 ${
        selected
          ? "border-emerald-400 bg-emerald-50/70 shadow-[0_20px_40px_rgba(16,185,129,0.2)]"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selected ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}>
          {selected ? "已選" : "點選"}
        </span>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!artist?.name}
            className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-600 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            複製名稱
          </button>
          {spotifyUrl ? (
            <a
              href={spotifyUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-600"
              onClick={(event) => event.stopPropagation()}
            >
              開啟 Spotify
            </a>
          ) : null}
        </div>
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
          <p className="select-text text-lg font-semibold text-slate-900">{artist?.name ?? "載入中..."}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            {artist?.followers?.total ? (
              <span className="rounded-full bg-slate-100 px-3 py-1">{artist.followers.total.toLocaleString()} 位追蹤者</span>
            ) : null}
            {artist?.popularity !== undefined ? (
              <span className="rounded-full bg-slate-100 px-3 py-1">人氣指數 {artist.popularity}</span>
            ) : null}
          </div>
          {artist?.genres?.length ? (
            <p className="mt-2 text-xs text-slate-400">{artist.genres.slice(0, 3).join(" · ")}</p>
          ) : null}
          {releaseLine ? <p className="mt-2 text-xs text-slate-500">{releaseLine}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            handleSearch();
          }}
          disabled={!artist?.name}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-600 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          Google 搜尋
        </button>
      </div>
    </button>
  );
}

type LeaderboardRowProps = {
  rank: number;
  artist?: SpotifyArtist;
  score: number;
  maxScore: number;
  history: number[];
};

function LeaderboardRow({ rank, artist, score, maxScore, history }: LeaderboardRowProps) {
  const percent = maxScore > 0 ? Math.max(8, Math.round((score / maxScore) * 100)) : 8;
  const roundBadges = [0, 1, 2].map((index) => {
    const value = history[index];
    const label = value === undefined ? "-" : `+${value}`;
    const tone =
      value === 3
        ? "bg-emerald-100 text-emerald-700"
        : value === 1
          ? "bg-sky-100 text-sky-700"
          : value === 0
            ? "bg-slate-200 text-slate-500"
            : "bg-slate-100 text-slate-400";
    return { key: `round-${index}`, text: `R${index + 1} ${label}`, tone };
  });
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>#{rank}</span>
        <span>{score.toFixed(2)} 分</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {artist?.images?.[0]?.url ? (
          <img src={artist.images[0].url} alt={artist.name} className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <div className="h-7 w-7 rounded-full bg-slate-200" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-700">{artist?.name ?? "載入中..."}</p>
          <div className="mt-1 h-1.5 w-full rounded-full bg-white">
            <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
            {roundBadges.map((badge) => (
              <span key={badge.key} className={`rounded-full px-2 py-0.5 ${badge.tone}`}>
                {badge.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type TierGroupProps = {
  tier: string;
  ids: string[];
  artistMap: Record<string, SpotifyArtist>;
  scoreMap: Record<string, { score: number }>;
  releaseMap: Record<string, LatestReleaseInfo | null>;
};

function TierGroup({ tier, ids, artistMap, scoreMap, releaseMap }: TierGroupProps) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Tier {tier}</h3>
        <span className="text-xs text-slate-400">{ids.length} 位</span>
      </div>
      {ids.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">尚未分配</p>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ids.map((id) => (
            <TierArtist
              key={id}
              artist={artistMap[id]}
              fallbackId={id}
              score={scoreMap[id]?.score}
              latestRelease={releaseMap[id] ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type TierArtistProps = {
  artist?: SpotifyArtist;
  fallbackId: string;
  score?: number;
  latestRelease?: LatestReleaseInfo | null;
};

function TierArtist({ artist, fallbackId, score, latestRelease }: TierArtistProps) {
  const releaseLine =
    latestRelease?.date
      ? `最新作品${latestRelease.name ? ` ${latestRelease.name}` : ""} · ${latestRelease.date}`
      : null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2">
      {artist?.images?.[0]?.url ? (
        <img
          src={artist.images[0].url}
          alt={artist.name}
          className="h-10 w-10 rounded-full object-cover"
        />
      ) : (
        <div className="h-10 w-10 rounded-full bg-slate-100" />
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800">{artist?.name ?? fallbackId}</p>
        {artist?.genres?.length ? (
          <p className="truncate text-xs text-slate-500">{artist.genres.slice(0, 2).join(" · ")}</p>
        ) : null}
        {score !== undefined ? (
          <p className="text-[11px] text-slate-400">總分 {score.toFixed(2)}</p>
        ) : null}
        {releaseLine ? (
          <p className="truncate text-[11px] text-slate-400">{releaseLine}</p>
        ) : null}
      </div>
    </div>
  );
}
