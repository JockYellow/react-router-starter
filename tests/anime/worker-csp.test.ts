import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workerSource = readFileSync(new URL("../../workers/app.ts", import.meta.url), "utf8");

test("Worker CSP allows Bangumi cover image origin", () => {
  assert.match(
    workerSource,
    /img-src[^;\n]*BANGUMI_IMAGE_ORIGIN/,
    "img-src CSP should include the Bangumi image origin constant",
  );
  assert.match(workerSource, /BANGUMI_IMAGE_ORIGIN\s*=\s*"https:\/\/lain\.bgm\.tv"/);
});
