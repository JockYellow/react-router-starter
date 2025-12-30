import type { ActionFunctionArgs } from "react-router";

import { requireBlogDb } from "../../lib/d1.server";
import {
  CATEGORY_HEADERS,
  PROMPT_HEADERS,
  buildCategoriesCsv,
  buildPromptsCsv,
} from "../../lib/rng-prompt-csv.server";

type CategoryLookup = {
  id: number;
  slug: string;
  min_count: number | null;
  max_count: number | null;
  sort_order: number | null;
};

type PromptLookup = {
  id: number;
  category_slug: string;
  value: string;
};

const parseCsv = (input: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (inQuotes) {
      if (char === '"') {
        const nextChar = input[index + 1];
        if (nextChar === '"') {
          value += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(value);
      value = "";
      continue;
    }

    if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    if (char === "\r") {
      const nextChar = input[index + 1];
      if (nextChar === "\n") {
        index += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
};

const normalizeHeader = (value: string, index: number) =>
  (index === 0 ? value.replace(/^\uFEFF/, "") : value).trim();

const parseIntCell = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? "invalid" : parsed;
};

const parseBoolCell = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === "1" || trimmed === "true") return true;
  if (trimmed === "0" || trimmed === "false") return false;
  return "invalid";
};

const toText = (value: string) => value.trim();

const ensureBackupTable = async (db: D1Database) => {
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS rng_prompt_backups (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL DEFAULT (datetime('now')), categories_csv TEXT NOT NULL, prompts_csv TEXT NOT NULL)",
    )
    .run();
};

const createBackup = async (db: D1Database) => {
  await ensureBackupTable(db);
  const categoriesCsv = await buildCategoriesCsv(db, false);
  const promptsCsv = await buildPromptsCsv(db, false);
  const result = await db
    .prepare("INSERT INTO rng_prompt_backups (categories_csv, prompts_csv) VALUES (?, ?)")
    .bind(categoriesCsv, promptsCsv)
    .run();
  return result?.meta?.last_row_id ?? null;
};

