import assert from "node:assert/strict";
import test from "node:test";

import { resolveBangumiPersonDisplayName } from "../../app/features/anime/anime-credit-display.server";

test("studio display prefers Bangumi Chinese name and converts it to Taiwan Traditional", () => {
  const result = resolveBangumiPersonDisplayName("京都アニメーション", [
    { key: "简体中文名", value: "京都动画" },
    {
      key: "别名",
      value: [
        { k: "英文名", v: "Kyoto Animation Co., Ltd." },
        { v: "KyoAni" },
      ],
    },
  ]);

  assert.equal(result.rawName, "京都アニメーション");
  assert.equal(result.displayName, "京都動畫");
  assert.deepEqual(result.aliases, [
    "京都动画",
    "Kyoto Animation Co., Ltd.",
    "KyoAni",
  ]);
});

test("kana-heavy studio name falls back to explicit English alias", () => {
  const result = resolveBangumiPersonDisplayName("サンプルスタジオ", [
    { key: "别名", value: [{ k: "英文名", v: "Sample Studio" }] },
  ]);

  assert.equal(result.displayName, "Sample Studio");
});

test("already readable Latin studio keeps raw provider name", () => {
  const result = resolveBangumiPersonDisplayName("MAPPA", [
    { key: "别名", value: [{ k: "英文名", v: "Maruyama Animation Produce Project Association" }] },
  ]);

  assert.equal(result.displayName, "MAPPA");
});

test("studio display leaves raw provider name when no useful alias exists", () => {
  const result = resolveBangumiPersonDisplayName("スタジオ例", [
    { key: "官方网站", value: "https://example-studio.jp" },
    { key: "生日", value: "2000-01-01" },
  ]);

  assert.equal(result.displayName, "スタジオ例");
});
