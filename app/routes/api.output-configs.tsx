import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { requireBlogDb } from "../lib/d1.server";

type OutputBlock = {
  id: string;
  type: "category" | "group" | "text";
  categorySlug?: string;
  groupId?: string;
  text?: string;
};

type OutputConfigRow = {
  id: string;
  name: string;
  blocks_json: string | null;
  is_active: number | boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type OutputConfigPayload = {
  id: string;
  name: string;
  blocks: OutputBlock[];
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

const parseBlocks = (raw: string | null) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutputBlock[]) : [];
  } catch (_error) {
    return [];
  }
};

export async function loader({ context }: LoaderFunctionArgs) {
  const db = requireBlogDb(context);
  const result = await db
    .prepare(
      "SELECT id, name, blocks_json, is_active, created_at, updated_at FROM output_configs ORDER BY is_active DESC, updated_at DESC, created_at DESC",
    )
    .all<OutputConfigRow>();

  const payload = (result.results ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    blocks: parseBlocks(row.blocks_json),
    is_active: row.is_active ? Boolean(row.is_active) : false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  })) satisfies OutputConfigPayload[];

  return Response.json({ configs: payload });
}

type OutputConfigAction =
  | {
      action: "create";
      name?: string;
      blocks?: OutputBlock[];
      activate?: boolean;
    }
  | {
      action: "update";
      id?: string;
      name?: string;
      blocks?: OutputBlock[];
    }
  | {
      action: "delete";
      id?: string;
    }
  | {
      action: "set-active";
      id?: string;
    };

export async function action({ request, context }: ActionFunctionArgs) {
  const db = requireBlogDb(context);
  const body = (await request.json().catch(() => null)) as OutputConfigAction | null;

  if (!body || typeof body.action !== "string") {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (body.action === "create") {
    const name = (body.name ?? "").trim() || "未命名設定";
    const blocks = Array.isArray(body.blocks) ? body.blocks : [];
    const id = crypto.randomUUID();
    const blocksJson = JSON.stringify(blocks);

    if (body.activate) {
      await db.prepare("UPDATE output_configs SET is_active = 0").run();
    }

    await db
      .prepare(
        "INSERT INTO output_configs (id, name, blocks_json, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
      )
      .bind(id, name, blocksJson, body.activate ? 1 : 0)
      .run();

    return Response.json({ ok: true, id });
  }

  if (body.action === "update") {
    const id = body.id ?? "";
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
    const name = (body.name ?? "").trim() || "未命名設定";
    const blocks = Array.isArray(body.blocks) ? body.blocks : [];
    const blocksJson = JSON.stringify(blocks);

    await db
      .prepare("UPDATE output_configs SET name = ?, blocks_json = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(name, blocksJson, id)
      .run();

    return Response.json({ ok: true });
  }

  if (body.action === "delete") {
    const id = body.id ?? "";
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
    await db.prepare("DELETE FROM output_configs WHERE id = ?").bind(id).run();
    return Response.json({ ok: true });
  }

  if (body.action === "set-active") {
    const id = body.id ?? "";
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
    await db.prepare("UPDATE output_configs SET is_active = 0").run();
    await db
      .prepare("UPDATE output_configs SET is_active = 1, updated_at = datetime('now') WHERE id = ?")
      .bind(id)
      .run();
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
