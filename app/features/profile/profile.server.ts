import { DEFAULT_PROFILE, type Profile } from "../../data/profile";
import {
  PROFILE_DOCUMENT_ID,
  parseProfile,
  toPublicProfile,
} from "./profile-document";

type ProfileDocumentRow = {
  id: string;
  draft_json: string;
  published_json: string;
  published_revision: number;
  draft_updated_at: string;
  published_at: string;
};

export type ProfileDocument = {
  draft: Profile;
  published: Profile;
  publishedRevision: number;
  draftUpdatedAt: string;
  publishedAt: string;
};

export type PublishedProfile = {
  profile: Profile;
  revision: number;
  source: "d1" | "default";
};

const schemaPromises = new WeakMap<object, Promise<void>>();

async function ensureProfileSchema(db: D1Database): Promise<void> {
  const key = db as unknown as object;
  let pending = schemaPromises.get(key);
  if (!pending) {
    pending = (async () => {
      await db.prepare(
        `CREATE TABLE IF NOT EXISTS profile_documents (
          id TEXT PRIMARY KEY CHECK (id = 'primary'),
          draft_json TEXT NOT NULL,
          published_json TEXT NOT NULL,
          published_revision INTEGER NOT NULL DEFAULT 1,
          draft_updated_at TEXT NOT NULL,
          published_at TEXT NOT NULL
        )`,
      ).run();
      const now = new Date().toISOString();
      const initial = JSON.stringify(DEFAULT_PROFILE);
      await db.prepare(
        `INSERT OR IGNORE INTO profile_documents
          (id, draft_json, published_json, published_revision, draft_updated_at, published_at)
         VALUES (?, ?, ?, 1, ?, ?)`,
      ).bind(PROFILE_DOCUMENT_ID, initial, initial, now, now).run();
    })();
    schemaPromises.set(key, pending);
  }
  try {
    await pending;
  } catch (error) {
    schemaPromises.delete(key);
    throw error;
  }
}

function parseRow(row: ProfileDocumentRow): ProfileDocument {
  return {
    draft: parseProfile(JSON.parse(row.draft_json) as unknown),
    published: parseProfile(JSON.parse(row.published_json) as unknown),
    publishedRevision: Math.max(1, Number(row.published_revision) || 1),
    draftUpdatedAt: row.draft_updated_at,
    publishedAt: row.published_at,
  };
}

export async function getProfileDocument(db: D1Database): Promise<ProfileDocument> {
  await ensureProfileSchema(db);
  const row = await db.prepare(
    `SELECT id, draft_json, published_json, published_revision, draft_updated_at, published_at
     FROM profile_documents WHERE id = ? LIMIT 1`,
  ).bind(PROFILE_DOCUMENT_ID).first<ProfileDocumentRow>();
  if (!row) throw new Error("Profile document is unavailable");
  return parseRow(row);
}

export async function getPublishedProfile(db: D1Database): Promise<PublishedProfile> {
  try {
    const document = await getProfileDocument(db);
    return {
      profile: toPublicProfile(document.published),
      revision: document.publishedRevision,
      source: "d1",
    };
  } catch (error) {
    console.warn("profile_document_fallback", JSON.stringify({
      errorCode: error instanceof SyntaxError ? "INVALID_JSON" : "D1_UNAVAILABLE",
    }));
    return { profile: toPublicProfile(DEFAULT_PROFILE), revision: 0, source: "default" };
  }
}

export async function saveProfileDraft(db: D1Database, input: unknown): Promise<ProfileDocument> {
  await ensureProfileSchema(db);
  const profile = parseProfile(input);
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE profile_documents
     SET draft_json = ?, draft_updated_at = ?
     WHERE id = ?`,
  ).bind(JSON.stringify(profile), now, PROFILE_DOCUMENT_ID).run();
  return getProfileDocument(db);
}

export async function publishProfileDraft(db: D1Database): Promise<ProfileDocument> {
  await ensureProfileSchema(db);
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE profile_documents
     SET published_json = draft_json,
         published_revision = published_revision + 1,
         published_at = ?
     WHERE id = ?`,
  ).bind(now, PROFILE_DOCUMENT_ID).run();
  return getProfileDocument(db);
}

export async function resetProfileDraft(db: D1Database): Promise<ProfileDocument> {
  await ensureProfileSchema(db);
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE profile_documents
     SET draft_json = published_json, draft_updated_at = ?
     WHERE id = ?`,
  ).bind(now, PROFILE_DOCUMENT_ID).run();
  return getProfileDocument(db);
}
