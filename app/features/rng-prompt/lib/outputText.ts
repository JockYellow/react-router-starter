import type { Category, Draws, OutputConfig } from "./types";
import { getDefaultOutputBlocks } from "./outputTemplate";
import { TAB_GENERAL, getCategoryGroupId, isGeneralGroupId } from "./utils";

type BuildOutputTextArgs = {
  configData: Category[];
  draws: Draws;
  checkedMap: Record<string, boolean>;
  cardLockMap: Record<string, boolean>;
  outputConfigs: OutputConfig[];
  activeOutputConfigId: string | null;
};

export const buildOutputText = ({
  configData,
  draws,
  checkedMap,
  cardLockMap,
  outputConfigs,
  activeOutputConfigId,
}: BuildOutputTextArgs) => {
  const activeConfig = outputConfigs.find((config) => config.id === activeOutputConfigId);
  const activeBlocks = activeConfig?.blocks ?? [];
  const blocks = activeBlocks.length > 0 ? activeBlocks : getDefaultOutputBlocks(configData);
  const orderedCategories = [...configData].sort((a, b) => {
    const orderA = a.sort_order ?? a.id;
    const orderB = b.sort_order ?? b.id;
    return orderA - orderB;
  });

  const isChecked = (slug: string) => checkedMap[slug] !== false;

  const buildCategorySegment = (slug: string) => {
    const cat = configData.find((item) => item.slug === slug);
    if (!cat) return "";
    if (!isChecked(slug) && !cardLockMap[slug]) return "";
    const values = draws[slug] ?? [];
    if (values.length === 0) return "";
    return values.map((item) => item.value).join(", ");
  };

  const buildGroupSegment = (groupId: string) => {
    const normalizedGroupId = isGeneralGroupId(groupId) ? TAB_GENERAL : groupId;
    const categories = orderedCategories.filter((cat) => {
      const resolved = isGeneralGroupId(getCategoryGroupId(cat)) ? TAB_GENERAL : getCategoryGroupId(cat);
      return resolved === normalizedGroupId;
    });
    const segments = categories.map((cat) => buildCategorySegment(cat.slug)).filter(Boolean);
    return segments.join(", ");
  };

  const resolved = blocks.map((block) => {
    if (block.type === "text") {
      return { kind: "text" as const, value: block.text ?? "" };
    }
    if (block.type === "group") {
      const groupId = block.groupId ?? "";
      return { kind: "content" as const, value: groupId ? buildGroupSegment(groupId) : "" };
    }
    const slug = block.categorySlug;
    return { kind: "content" as const, value: slug ? buildCategorySegment(slug) : "" };
  });

  const segments: { kind: "text" | "content"; value: string }[] = [];
  for (let index = 0; index < resolved.length; index += 1) {
    const item = resolved[index];
    if (item.kind === "content") {
      if (item.value && item.value.trim().length > 0) {
        segments.push({ kind: "content", value: item.value });
      }
      continue;
    }

    let prevIndex = -1;
    for (let i = index - 1; i >= 0; i -= 1) {
      if (resolved[i].kind === "content") {
        prevIndex = i;
        break;
      }
    }
    let nextIndex = -1;
    for (let i = index + 1; i < resolved.length; i += 1) {
      if (resolved[i].kind === "content") {
        nextIndex = i;
        break;
      }
    }
    const prevContent = prevIndex === -1 ? null : resolved[prevIndex];
    const nextContent = nextIndex === -1 ? null : resolved[nextIndex];
    const prevHas = Boolean(prevContent && prevContent.value.trim().length > 0);
    const nextHas = Boolean(nextContent && nextContent.value.trim().length > 0);

    const shouldInclude =
      prevContent && nextContent ? prevHas && nextHas : prevContent ? prevHas : nextContent ? nextHas : false;

    if (shouldInclude && item.value && item.value.length > 0) {
      segments.push({ kind: "text", value: item.value });
    }
  }

  let output = "";
  let lastKind: "text" | "content" | null = null;
  segments.forEach((segment) => {
    if (segment.kind === "content" && lastKind === "content" && output && !/\s$/.test(output)) {
      output += " ";
    }
    output += segment.value;
    lastKind = segment.kind;
  });

  return output.trim();
};
