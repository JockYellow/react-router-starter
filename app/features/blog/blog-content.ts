import type { BlogContentBlock, BlogImageLayout } from "./blog.types";

const BLOCK_TYPES = new Set(["paragraph", "heading", "image", "video", "gallery", "quote", "divider", "columns"]);
const IMAGE_LAYOUTS = new Set<BlogImageLayout>(["normal", "wide", "full", "float-left", "float-right"]);

function makeId(prefix = "block") {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function cleanText(value: unknown, maxLength = 20000) {
  const text = typeof value === "string" ? value : "";
  return text.slice(0, maxLength);
}

function cleanUrl(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeId(value: unknown, prefix = "block") {
  const id = typeof value === "string" ? value.trim() : "";
  return id && /^[a-z0-9][a-z0-9_-]{2,80}$/i.test(id) ? id : makeId(prefix);
}

function normalizeMediaId(value: unknown) {
  const id = typeof value === "string" ? value.trim() : "";
  return id && /^[a-z0-9_-]{6,80}$/i.test(id) ? id : undefined;
}

export function blocksFromPlainText(body: string): BlogContentBlock[] {
  return body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((text) => ({
      id: makeId("paragraph"),
      type: "paragraph" as const,
      props: { text },
    }));
}

export function extractPlainTextFromBlocks(blocks: BlogContentBlock[]) {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === "paragraph" || block.type === "heading" || block.type === "quote") {
      parts.push(block.props.text);
    }
    if (block.type === "columns") {
      for (const column of block.props.columns) {
        parts.push(extractPlainTextFromBlocks(column.blocks));
      }
    }
  }
  return parts.filter(Boolean).join("\n\n");
}

export function firstImageFromBlocks(blocks: BlogContentBlock[]): string | null {
  for (const block of blocks) {
    if (block.type === "image" && block.props.src) return block.props.src;
    if (block.type === "gallery" && block.props.items[0]?.src) return block.props.items[0].src;
    if (block.type === "columns") {
      for (const column of block.props.columns) {
        const nested = firstImageFromBlocks(column.blocks);
        if (nested) return nested;
      }
    }
  }
  return null;
}

export function collectMediaIdsFromBlocks(blocks: BlogContentBlock[]) {
  const ids: string[] = [];
  function visit(items: BlogContentBlock[]) {
    for (const block of items) {
      if ((block.type === "image" || block.type === "video") && block.props.mediaId) ids.push(block.props.mediaId);
      if (block.type === "gallery") {
        for (const item of block.props.items) {
          if (item.mediaId) ids.push(item.mediaId);
        }
      }
      if (block.type === "columns") {
        for (const column of block.props.columns) visit(column.blocks);
      }
    }
  }
  visit(blocks);
  return Array.from(new Set(ids));
}

export function normalizeBlogBlocks(input: unknown, fallbackBody = "", depth = 0): BlogContentBlock[] {
  if (depth > 2) return [];
  const rawBlocks = Array.isArray(input) ? input : [];
  const normalized: BlogContentBlock[] = [];

  for (const raw of rawBlocks) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as { id?: unknown; type?: unknown; props?: Record<string, unknown> };
    if (typeof candidate.type !== "string" || !BLOCK_TYPES.has(candidate.type)) continue;
    const props = candidate.props && typeof candidate.props === "object" ? candidate.props : {};
    const id = normalizeId(candidate.id, candidate.type);

    switch (candidate.type) {
      case "paragraph": {
        const text = cleanText(props.text);
        if (text) normalized.push({ id, type: "paragraph", props: { text } });
        break;
      }
      case "heading": {
        const text = cleanText(props.text, 300);
        const level = props.level === 3 ? 3 : 2;
        if (text) normalized.push({ id, type: "heading", props: { text, level } });
        break;
      }
      case "image": {
        const src = cleanUrl(props.src);
        if (src) {
          const layout = IMAGE_LAYOUTS.has(props.layout as BlogImageLayout) ? (props.layout as BlogImageLayout) : "normal";
          normalized.push({
            id,
            type: "image",
            props: {
              mediaId: normalizeMediaId(props.mediaId),
              src,
              alt: cleanText(props.alt, 300),
              caption: cleanText(props.caption, 500),
              layout,
            },
          });
        }
        break;
      }
      case "video": {
        const src = cleanUrl(props.src);
        if (src) {
          normalized.push({
            id,
            type: "video",
            props: {
              mediaId: normalizeMediaId(props.mediaId),
              src,
              mimeType: cleanText(props.mimeType, 80),
              caption: cleanText(props.caption, 500),
            },
          });
        }
        break;
      }
      case "gallery": {
        const items = Array.isArray(props.items)
          ? props.items
              .map((item) => {
                if (!item || typeof item !== "object") return null;
                const galleryItem = item as Record<string, unknown>;
                const src = cleanUrl(galleryItem.src);
                if (!src) return null;
                return {
                  mediaId: normalizeMediaId(galleryItem.mediaId),
                  src,
                  alt: cleanText(galleryItem.alt, 300),
                  caption: cleanText(galleryItem.caption, 500),
                };
              })
              .filter((item): item is NonNullable<typeof item> => Boolean(item))
          : [];
        if (items.length) {
          normalized.push({
            id,
            type: "gallery",
            props: { items, layout: props.layout === "grid" ? "grid" : "carousel" },
          });
        }
        break;
      }
      case "quote": {
        const text = cleanText(props.text, 4000);
        if (text) normalized.push({ id, type: "quote", props: { text, cite: cleanText(props.cite, 300) } });
        break;
      }
      case "divider":
        normalized.push({ id, type: "divider", props: {} });
        break;
      case "columns": {
        const columns = Array.isArray(props.columns)
          ? props.columns.slice(0, 3).map((column) => {
              const blocks = column && typeof column === "object" ? (column as any).blocks : [];
              return { blocks: normalizeBlogBlocks(blocks, "", depth + 1).slice(0, 12) };
            })
          : [];
        if (columns.length) normalized.push({ id, type: "columns", props: { columns } });
        break;
      }
    }
  }

  if (!normalized.length && fallbackBody) return blocksFromPlainText(fallbackBody);
  return normalized;
}

export function parseBlogBlocks(raw: string | null | undefined, fallbackBody = "") {
  if (!raw) return blocksFromPlainText(fallbackBody);
  try {
    return normalizeBlogBlocks(JSON.parse(raw), fallbackBody);
  } catch {
    return blocksFromPlainText(fallbackBody);
  }
}
