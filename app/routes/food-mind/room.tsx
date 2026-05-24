import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Check, Copy, Loader2, Lock, Send, UserRoundCheck, Users } from "lucide-react";

import { FOOD_MIND_FIXED_PLAYERS, FOOD_MIND_SCORE_OPTIONS, type FoodMindFixedPlayerKey } from "../../features/food-mind/food-mind.cards";
import { getFoodMindScoreLabel } from "../../features/food-mind/food-mind.rules";
import type { FoodMindScore, FoodMindStatePayload } from "../../features/food-mind/food-mind.types";

type ErrorPayload = {
  ok?: false;
  error?: string;
};

function getStorageKey(roomId: string): string {
  return `food_mind_player_${roomId}`;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | ErrorPayload | null;
  if (!response.ok) {
    const errorPayload = payload as ErrorPayload | null;
    throw new Error(errorPayload?.error || "Request failed");
  }
  return payload as T;
}

function ScorePicker({
  title,
  value,
  onChange,
}: {
  title: string;
  value: FoodMindScore | null;
  onChange: (score: FoodMindScore) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black text-stone-900">{title}</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {FOOD_MIND_SCORE_OPTIONS.map((option) => {
          const active = value === option.score;
          return (
            <button
              key={option.score}
              type="button"
              onClick={() => onChange(option.score)}
              className={`min-h-20 rounded-md border px-3 py-3 text-left transition ${
                active
                  ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-100"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"
              }`}
            >
              <span className="block text-base font-black">{option.label}</span>
              <span className="mt-1 block text-xs leading-5 text-stone-500">{option.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function moveItem(items: string[], index: number, direction: -1 | 1): string[] {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

function RankingPicker({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black text-stone-900">{title}</h3>
      <div className="space-y-2">
        {value.map((option, index) => (
          <div key={option} className="flex items-center gap-2 rounded-md border border-stone-200 bg-white p-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-emerald-50 text-sm font-black text-emerald-800">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 font-bold text-stone-900">{option}</span>
            <button
              type="button"
              onClick={() => onChange(moveItem(value, index, -1))}
              disabled={index === 0}
              className="rounded-md border border-stone-200 px-2 py-1 text-xs font-bold text-stone-600 disabled:opacity-30"
            >
              上
            </button>
            <button
              type="button"
              onClick={() => onChange(moveItem(value, index, 1))}
              disabled={index === value.length - 1}
              className="rounded-md border border-stone-200 px-2 py-1 text-xs font-bold text-stone-600 disabled:opacity-30"
            >
              下
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function meta() {
  return [{ title: "早餐店讀心局房間" }];
}

export default function FoodMindRoomPage() {
  const params = useParams();
  const navigate = useNavigate();
  const roomId = params.roomId ?? "";
  const [state, setState] = useState<FoodMindStatePayload | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [selfScore, setSelfScore] = useState<FoodMindScore | null>(null);
  const [predictPartnerScore, setPredictPartnerScore] = useState<FoodMindScore | null>(null);
  const [selfOrder, setSelfOrder] = useState<string[]>([]);
  const [predictPartnerOrder, setPredictPartnerOrder] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [copied, setCopied] = useState(false);

  const roomUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/food-mind/room/${roomId}`;
  }, [roomId]);

  const me = state?.players.find((player) => player.id === playerId) ?? null;
  const partner = state?.players.find((player) => player.id !== playerId) ?? null;
  const submittedCount = state?.answerStatuses.filter((item) => item.submitted).length ?? 0;
  const revealForMe = state?.reveal?.playerResults.find((result) => result.player.id === playerId) ?? null;
  const rankingRevealForMe = state?.rankingReveal?.playerResults.find((result) => result.player.id === playerId) ?? null;

  const fetchState = useCallback(async (currentPlayerId = playerId) => {
    if (!roomId) return;
    const query = currentPlayerId ? `?playerId=${encodeURIComponent(currentPlayerId)}` : "";
    const response = await fetch(`/api/food-mind/rooms/${roomId}/state${query}`);
    const payload = await readJson<FoodMindStatePayload>(response);
    setState(payload);
    if (payload.myAnswer) {
      setSelfScore(payload.myAnswer.selfScore);
      setPredictPartnerScore(payload.myAnswer.predictPartnerScore);
    } else {
      setSelfScore(null);
      setPredictPartnerScore(null);
    }
    if (payload.currentRankingSet) {
      setSelfOrder(payload.myRankingAnswer?.selfOrder ?? payload.currentRankingSet.options);
      setPredictPartnerOrder(payload.myRankingAnswer?.predictPartnerOrder ?? payload.currentRankingSet.options);
    } else {
      setSelfOrder([]);
      setPredictPartnerOrder([]);
    }
  }, [playerId, roomId]);

  useEffect(() => {
    const savedPlayerId = window.localStorage.getItem(getStorageKey(roomId));
    if (savedPlayerId) setPlayerId(savedPlayerId);
    void fetchState(savedPlayerId);
  }, [fetchState, roomId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchState();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [fetchState]);

  useEffect(() => {
    if (state?.room.status === "finished") {
      navigate(`/food-mind/room/${roomId}/result`);
    }
  }, [navigate, roomId, state?.room.status]);

  const joinRoom = async (playerKey: FoodMindFixedPlayerKey) => {
    setIsJoining(true);
    setError("");
    try {
      const response = await fetch(`/api/food-mind/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerKey }),
      });
      const payload = await readJson<{ ok: true; player: { id: string } }>(response);
      window.localStorage.setItem(getStorageKey(roomId), payload.player.id);
      setPlayerId(payload.player.id);
      await fetchState(payload.player.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加入房間失敗");
    } finally {
      setIsJoining(false);
    }
  };

  const resetIdentity = () => {
    window.localStorage.removeItem(getStorageKey(roomId));
    setPlayerId(null);
    setSelfScore(null);
    setPredictPartnerScore(null);
    setSelfOrder([]);
    setPredictPartnerOrder([]);
    void fetchState(null);
  };

  const copyRoomLink = async () => {
    if (!roomUrl) return;
    await navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const submitAnswer = async () => {
    if (!playerId || !state) return;
    const isRanking = state.theme.mode === "ranking";
    if (!isRanking && (selfScore === null || predictPartnerScore === null)) return;
    if (isRanking && (!state.currentRankingSet || selfOrder.length === 0 || predictPartnerOrder.length === 0)) return;
    setIsSubmitting(true);
    setError("");
    try {
      const body = isRanking
        ? { playerId, selfOrder, predictPartnerOrder }
        : { playerId, selfScore, predictPartnerScore };
      const response = await fetch(`/api/food-mind/rooms/${roomId}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await readJson<FoodMindStatePayload>(response);
      setState(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送出答案失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const goNext = async () => {
    if (!state) return;
    setIsAdvancing(true);
    setError("");
    try {
      const response = await fetch(`/api/food-mind/rooms/${roomId}/next`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedIndex: state.room.currentIndex }),
      });
      const payload = await readJson<FoodMindStatePayload>(response);
      setState(payload);
      if (payload.room.status === "finished") {
        navigate(`/food-mind/room/${roomId}/result`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "前往下一題失敗");
    } finally {
      setIsAdvancing(false);
    }
  };

  if (!state) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f2ea] text-stone-700">
        <div className="inline-flex items-center gap-2 text-sm font-bold">
          <Loader2 className="h-4 w-4 animate-spin" />
          載入房間中...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f2ea] px-4 py-5 text-stone-950 md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link to="/food-mind" className="inline-flex items-center gap-2 text-sm font-bold text-stone-600 hover:text-stone-950">
            <ArrowLeft className="h-4 w-4" />
            {state.theme.name}
          </Link>
          <button
            type="button"
            onClick={copyRoomLink}
            className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-bold text-stone-700 transition hover:bg-stone-50"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-700" /> : <Copy className="h-4 w-4" />}
            {copied ? "已複製" : "複製房間連結"}
          </button>
        </div>

        <div className="mx-auto max-w-4xl">
          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
              <div>
                <p className="text-sm font-bold text-emerald-700">
                  第 {state.currentCardNumber} / {state.totalCards} {state.theme.mode === "ranking" ? "組" : "題"}
                </p>
                <h1 className="mt-1 text-3xl font-black text-stone-950">
                  {state.currentCard?.name ?? state.currentRankingSet?.title ?? "測驗完成"}
                </h1>
              </div>
              <div className="inline-flex items-center gap-2 rounded-md bg-stone-100 px-3 py-2 text-sm font-bold text-stone-700">
                <Users className="h-4 w-4" />
                {state.players.length}/2 位玩家
              </div>
            </div>

            {state.currentCard ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {state.currentCard.tags.map((tag) => (
                  <span key={tag} className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            {state.currentCard?.description ? (
              <p className="mt-4 rounded-lg bg-stone-50 p-4 text-sm leading-6 text-stone-600">{state.currentCard.description}</p>
            ) : null}

            {state.currentRankingSet?.description ? (
              <p className="mt-4 rounded-lg bg-stone-50 p-4 text-sm leading-6 text-stone-600">
                {state.currentRankingSet.description}
              </p>
            ) : null}

            {!me ? (
              <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-4">
                <h2 className="text-lg font-black">你是誰？</h2>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  這不是開放房間系統，房間只代表這一局。選自己的身份後就能作答。
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {FOOD_MIND_FIXED_PLAYERS.map((fixedPlayer) => {
                    const selectedBySomeone = state.players.some((player) => player.name === fixedPlayer.name);
                    return (
                      <button
                        key={fixedPlayer.key}
                        type="button"
                        onClick={() => joinRoom(fixedPlayer.key)}
                        disabled={isJoining}
                        className="flex min-h-24 items-center justify-between rounded-md border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-emerald-500 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span>
                          <span className="block text-xl font-black text-stone-950">{fixedPlayer.name}</span>
                          <span className="mt-1 block text-sm text-stone-500">
                            {selectedBySomeone ? "已在這局出現，點擊可回到此身份" : "選擇這個身份"}
                          </span>
                        </span>
                        {isJoining ? <Loader2 className="h-5 w-5 animate-spin text-stone-500" /> : <UserRoundCheck className="h-5 w-5 text-emerald-700" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
                你現在是 <span className="font-black text-stone-950">{me.name}</span>
                {partner ? (
                  <>
                    ，對方是 <span className="font-black text-stone-950">{partner.name}</span>。
                  </>
                ) : (
                  "，等待另一個身份進入這一局。"
                )}
                <button type="button" onClick={resetIdentity} className="ml-3 font-bold text-emerald-700 hover:text-emerald-900">
                  重選身份
                </button>
              </div>
            )}

            {error ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
            ) : null}

            {me && state.players.length < 2 ? (
              <div className="mt-6 flex items-start gap-3 rounded-lg border border-dashed border-stone-300 bg-white p-4 text-sm leading-6 text-stone-600">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-stone-500" />
                <div>
                  <p className="font-bold text-stone-900">等待另一位玩家加入</p>
                  <p>複製右上角連結給對方，對方選另一個身份後就會開始。</p>
                </div>
              </div>
            ) : null}

            {me && state.players.length === 2 && state.currentCard ? (
              <div className="mt-6 space-y-7">
                <ScorePicker title="1. 我自己的感覺" value={selfScore} onChange={setSelfScore} />
                <ScorePicker title="2. 我猜對方的感覺" value={predictPartnerScore} onChange={setPredictPartnerScore} />

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-4">
                  <div className="text-sm text-stone-600">
                    目前作答：<span className="font-black text-stone-950">{submittedCount}</span> / 2
                    {state.myAnswer && !state.reveal ? "，等待對方完成。" : null}
                  </div>
                  <button
                    type="button"
                    onClick={submitAnswer}
                    disabled={isSubmitting || selfScore === null || predictPartnerScore === null || Boolean(state.reveal)}
                    className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {state.myAnswer ? "更新答案" : "送出答案"}
                  </button>
                </div>
              </div>
            ) : null}

            {me && state.players.length === 2 && state.currentRankingSet ? (
              <div className="mt-6 space-y-7">
                <RankingPicker title="1. 我自己的排序" value={selfOrder} onChange={setSelfOrder} />
                <RankingPicker title="2. 我猜對方的排序" value={predictPartnerOrder} onChange={setPredictPartnerOrder} />

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-4">
                  <div className="text-sm text-stone-600">
                    目前作答：<span className="font-black text-stone-950">{submittedCount}</span> / 2
                    {state.myRankingAnswer && !state.rankingReveal ? "，等待對方完成。" : null}
                  </div>
                  <button
                    type="button"
                    onClick={submitAnswer}
                    disabled={isSubmitting || Boolean(state.rankingReveal)}
                    className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {state.myRankingAnswer ? "更新排序" : "送出排序"}
                  </button>
                </div>
              </div>
            ) : null}

            {state.reveal ? (
              <div className="mt-6 space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div>
                  <p className="text-sm font-bold text-emerald-800">揭曉</p>
                  <h2 className="mt-1 text-2xl font-black text-stone-950">{state.reveal.compatibility.label}</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-700">{state.reveal.compatibility.description}</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {state.reveal.playerResults.map((result) => (
                    <div key={result.player.id} className="rounded-lg border border-emerald-100 bg-white p-4">
                      <h3 className="font-black text-stone-950">{result.player.name}</h3>
                      <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-stone-500">自己的選擇</dt>
                          <dd className="font-bold">{getFoodMindScoreLabel(result.selfScore)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-stone-500">對方猜你會選</dt>
                          <dd className="font-bold">{getFoodMindScoreLabel(result.partnerGuessedSelfScore)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-stone-500">猜對方</dt>
                          <dd className="font-bold">{getFoodMindScoreLabel(result.predictPartnerScore)}</dd>
                        </div>
                      </dl>
                      <div className="mt-3 rounded-md bg-stone-50 p-3 text-sm leading-6 text-stone-700">
                        <span className="font-black text-stone-950">{result.mindRead.label}</span>
                        ：誤差 {result.mindRead.error}。{result.mindRead.prompt}
                      </div>
                    </div>
                  ))}
                </div>

                {revealForMe ? (
                  <div className="rounded-md bg-white p-3 text-sm leading-6 text-stone-700">
                    你猜 {revealForMe.partner.name} 是
                    <span className="font-black text-stone-950"> {getFoodMindScoreLabel(revealForMe.predictPartnerScore)} </span>
                    ，實際是
                    <span className="font-black text-stone-950"> {getFoodMindScoreLabel(revealForMe.partnerActualScore)} </span>
                    。
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={goNext}
                  disabled={isAdvancing}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-stone-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-stone-800 disabled:opacity-60 sm:w-auto"
                >
                  {isAdvancing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {state.room.currentIndex >= state.totalCards - 1 ? "看結果" : "下一題"}
                </button>
              </div>
            ) : null}

            {state.rankingReveal ? (
              <div className="mt-6 space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div>
                  <p className="text-sm font-bold text-emerald-800">揭曉</p>
                  <h2 className="mt-1 text-2xl font-black text-stone-950">{state.rankingReveal.set.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-700">比較你們的真實排序，以及猜對方排序的落差。</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {state.rankingReveal.playerResults.map((result) => (
                    <div key={result.player.id} className="rounded-lg border border-emerald-100 bg-white p-4">
                      <h3 className="font-black text-stone-950">{result.player.name}</h3>
                      <div className="mt-3 grid gap-3 text-sm">
                        <div>
                          <p className="font-bold text-stone-600">自己的前 3 名</p>
                          <p className="mt-1 text-stone-900">{result.selfOrder.slice(0, 3).join("、")}</p>
                        </div>
                        <div>
                          <p className="font-bold text-stone-600">最大誤判</p>
                          <p className="mt-1 text-stone-900">
                            {result.biggestMisses.map((diff) => `${diff.option} 差 ${diff.error}`).join("、") || "沒有明顯誤判"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {rankingRevealForMe ? (
                  <div className="rounded-md bg-white p-3 text-sm leading-6 text-stone-700">
                    你猜 {rankingRevealForMe.partner.name} 最準：
                    <span className="font-black text-stone-950">
                      {" "}
                      {rankingRevealForMe.exactMatches.map((diff) => diff.option).join("、") || "這組沒有完全同名次"}
                    </span>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={goNext}
                  disabled={isAdvancing}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-stone-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-stone-800 disabled:opacity-60 sm:w-auto"
                >
                  {isAdvancing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {state.room.currentIndex >= state.totalCards - 1 ? "看結果" : "下一組"}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
