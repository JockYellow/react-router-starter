import type { AnimeSurveyCredits } from "./anime-credits";

const creditsCache = new Map<number, AnimeSurveyCredits>();
const pendingCredits = new Map<number, Promise<AnimeSurveyCredits | null>>();

function parseCredits(value: unknown): AnimeSurveyCredits | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const studio = typeof record.studio === "string" && record.studio.trim()
    ? record.studio.trim()
    : null;
  const directors = Array.isArray(record.directors)
    ? record.directors.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
  return { studio, directors };
}

function normalizeAnimeIds(animeIds: readonly number[]): number[] {
  return Array.from(new Set(
    animeIds.filter((animeId) => Number.isInteger(animeId) && animeId > 0),
  )).slice(0, 20);
}

async function startBatch(ids: number[]): Promise<void> {
  const params = new URLSearchParams({ ids: ids.join(",") });
  const response = await fetch(`/api/anime/credits?${params.toString()}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Credits prefetch failed (${response.status})`);

  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object") return;
  const items = (payload as Record<string, unknown>).items;
  if (!Array.isArray(items)) return;

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const animeId = Number(record.animeId);
    const credits = parseCredits(record.credits);
    if (Number.isInteger(animeId) && animeId > 0 && credits) creditsCache.set(animeId, credits);
  }
}

export function peekAnimeCredits(animeId: number): AnimeSurveyCredits | null {
  return creditsCache.get(animeId) ?? null;
}

export async function prefetchAnimeCredits(animeIds: readonly number[]): Promise<void> {
  const ids = normalizeAnimeIds(animeIds);
  const missing = ids.filter((animeId) => !creditsCache.has(animeId) && !pendingCredits.has(animeId));

  if (missing.length) {
    const batchPromise = startBatch(missing).catch(() => undefined);
    for (const animeId of missing) {
      const itemPromise = batchPromise
        .then(() => creditsCache.get(animeId) ?? null)
        .finally(() => pendingCredits.delete(animeId));
      pendingCredits.set(animeId, itemPromise);
    }
  }

  await Promise.all(ids.map((animeId) => pendingCredits.get(animeId) ?? Promise.resolve(creditsCache.get(animeId) ?? null)));
}

export async function prefetchAnimeCreditsWithProgress(
  animeIds: readonly number[],
  onProgress: (completed: number, total: number) => void,
  batchSize = 4,
): Promise<void> {
  const ids = normalizeAnimeIds(animeIds);
  const size = Math.max(1, Math.min(Math.trunc(batchSize), 10));
  let completed = 0;
  onProgress(completed, ids.length);

  for (let index = 0; index < ids.length; index += size) {
    const batch = ids.slice(index, index + size);
    await prefetchAnimeCredits(batch);
    completed += batch.length;
    onProgress(completed, ids.length);
  }
}

export async function loadAnimeCredits(animeId: number): Promise<AnimeSurveyCredits | null> {
  const cached = creditsCache.get(animeId);
  if (cached) return cached;
  const pending = pendingCredits.get(animeId);
  if (pending) return pending;
  await prefetchAnimeCredits([animeId]);
  return creditsCache.get(animeId) ?? null;
}
