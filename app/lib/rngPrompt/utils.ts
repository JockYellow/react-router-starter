import type { Category } from "./types";

const GENERAL_GROUP_IDS = new Set(["Base", "Default", "一般", "General", "general"]);

export const TAB_ALL = "全部";
export const TAB_GENERAL = "一般";

export const getCategoryGroupId = (category: Category) => category.ui_group?.trim() || "Default";

export const isGeneralGroupId = (groupId: string) => GENERAL_GROUP_IDS.has(groupId);

export const isOptionalCategory = (category: Category) => category.is_optional ?? category.type === "optional";