export async function action({ request, context }: ActionFunctionArgs) {
  const db = requireBlogDb(context);
  const formData = await request.formData();
  const type = formData.get("type");
  const file = formData.get("file");

  if (type !== "categories" && type !== "prompts") {
    return Response.json({ error: "Invalid import type" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return Response.json({ error: "Missing CSV file" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return Response.json({ error: "CSV is empty" }, { status: 400 });
  }

  const expectedHeaders = type === "categories" ? CATEGORY_HEADERS : PROMPT_HEADERS;
  const header = rows[0]?.map(normalizeHeader) ?? [];
  if (header.length !== expectedHeaders.length) {
    return Response.json(
      { error: "CSV header mismatch", expected: expectedHeaders.join(",") },
      { status: 400 },
    );
  }
  for (let index = 0; index < expectedHeaders.length; index += 1) {
    if (header[index] !== expectedHeaders[index]) {
      return Response.json(
        { error: "CSV header mismatch", expected: expectedHeaders.join(",") },
        { status: 400 },
      );
    }
  }

  const dataRows = rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim().length > 0));
  if (dataRows.length === 0) {
    return Response.json({ error: "CSV has no data rows" }, { status: 400 });
  }

  const errors: string[] = [];

  if (type === "categories") {
    const existingResult = await db
      .prepare("SELECT id, slug, min_count, max_count, sort_order FROM categories")
      .all<CategoryLookup>();
    const byId = new Map<number, CategoryLookup>();
    const bySlug = new Map<string, CategoryLookup>();
    (existingResult.results ?? []).forEach((row) => {
      byId.set(row.id, row);
      bySlug.set(row.slug, row);
    });
    const maxSortRow = await db.prepare("SELECT MAX(sort_order) as max_order FROM categories").first<{
      max_order: number | null;
    }>();
    let nextSortOrder = (maxSortRow?.max_order ?? 0) + 1;

    const allowedTypes = new Set(["required", "optional", "group"]);
    const entries: Array<{
      id: number;
      slug: string;
      label: string;
      ui_group: string;
      is_optional: boolean;
      type: string;
      min_count: number | null;
      max_count: number | null;
      sort_order: number | null;
    }> = [];

    for (let index = 0; index < dataRows.length; index += 1) {
      const row = dataRows[index];
      const rowIndex = index + 2;
      if (row.length !== CATEGORY_HEADERS.length) {
        errors.push(`第 ${rowIndex} 行欄位數量不正確`);
        continue;
      }

      const idCell = parseIntCell(row[0]);
      if (idCell === "invalid") {
        errors.push(`第 ${rowIndex} 行 id 不是數字`);
        continue;
      }
      const id = typeof idCell === "number" ? idCell : 0;

      const slug = toText(row[1]);
      if (!slug) {
        errors.push(`第 ${rowIndex} 行 slug 為必填`);
        continue;
      }

      const label = toText(row[2]);
      if (!label) {
        errors.push(`第 ${rowIndex} 行 label 為必填`);
        continue;
      }

      const uiGroup = toText(row[3]) || "Default";
      const optionalCell = parseBoolCell(row[4]);
      if (optionalCell === "invalid") {
        errors.push(`第 ${rowIndex} 行 is_optional 必須是 0/1/true/false`);
        continue;
      }

      const rawType = toText(row[5]);
      if (rawType && !allowedTypes.has(rawType)) {
        errors.push(`第 ${rowIndex} 行 type 必須是 required/optional/group`);
        continue;
      }

      const minCell = parseIntCell(row[6]);
      if (minCell === "invalid") {
        errors.push(`第 ${rowIndex} 行 min_count 不是數字`);
        continue;
      }
      const maxCell = parseIntCell(row[7]);
      if (maxCell === "invalid") {
        errors.push(`第 ${rowIndex} 行 max_count 不是數字`);
        continue;
      }
      const sortCell = parseIntCell(row[8]);
      if (sortCell === "invalid") {
        errors.push(`第 ${rowIndex} 行 sort_order 不是數字`);
        continue;
      }

      const existingById = id ? byId.get(id) : undefined;
      if (existingById && existingById.slug !== slug) {
        errors.push(`第 ${rowIndex} 行 id 與 slug 對不起來`);
        continue;
      }
      if (id > 0 && !existingById && bySlug.has(slug)) {
        errors.push(`第 ${rowIndex} 行 id 不存在但 slug 已存在，請清空 id 或修正`);
        continue;
      }

      const resolvedType = rawType || (optionalCell === true ? "optional" : "required");
      const resolvedOptional =
        resolvedType === "optional" ? true : resolvedType === "required" ? false : optionalCell ?? false;

      entries.push({
        id,
        slug,
        label,
        ui_group: uiGroup,
        is_optional: resolvedOptional,
        type: resolvedType,
        min_count: typeof minCell === "number" ? minCell : null,
        max_count: typeof maxCell === "number" ? maxCell : null,
        sort_order: typeof sortCell === "number" ? sortCell : null,
      });
    }

    if (errors.length > 0) {
      return Response.json({ error: "CSV 有錯誤", details: errors }, { status: 400 });
    }

    const backupId = await createBackup(db);
    let created = 0;
    let updated = 0;

    for (const entry of entries) {
      const existing = entry.id ? byId.get(entry.id) : undefined;
      const existingBySlug = bySlug.get(entry.slug);
      const target = existing ?? existingBySlug;
      if (target) {
        const minValue = entry.min_count ?? target.min_count ?? 1;
        const maxValue = entry.max_count ?? target.max_count ?? minValue;
        const safeMin = Math.max(0, minValue);
        const safeMax = Math.max(safeMin, maxValue);
        const sortValue = entry.sort_order ?? target.sort_order ?? 0;

        await db
          .prepare(
            "UPDATE categories SET label = ?, ui_group = ?, is_optional = ?, type = ?, min_count = ?, max_count = ?, sort_order = ? WHERE id = ?",
          )
          .bind(
            entry.label,
            entry.ui_group,
            entry.is_optional ? 1 : 0,
            entry.type,
            safeMin,
            safeMax,
            sortValue,
            target.id,
          )
          .run();
        updated += 1;
        const nextRecord = {
          id: target.id,
          slug: entry.slug,
          min_count: safeMin,
          max_count: safeMax,
          sort_order: sortValue,
        };
        byId.set(target.id, nextRecord);
        bySlug.set(entry.slug, nextRecord);
      } else {
        const minValue = entry.min_count ?? 1;
        const maxValue = entry.max_count ?? minValue;
        const safeMin = Math.max(0, minValue);
        const safeMax = Math.max(safeMin, maxValue);
        const sortValue = entry.sort_order ?? nextSortOrder;
        if (entry.sort_order === null) nextSortOrder += 1;

        if (entry.id > 0) {
          await db
            .prepare(
              "INSERT INTO categories (id, slug, label, ui_group, is_optional, type, min_count, max_count, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(
              entry.id,
              entry.slug,
              entry.label,
              entry.ui_group,
              entry.is_optional ? 1 : 0,
              entry.type,
              safeMin,
              safeMax,
              sortValue,
            )
            .run();
          const nextRecord = {
            id: entry.id,
            slug: entry.slug,
            min_count: safeMin,
            max_count: safeMax,
            sort_order: sortValue,
          };
          byId.set(entry.id, nextRecord);
          bySlug.set(entry.slug, nextRecord);
        } else {
          const result = await db
            .prepare(
              "INSERT INTO categories (slug, label, ui_group, is_optional, type, min_count, max_count, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(
              entry.slug,
              entry.label,
              entry.ui_group,
              entry.is_optional ? 1 : 0,
              entry.type,
              safeMin,
              safeMax,
              sortValue,
            )
            .run();
          const insertedId = result?.meta?.last_row_id;
          if (insertedId) {
            const nextRecord = {
              id: insertedId,
              slug: entry.slug,
              min_count: safeMin,
              max_count: safeMax,
              sort_order: sortValue,
            };
            byId.set(insertedId, nextRecord);
            bySlug.set(entry.slug, nextRecord);
          }
        }
        created += 1;
      }
    }

    return Response.json({ ok: true, type, created, updated, backupId });
  }

  const categories = await db.prepare("SELECT slug FROM categories").all<{ slug: string }>();
  const categorySet = new Set((categories.results ?? []).map((row) => row.slug));
  const existingPrompts = await db.prepare("SELECT id, category_slug, value FROM prompts").all<PromptLookup>();
  const promptById = new Map<number, PromptLookup>();
  const promptByKey = new Map<string, PromptLookup>();
  (existingPrompts.results ?? []).forEach((row) => {
    promptById.set(row.id, row);
    promptByKey.set(`${row.category_slug}::${row.value}`, row);
  });

  const entries: Array<{
    id: number;
    category_slug: string;
    value: string;
    label: string;
    is_active: boolean;
  }> = [];

  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index];
    const rowIndex = index + 2;
    if (row.length !== PROMPT_HEADERS.length) {
      errors.push(`第 ${rowIndex} 行欄位數量不正確`);
      continue;
    }

    const idCell = parseIntCell(row[0]);
    if (idCell === "invalid") {
      errors.push(`第 ${rowIndex} 行 id 不是數字`);
      continue;
    }
    const id = typeof idCell === "number" ? idCell : 0;

    const categorySlug = toText(row[1]);
    if (!categorySlug) {
      errors.push(`第 ${rowIndex} 行 category_slug 為必填`);
      continue;
    }
    if (!categorySet.has(categorySlug)) {
      errors.push(`第 ${rowIndex} 行 category_slug 不存在`);
      continue;
    }

    const value = toText(row[2]);
    if (!value) {
      errors.push(`第 ${rowIndex} 行 value 為必填`);
      continue;
    }
    const label = toText(row[3]);
    const activeCell = parseBoolCell(row[4]);
    if (activeCell === "invalid") {
      errors.push(`第 ${rowIndex} 行 is_active 必須是 0/1/true/false`);
      continue;
    }
    const isActive = activeCell === null ? true : activeCell;

    const existingById = id ? promptById.get(id) : undefined;
    const existingByKey = promptByKey.get(`${categorySlug}::${value}`);
    if (id > 0 && !existingById && existingByKey) {
      errors.push(`第 ${rowIndex} 行 id 不存在但組合鍵已存在，請清空 id 或修正`);
      continue;
    }

    entries.push({
      id,
      category_slug: categorySlug,
      value,
      label,
      is_active: isActive,
    });
  }

  if (errors.length > 0) {
    return Response.json({ error: "CSV 有錯誤", details: errors }, { status: 400 });
  }

  const backupId = await createBackup(db);
  let created = 0;
  let updated = 0;

  for (const entry of entries) {
    const existingById = entry.id ? promptById.get(entry.id) : undefined;
    const existingByKey = existingById ? undefined : promptByKey.get(`${entry.category_slug}::${entry.value}`);
    const existing = existingById ?? existingByKey;

    if (existing) {
      await db
        .prepare("UPDATE prompts SET category_slug = ?, value = ?, label = ?, is_active = ? WHERE id = ?")
        .bind(entry.category_slug, entry.value, entry.label || null, entry.is_active ? 1 : 0, existing.id)
        .run();
      updated += 1;
      const nextRecord = { id: existing.id, category_slug: entry.category_slug, value: entry.value };
      promptById.set(existing.id, nextRecord);
      promptByKey.set(`${entry.category_slug}::${entry.value}`, nextRecord);
    } else if (entry.id > 0) {
      await db
        .prepare("INSERT INTO prompts (id, category_slug, value, label, is_active) VALUES (?, ?, ?, ?, ?)")
        .bind(entry.id, entry.category_slug, entry.value, entry.label || null, entry.is_active ? 1 : 0)
        .run();
      created += 1;
      const nextRecord = { id: entry.id, category_slug: entry.category_slug, value: entry.value };
      promptById.set(entry.id, nextRecord);
      promptByKey.set(`${entry.category_slug}::${entry.value}`, nextRecord);
    } else {
      const result = await db
        .prepare("INSERT INTO prompts (category_slug, value, label, is_active) VALUES (?, ?, ?, ?)")
        .bind(entry.category_slug, entry.value, entry.label || null, entry.is_active ? 1 : 0)
        .run();
      created += 1;
      const insertedId = result?.meta?.last_row_id;
      if (insertedId) {
        const nextRecord = { id: insertedId, category_slug: entry.category_slug, value: entry.value };
        promptById.set(insertedId, nextRecord);
        promptByKey.set(`${entry.category_slug}::${entry.value}`, nextRecord);
      }
    }
  }

  return Response.json({ ok: true, type, created, updated, backupId });
}
