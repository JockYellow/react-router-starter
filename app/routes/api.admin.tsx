import type { ActionFunctionArgs } from "react-router";

import { requireBlogDb } from "../lib/d1.server";

type AdminPayload = {
  action?: "create" | "update" | "delete";
  table?: "categories" | "prompts";
  data?: Record<string, unknown>;
  id?: number | string;
  slug?: string;
};

const toBool = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value === "1" || value.toLowerCase() === "true";
  return false;
};

const toNumber = (value: unknown, fallback: number) => {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
};

const toString = (value: unknown) => (value ?? "").toString().trim();

export async function action({ request, context }: ActionFunctionArgs) {
  const db = requireBlogDb(context);
  const body = (await request.json().catch(() => null)) as AdminPayload | null;

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const action = body.action;
  const table = body.table;
  const data = body.data ?? {};

  if (!action || !table) {
    return Response.json({ error: "Missing action or table" }, { status: 400 });
  }

  if (table === "categories") {
    if (action === "create") {
      const slug = toString(data.slug);
      const label = toString(data.label);
      if (!slug || !label) return Response.json({ error: "Missing slug or label" }, { status: 400 });
      const uiGroup = toString(data.ui_group) || "Default";
      const isOptional = toBool(data.is_optional);
      const type = toString(data.type) || (isOptional ? "optional" : "required");
      const minCount = toNumber(data.min_count ?? data.min, 1);
      const maxCount = Math.max(minCount, toNumber(data.max_count ?? data.max, minCount));

      let sortOrder = toNumber(data.sort_order, 0);
      if (sortOrder <= 0) {
        const maxRow = await db.prepare("SELECT MAX(sort_order) as max_order FROM categories").first<{
          max_order: number | null;
        }>();
        sortOrder = (maxRow?.max_order ?? 0) + 1;
      }

      await db
        .prepare(
          "INSERT INTO categories (slug, label, ui_group, is_optional, type, min_count, max_count, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(slug, label, uiGroup, isOptional ? 1 : 0, type, minCount, maxCount, sortOrder)
        .run();

      return Response.json({ ok: true });
    }

    if (action === "update") {
      const id = body.id ?? data.id;
      const slug = toString(body.slug ?? data.slug);
      if (!id && !slug) return Response.json({ error: "Missing category id or slug" }, { status: 400 });

      const label = toString(data.label);
      const uiGroup = toString(data.ui_group) || "Default";
      const isOptional = toBool(data.is_optional);
      const type = toString(data.type) || (isOptional ? "optional" : "required");
      const minCount = toNumber(data.min_count ?? data.min, 1);
      const maxCount = Math.max(minCount, toNumber(data.max_count ?? data.max, minCount));
      const sortOrder = toNumber(data.sort_order ?? 0, 0);

      const whereClause = id ? "id = ?" : "slug = ?";
      const whereValue = id ?? slug;

      await db
        .prepare(
          `UPDATE categories SET label = ?, ui_group = ?, is_optional = ?, type = ?, min_count = ?, max_count = ?, sort_order = ? WHERE ${whereClause}`,
        )
        .bind(label, uiGroup, isOptional ? 1 : 0, type, minCount, maxCount, sortOrder, whereValue)
        .run();

      return Response.json({ ok: true });
    }

    if (action === "delete") {
      const id = body.id ?? data.id;
      const slug = toString(body.slug ?? data.slug);
      if (!id && !slug) return Response.json({ error: "Missing category id or slug" }, { status: 400 });
      let targetSlug = slug;
      if (!targetSlug && id) {
        const row = await db.prepare("SELECT slug FROM categories WHERE id = ?").bind(id).first<{
          slug: string;
        }>();
        targetSlug = row?.slug ?? "";
      }

      if (targetSlug) {
        await db.prepare("DELETE FROM prompts WHERE category_slug = ?").bind(targetSlug).run();
      }
      const whereClause = id ? "id = ?" : "slug = ?";
      const whereValue = id ?? targetSlug;
      await db.prepare(`DELETE FROM categories WHERE ${whereClause}`).bind(whereValue).run();
      return Response.json({ ok: true });
    }
  }

  if (table === "prompts") {
    if (action === "create") {
      const categorySlug = toString(data.category_slug);
      const value = toString(data.value);
      const label = toString(data.label);
      const isActive = data.is_active === undefined ? true : toBool(data.is_active);
      if (!categorySlug || !value) {
        return Response.json({ error: "Missing category_slug or value" }, { status: 400 });
      }

      await db
        .prepare("INSERT INTO prompts (category_slug, value, label, is_active) VALUES (?, ?, ?, ?)")
        .bind(categorySlug, value, label || null, isActive ? 1 : 0)
        .run();
      return Response.json({ ok: true });
    }

    if (action === "update") {
      const id = toNumber(body.id ?? data.id, 0);
      if (!id) return Response.json({ error: "Missing prompt id" }, { status: 400 });
      const value = toString(data.value);
      const label = toString(data.label);
      const isActive = data.is_active === undefined ? true : toBool(data.is_active);

      await db
        .prepare("UPDATE prompts SET value = ?, label = ?, is_active = ? WHERE id = ?")
        .bind(value, label || null, isActive ? 1 : 0, id)
        .run();
      return Response.json({ ok: true });
    }

    if (action === "delete") {
      const id = toNumber(body.id ?? data.id, 0);
      if (!id) return Response.json({ error: "Missing prompt id" }, { status: 400 });
      await db.prepare("DELETE FROM prompts WHERE id = ?").bind(id).run();
      return Response.json({ ok: true });
    }
  }

  return Response.json({ error: "Unsupported operation" }, { status: 400 });
}
