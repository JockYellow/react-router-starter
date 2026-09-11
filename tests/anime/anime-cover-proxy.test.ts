import assert from "node:assert/strict";
import test from "node:test";

import {
  animeCoverProxyPath,
  parseAllowedAnimeCoverUrl,
} from "../../app/features/anime/anime-cover.server";

test("anime cover proxy path uses internal anime id", () => {
  assert.equal(animeCoverProxyPath(123), "/api/anime/cover/123");
  assert.throws(() => animeCoverProxyPath(0), /Invalid anime id/);
});

test("anime cover proxy only permits known HTTPS provider hosts", () => {
  assert.equal(
    parseAllowedAnimeCoverUrl("https://lain.bgm.tv/pic/cover/l/example.jpg")?.hostname,
    "lain.bgm.tv",
  );
  assert.equal(
    parseAllowedAnimeCoverUrl("https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/example.jpg")?.hostname,
    "s4.anilist.co",
  );
  assert.equal(parseAllowedAnimeCoverUrl("http://lain.bgm.tv/pic/cover/l/example.jpg"), null);
  assert.equal(parseAllowedAnimeCoverUrl("https://example.com/cover.jpg"), null);
  assert.equal(parseAllowedAnimeCoverUrl("https://lain.bgm.tv.evil.example/cover.jpg"), null);
  assert.equal(parseAllowedAnimeCoverUrl("not-a-url"), null);
});
