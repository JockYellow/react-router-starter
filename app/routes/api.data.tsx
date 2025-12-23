import type { LoaderFunctionArgs } from "react-router";

import { requireBlogDb } from "../lib/d1.server";

type CategoryRow = {
  id: number;
  slug: string;
  label: string;
  type: string | null;
  min_count: number | null;
  max_count: number | null;
  sort_order: number | null;
};

type PromptRow = {
  id: number;
  category_slug: string;
  value: string;
  label: string | null;
  is_active: number | boolean | null;
};

type PromptItem = {
  id: number;
  value: string;
  label: string | null;
  is_active: boolean;
};

type CategoryPayload = {
  id: number;
  slug: string;
  label: string;
  type: string;
  min_count: number;
  max_count: number;
  sort_order: number;
  items: PromptItem[];
};

export async function loader({ context }: LoaderFunctionArgs) {
  const db = requireBlogDb(context);
  const categoriesRes = await db
    .prepare("SELECT id, slug, label, type, min_count, max_count, sort_order FROM categories ORDER BY sort_order, id")
    .all<CategoryRow>();
  const promptsRes = await db
    .prepare("SELECT id, category_slug, value, label, is_active FROM prompts ORDER BY id")
    .all<PromptRow>();

  const promptMap = new Map<string, PromptItem[]>();
  for (const row of promptsRes.results ?? []) {
    const isActive = row.is_active === null || row.is_active === undefined ? true : Boolean(row.is_active);
    const item: PromptItem = {
      id: row.id,
      value: row.value,
      label: row.label ?? null,
      is_active: isActive,
    };
    const list = promptMap.get(row.category_slug);
    if (list) {
      list.push(item);
    } else {
      promptMap.set(row.category_slug, [item]);
    }
  }

  const payload: CategoryPayload[] = (categoriesRes.results ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    label: row.label,
    type: row.type ?? "required",
    min_count: row.min_count ?? 1,
    max_count: row.max_count ?? 1,
    sort_order: row.sort_order ?? 0,
    items: promptMap.get(row.slug) ?? [],
  }));

  return Response.json(payload);
}
