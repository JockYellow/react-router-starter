import type { Category } from "./types";

export const getMulRange = (cat: Category) => {
  const min = Math.max(0, cat.min_count ?? 1);
  const max = Math.max(min, cat.max_count ?? min);
  return { min, max };
};

export const getCardMulCount = (cat: Category, override?: number) => {
  if (typeof override === "number") return Math.max(0, override);
  const { min, max } = getMulRange(cat);
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};
