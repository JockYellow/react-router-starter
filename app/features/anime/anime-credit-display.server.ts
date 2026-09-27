import { toTaiwanTraditionalChinese } from "./anime-chinese-title.server";

type InfoboxEntry = {
  key?: unknown;
  value?: unknown;
};

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nestedNamedValues(value: unknown): Array<{ key: string | null; value: string }> {
  if (!Array.isArray(value)) return [];
  const result: Array<{ key: string | null; value: string }> = [];

  for (const item of value) {
    if (typeof item === "string") {
      const text = clean(item);
      if (text) result.push({ key: null, value: text });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const text = clean(record.v ?? record.value);
    if (!text) continue;
    result.push({ key: clean(record.k ?? record.key), value: text });
  }

  return result;
}

function isChineseNameKey(value: string): boolean {
  return /(简体中文名|簡體中文名|中文名|中文名稱|中文名称)/.test(value);
}

function isEnglishNameKey(value: string): boolean {
  return /(英文名|英語名|英语名|English)/i.test(value);
}

function hasKana(value: string): boolean {
  return /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value);
}

function looksLatinReadable(value: string): boolean {
  return /[A-Za-z]/.test(value) && !hasKana(value);
}

export type BangumiPersonDisplayName = {
  rawName: string;
  displayName: string;
  aliases: string[];
};

/**
 * Chooses a readable display name from Bangumi's PersonDetail infobox.
 *
 * Provider text is never overwritten: rawName is kept separately. Chinese names
 * are preferred and converted to Taiwan Traditional Chinese. For a kana-heavy raw
 * company name, an explicit English alias is preferred when no Chinese alias exists.
 */
export function resolveBangumiPersonDisplayName(
  rawName: string,
  infobox: unknown,
): BangumiPersonDisplayName {
  const raw = clean(rawName) ?? rawName;
  const aliases: Array<{ key: string | null; value: string }> = [];

  if (Array.isArray(infobox)) {
    for (const item of infobox) {
      if (!item || typeof item !== "object") continue;
      const entry = item as InfoboxEntry;
      const key = clean(entry.key);
      const direct = clean(entry.value);
      if (direct) aliases.push({ key, value: direct });
      aliases.push(...nestedNamedValues(entry.value));
    }
  }

  const distinct = Array.from(new Map(
    aliases
      .filter((item) => item.value !== raw)
      .map((item) => [item.value, item] as const),
  ).values());

  const chinese = distinct.find((item) => item.key && isChineseNameKey(item.key));
  const english = distinct.find((item) => item.key && isEnglishNameKey(item.key))
    ?? distinct.find((item) => looksLatinReadable(item.value));

  let displayName = raw;
  if (chinese) {
    displayName = toTaiwanTraditionalChinese(chinese.value) || chinese.value;
  } else if (hasKana(raw) && english) {
    displayName = english.value;
  }

  return {
    rawName: raw,
    displayName,
    aliases: distinct.map((item) => item.value),
  };
}
