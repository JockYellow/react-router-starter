const HAN_RE = /\p{Script=Han}/u;
const KANA_RE = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;

/**
 * Conservative normalization for exact-ish alias matching.
 *
 * This intentionally does not do fuzzy/subsequence matching. It removes
 * presentation differences (width, case, punctuation, whitespace) while
 * preserving the actual sequence of letters/numbers/ideographs.
 */
export function normalizeAnimeAlias(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[×✕✖]/g, "x")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

export function distinctAnimeAliases(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;
    const normalized = normalizeAnimeAlias(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value);
  }

  return result;
}

/**
 * Heuristic only. A Han-only Japanese title can look Chinese, so callers must
 * never treat this function as authoritative matching evidence.
 */
export function looksLikeChineseTitle(value: string): boolean {
  return HAN_RE.test(value) && !KANA_RE.test(value);
}
