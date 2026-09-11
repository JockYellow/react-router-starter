import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ANIME_BACKGROUND_SAVE_MAX_ATTEMPTS,
  animeBackgroundSaveRetryDelayMs,
  createSerialAsyncQueue,
  isRetryableAnimeBackgroundSaveStatus,
} from "./anime-background-save";
import {
  advanceAnimeSurveyQueue,
  mergeAnimeSurveyQueue,
  type AnimeSurveyQueueItem,
} from "./anime-survey-queue";
import type { AnimePrimaryStatus, AnimeSeason } from "./anime.types";

type FastPrimaryStatus = Extract<AnimePrimaryStatus, "WANT" | "NOT_SEEN">;

type SaveJob = {
  scopeKey: string;
  animeId: number;
  status: FastPrimaryStatus;
  state: "SAVING" | "FAILED";
  error: string | null;
};

type QueueResponse = {
  ok: true;
  items: AnimeSurveyQueueItem[];
};

class BackgroundSaveRequestError extends Error {
  retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "BackgroundSaveRequestError";
    this.retryable = retryable;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isQueueItem(value: unknown): value is AnimeSurveyQueueItem {
  if (!isRecord(value) || !isRecord(value.candidate) || !isRecord(value.record)) return false;
  return Number.isInteger(value.candidate.animeId) && Number.isInteger(value.record.animeId);
}

function parseQueueResponse(value: unknown): QueueResponse | null {
  if (!isRecord(value) || value.ok !== true || !Array.isArray(value.items)) return null;
  if (!value.items.every(isQueueItem)) return null;
  return { ok: true, items: value.items };
}

function initialSignature(items: readonly AnimeSurveyQueueItem[]): string {
  return items
    .map((item) => [
      item.candidate.animeId,
      item.record.status ?? "",
      item.record.detailStatus ?? "",
      item.record.rating ?? "",
    ].join(":"))
    .join("|");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sameSaveJob(a: Pick<SaveJob, "scopeKey" | "animeId">, b: Pick<SaveJob, "scopeKey" | "animeId">) {
  return a.scopeKey === b.scopeKey && a.animeId === b.animeId;
}

/**
 * Keeps a small unresolved queue in the browser and persists Want/Not Seen in
 * the background while the visible card advances immediately.
 *
 * @param props - Scope, server queue snapshot and progress counters.
 */
export function useAnimeSurveyOptimisticQueue(props: {
  year: number;
  season: AnimeSeason;
  initialItems: readonly AnimeSurveyQueueItem[];
  candidateCount: number;
  processedCount: number;
  enabled: boolean;
}) {
  const scopeKey = `${props.year}:${props.season}`;
  const incomingSignature = useMemo(() => initialSignature(props.initialItems), [props.initialItems]);
  const initialQueue = props.initialItems.slice(0, 5);
  const [queue, setQueue] = useState<AnimeSurveyQueueItem[]>(() => initialQueue);
  const [handledIds, setHandledIds] = useState<Set<number>>(() => new Set());
  const [saveJobs, setSaveJobs] = useState<SaveJob[]>([]);
  const [displayProcessedCount, setDisplayProcessedCount] = useState(props.processedCount);
  const [refillLoading, setRefillLoading] = useState(false);
  const [refillError, setRefillError] = useState<string | null>(null);
  const handledIdsRef = useRef(handledIds);
  const queueRef = useRef<AnimeSurveyQueueItem[]>(initialQueue);
  const saveQueueRef = useRef<ReturnType<typeof createSerialAsyncQueue> | null>(null);
  const lastScopeRef = useRef(scopeKey);
  const lastRefillKeyRef = useRef("");

  if (!saveQueueRef.current) saveQueueRef.current = createSerialAsyncQueue();

  useEffect(() => {
    handledIdsRef.current = handledIds;
  }, [handledIds]);

  useEffect(() => {
    if (lastScopeRef.current === scopeKey) return;
    lastScopeRef.current = scopeKey;
    const nextHandled = new Set<number>();
    const nextQueue = props.initialItems.slice(0, 5);
    handledIdsRef.current = nextHandled;
    queueRef.current = nextQueue;
    setHandledIds(nextHandled);
    setSaveJobs([]);
    setQueue(nextQueue);
    setDisplayProcessedCount(props.processedCount);
    setRefillLoading(false);
    setRefillError(null);
    lastRefillKeyRef.current = "";
  }, [props.initialItems, props.processedCount, scopeKey]);

  useEffect(() => {
    if (lastScopeRef.current !== scopeKey) return;
    setDisplayProcessedCount((current) => Math.max(current, props.processedCount));
    const nextQueue = mergeAnimeSurveyQueue([], props.initialItems, handledIdsRef.current, 5);
    queueRef.current = nextQueue;
    setQueue(nextQueue);
    setRefillError(null);
    lastRefillKeyRef.current = "";
  }, [incomingSignature, props.initialItems, props.processedCount, scopeKey]);

  useEffect(() => {
    if (typeof Image === "undefined") return;
    for (const item of queue.slice(1, 5)) {
      if (!item.candidate.coverUrl) continue;
      const image = new Image();
      image.decoding = "async";
      image.src = item.candidate.coverUrl;
    }
  }, [queue]);

  const persistJob = useCallback(async (job: Pick<SaveJob, "scopeKey" | "animeId" | "status">) => {
    let finalError: Error | null = null;

    for (let attempt = 0; attempt < ANIME_BACKGROUND_SAVE_MAX_ATTEMPTS; attempt += 1) {
      try {
        const formData = new FormData();
        formData.set("year", String(props.year));
        formData.set("season", props.season);
        formData.set("animeId", String(job.animeId));
        formData.set("status", job.status);

        const response = await fetch("/api/anime/survey-answer", {
          method: "POST",
          body: formData,
          credentials: "same-origin",
          keepalive: true,
          headers: { Accept: "application/json" },
        });
        const payload: unknown = await response.json().catch(() => null);
        const loginRedirect = response.redirected || response.url.includes("/admin/login");

        if (!response.ok || !isRecord(payload) || payload.ok !== true) {
          const message = loginRedirect
            ? "背景儲存失敗：登入狀態可能已失效"
            : `背景儲存失敗（HTTP ${response.status}）`;
          throw new BackgroundSaveRequestError(
            message,
            !loginRedirect && isRetryableAnimeBackgroundSaveStatus(response.status),
          );
        }

        setSaveJobs((current) => current.filter((item) => !sameSaveJob(item, job)));
        return;
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error("背景儲存失敗");
        finalError = normalized;
        const retryable = error instanceof BackgroundSaveRequestError
          ? error.retryable
          : error instanceof TypeError;
        const canRetry = retryable && attempt + 1 < ANIME_BACKGROUND_SAVE_MAX_ATTEMPTS;
        if (!canRetry) break;
        await delay(animeBackgroundSaveRetryDelayMs(attempt));
      }
    }

    setSaveJobs((current) => current.map((item) => sameSaveJob(item, job)
      ? {
          ...item,
          state: "FAILED",
          error: finalError?.message ?? "背景儲存失敗",
        }
      : item));
  }, [props.season, props.year]);

  const enqueuePersist = useCallback((job: Pick<SaveJob, "scopeKey" | "animeId" | "status">): void => {
    const runner = saveQueueRef.current;
    if (!runner) return;
    void runner.enqueue(() => persistJob(job));
  }, [persistJob]);

  const answerFast = useCallback((status: FastPrimaryStatus): boolean => {
    if (!props.enabled) return false;
    const current = queueRef.current[0];
    if (!current || current.record.status === "SEEN") return false;

    const animeId = current.candidate.animeId;
    const nextQueue = advanceAnimeSurveyQueue(queueRef.current, animeId);
    queueRef.current = nextQueue;
    setQueue(nextQueue);
    setHandledIds((previous) => {
      const next = new Set(previous);
      next.add(animeId);
      handledIdsRef.current = next;
      return next;
    });
    setDisplayProcessedCount((count) => Math.min(props.candidateCount, count + 1));
    const job: SaveJob = { scopeKey, animeId, status, state: "SAVING", error: null };
    setSaveJobs((jobs) => [
      ...jobs.filter((item) => !sameSaveJob(item, job)),
      job,
    ]);
    enqueuePersist(job);
    return true;
  }, [enqueuePersist, props.candidateCount, props.enabled, scopeKey]);

  const retrySave = useCallback((animeId: number): void => {
    const job = saveJobs.find((item) => item.scopeKey === scopeKey
      && item.animeId === animeId
      && item.state === "FAILED");
    if (!job) return;
    setSaveJobs((current) => current.map((item) => sameSaveJob(item, job)
      ? { ...item, state: "SAVING", error: null }
      : item));
    enqueuePersist(job);
  }, [enqueuePersist, saveJobs, scopeKey]);

  const retryAllFailed = useCallback((): void => {
    for (const job of saveJobs.filter((item) => item.scopeKey === scopeKey && item.state === "FAILED")) {
      setSaveJobs((current) => current.map((item) => sameSaveJob(item, job)
        ? { ...item, state: "SAVING", error: null }
        : item));
      enqueuePersist(job);
    }
  }, [enqueuePersist, saveJobs, scopeKey]);

  const refillQueue = useCallback(async (): Promise<void> => {
    if (!props.enabled || refillLoading) return;
    setRefillLoading(true);
    setRefillError(null);
    try {
      const params = new URLSearchParams({
        year: String(props.year),
        season: props.season,
        limit: "5",
      });
      const excluded = [...handledIdsRef.current];
      if (excluded.length) params.set("exclude", excluded.join(","));

      const response = await fetch(`/api/anime/survey-queue?${params.toString()}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const payload: unknown = await response.json().catch(() => null);
      const parsed = parseQueueResponse(payload);
      if (!response.ok || !parsed) {
        throw new Error(`下一批候選載入失敗（HTTP ${response.status}）`);
      }

      setQueue((current) => {
        const next = mergeAnimeSurveyQueue(
          current,
          parsed.items,
          handledIdsRef.current,
          5,
        );
        queueRef.current = next;
        return next;
      });
    } catch (error) {
      setRefillError(error instanceof Error ? error.message : "下一批候選載入失敗");
    } finally {
      setRefillLoading(false);
    }
  }, [props.enabled, props.season, props.year, refillLoading]);

  useEffect(() => {
    if (!props.enabled || refillLoading || refillError) return;
    if (queue.length > 2 || displayProcessedCount >= props.candidateCount) return;

    const refillKey = `${queue.map((item) => item.candidate.animeId).join(",")}|${handledIds.size}|${displayProcessedCount}`;
    if (lastRefillKeyRef.current === refillKey) return;
    lastRefillKeyRef.current = refillKey;
    void refillQueue();
  }, [
    displayProcessedCount,
    handledIds.size,
    props.candidateCount,
    props.enabled,
    queue,
    refillError,
    refillLoading,
    refillQueue,
  ]);

  const retryRefill = useCallback((): void => {
    lastRefillKeyRef.current = "";
    setRefillError(null);
    void refillQueue();
  }, [refillQueue]);

  useEffect(() => {
    const hasPending = saveJobs.length > 0;
    if (!hasPending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveJobs.length]);

  const currentScopeJobs = saveJobs.filter((job) => job.scopeKey === scopeKey);
  const failedJobs = currentScopeJobs.filter((job) => job.state === "FAILED");
  const savingCount = currentScopeJobs.length - failedJobs.length;
  const currentItem = queue[0] ?? null;
  const isComplete = props.candidateCount > 0
    && displayProcessedCount >= props.candidateCount
    && currentScopeJobs.length === 0;
  const waitingForQueue = !currentItem
    && !isComplete
    && (refillLoading || displayProcessedCount < props.candidateCount);

  return {
    currentItem,
    queueLength: queue.length,
    displayProcessedCount,
    answerFast,
    savingCount,
    failedJobs,
    retrySave,
    retryAllFailed,
    refillLoading,
    refillError,
    retryRefill,
    waitingForQueue,
    isComplete,
  };
}
