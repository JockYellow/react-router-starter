export type CategoryType = "required" | "optional" | "group";

export type PromptItem = {
  id: number;
  value: string;
  label?: string | null;
  is_active?: boolean;
};

export type Category = {
  id: number;
  slug: string;
  label: string;
  type: CategoryType;
  ui_group?: string | null;
  is_optional?: boolean | null;
  min_count?: number | null;
  max_count?: number | null;
  sort_order?: number;
  items: PromptItem[];
};

export type Draws = Record<string, PromptItem[]>;

export type TagLockKey = number | string;

export type OutputBlock = {
  id: string;
  type: "category" | "group" | "text";
  categorySlug?: string;
  groupId?: string;
  text?: string;
};

export type OutputConfig = {
  id: string;
  name: string;
  blocks: OutputBlock[];
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type GroupLimit = {
  min: number;
  max: number;
};
