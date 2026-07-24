import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_PROFILE } from "../../app/data/profile";
import { createAdminSessionCookie, getCsrfToken, requireCsrf } from "../../app/features/admin/admin-auth.server";
import { buildStableProfilePrefix } from "../../app/features/ai/prompt";
import { cloneProfile, parseProfile, toPublicProfile } from "../../app/features/profile/profile-document";
import { getProfileDocument, getPublishedProfile, publishProfileDraft, saveProfileDraft } from "../../app/features/profile/profile.server";

type MemoryRow = {
  id: string;
  draft_json: string;
  published_json: string;
  published_revision: number;
  draft_updated_at: string;
  published_at: string;
};

function memoryD1(): D1Database {
  let row: MemoryRow | null = null;
  return {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...next: unknown[]) { values = next; return statement; },
        async run() {
          if (/INSERT OR IGNORE INTO profile_documents/.test(sql) && !row) {
            row = { id: String(values[0]), draft_json: String(values[1]), published_json: String(values[2]), published_revision: 1, draft_updated_at: String(values[3]), published_at: String(values[4]) };
          } else if (/SET draft_json = \?, draft_updated_at = \?/.test(sql) && row) {
            row = { ...row, draft_json: String(values[0]), draft_updated_at: String(values[1]) };
          } else if (/SET published_json = draft_json/.test(sql) && row) {
            row = { ...row, published_json: row.draft_json, published_revision: row.published_revision + 1, published_at: String(values[0]) };
          }
          return { success: true };
        },
        async first<T>() { return row as T | null; },
      };
      return statement;
    },
  } as unknown as D1Database;
}

test("default profile round-trips through the D1 document validator", () => {
  assert.deepEqual(parseProfile(JSON.parse(JSON.stringify(DEFAULT_PROFILE))), DEFAULT_PROFILE);
});

test("public profile and prompt remove private notes and private stories", () => {
  const profile = cloneProfile(DEFAULT_PROFILE);
  profile.interviewKnowledge.privateNotes = ["PRIVATE-MARKER-NOTE"];
  profile.interviewKnowledge.stories = [
    { id: "public-story", title: "Public", situation: "PUBLIC-MARKER", task: "", action: "", result: "", reflection: "", visibility: "public" },
    { id: "private-story", title: "Private", situation: "PRIVATE-MARKER-STORY", task: "", action: "", result: "", reflection: "", visibility: "private" },
  ];

  const publicProfile = toPublicProfile(profile);
  const publicPrefix = buildStableProfilePrefix(publicProfile, { revision: 2 });
  const adminPrefix = buildStableProfilePrefix(profile, { revision: 2, includePrivate: true });
  assert.match(publicPrefix, /PUBLIC-MARKER/);
  assert.doesNotMatch(publicPrefix, /PRIVATE-MARKER/);
  assert.match(adminPrefix, /PRIVATE-MARKER-NOTE/);
  assert.match(adminPrefix, /PRIVATE-MARKER-STORY/);
});

test("same published revision creates a byte-stable prefix", () => {
  assert.equal(
    buildStableProfilePrefix(DEFAULT_PROFILE, { revision: 9 }),
    buildStableProfilePrefix(cloneProfile(DEFAULT_PROFILE), { revision: 9 }),
  );
});

test("saving a draft does not change published data; publishing increments revision", async () => {
  const db = memoryD1();
  const initial = await getProfileDocument(db);
  const draft = cloneProfile(initial.draft);
  draft.personal.title = "DRAFT-ONLY-TITLE";
  await saveProfileDraft(db, draft);

  const beforePublish = await getPublishedProfile(db);
  assert.notEqual(beforePublish.profile.personal.title, "DRAFT-ONLY-TITLE");
  assert.equal(beforePublish.revision, 1);

  const published = await publishProfileDraft(db);
  assert.equal(published.published.personal.title, "DRAFT-ONLY-TITLE");
  assert.equal(published.publishedRevision, 2);
});

test("admin session and matching CSRF token are required for profile writes", async () => {
  const context = { env: { BLOG_ADMIN_PASS: "test-password", BLOG_ADMIN_SESSION_SECRET: "test-session-secret-at-least-32-characters" } } as never;
  const request = new Request("http://localhost/admin/profile");
  const sessionCookie = await createAdminSessionCookie(request, context);
  const sessionPair = sessionCookie.split(";")[0];
  const csrf = await getCsrfToken(new Request(request.url, { headers: { Cookie: sessionPair } }), context);
  const csrfPair = csrf.cookie.split(";")[0];

  await assert.doesNotReject(() => requireCsrf(new Request(request.url, {
    method: "POST",
    headers: { Cookie: `${sessionPair}; ${csrfPair}`, "X-CSRF-Token": csrf.token },
  }), context));
  await assert.rejects(
    () => requireCsrf(new Request(request.url, { method: "POST", headers: { Cookie: `${sessionPair}; ${csrfPair}` } }), context),
    (error: unknown) => error instanceof Response && error.status === 403,
  );
});
