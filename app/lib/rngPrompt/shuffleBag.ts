import type { TagLockKey } from "./types";

export type ShuffleBagState = Record<string, { order: TagLockKey[]; index: number }>;

type EnsureBagResult = {
  bag: { order: TagLockKey[]; index: number };
  bags: ShuffleBagState;
};

export const shuffleArray = <T,>(items: T[]) => {
  const list = [...items];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(Math.random() * (index + 1));
    [list[index], list[pick]] = [list[pick], list[index]];
  }
  return list;
};

const hasSameMembers = (a: TagLockKey[], b: TagLockKey[]) => {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  if (setA.size !== a.length) return false;
  return b.every((key) => setA.has(key));
};

const ensureShuffleBag = (bags: ShuffleBagState, bagKey: string, activeKeys: TagLockKey[]): EnsureBagResult => {
  const current = bags[bagKey];
  if (!current || !hasSameMembers(activeKeys, current.order)) {
    const next = { order: shuffleArray(activeKeys), index: 0 };
    return { bag: next, bags: { ...bags, [bagKey]: next } };
  }
  const safeIndex = Math.min(Math.max(0, current.index), current.order.length);
  if (safeIndex !== current.index) {
    const next = { ...current, index: safeIndex };
    return { bag: next, bags: { ...bags, [bagKey]: next } };
  }
  return { bag: current, bags };
};

export const drawFromShuffleBag = <T,>(
  bags: ShuffleBagState,
  bagKey: string,
  items: T[],
  getKey: (item: T) => TagLockKey,
  count: number,
  excludeKeys: Set<TagLockKey>,
) => {
  if (count <= 0) return { picked: [] as T[], bags };
  if (items.length === 0) return { picked: [] as T[], bags };

  const itemMap = new Map<TagLockKey, T>();
  const activeKeys: TagLockKey[] = [];
  items.forEach((item) => {
    const key = getKey(item);
    activeKeys.push(key);
    itemMap.set(key, item);
  });

  let { bag, bags: nextBags } = ensureShuffleBag(bags, bagKey, activeKeys);
  let index = bag.index;
  const picked: T[] = [];
  const seen = new Set<TagLockKey>();
  const maxAttempts = activeKeys.length * 2;
  let attempts = 0;

  while (picked.length < count && attempts < maxAttempts) {
    if (index >= bag.order.length) {
      const nextBag = { order: shuffleArray(activeKeys), index: 0 };
      bag = nextBag;
      nextBags = { ...nextBags, [bagKey]: nextBag };
      index = 0;
    }
    const key = bag.order[index];
    index += 1;
    attempts += 1;
    if (!itemMap.has(key)) continue;
    if (excludeKeys.has(key)) continue;
    if (seen.has(key)) continue;
    const item = itemMap.get(key);
    if (item) {
      picked.push(item);
      seen.add(key);
    }
  }

  if (bag.index !== index) {
    const nextBag = { ...bag, index };
    nextBags = { ...nextBags, [bagKey]: nextBag };
  }

  return { picked, bags: nextBags };
};
