import assert from "node:assert/strict";
import test from "node:test";

import { toTaiwanTraditionalChinese } from "../../app/features/anime/anime-chinese-title.server";

test("converts Simplified Chinese text to Taiwan Traditional Chinese", () => {
  assert.equal(toTaiwanTraditionalChinese("汉语"), "漢語");
});

test("keeps empty input empty", () => {
  assert.equal(toTaiwanTraditionalChinese("   "), "");
});
