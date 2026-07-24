import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_PROFILE, PROFILE_VERSION } from "../../app/data/profile";
import { AIError } from "../../app/features/ai/errors";
import {
  assertPromptCacheVersion,
  buildEffectivePromptCacheKey,
  buildOpenAIInput,
  buildStableProfilePrefix,
} from "../../app/features/ai/prompt";
import {
  AI_INPUT_LIMITS,
  validateChatInput,
  validateCompanyFitInput,
} from "../../app/features/ai/validation";

test("canonical profile and stable prefix contain only verified content", () => {
  const stablePrefix = buildStableProfilePrefix(DEFAULT_PROFILE, { revision: 1 });
  assert.equal(DEFAULT_PROFILE.version, PROFILE_VERSION);
  assert.equal(PROFILE_VERSION, "huang-profile-v1");
  assert.match(stablePrefix, /黃彥禎/);
  assert.doesNotMatch(stablePrefix, /【待補充】|模板公司|提升 40%|CI\/CD pipeline/);
  assert.ok(stablePrefix.length > 4_000, "stable prefix should exceed the cache eligibility floor");
});

test("company dynamic material is always after the cache breakpoint", () => {
  const marker = "ACME-DYNAMIC-MARKER";
  const items = buildOpenAIInput("company-fit", {
    companyName: marker,
    jobTitle: "Customer Success",
    jobDescription: "協助企業導入 SaaS。",
  }, DEFAULT_PROFILE, 3);
  const rendered = JSON.stringify(items);

  assert.equal(items[0]?.role, "developer");
  assert.match(JSON.stringify(items[0]), /prompt_cache_breakpoint/);
  assert.doesNotMatch(JSON.stringify(items[0]), new RegExp(marker));
  assert.ok(rendered.indexOf(marker) > rendered.indexOf("prompt_cache_breakpoint"));
});

test("prompt cache key must match the profile version", () => {
  assert.doesNotThrow(() => assertPromptCacheVersion(PROFILE_VERSION));
  assert.equal(buildEffectivePromptCacheKey(PROFILE_VERSION, 7), "huang-profile-v1-r7");
  assert.throws(
    () => assertPromptCacheVersion("huang-profile-v2"),
    (error: unknown) => error instanceof AIError && error.code === "SERVER_MISCONFIGURED",
  );
});

test("company-fit validation trims and enforces limits", () => {
  assert.deepEqual(validateCompanyFitInput({ companyName: " 公司 " }), { companyName: "公司" });
  assert.throws(
    () => validateCompanyFitInput({ companyName: "x".repeat(AI_INPUT_LIMITS.companyName + 1) }),
    (error: unknown) => error instanceof AIError && error.code === "CONTENT_TOO_LONG",
  );
});

test("chat validation requires a final user message and caps history", () => {
  assert.deepEqual(validateChatInput({ messages: [{ role: "user", content: "你好" }] }), {
    messages: [{ role: "user", content: "你好" }],
  });
  assert.throws(
    () => validateChatInput({ messages: [{ role: "assistant", content: "你好" }] }),
    (error: unknown) => error instanceof AIError && error.code === "INPUT_INVALID",
  );
  assert.throws(
    () => validateChatInput({
      messages: Array.from({ length: AI_INPUT_LIMITS.chatMessages + 1 }, () => ({
        role: "user",
        content: "test",
      })),
    }),
    (error: unknown) => error instanceof AIError && error.code === "CONTENT_TOO_LONG",
  );
});
