// app/lib/gift.server.ts
import type { D1Database } from "@cloudflare/workers-types";

export type Gift = {
  id: string;
  type: 'GOOD' | 'BAD';
  slogan: string;
  tags: string[]; // 我們會手動 parse
  image_key?: string | null;
  is_locked: boolean;
  is_forced: boolean;
  vote_count: number;
  provider_name: string;
  holder_id?: string | null;
  holder_name?: string;
};

function parseTags(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((t): t is string => typeof t === "string");
  }
  if (typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter((t): t is string => typeof t === "string");
    }
  } catch {
    // Fall back to comma-separated tags
  }
  return trimmed.split(",").map((t) => t.trim()).filter(Boolean);
}

// 取得所有禮物列表 (包含提供者名字)
export async function getGifts(db: D1Database): Promise<Gift[]> {
  const query = `
    SELECT 
      g.*, 
      p_prov.name as provider_name, 
      p_hold.name as holder_name 
    FROM gifts g
    LEFT JOIN players p_prov ON g.provider_id = p_prov.id
    LEFT JOIN players p_hold ON g.holder_id = p_hold.id
    ORDER BY g.created_at DESC
  `;
  
  const { results } = await db.prepare(query).all();

  // 整理資料格式 (把 tags 從字串轉回 Array, 0/1 轉回 boolean)
  return results.map((r: any) => ({
    ...r,
    tags: parseTags(r.tags),
    is_locked: Boolean(r.is_locked),
    is_forced: Boolean(r.is_forced),
    // 確保 SQLite 的 integer 0/1 被轉為 boolean
  }));
}

// 切換鎖定狀態
export async function toggleLock(db: D1Database, giftId: string, currentStatus: boolean) {
  if (currentStatus) {
    return { success: false, newStatus: true, reason: "already_locked" };
  }
  await db.prepare("UPDATE gifts SET is_locked = 1 WHERE id = ?").bind(giftId).run();

  return { success: true, newStatus: true };
}
