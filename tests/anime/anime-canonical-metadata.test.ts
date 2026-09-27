import assert from "node:assert/strict";
import test from "node:test";

import { selectAnimeDisplayTitle } from "../../app/features/anime/anime-canonical-metadata.server";

test("canonical metadata display title prefers zh-TW, then native, romaji and English", () => {
  assert.equal(
    selectAnimeDisplayTitle({
      zhTw: "中文名稱",
      native: "日本語",
      romaji: "Romaji",
      english: "English",
    }),
    "中文名稱",
  );

  assert.equal(
    selectAnimeDisplayTitle({
      zhTw: " ",
      native: "日本語",
      romaji: "Romaji",
      english: "English",
    }),
    "日本語",
  );

  assert.equal(
    selectAnimeDisplayTitle({
      zhTw: null,
      native: null,
      romaji: "Romaji",
      english: "English",
    }),
    "Romaji",
  );

  assert.equal(
    selectAnimeDisplayTitle({
      zhTw: null,
      native: null,
      romaji: null,
      english: "English",
    }),
    "English",
  );
});

test("canonical metadata display title has a deterministic empty fallback", () => {
  assert.equal(
    selectAnimeDisplayTitle({
      zhTw: null,
      native: null,
      romaji: null,
      english: null,
    }),
    "未命名作品",
  );
});
