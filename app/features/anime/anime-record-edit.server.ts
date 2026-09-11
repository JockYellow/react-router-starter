import { savePrimaryDecision } from "./anime-record.server";
import type { NormalizedAnimeRecordEdit } from "./anime-record-edit";
import { ensureAnimeSchema } from "./anime.schema.server";

export async function saveAnimeRecordEdit(
  db: D1Database,
  animeId: number,
  input: NormalizedAnimeRecordEdit,
): Promise<void> {
  if (input.status !== "SEEN") {
    await savePrimaryDecision(db, animeId, input.status);
    return;
  }

  await ensureAnimeSchema(db);
  const now = Date.now();
  const statements = [
    db
      .prepare(
        `INSERT INTO anime_user_decisions (
          anime_id, status, detail_status, decided_at, updated_at
        ) VALUES (?, 'SEEN', ?, ?, ?)
        ON CONFLICT(anime_id) DO UPDATE SET
          status = 'SEEN',
          detail_status = excluded.detail_status,
          updated_at = excluded.updated_at`,
      )
      .bind(animeId, input.detailStatus, now, now),
    db.prepare("DELETE FROM anime_user_evaluation_tags WHERE anime_id = ?").bind(animeId),
    db.prepare("DELETE FROM anime_user_evaluations WHERE anime_id = ?").bind(animeId),
  ];

  if (input.rating || input.note) {
    statements.push(
      db
        .prepare(
          `INSERT INTO anime_user_evaluations (anime_id, rating, note, updated_at)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(animeId, input.rating, input.note, now),
    );
  }

  for (const tag of input.tags) {
    statements.push(
      db
        .prepare(
          "INSERT INTO anime_user_evaluation_tags (anime_id, tag_key, created_at) VALUES (?, ?, ?)",
        )
        .bind(animeId, tag, now),
    );
  }

  await db.batch(statements);
}
