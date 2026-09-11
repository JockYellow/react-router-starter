import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  advanceAnimeSurveyQueue,
  mergeAnimeSurveyQueue,
  type AnimeSurveyQueueItem,
} from "./anime-survey-queue";
import type { AnimePrimaryStatus, AnimeSeason } from "./anime.types";

type FastPrimaryStatus = Extract<AnimePrimaryStatus, "WANT" | "NOT_SEEN">;

type SaveJob = {
  animeId: number;
  status: FastPrimaryStatus;
  state: "SAVING" | "FAILED";
  error: string | null;
};

type QueueResponse = {
  ok: true;
  items: AnimeSurveyQueueItem[];
};

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
  const [queue, setQueue] = useState<AnimeSurveyQueueItem[]>(() => props.initialItems.slice(0, 5));
  const [handledIds, setHandledIds] = useState<Set<number>>(() => new Set());
  const [saveJobs, setSaveJobs] = useState<SaveJob[]>([]);
  const [displayProcessedCount, setDisplayProcessedCount] = useState(props.processedCount);
  const [refillLoading, setRefillLoading] = useState(false);
  const [refillError, setRefillError] = useState<string | null>(null);
  const handledIdsRef = useRef(handledIds);
  const lastScopeRef = useRef(scopeKey);
  const lastRefillKeyRef = useRef("");

  useEffect(() => {
    handledIdsRef.current = handledIds;
  }, [handledIds]);

  useEffect(() => {
    if (lastScopeRef.current === scopeKey) return;
    lastScopeRef.current = scopeKey;
    const nextHandled = new Set<number>();
    handledIdsRef.current = nextHandled;
    setHandledIds(nextHandled);
    setSaveJobs([]);
    setQueue(props.initialItems.slice(0, 5));
    setDisplayProcessedCount(props.processedCount);
    setRefillLoading(false);
    setRefillError(null);
    lastRefillKeyRef.current = "";
  }, [props.initialItems, props.processedCount, scopeKey]);

  useEffect(() => {
    if (lastScopeRef.current !== scopeKey) return;
    setDisplayProcessedCount((current) => Math.max(current, props.processedCount));
    setQueue((current) => {
      const incomingById = new Map(
        props.initialItems.map((item) => [item.candidate.animeId, item] as const),
      );
      const refreshedCurrent = current.map((item) => incomingById.get(item.candidate.animeId) ?? item);
      return mergeAnimeSurveyQueue(
        refreshedCurrent,
        props.initialItems,
        handledIdsRef.current,
        5,
      );
    });
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

  const persistJob = useCallback(async (job: Pick<SaveJob, "animeId" | "status">) => {
    try {
      const formData = new FormData();
      formData.set("intent", "primary-optimistic");
      formData.set("year", String(props.year));
      formData.set("season", props.season);
      formData.set("animeId", String(job.animeId));
      formData.set("status", job.status);

      const response = await fetch(`/anime/survey?year=${props.year}&season=${props.season}`, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        keepalive: true,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `HTTP ${response.status}`);
      }

      setSaveJobs((current) => current.filter((item) => item.animeId !== job.animeId));
    } catch (error) {
      setSaveJobs((current) => current.map((item) => item.animeId === job.animeId
        ? {
            ...item,
            state: "FAILED",
            error: error instanceof Error ? error.message : "背景儲存失敗",
          }
        : item));
    }
  }, [props.season, props.year]);

  const answerFast = useCallback((status: FastPrimaryStatus): boolean => {
    if (!props.enabled) return false;
    const current = queue[0];
    if (!current || current.record.status === "SEEN") return false;

    const animeId = current.candidate.animeId;
    setQueue((items) => advanceAnimeSurveyQueue(items, animeId));
    setHandledIds((previous) => {
      const next = new Set(previous);
      next.add(animeId);
      handledIdsRef.current = next;
      return next;
    });
    setDisplayProcessedCount((count) => Math.min(props.candidateCount, count + 1));
    setSaveJobs((jobs) => [
      ...jobs.filter((item) => item.animeId !== animeId),
      { animeId, status, state: "SAVING", error: null },
    ]);
    void persistJob({ animeId, status });
    return true;
  }, [persistJob, props.candidateCount, props.enabled, queue]);

  const retrySave = useCallback((animeId: number): void => {
    const job = saveJobs.find((item) => item.animeId === animeId && item.state === "FAILED");
    if (!job) return;
    setSaveJobs((current) => current.map((item) => item.animeId === animeId
      ? { ...item, state: "SAVING", error: null }
      : item));
    void persistJob(job);
  }, [persistJob, saveJobs]);

  const retryAllFailed = useCallback((): void => {
    for (const job of saveJobs.filter((item) => item.state === "FAILED")) {
      setSaveJobs((current) => current.map((item) => item.animeId === job.animeId
        ? { ...item, state: "SAVING", error: null }
        : item));
      void persistJob(job);
    }
  }, [persistJob, saveJobs]);

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

      setQueue((current) => mergeAnimeSurveyQueue(
        current,
        parsed.items,
        handledIdsRef.current,
        5,
      ));
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

  const failedJobs = saveJobs.filter((job) => job.state === "FAILED");
  const savingCount = saveJobs.length - failedJobs.length;
  const currentItem = queue[0] ?? null;
  const isComplete = props.candidateCount > 0
    && displayProcessedCount >= props.candidateCount
    && saveJobs.length === 0;
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
