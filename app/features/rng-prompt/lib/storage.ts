import type { GroupLimit, TagLockKey } from "./types";

const GROUP_LIMITS_COOKIE = "rng_group_limits";
const SHUFFLE_BAG_STORAGE = "rng_prompt_shuffle_bags";

export const readCookieValue = (name: string) => {
  if (typeof document === "undefined") return "";
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
};

export const readGroupLimitsCookie = () => {
  const raw = readCookieValue(GROUP_LIMITS_COOKIE);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, GroupLimit>;
    const normalized: Record<string, GroupLimit> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (!value || typeof value !== "object") return;
      const min = Number(value.min);
      const max = Number(value.max);
      if (Number.isNaN(min) || Number.isNaN(max)) return;
      const safeMin = Math.max(0, min);
      const safeMax = Math.max(safeMin, max);
      normalized[key] = { min: safeMin, max: safeMax };
    });
    return normalized;
  } catch (_error) {
    return {};
  }
};

export const writeGroupLimitsCookie = (limits: Record<string, GroupLimit>) => {
  if (typeof document === "undefined") return;
  const payload = encodeURIComponent(JSON.stringify(limits));
  document.cookie = `${GROUP_LIMITS_COOKIE}=${payload}; path=/; max-age=31536000`;
};

export type ShuffleBags = Record<string, { order: TagLockKey[]; index: number }>;

export const readShuffleBags = () => {
  if (typeof window === "undefined") return {} as ShuffleBags;
  const raw = window.localStorage.getItem(SHUFFLE_BAG_STORAGE);
  if (!raw) return {} as ShuffleBags;
  try {
    const parsed = JSON.parse(raw) as Record<string, { order?: TagLockKey[]; index?: number }>;
    const normalized: ShuffleBags = {};
    Object.entries(parsed ?? {}).forEach(([key, value]) => {
      if (!value || typeof value !== "object") return;
      const order = Array.isArray(value.order) ? (value.order as TagLockKey[]) : [];
      const index = typeof value.index === "number" ? Math.max(0, value.index) : 0;
      normalized[key] = { order, index };
    });
    return normalized;
  } catch (_error) {
    return {} as ShuffleBags;
  }
};

export const writeShuffleBags = (bags: ShuffleBags) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SHUFFLE_BAG_STORAGE, JSON.stringify(bags));
};
