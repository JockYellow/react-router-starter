import type { CompanyPage, CompanyPageInput } from "./resume.types";

async function ensureCompanyPagesSchema(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS company_pages (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        slug                TEXT UNIQUE NOT NULL,
        company_name        TEXT NOT NULL,
        why_this_company    TEXT,
        relevant_experience TEXT DEFAULT '[]',
        what_i_bring        TEXT,
        questions_or_ideas  TEXT,
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL
      )`,
    )
    .run();
  await db
    .prepare("CREATE INDEX IF NOT EXISTS idx_company_pages_slug ON company_pages (slug)")
    .run();
}

export async function getCompanyPage(
  db: D1Database,
  slug: string,
): Promise<CompanyPage | null> {
  await ensureCompanyPagesSchema(db);
  const row = await db
    .prepare("SELECT * FROM company_pages WHERE slug = ? LIMIT 1")
    .bind(slug)
    .first<CompanyPage>();
  return row ?? null;
}

export async function getAllCompanyPages(db: D1Database): Promise<CompanyPage[]> {
  await ensureCompanyPagesSchema(db);
  const result = await db
    .prepare("SELECT * FROM company_pages ORDER BY created_at DESC")
    .all<CompanyPage>();
  return result.results;
}

export async function upsertCompanyPage(
  db: D1Database,
  data: CompanyPageInput,
): Promise<void> {
  await ensureCompanyPagesSchema(db);
  const now = new Date().toISOString();
  const expJson = JSON.stringify(data.relevant_experience);
  await db
    .prepare(
      `INSERT INTO company_pages
         (slug, company_name, why_this_company, relevant_experience, what_i_bring, questions_or_ideas, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         company_name       = excluded.company_name,
         why_this_company   = excluded.why_this_company,
         relevant_experience = excluded.relevant_experience,
         what_i_bring       = excluded.what_i_bring,
         questions_or_ideas = excluded.questions_or_ideas,
         updated_at         = excluded.updated_at`,
    )
    .bind(
      data.slug,
      data.company_name,
      data.why_this_company,
      expJson,
      data.what_i_bring,
      data.questions_or_ideas,
      now,
      now,
    )
    .run();
}

export async function deleteCompanyPage(db: D1Database, id: number): Promise<void> {
  await ensureCompanyPagesSchema(db);
  await db.prepare("DELETE FROM company_pages WHERE id = ?").bind(id).run();
}
