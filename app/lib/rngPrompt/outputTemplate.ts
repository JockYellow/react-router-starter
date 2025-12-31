import type { Category, OutputBlock } from "./types";
import { TAB_GENERAL, getCategoryGroupId, isGeneralGroupId } from "./utils";

export const getDefaultOutputBlocks = (categories: Category[]) => {
  return [...categories]
    .sort((a, b) => {
      const orderA = a.sort_order ?? a.id;
      const orderB = b.sort_order ?? b.id;
      return orderA - orderB;
    })
    .map((cat) => ({
      id: `cat-${cat.slug}`,
      type: "category" as const,
      categorySlug: cat.slug,
    }));
};

export const getDefaultGroupBlocks = (categories: Category[]) => {
  const ordered = [...categories].sort((a, b) => {
    const orderA = a.sort_order ?? a.id;
    const orderB = b.sort_order ?? b.id;
    return orderA - orderB;
  });
  const groupIds: string[] = [];
  ordered.forEach((cat) => {
    const groupId = isGeneralGroupId(getCategoryGroupId(cat)) ? TAB_GENERAL : getCategoryGroupId(cat);
    if (!groupIds.includes(groupId)) groupIds.push(groupId);
  });
  return groupIds.map((groupId) => ({
    id: `group-${groupId}`,
    type: "group" as const,
    groupId,
  }));
};

export const blocksToTemplate = (blocks: OutputBlock[]) => {
  let template = "";
  blocks.forEach((block, index) => {
    if (block.type === "text") {
      template += block.text ?? "";
      return;
    }
    const token =
      block.type === "group" ? `{{group:${block.groupId ?? ""}}}` : `{{cat:${block.categorySlug ?? ""}}}`;
    const prev = blocks[index - 1];
    if (template && prev && prev.type !== "text") template += " ";
    template += token;
  });
  return template;
};

export const templateToBlocks = (template: string, createId: () => string) => {
  const blocks: OutputBlock[] = [];
  const tokenRegex = /{{\s*(group|cat)\s*:\s*([^}]+)\s*}}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(template)) !== null) {
    const before = template.slice(lastIndex, match.index);
    if (before) {
      blocks.push({ id: createId(), type: "text", text: before });
    }
    const rawValue = match[2]?.trim();
    if (rawValue) {
      if (match[1] === "group") {
        blocks.push({ id: createId(), type: "group", groupId: rawValue });
      } else {
        blocks.push({ id: createId(), type: "category", categorySlug: rawValue });
      }
    }
    lastIndex = tokenRegex.lastIndex;
  }

  const tail = template.slice(lastIndex);
  if (tail) {
    blocks.push({ id: createId(), type: "text", text: tail });
  }

  return blocks;
};
