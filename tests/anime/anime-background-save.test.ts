import assert from "node:assert/strict";
import test from "node:test";

import {
  ANIME_BACKGROUND_SAVE_MAX_ATTEMPTS,
  animeBackgroundSaveRetryDelayMs,
  createSerialAsyncQueue,
  isRetryableAnimeBackgroundSaveStatus,
} from "../../app/features/anime/anime-background-save";

test("background save retry policy is limited to transient statuses", () => {
  for (const status of [408, 425, 429, 500, 502, 503, 504]) {
    assert.equal(isRetryableAnimeBackgroundSaveStatus(status), true, String(status));
  }
  for (const status of [200, 400, 401, 403, 404, 409, 422]) {
    assert.equal(isRetryableAnimeBackgroundSaveStatus(status), false, String(status));
  }
  assert.equal(ANIME_BACKGROUND_SAVE_MAX_ATTEMPTS, 3);
});

test("retry delay backs off and stays bounded", () => {
  assert.equal(animeBackgroundSaveRetryDelayMs(0), 180);
  assert.equal(animeBackgroundSaveRetryDelayMs(1), 360);
  assert.equal(animeBackgroundSaveRetryDelayMs(2), 720);
  assert.equal(animeBackgroundSaveRetryDelayMs(10), 1200);
});

test("serial async queue never runs writes concurrently and preserves order", async () => {
  const queue = createSerialAsyncQueue();
  const events: string[] = [];
  let active = 0;
  let maxActive = 0;

  const task = (name: string, ms: number) => queue.enqueue(async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    events.push(`start:${name}`);
    await new Promise((resolve) => setTimeout(resolve, ms));
    events.push(`end:${name}`);
    active -= 1;
  });

  await Promise.all([task("a", 15), task("b", 1), task("c", 1)]);
  assert.equal(maxActive, 1);
  assert.deepEqual(events, [
    "start:a", "end:a",
    "start:b", "end:b",
    "start:c", "end:c",
  ]);
});

test("serial async queue continues after a rejected write", async () => {
  const queue = createSerialAsyncQueue();
  const events: string[] = [];

  const first = queue.enqueue(async () => {
    events.push("first");
    throw new Error("transient failure");
  });
  const second = queue.enqueue(async () => {
    events.push("second");
  });

  await assert.rejects(first, /transient failure/);
  await second;
  assert.deepEqual(events, ["first", "second"]);
});
