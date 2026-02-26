export type ChangelogTag = "add" | "fix" | "change" | "docs";

export type Changelog = {
  id: number;
  slug: string;
  date: string;
  title: string;
  notes: string[];
  tag: ChangelogTag | null;
  createdAt: string;
  updatedAt: string;
};

async function ensureChangelogSchema(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS changelogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '[]',
        tag TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    )
    .run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_changelogs_date ON changelogs (date DESC)").run();
}

function parseNotes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((n) => n.toString());
  } catch {
    // ignore broken JSON
  }
  return [];
}

function mapRowToChangelog(row: Record<string, any>): Changelog {
  return {
    id: row.id,
    slug: row.slug,
    date: row.date,
    title: row.title,
    notes: parseNotes(row.notes),
    tag: row.tag ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllChangelogs(db: D1Database): Promise<Changelog[]> {
  await ensureChangelogSchema(db);
  const { results } = await db
    .prepare(
      `SELECT id, slug, date, title, notes, tag, created_at, updated_at
       FROM changelogs
       ORDER BY date DESC, id DESC`,
    )
    .all<Record<string, any>>();
  return results.map(mapRowToChangelog);
}

export async function upsertChangelog(
  db: D1Database,
  data: {
    slug: string;
    date: string;
    title: string;
    notes: string[];
    tag: string | null;
  },
): Promise<void> {
  await ensureChangelogSchema(db);
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO changelogs (slug, date, title, notes, tag, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         date = excluded.date,
         title = excluded.title,
         notes = excluded.notes,
         tag = excluded.tag,
         updated_at = excluded.updated_at`,
    )
    .bind(data.slug, data.date, data.title, JSON.stringify(data.notes), data.tag || null, now, now)
    .run();
}

export async function deleteChangelog(db: D1Database, id: number): Promise<void> {
  await ensureChangelogSchema(db);
  await db.prepare("DELETE FROM changelogs WHERE id = ?").bind(id).run();
}
