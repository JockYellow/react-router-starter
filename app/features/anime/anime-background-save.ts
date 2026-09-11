export const ANIME_BACKGROUND_SAVE_MAX_ATTEMPTS = 3;

const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export function isRetryableAnimeBackgroundSaveStatus(status: number): boolean {
  return RETRYABLE_HTTP_STATUSES.has(status);
}

export function animeBackgroundSaveRetryDelayMs(failedAttemptIndex: number): number {
  const index = Math.max(0, Math.trunc(failedAttemptIndex));
  return Math.min(1200, 180 * (2 ** index));
}

export type SerialAsyncQueue = {
  enqueue(task: () => Promise<void>): Promise<void>;
};

/**
 * Runs async write jobs one at a time. A rejected job does not block later jobs.
 */
export function createSerialAsyncQueue(): SerialAsyncQueue {
  let tail: Promise<void> = Promise.resolve();

  return {
    enqueue(task) {
      const run = tail.then(task, task);
      tail = run.catch(() => undefined);
      return run;
    },
  };
}
