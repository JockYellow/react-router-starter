type CategoryRow = {
  id: number;
  slug: string;
  label: string;
  ui_group: string | null;
  is_optional: number | boolean | null;
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

export const CATEGORY_HEADERS = [
  "id",
  "slug",
  "label",
  "ui_group",
  "is_optional",
  "type",
  "min_count",
  "max_count",
  "sort_order",
];

export const PROMPT_HEADERS = ["id", "category_slug", "value", "label", "is_active"];

const escapeCsvValue = (value: unknown) => {
  const raw = value === null || value === undefined ? "" : String(value);
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
};

const buildCsv = (headers: string[], rows: Array<Array<string | number>>, includeBom: boolean) => {
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(row.map(escapeCsvValue).join(","));
  });
  const content = lines.join("\n");
  return includeBom ? `\ufeff${content}` : content;
};

export const buildCategoriesCsv = async (db: D1Database, includeBom = false) => {
  const result = await db
    .prepare(
      "SELECT id, slug, label, ui_group, is_optional, type, min_count, max_count, sort_order FROM categories ORDER BY sort_order, id",
    )
    .all<CategoryRow>();

  const rows = (result.results ?? []).map((row) => {
    const isOptional = row.is_optional ? 1 : 0;
    const resolvedType = row.type ?? (isOptional ? "optional" : "required");
    return [
      row.id,
      row.slug,
      row.label,
      row.ui_group ?? "Default",
      isOptional,
      resolvedType,
      row.min_count ?? 1,
      row.max_count ?? 1,
      row.sort_order ?? 0,
    ];
  });

  return buildCsv(CATEGORY_HEADERS, rows, includeBom);
};

export const buildPromptsCsv = async (db: D1Database, includeBom = false) => {
  const result = await db
    .prepare("SELECT id, category_slug, value, label, is_active FROM prompts ORDER BY id")
    .all<PromptRow>();

  const rows = (result.results ?? []).map((row) => [
    row.id,
    row.category_slug,
    row.value,
    row.label ?? "",
    row.is_active === null || row.is_active === undefined ? 1 : row.is_active ? 1 : 0,
  ]);

  return buildCsv(PROMPT_HEADERS, rows, includeBom);
};
