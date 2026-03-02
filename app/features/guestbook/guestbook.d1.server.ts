export type GuestbookMsg = {
  id: number;
  name: string | null;
  company: string | null;
  contact: string | null;
  message: string | null;
  wantContact: number; // 0 | 1
  ip: string | null;
  createdAt: string;
};

function mapRow(row: Record<string, unknown>): GuestbookMsg {
  return {
    id: row.id as number,
    name: (row.name as string) ?? null,
    company: (row.company as string) ?? null,
    contact: (row.contact as string) ?? null,
    message: (row.message as string) ?? null,
    wantContact: (row.want_contact as number) ?? 0,
    ip: (row.ip as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function getAllMessages(db: D1Database): Promise<GuestbookMsg[]> {
  const { results } = await db
    .prepare("SELECT * FROM guestbook_messages ORDER BY id DESC")
    .all<Record<string, unknown>>();
  return results.map(mapRow);
}

export async function insertMessage(
  db: D1Database,
  data: {
    name: string | null;
    company: string | null;
    contact: string | null;
    message: string | null;
    wantContact: number;
    ip: string | null;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO guestbook_messages
         (name, company, contact, message, want_contact, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      data.name,
      data.company,
      data.contact,
      data.message,
      data.wantContact,
      data.ip,
      new Date().toISOString(),
    )
    .run();
}

export async function deleteMessage(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM guestbook_messages WHERE id = ?").bind(id).run();
}
