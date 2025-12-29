import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowLeft,
  Copy,
  Database,
  Dice5,
  Loader2,
  Plus,
  Save,
  Settings,
  Trash2,
  X,
} from "lucide-react";

type CategoryType = "required" | "optional" | "group";

type PromptItem = {
  id: number;
  value: string;
  label?: string | null;
  is_active?: boolean;
};

type Category = {
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

type Draws = Record<string, PromptItem[]>;

type TagLockKey = number | string;

type OutputBlock = {
  id: string;
  type: "category" | "group" | "text";
  categorySlug?: string;
  groupId?: string;
  text?: string;
};

type OutputConfig = {
  id: string;
  name: string;
  blocks: OutputBlock[];
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type CategoryFormState = {
  slug: string;
  label: string;
  type: CategoryType;
  ui_group: string;
  is_optional: boolean;
  min: string;
  max: string;
};

type PromptForm = {
  value: string;
  label: string;
  is_active?: boolean;
};

type CategoryFormProps = {
  value: CategoryFormState;
  onChange: (next: CategoryFormState) => void;
  mode: "create" | "edit";
  onSubmit?: () => void;
  onCancel?: () => void;
};

type AdminPanelProps = {
  data: Category[];
  outputConfigs: OutputConfig[];
  activeOutputConfigId: string | null;
  onCreateOutputConfig: (name: string, blocks: OutputBlock[]) => Promise<string | null>;
  onUpdateOutputConfig: (id: string, name: string, blocks: OutputBlock[]) => Promise<void>;
  onDeleteOutputConfig: (id: string) => Promise<void>;
  onSetActiveOutputConfig: (id: string) => Promise<void>;
  onRefreshData: () => Promise<void>;
  onClose: () => void;
};

type OutputComposerProps = {
  categories: Category[];
  configs: OutputConfig[];
  activeConfigId: string | null;
  onCreateConfig: (name: string, blocks: OutputBlock[]) => Promise<string | null>;
  onUpdateConfig: (id: string, name: string, blocks: OutputBlock[]) => Promise<void>;
  onDeleteConfig: (id: string) => Promise<void>;
  onSetActiveConfig: (id: string) => Promise<void>;
};

type ToastState = {
  visible: boolean;
  message: string;
};

type GroupLimit = {
  min: number;
  max: number;
};

type TabMode = "all" | "general" | "group";

type TabItem = {
  id: string;
  label: string;
  mode: TabMode;
};

type StickyTopAreaProps = {
  previewText: string;
  charCount: number;
  outputConfigs: OutputConfig[];
  activeOutputConfigId: string | null;
  onSelectOutputConfig: (id: string) => void;
  onGlobalRoll: () => void;
  onCopy: () => void;
  onOpenAdmin: () => void;
};

type TabsBarProps = {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
};

type ToolbarWrapperProps = {
  mode: TabMode;
  groups: { id: string; label: string }[];
  activeGroupId?: string;
  activeGroupLabel?: string;
  groupLimit?: GroupLimit;
  onToggleAllOptional: (checked: boolean) => void;
  onToggleGroupChecked: (groupId: string, checked: boolean) => void;
  onRefreshGroup: (groupId: string) => void;
  onUnlockAll: () => void;
  onChangeGroupLimit: (groupId: string, type: "min" | "max", delta: 1 | -1) => void;
};

type StepperProps = {
  value: number;
  onChange: (delta: 1 | -1) => void;
};

type CardGridProps = {
  categories: Category[];
  activeTab: string;
  draws: Draws;
  checkedMap: Record<string, boolean>;
  cardLockMap: Record<string, boolean>;
  tagLockMap: Record<string, Set<TagLockKey>>;
  qtyMap: Record<string, number>;
  onToggleChecked: (categorySlug: string, checked: boolean) => void;
  onToggleCardLock: (categorySlug: string) => void;
  onToggleTagLock: (categorySlug: string, promptKey: TagLockKey) => void;
  onSingleRefresh: (categorySlug: string) => void;
  onChangeQty: (categorySlug: string, delta: 1 | -1) => void;
};

type PromptCardProps = {
  category: Category;
  draws: PromptItem[];
  checked: boolean;
  locked: boolean;
  tagLocks: Set<TagLockKey>;
  qty?: number;
  onToggleChecked: (categorySlug: string, checked: boolean) => void;
  onToggleCardLock: (categorySlug: string) => void;
  onToggleTagLock: (categorySlug: string, promptKey: TagLockKey) => void;
  onSingleRefresh: (categorySlug: string) => void;
  onChangeQty: (categorySlug: string, delta: 1 | -1) => void;
};

type CopyToastProps = {
  toast: ToastState;
};

const TAB_ALL = "全部";
const TAB_GENERAL = "一般";
const GENERAL_GROUP_IDS = new Set(["Base", "Default", "一般", "General", "general"]);
const GROUP_LIMITS_COOKIE = "rng_group_limits";

const getCategoryGroupId = (category: Category) => category.ui_group?.trim() || "Default";
const isGeneralGroupId = (groupId: string) => GENERAL_GROUP_IDS.has(groupId);
const isOptionalCategory = (category: Category) => category.is_optional ?? category.type === "optional";

const readCookieValue = (name: string) => {
  if (typeof document === "undefined") return "";
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
};

const readGroupLimitsCookie = () => {
  const raw = readCookieValue(GROUP_LIMITS_COOKIE);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, GroupLimit>;
    const normalized: Record<string, GroupLimit> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (!value || typeof value !== "object") return;
      const min = Number(value.min);
      const max = Number(value.max);
      if (Number.isNaN(min) || Number.isNaN(max)) return;
      const safeMin = Math.max(0, min);
      const safeMax = Math.max(safeMin, max);
      normalized[key] = { min: safeMin, max: safeMax };
    });
    return normalized;
  } catch (_error) {
    return {};
  }
};

const writeGroupLimitsCookie = (limits: Record<string, GroupLimit>) => {
  if (typeof document === "undefined") return;
  const payload = encodeURIComponent(JSON.stringify(limits));
  document.cookie = `${GROUP_LIMITS_COOKIE}=${payload}; path=/; max-age=31536000`;
};

// --- Mock Data ---
const MOCK_DB_DATA: Category[] = [
  {
    id: 1,
    slug: "subject",
    label: "主體",
    type: "required",
    min_count: 1,
    max_count: 1,
    sort_order: 1,
    items: [
      { id: 101, value: "girl", label: "少女", is_active: true },
      { id: 102, value: "cat", label: "貓咪", is_active: true },
      { id: 103, value: "robot", label: "機器人", is_active: true },
    ],
  },
  {
    id: 2,
    slug: "style",
    label: "畫風",
    type: "required",
    min_count: 1,
    max_count: 1,
    sort_order: 2,
    items: [
      { id: 201, value: "oil painting", label: "油畫", is_active: true },
      { id: 202, value: "watercolor", label: "水彩", is_active: true },
      { id: 203, value: "cyberpunk", label: "賽博龐克", is_active: true },
    ],
  },
  {
    id: 4,
    slug: "environment",
    label: "環境",
    type: "group",
    min_count: 1,
    max_count: 2,
    sort_order: 3,
    items: [
      { id: 401, value: "forest", label: "森林", is_active: true },
      { id: 402, value: "city ruins", label: "城市廢墟", is_active: true },
      { id: 403, value: "ocean", label: "海洋", is_active: true },
    ],
  },
];

const CategoryForm = ({ value, onChange, mode, onSubmit, onCancel }: CategoryFormProps) => {
  const isCreate = mode === "create";
  const inputClassName = isCreate ? "w-full text-sm p-1 border rounded" : "w-full text-sm p-2 border rounded";
  const selectClassName = isCreate ? "text-sm border rounded p-1 flex-1" : "w-full text-sm p-2 border rounded";

  const updateValue = (patch: Partial<CategoryFormState>) => {
    onChange({ ...value, ...patch });
  };

  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextType = event.target.value as CategoryType;
    const nextOptional = nextType === "group" ? value.is_optional : nextType === "optional";
    updateValue({ type: nextType, is_optional: nextOptional });
  };

  const handleOptionalChange = (event: ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    updateValue({
      is_optional: checked,
      type: value.type === "group" ? value.type : checked ? "optional" : "required",
    });
  };

  return (
    <div className={isCreate ? "space-y-2" : "grid grid-cols-1 md:grid-cols-2 gap-3 text-xs"}>
      {isCreate && (
        <input
          className={inputClassName}
          placeholder="ID (Slug, e.g. style)"
          value={value.slug}
          onChange={(event) => updateValue({ slug: event.target.value })}
        />
      )}

      {isCreate ? (
        <input
          className={inputClassName}
          placeholder="顯示名稱 (Label)"
          value={value.label}
          onChange={(event) => updateValue({ label: event.target.value })}
        />
      ) : (
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-slate-500">顯示名稱 (Label)</span>
          <input
            className={inputClassName}
            value={value.label}
            onChange={(event) => updateValue({ label: event.target.value })}
          />
        </label>
      )}

      {isCreate ? (
        <input
          className={inputClassName}
          placeholder="群組 (ui_group, e.g. Character)"
          value={value.ui_group}
          onChange={(event) => updateValue({ ui_group: event.target.value })}
        />
      ) : (
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-slate-500">群組 (ui_group)</span>
          <input
            className={inputClassName}
            value={value.ui_group}
            onChange={(event) => updateValue({ ui_group: event.target.value })}
          />
        </label>
      )}

      {isCreate ? (
        <div className="flex gap-2">
          <select className={selectClassName} value={value.type} onChange={handleTypeChange}>
            <option value="required">必填 (Required)</option>
            <option value="optional">選用 (Optional)</option>
            <option value="group">群組 (Group)</option>
          </select>
          <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
            <input type="checkbox" checked={value.is_optional} onChange={handleOptionalChange} />
            Optional
          </label>
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-slate-500">類型 (type)</span>
            <select className={selectClassName} value={value.type} onChange={handleTypeChange}>
              <option value="required">必填 (Required)</option>
              <option value="optional">選用 (Optional)</option>
              <option value="group">群組 (Group)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <input type="checkbox" checked={value.is_optional} onChange={handleOptionalChange} />
            Optional (is_optional)
          </label>
        </>
      )}

      {isCreate ? (
        <div className="flex items-center gap-2 text-xs">
          mul:{" "}
          <input
            type="number"
            className="w-12 border p-1"
            value={value.min}
            onChange={(event) => updateValue({ min: event.target.value })}
          />
          ~{" "}
          <input
            type="number"
            className="w-12 border p-1"
            value={value.max}
            onChange={(event) => updateValue({ max: event.target.value })}
          />
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-slate-500">mul 最小</span>
            <input
              type="number"
              className={inputClassName}
              value={value.min}
              onChange={(event) => updateValue({ min: event.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-slate-500">mul 最大</span>
            <input
              type="number"
              className={inputClassName}
              value={value.max}
              onChange={(event) => updateValue({ max: event.target.value })}
            />
          </label>
        </>
      )}

      {isCreate && (onSubmit || onCancel) && (
        <div className="flex gap-2 mt-2">
          {onSubmit && (
            <button onClick={onSubmit} className="flex-1 bg-blue-600 text-white text-xs py-1 rounded">
              儲存
            </button>
          )}
          {onCancel && (
            <button onClick={onCancel} className="flex-1 bg-slate-200 text-slate-600 text-xs py-1 rounded">
              取消
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const AdminPanel = ({
  data,
  outputConfigs,
  activeOutputConfigId,
  onCreateOutputConfig,
  onUpdateOutputConfig,
  onDeleteOutputConfig,
  onSetActiveOutputConfig,
  onRefreshData,
  onClose,
}: AdminPanelProps) => {
  const [activeTab, setActiveTab] = useState<string>(data[0]?.slug ?? "");
  const [adminView, setAdminView] = useState<"categories" | "output">("categories");

  const [newCatMode, setNewCatMode] = useState(false);
  const [newPromptMode, setNewPromptMode] = useState(false);
  const [catForm, setCatForm] = useState<CategoryFormState>({
    slug: "",
    label: "",
    type: "required",
    ui_group: "Default",
    is_optional: false,
    min: "1",
    max: "1",
  });
  const [promptForm, setPromptForm] = useState<PromptForm>({ value: "", label: "", is_active: true });
  const [editCatForm, setEditCatForm] = useState<CategoryFormState | null>(null);
  const [editingPromptId, setEditingPromptId] = useState<number | null>(null);
  const [promptEditForm, setPromptEditForm] = useState<PromptForm>({ value: "", label: "", is_active: true });

  const activeCategory = data.find((cat) => cat.slug === activeTab);

  useEffect(() => {
    if (!activeCategory) {
      setEditCatForm(null);
      setEditingPromptId(null);
      return;
    }
    setEditCatForm({
      slug: activeCategory.slug,
      label: activeCategory.label,
      type: activeCategory.type ?? "required",
      ui_group: activeCategory.ui_group ?? "Default",
      is_optional: activeCategory.is_optional ?? activeCategory.type === "optional",
      min: String(activeCategory.min_count ?? 1),
      max: String(activeCategory.max_count ?? 1),
    });
    setEditingPromptId(null);
  }, [activeCategory]);

  const resolveCategoryType = (type: CategoryType, isOptional: boolean) => {
    if (type === "group") return "group";
    return isOptional ? "optional" : "required";
  };

  const runAdminMutation = async (payload: Record<string, unknown>, errorMessage: string) => {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Admin API failed");
      await onRefreshData();
      return true;
    } catch (_error) {
      window.alert(errorMessage);
      return false;
    }
  };

  const handleAddCategory = async () => {
    if (!catForm.slug || !catForm.label) {
      window.alert("請填寫 Slug 和 Label");
      return;
    }

    const minCount = Number.parseInt(catForm.min, 10);
    const maxCount = Number.parseInt(catForm.max, 10);
    const safeMin = Number.isNaN(minCount) ? 1 : minCount;
    const safeMax = Number.isNaN(maxCount) ? 1 : maxCount;

    const resolvedType = resolveCategoryType(catForm.type, catForm.is_optional);
    const ok = await runAdminMutation(
      {
        action: "create",
        table: "categories",
        data: {
          slug: catForm.slug.trim(),
          label: catForm.label.trim(),
          type: resolvedType,
          ui_group: catForm.ui_group.trim() || "Default",
          is_optional: catForm.is_optional,
          min_count: safeMin,
          max_count: safeMax,
          sort_order: data.length + 1,
        },
      },
      "新增類別失敗",
    );
    if (!ok) return;
    setNewCatMode(false);
    setActiveTab(catForm.slug.trim());
    setCatForm({
      slug: "",
      label: "",
      type: "required",
      ui_group: "Default",
      is_optional: false,
      min: "1",
      max: "1",
    });
  };

  const handleDeleteCategory = async (slug: string) => {
    if (!window.confirm(`確定要刪除類別 ${slug} 嗎？底下的所有 Prompt 都會消失！`)) return;
    const ok = await runAdminMutation({ action: "delete", table: "categories", slug }, "刪除類別失敗");
    if (!ok) return;
    if (activeTab === slug) setActiveTab(data.find((cat) => cat.slug !== slug)?.slug ?? "");
  };

  const handleUpdateCategory = async () => {
    if (!activeCategory || !editCatForm) return;
    if (!editCatForm.label.trim()) {
      window.alert("請填寫 Label");
      return;
    }
    const minCount = Number.parseInt(editCatForm.min, 10);
    const maxCount = Number.parseInt(editCatForm.max, 10);
    const safeMin = Number.isNaN(minCount) ? 0 : Math.max(0, minCount);
    const safeMax = Number.isNaN(maxCount) ? safeMin : Math.max(safeMin, maxCount);
    const resolvedType = resolveCategoryType(editCatForm.type, editCatForm.is_optional);
    await runAdminMutation(
      {
        action: "update",
        table: "categories",
        id: activeCategory.id,
        data: {
          label: editCatForm.label.trim(),
          ui_group: editCatForm.ui_group.trim() || "Default",
          is_optional: editCatForm.is_optional,
          type: resolvedType,
          min_count: safeMin,
          max_count: safeMax,
          sort_order: activeCategory.sort_order ?? 0,
        },
      },
      "更新類別失敗",
    );
  };

  const handleAddPrompt = async () => {
    if (!promptForm.value || !promptForm.label) {
      window.alert("請填寫 Prompt 和 Label");
      return;
    }

    const ok = await runAdminMutation(
      {
        action: "create",
        table: "prompts",
        data: {
          category_slug: activeTab,
          value: promptForm.value.trim(),
          label: promptForm.label.trim(),
          is_active: promptForm.is_active ?? true,
        },
      },
      "新增 Prompt 失敗",
    );
    if (!ok) return;
    setNewPromptMode(false);
    setPromptForm({ value: "", label: "", is_active: true });
  };

  const handleDeletePrompt = async (itemId: number) => {
    if (!window.confirm("確定刪除此 Prompt?")) return;
    await runAdminMutation({ action: "delete", table: "prompts", id: itemId }, "刪除 Prompt 失敗");
  };

  const handleStartEditPrompt = (item: PromptItem) => {
    setEditingPromptId(item.id);
    setPromptEditForm({
      value: item.value,
      label: item.label ?? "",
      is_active: item.is_active !== false,
    });
  };

  const handleCancelEditPrompt = () => {
    setEditingPromptId(null);
  };

  const handleSavePrompt = async () => {
    if (!activeCategory || editingPromptId === null) return;
    if (!promptEditForm.value.trim()) {
      window.alert("請填寫 Prompt Value");
      return;
    }
    const ok = await runAdminMutation(
      {
        action: "update",
        table: "prompts",
        id: editingPromptId,
        data: {
          value: promptEditForm.value.trim(),
          label: promptEditForm.label.trim(),
          is_active: promptEditForm.is_active ?? true,
        },
      },
      "更新 Prompt 失敗",
    );
    if (!ok) return;
    setEditingPromptId(null);
  };

  const handleTogglePromptActive = async (itemId: number) => {
    if (!activeCategory) return;
    const target = activeCategory.items.find((item) => item.id === itemId);
    if (!target) return;
    await runAdminMutation(
      {
        action: "update",
        table: "prompts",
        id: itemId,
        data: {
          value: target.value,
          label: target.label ?? "",
          is_active: !target.is_active,
        },
      },
      "更新 Prompt 狀態失敗",
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col">
      <div className="bg-slate-900 text-white p-4 shadow-md flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Database size={20} className="text-blue-400" /> 資料庫管理
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-md border border-slate-700 overflow-hidden text-xs">
            <button
              onClick={() => setAdminView("categories")}
              className={`px-3 py-1.5 font-semibold transition ${
                adminView === "categories" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              類別/Prompt
            </button>
            <button
              onClick={() => setAdminView("output")}
              className={`px-3 py-1.5 font-semibold transition ${
                adminView === "output" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              輸出編排
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="w-full lg:w-1/4 lg:min-w-[250px] min-w-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col max-h-[45vh] lg:max-h-none">
          <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">類別列表</span>
            <button
              onClick={() => setNewCatMode(true)}
              className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
              title="新增類別"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 min-h-0">
            {newCatMode && (
              <div className="p-3 bg-blue-50 border-b border-blue-100 animate-in slide-in-from-top-2">
                <CategoryForm
                  mode="create"
                  value={catForm}
                  onChange={setCatForm}
                  onSubmit={handleAddCategory}
                  onCancel={() => setNewCatMode(false)}
                />
              </div>
            )}

            {data.map((cat) => (
              <div
                key={cat.id}
                onClick={() => setActiveTab(cat.slug)}
                className={`p-3 border-b border-slate-50 cursor-pointer flex justify-between items-center hover:bg-slate-50 transition-colors ${
                  activeTab === cat.slug ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                }`}
              >
                <div>
                  <div className="font-bold text-sm text-slate-800">{cat.label}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {cat.slug} • {cat.ui_group ?? "Default"} • {isOptionalCategory(cat) ? "opt" : "req"} •{" "}
                    {cat.type}
                  </div>
                </div>
                {activeTab === cat.slug && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteCategory(cat.slug);
                    }}
                    className="text-slate-300 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-slate-50 flex flex-col min-h-0">
          {adminView === "categories" ? (
            activeCategory ? (
              <>
                <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">
                      {activeCategory.label}{" "}
                      <span className="text-slate-400 font-normal text-sm">({activeCategory.items.length} items)</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      群組: {activeCategory.ui_group ?? "Default"} ・{" "}
                      {isOptionalCategory(activeCategory) ? "Optional" : "Required"} ・
                      {" "}
                      {activeCategory.type} ・ mul {activeCategory.min_count ?? 1}~{activeCategory.max_count ?? 1}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setNewPromptMode(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center gap-2 shadow-sm"
                    >
                      <Plus size={16} /> 新增 Prompt
                    </button>
                    <button
                      onClick={handleUpdateCategory}
                      className="px-3 py-1.5 rounded text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800"
                    >
                      儲存類別
                    </button>
                  </div>
                </div>

                {editCatForm && (
                  <div className="p-4 bg-white border-b border-slate-100">
                    <CategoryForm mode="edit" value={editCatForm} onChange={(next) => setEditCatForm(next)} />
                  </div>
                )}

                {newPromptMode && (
                  <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex flex-col md:flex-row gap-2 items-end animate-in fade-in">
                    <div className="flex-1 w-full">
                      <label className="text-[10px] text-emerald-700 font-bold uppercase">Prompt Value (English)</label>
                      <input
                        autoFocus
                        className="w-full p-2 border border-emerald-300 rounded text-sm"
                        placeholder="e.g. oil painting"
                        value={promptForm.value}
                        onChange={(event) => setPromptForm({ ...promptForm, value: event.target.value })}
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="text-[10px] text-emerald-700 font-bold uppercase">顯示名稱 (Chinese)</label>
                      <input
                        className="w-full p-2 border border-emerald-300 rounded text-sm"
                        placeholder="e.g. 油畫"
                        value={promptForm.label}
                        onChange={(event) => setPromptForm({ ...promptForm, label: event.target.value })}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-emerald-700 font-semibold">
                      <input
                        type="checkbox"
                        checked={promptForm.is_active ?? true}
                        onChange={(event) => setPromptForm({ ...promptForm, is_active: event.target.checked })}
                      />
                      啟用
                    </label>
                    <button
                      onClick={handleAddPrompt}
                      className="bg-emerald-600 text-white p-2 rounded hover:bg-emerald-700 h-[38px] w-[38px] flex items-center justify-center"
                    >
                      <Save size={18} />
                    </button>
                    <button
                      onClick={() => setNewPromptMode(false)}
                      className="bg-slate-200 text-slate-600 p-2 rounded hover:bg-slate-300 h-[38px] w-[38px] flex items-center justify-center"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}

                <div className="p-4 overflow-y-auto flex-1 min-h-0">
                  <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                          <tr>
                            <th className="p-3 w-16 text-center">ID</th>
                            <th className="p-3">Prompt Value</th>
                            <th className="p-3">標籤 (Label)</th>
                            <th className="p-3 w-20 text-center">狀態</th>
                            <th className="p-3 w-28 text-center">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                        {activeCategory.items.map((item) => {
                          const isEditing = editingPromptId === item.id;
                          return (
                            <tr key={item.id} className="hover:bg-slate-50 group">
                              <td className="p-3 text-center text-slate-400 font-mono text-xs">{item.id}</td>
                              <td className="p-3 font-mono text-slate-700">
                                {isEditing ? (
                                  <input
                                    className="w-full border rounded px-2 py-1 text-xs font-mono"
                                    value={promptEditForm.value}
                                    onChange={(event) =>
                                      setPromptEditForm({ ...promptEditForm, value: event.target.value })
                                    }
                                  />
                                ) : (
                                  item.value
                                )}
                              </td>
                              <td className="p-3 text-slate-600">
                                {isEditing ? (
                                  <input
                                    className="w-full border rounded px-2 py-1 text-xs"
                                    value={promptEditForm.label}
                                    onChange={(event) =>
                                      setPromptEditForm({ ...promptEditForm, label: event.target.value })
                                    }
                                  />
                                ) : (
                                  item.label
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {isEditing ? (
                                  <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                                    <input
                                      type="checkbox"
                                      checked={promptEditForm.is_active ?? true}
                                      onChange={(event) =>
                                        setPromptEditForm({ ...promptEditForm, is_active: event.target.checked })
                                      }
                                    />
                                    啟用
                                  </label>
                                ) : (
                                  <button
                                    onClick={() => handleTogglePromptActive(item.id)}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition ${
                                      item.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    {item.is_active ? "Active" : "Disabled"}
                                  </button>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={handleSavePrompt}
                                      className="text-emerald-600 hover:text-emerald-700"
                                    >
                                      <Save size={16} />
                                    </button>
                                    <button
                                      onClick={handleCancelEditPrompt}
                                      className="text-slate-400 hover:text-slate-600"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => handleStartEditPrompt(item)}
                                      className="text-slate-400 hover:text-slate-600"
                                    >
                                      <Settings size={16} />
                                    </button>
                                    <button
                                      onClick={() => handleDeletePrompt(item.id)}
                                      className="text-slate-300 hover:text-red-500 transition-colors"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {activeCategory.items.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                              此類別尚無 Prompt，請點擊右上方新增。
                            </td>
                          </tr>
                        )}
                      </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400">請選擇左側類別以編輯內容</div>
            )
          ) : (
            <OutputComposer
              categories={data}
              configs={outputConfigs}
              activeConfigId={activeOutputConfigId}
              onCreateConfig={onCreateOutputConfig}
              onUpdateConfig={onUpdateOutputConfig}
              onDeleteConfig={onDeleteOutputConfig}
              onSetActiveConfig={onSetActiveOutputConfig}
            />
          )}
        </div>
      </div>

    </div>
  );
};

const getDefaultOutputBlocks = (categories: Category[]) => {
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

const getDefaultGroupBlocks = (categories: Category[]) => {
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

const blocksToTemplate = (blocks: OutputBlock[]) => {
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

const templateToBlocks = (template: string, createId: () => string) => {
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

const NEW_OUTPUT_CONFIG_ID = "__new__";

const OutputComposer = ({
  categories,
  configs,
  activeConfigId,
  onCreateConfig,
  onUpdateConfig,
  onDeleteConfig,
  onSetActiveConfig,
}: OutputComposerProps) => {
  const [selectedConfigId, setSelectedConfigId] = useState<string>(
    activeConfigId ?? configs[0]?.id ?? NEW_OUTPUT_CONFIG_ID,
  );
  const [draftName, setDraftName] = useState("");
  const [templateDraft, setTemplateDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const templateRef = useRef<HTMLTextAreaElement | null>(null);
  const hasInitializedConfigRef = useRef(false);

  useEffect(() => {
    if (hasInitializedConfigRef.current) return;
    if (configs.length === 0) return;
    setSelectedConfigId(activeConfigId ?? configs[0].id);
    hasInitializedConfigRef.current = true;
  }, [configs, activeConfigId]);

  useEffect(() => {
    if (selectedConfigId === NEW_OUTPUT_CONFIG_ID) return;
    if (configs.some((config) => config.id === selectedConfigId)) return;
    setSelectedConfigId(activeConfigId ?? configs[0]?.id ?? NEW_OUTPUT_CONFIG_ID);
  }, [configs, activeConfigId, selectedConfigId]);

  useEffect(() => {
    const selected = configs.find((config) => config.id === selectedConfigId);
    if (selected) {
      setDraftName(selected.name);
      setTemplateDraft(blocksToTemplate(selected.blocks ?? []));
      return;
    }
    if (selectedConfigId === NEW_OUTPUT_CONFIG_ID) {
      setDraftName("");
      const groupBlocks = getDefaultGroupBlocks(categories);
      const defaultBlocks = groupBlocks.length > 0 ? groupBlocks : getDefaultOutputBlocks(categories);
      setTemplateDraft(blocksToTemplate(defaultBlocks));
    }
  }, [selectedConfigId, configs, categories]);

  const orderedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const orderA = a.sort_order ?? a.id;
      const orderB = b.sort_order ?? b.id;
      return orderA - orderB;
    });
  }, [categories]);

  const groupOptions = useMemo(() => {
    const groups = new Map<string, number>();
    orderedCategories.forEach((cat) => {
      const groupId = isGeneralGroupId(getCategoryGroupId(cat)) ? TAB_GENERAL : getCategoryGroupId(cat);
      groups.set(groupId, (groups.get(groupId) ?? 0) + 1);
    });
    return Array.from(groups.entries()).map(([id, count]) => ({
      id,
      label: id === TAB_GENERAL ? TAB_GENERAL : id,
      count,
    }));
  }, [orderedCategories]);

  const createBlockId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const selectedConfig = configs.find((config) => config.id === selectedConfigId);
  const isActiveSelected = selectedConfigId !== NEW_OUTPUT_CONFIG_ID && selectedConfigId === activeConfigId;

  const insertTokenAtCursor = (token: string) => {
    const target = templateRef.current;
    if (!target) {
      setTemplateDraft((prev) => prev + token);
      return;
    }
    const start = target.selectionStart ?? templateDraft.length;
    const end = target.selectionEnd ?? templateDraft.length;
    const nextValue = `${templateDraft.slice(0, start)}${token}${templateDraft.slice(end)}`;
    setTemplateDraft(nextValue);
    window.requestAnimationFrame(() => {
      target.focus();
      const cursor = start + token.length;
      target.setSelectionRange(cursor, cursor);
    });
  };

  const handleInsertGroup = (groupId: string) => {
    insertTokenAtCursor(`{{group:${groupId}}}`);
  };

  const handleCreateConfig = async () => {
    setIsSaving(true);
    const blocks = templateToBlocks(templateDraft, createBlockId);
    const newId = await onCreateConfig(draftName, blocks);
    setIsSaving(false);
    if (newId) setSelectedConfigId(newId);
  };

  const handleSaveConfig = async () => {
    if (!selectedConfig) return;
    setIsSaving(true);
    const blocks = templateToBlocks(templateDraft, createBlockId);
    await onUpdateConfig(selectedConfig.id, draftName, blocks);
    setIsSaving(false);
  };

  const handleDeleteConfig = async () => {
    if (!selectedConfig) return;
    if (!window.confirm(`確定要刪除設定「${selectedConfig.name}」嗎？`)) return;
    setIsSaving(true);
    await onDeleteConfig(selectedConfig.id);
    setIsSaving(false);
    setSelectedConfigId(NEW_OUTPUT_CONFIG_ID);
  };

  const handleSetActive = async () => {
    if (!selectedConfig) return;
    await onSetActiveConfig(selectedConfig.id);
  };

  const handleResetToGroups = () => {
    const blocks = getDefaultGroupBlocks(categories);
    const fallbackBlocks = blocks.length > 0 ? blocks : getDefaultOutputBlocks(categories);
    setTemplateDraft(blocksToTemplate(fallbackBlocks));
  };

  const handleResetToCategories = () => {
    const blocks = getDefaultOutputBlocks(categories);
    setTemplateDraft(blocksToTemplate(blocks));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 bg-white border-b border-slate-200">
        <h3 className="text-lg font-bold text-slate-800">輸出編排</h3>
        <p className="text-xs text-slate-500 mt-1">
          使用範本拼接文字與群組變數，輸入 <span className="font-mono">{`{{group:群組名}}`}</span> 即可插入。
        </p>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="text-sm border rounded p-2 flex-1 min-w-[220px]"
              value={selectedConfigId}
              onChange={(event) => setSelectedConfigId(event.target.value)}
            >
              <option value={NEW_OUTPUT_CONFIG_ID}>＋ 新設定（尚未建立）</option>
              {configs.map((config) => (
                <option key={config.id} value={config.id}>
                  {config.name}
                  {config.id === activeConfigId ? "（使用中）" : ""}
                </option>
              ))}
            </select>
            <input
              className="text-sm border rounded p-2 flex-1 min-w-[200px]"
              placeholder="設定名稱"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {selectedConfigId === NEW_OUTPUT_CONFIG_ID ? (
              <button
                onClick={handleCreateConfig}
                disabled={isSaving}
                className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                建立設定檔
              </button>
            ) : (
              <>
                <button
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  儲存變更
                </button>
                <button
                  onClick={handleSetActive}
                  disabled={isActiveSelected}
                  className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-60"
                >
                  {isActiveSelected ? "使用中" : "設為使用中"}
                </button>
                <button
                  onClick={handleDeleteConfig}
                  disabled={isSaving}
                  className="px-3 py-1.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                >
                  刪除設定
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold">範本編輯器</span>
            <span>點選群組或直接輸入文字</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500">插入群組 (ui-group)</span>
            {groupOptions.length === 0 ? (
              <span className="text-xs text-slate-400">尚無可用群組</span>
            ) : (
              groupOptions.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleInsertGroup(group.id)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  title={`插入 ${group.label}`}
                >
                  {group.label}
                </button>
              ))
            )}
          </div>
          <textarea
            ref={templateRef}
            className="w-full min-h-[220px] max-h-[420px] border border-slate-200 rounded-lg p-3 text-sm font-mono text-slate-700 leading-relaxed resize-y"
            placeholder="在這裡輸入文字，點選上方群組即可插入變數。"
            value={templateDraft}
            onChange={(event) => setTemplateDraft(event.target.value)}
          />
          <div className="text-[11px] text-slate-500">
            支援語法：<span className="font-mono">{`{{group:群組名}}`}</span>（建議），或{" "}
            <span className="font-mono">{`{{cat:slug}}`}</span>（進階）。
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <button
              onClick={handleResetToGroups}
              className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200"
            >
              以群組重建
            </button>
            <button
              onClick={handleResetToCategories}
              className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200"
            >
              以類別重建
            </button>
            <button
              onClick={() => setTemplateDraft("")}
              className="px-3 py-1.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100"
            >
              清空範本
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StickyTopArea = ({
  previewText,
  charCount,
  outputConfigs,
  activeOutputConfigId,
  onSelectOutputConfig,
  onGlobalRoll,
  onCopy,
  onOpenAdmin,
}: StickyTopAreaProps) => {
  return (
    <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Prompt Generator</div>
          </div>
          <button
            onClick={onOpenAdmin}
            className="p-2 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="資料庫管理"
          >
            <Settings size={16} />
          </button>
        </div>

        <div className="bg-white rounded-lg p-3 border border-slate-200 min-h-[60px] max-h-[80px] overflow-y-auto text-sm font-mono text-slate-700 whitespace-pre-wrap break-all">
          {previewText || <span className="text-slate-400 italic">...</span>}
        </div>

        {outputConfigs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold">使用範本</span>
            <select
              className="flex-1 min-w-[200px] border rounded px-2 py-1 text-xs text-slate-700"
              value={activeOutputConfigId ?? ""}
              onChange={(event) => {
                const nextId = event.target.value;
                if (nextId) onSelectOutputConfig(nextId);
              }}
            >
              <option value="" disabled>
                選擇範本
              </option>
              {outputConfigs.map((config) => (
                <option key={config.id} value={config.id}>
                  {config.name}
                  {config.id === activeOutputConfigId ? "（使用中）" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onGlobalRoll}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center gap-2 shadow-sm active:translate-y-px active:shadow-none transition-all"
          >
            <Dice5 size={18} /> 隨機生成
          </button>
          <button
            onClick={onCopy}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center gap-2 shadow-sm active:translate-y-px active:shadow-none transition-all"
          >
            <Copy size={18} /> 複製
          </button>
        </div>

        <div className="text-right text-[10px] text-slate-400">字數 {charCount}</div>
      </div>
    </div>
  );
};

const TabsBar = ({ tabs, activeTab, onTabChange }: TabsBarProps) => {
  return (
    <div className="max-w-5xl mx-auto px-3 pt-3">
      <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const ToolbarWrapper = ({
  mode,
  groups,
  activeGroupId,
  activeGroupLabel,
  groupLimit,
  onToggleAllOptional,
  onToggleGroupChecked,
  onRefreshGroup,
  onUnlockAll,
  onChangeGroupLimit,
}: ToolbarWrapperProps) => {
  return (
    <div className="max-w-5xl mx-auto px-3 pb-3">
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-3 space-y-2">
        {mode === "all" && (
          <ToolbarAll
            groups={groups}
            onToggleAllOptional={onToggleAllOptional}
            onRefreshGroup={onRefreshGroup}
            onUnlockAll={onUnlockAll}
          />
        )}
        {mode === "general" && (
          <ToolbarGeneral onToggleGroupChecked={(checked) => onToggleGroupChecked(TAB_GENERAL, checked)} />
        )}
        {mode === "group" && activeGroupId && (
          <ToolbarGroup
            groupId={activeGroupId}
            groupLabel={activeGroupLabel ?? activeGroupId}
            groupLimit={groupLimit ?? { min: 0, max: 0 }}
            onChangeGroupLimit={onChangeGroupLimit}
            onRefreshGroup={onRefreshGroup}
            onToggleGroupChecked={onToggleGroupChecked}
          />
        )}
      </div>
    </div>
  );
};

type ToolbarAllProps = {
  groups: { id: string; label: string }[];
  onToggleAllOptional: (checked: boolean) => void;
  onRefreshGroup: (groupId: string) => void;
  onUnlockAll: () => void;
};

const ToolbarAll = ({ groups, onToggleAllOptional, onRefreshGroup, onUnlockAll }: ToolbarAllProps) => {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onToggleAllOptional(true)}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
        >
          選項全開
        </button>
        <button
          onClick={() => onToggleAllOptional(false)}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
        >
          選項全關
        </button>
        <button
          onClick={onUnlockAll}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
        >
          全解
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {groups.length === 0 ? (
          <span className="text-xs text-slate-400">無可重抽群組</span>
        ) : (
          groups.map((group) => (
            <button
              key={group.id}
              onClick={() => onRefreshGroup(group.id)}
              className="px-2 py-1 text-[11px] rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
            >
              🎲 {group.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

type ToolbarGeneralProps = {
  onToggleGroupChecked: (checked: boolean) => void;
};

const ToolbarGeneral = ({ onToggleGroupChecked }: ToolbarGeneralProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onToggleGroupChecked(true)}
        className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
      >
        本頁全選
      </button>
      <button
        onClick={() => onToggleGroupChecked(false)}
        className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
      >
        本頁全撇
      </button>
    </div>
  );
};

type ToolbarGroupProps = {
  groupId: string;
  groupLabel: string;
  groupLimit: GroupLimit;
  onChangeGroupLimit: (groupId: string, type: "min" | "max", delta: 1 | -1) => void;
  onRefreshGroup: (groupId: string) => void;
  onToggleGroupChecked: (groupId: string, checked: boolean) => void;
};

const ToolbarGroup = ({
  groupId,
  groupLabel,
  groupLimit,
  onChangeGroupLimit,
  onRefreshGroup,
  onToggleGroupChecked,
}: ToolbarGroupProps) => {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">{groupLabel}</span>
          <span className="text-slate-400">數量</span>
          <Stepper value={groupLimit.min} onChange={(delta) => onChangeGroupLimit(groupId, "min", delta)} />
          <span className="text-slate-400">~</span>
          <Stepper value={groupLimit.max} onChange={(delta) => onChangeGroupLimit(groupId, "max", delta)} />
        </div>
        <button
          onClick={() => onRefreshGroup(groupId)}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
        >
          🎲 重抽本組
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onToggleGroupChecked(groupId, true)}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
        >
          全選
        </button>
        <button
          onClick={() => onToggleGroupChecked(groupId, false)}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
        >
          全撇
        </button>
      </div>
    </div>
  );
};

const Stepper = ({ value, onChange }: StepperProps) => {
  return (
    <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 overflow-hidden">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onChange(-1);
        }}
        className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
      >
        -
      </button>
      <span className="px-2 text-xs font-semibold text-slate-700 min-w-[20px] text-center">{value}</span>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onChange(1);
        }}
        className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
      >
        +
      </button>
    </div>
  );
};

const CardGrid = ({
  categories,
  activeTab,
  draws,
  checkedMap,
  cardLockMap,
  tagLockMap,
  qtyMap,
  onToggleChecked,
  onToggleCardLock,
  onToggleTagLock,
  onSingleRefresh,
  onChangeQty,
}: CardGridProps) => {
  const filteredCategories = categories.filter((cat) => {
    if (activeTab === TAB_GENERAL) return isGeneralGroupId(getCategoryGroupId(cat));
    if (activeTab === TAB_ALL) return true;
    return getCategoryGroupId(cat) === activeTab;
  });

  const visibleCategories = filteredCategories.filter((cat) => {
    if (activeTab !== TAB_ALL) return true;
    const isLocked = cardLockMap[cat.slug] === true;
    const hasContent = (draws[cat.slug] ?? []).length > 0;
    return isLocked || hasContent;
  });

  const sortedCategories = [...visibleCategories].sort((a, b) => {
    const lockedA = cardLockMap[a.slug] === true;
    const lockedB = cardLockMap[b.slug] === true;
    if (lockedA !== lockedB) return lockedA ? -1 : 1;
    const orderA = a.sort_order ?? a.id;
    const orderB = b.sort_order ?? b.id;
    return orderA - orderB;
  });

  return (
    <div className="max-w-5xl mx-auto px-[10px] pb-16">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-[10px]">
        {sortedCategories.length === 0 && (
          <div className="col-span-full text-center text-sm text-slate-400 py-10">此分頁沒有可顯示的卡片。</div>
        )}
        {sortedCategories.map((cat) => (
          <PromptCard
            key={cat.slug}
            category={cat}
            draws={draws[cat.slug] ?? []}
            checked={checkedMap[cat.slug] !== false}
            locked={cardLockMap[cat.slug] === true}
            tagLocks={tagLockMap[cat.slug] ?? new Set<TagLockKey>()}
            qty={qtyMap[cat.slug]}
            onToggleChecked={onToggleChecked}
            onToggleCardLock={onToggleCardLock}
            onToggleTagLock={onToggleTagLock}
            onSingleRefresh={onSingleRefresh}
            onChangeQty={onChangeQty}
          />
        ))}
      </div>
    </div>
  );
};

const PromptCard = ({
  category,
  draws,
  checked,
  locked,
  tagLocks,
  qty,
  onToggleChecked,
  onToggleCardLock,
  onToggleTagLock,
  onSingleRefresh,
  onChangeQty,
}: PromptCardProps) => {
  const hasContent = draws.length > 0;
  const isGroup = category.type === "group";
  const isOptional = isOptionalCategory(category);
  const typeLabel = isGroup ? "群組" : isOptional ? "選用" : "必填";
  const typeClass = isGroup
    ? "bg-orange-100 text-orange-700"
    : isOptional
      ? "bg-pink-100 text-pink-700"
      : "bg-blue-100 text-blue-700";

  return (
    <div
      className={`flex flex-col rounded-xl border shadow-sm overflow-hidden transition-all ${
        locked ? "border-amber-300 bg-amber-50/60 ring-1 ring-amber-200" : "border-slate-200 bg-white"
      } ${checked ? "" : "opacity-50 grayscale"}`}
    >
      <div
        className="flex items-center gap-2 p-2 border-b border-slate-100 cursor-pointer hover:bg-slate-50"
        onClick={() => onToggleChecked(category.slug, !checked)}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => {
            event.stopPropagation();
            onToggleChecked(category.slug, event.target.checked);
          }}
          onClick={(event) => event.stopPropagation()}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 accent-blue-600"
        />
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${typeClass}`}>{typeLabel}</span>
        <span className="text-sm font-semibold text-slate-700 truncate flex-1 min-w-0">{category.label}</span>
        {typeof qty === "number" && (
          <div
            onClick={(event) => event.stopPropagation()}
            className="shrink-0"
          >
            <Stepper value={qty} onChange={(delta) => onChangeQty(category.slug, delta)} />
          </div>
        )}
      </div>

      <div
        className={`p-2 min-h-[56px] flex flex-wrap content-start gap-1 cursor-pointer transition-colors ${
          locked ? "" : "hover:bg-slate-50"
        }`}
        onClick={() => {
          if (!locked) onSingleRefresh(category.slug);
        }}
      >
        {hasContent ? (
          draws.map((item) => {
            const key: TagLockKey = item.id ?? item.value;
            const isLocked = tagLocks.has(key);
            return (
              <button
                type="button"
                key={`${category.slug}-${key}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleTagLock(category.slug, key);
                }}
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border transition ${
                  isLocked
                    ? "bg-rose-50 text-rose-700 border-rose-300 font-semibold"
                    : "bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                {item.label || item.value}
              </button>
            );
          })
        ) : (
          <span className="text-xs text-slate-400 w-full text-center py-2">(未選中)</span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onToggleCardLock(category.slug)}
        className={`w-full py-2 text-xs font-semibold border-t border-slate-100 flex items-center justify-center gap-1 transition-colors ${
          locked ? "bg-amber-100 text-amber-700" : "text-slate-400 hover:bg-slate-50"
        }`}
      >
        {locked ? "🔒 已鎖定" : "🔓 點擊鎖定"}
      </button>
    </div>
  );
};

const CopyToast = ({ toast }: CopyToastProps) => {
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-semibold bg-slate-900 text-white shadow-lg transition-all duration-300 ${
        toast.visible ? "opacity-100" : "opacity-0 pointer-events-none translate-y-2"
      }`}
    >
      {toast.message}
    </div>
  );
};

export default function RngPromptRoute() {
  const [configData, setConfigData] = useState<Category[]>([]);
  const [draws, setDraws] = useState<Draws>({});
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const [cardLockMap, setCardLockMap] = useState<Record<string, boolean>>({});
  const [tagLockMap, setTagLockMap] = useState<Record<string, Set<TagLockKey>>>({});
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [groupLimits, setGroupLimits] = useState<Record<string, GroupLimit>>({});
  const [outputConfigs, setOutputConfigs] = useState<OutputConfig[]>([]);
  const [activeOutputConfigId, setActiveOutputConfigId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "" });
  const [activeTab, setActiveTab] = useState<string>(TAB_ALL);
  const [loading, setLoading] = useState(true);
  const [useMock, setUseMock] = useState(false);
  const [view, setView] = useState<"generator" | "admin">("generator");
  const toastTimerRef = useRef<number | null>(null);
  const hasAutoRolledRef = useRef(false);
  const groupLimitsCookieRef = useRef<Record<string, GroupLimit>>({});

  const applyOutputConfigs = (configs: OutputConfig[]) => {
    setOutputConfigs(configs);
    const active = configs.find((config) => config.is_active);
    setActiveOutputConfigId(active?.id ?? null);
  };

  const refreshConfigData = async () => {
    const res = await fetch("/api/data");
    if (!res.ok) throw new Error("API not found");
    return (await res.json()) as Category[];
  };

  const fetchOutputConfigs = async () => {
    const res = await fetch("/api/output-configs");
    if (!res.ok) throw new Error("Output configs API not found");
    const payload = (await res.json()) as { configs?: OutputConfig[] };
    return payload.configs ?? [];
  };

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await refreshConfigData();
        if (!cancelled) {
          setConfigData(data);
          setUseMock(false);
        }
      } catch (_error) {
        if (!cancelled) {
          setConfigData(MOCK_DB_DATA);
          setUseMock(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadConfigs = async () => {
      try {
        const configs = await fetchOutputConfigs();
        if (!cancelled) applyOutputConfigs(configs);
      } catch (_error) {
        if (!cancelled) applyOutputConfigs([]);
      }
    };
    loadConfigs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    groupLimitsCookieRef.current = readGroupLimitsCookie();
  }, []);

  useEffect(() => {
    if (configData.length === 0) return;

    setCheckedMap((prev) => {
      const next = { ...prev };
      configData.forEach((cat) => {
        if (next[cat.slug] === undefined) next[cat.slug] = true;
      });
      return next;
    });

    setCardLockMap((prev) => {
      const next = { ...prev };
      configData.forEach((cat) => {
        if (next[cat.slug] === undefined) next[cat.slug] = false;
      });
      return next;
    });

    setTagLockMap((prev) => {
      const next = { ...prev };
      configData.forEach((cat) => {
        if (next[cat.slug] === undefined) next[cat.slug] = new Set<TagLockKey>();
      });
      return next;
    });

    setQtyMap((prev) => {
      const next = { ...prev };
      configData.forEach((cat) => {
        if (cat.type === "group" && next[cat.slug] === undefined) {
          next[cat.slug] = Math.max(1, cat.min_count ?? 1);
        }
      });
      return next;
    });

    setGroupLimits((prev) => {
      const next = { ...prev };
      const groupCounts = new Map<string, number>();
      const storedLimits = groupLimitsCookieRef.current;
      configData.forEach((cat) => {
        if (cat.items.length === 0) return;
        const groupId = getCategoryGroupId(cat);
        if (isGeneralGroupId(groupId)) return;
        groupCounts.set(groupId, (groupCounts.get(groupId) ?? 0) + 1);
      });

      groupCounts.forEach((count, groupId) => {
        if (next[groupId] !== undefined) return;
        const stored = storedLimits[groupId];
        if (stored) {
          const safeMin = Math.max(0, stored.min);
          const safeMax = Math.max(safeMin, stored.max);
          next[groupId] = { min: safeMin, max: safeMax };
          return;
        }
        const safeMax = Math.max(1, count);
        next[groupId] = { min: Math.min(1, safeMax), max: safeMax };
      });
      return next;
    });

    setDraws((prev) => {
      const next = { ...prev };
      configData.forEach((cat) => {
        if (next[cat.slug] === undefined) next[cat.slug] = [];
      });
      return next;
    });
  }, [configData]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (Object.keys(groupLimits).length === 0) return;
    writeGroupLimitsCookie(groupLimits);
    groupLimitsCookieRef.current = groupLimits;
  }, [groupLimits]);

  const tabs = useMemo<TabItem[]>(() => {
    const ordered = [...configData].sort((a, b) => {
      const orderA = a.sort_order ?? a.id;
      const orderB = b.sort_order ?? b.id;
      return orderA - orderB;
    });

    const groupTabMap = new Map<string, TabItem>();
    let hasGeneral = false;

    ordered.forEach((cat) => {
      if (cat.items.length === 0) return;
      const groupId = getCategoryGroupId(cat);
      if (isGeneralGroupId(groupId)) {
        hasGeneral = true;
        return;
      }
      if (!groupTabMap.has(groupId)) {
        groupTabMap.set(groupId, { id: groupId, label: groupId, mode: "group" as const });
      }
    });

    return [
      { id: TAB_ALL, label: TAB_ALL, mode: "all" as const },
      ...groupTabMap.values(),
      ...(hasGeneral ? [{ id: TAB_GENERAL, label: TAB_GENERAL, mode: "general" as const }] : []),
    ];
  }, [configData]);

  useEffect(() => {
    if (tabs.length === 0) return;
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  const isChecked = (slug: string) => checkedMap[slug] !== false;

  const getItemKey = (item: PromptItem): TagLockKey => item.id ?? item.value;

  const getMulRange = (cat: Category) => {
    const min = Math.max(0, cat.min_count ?? 1);
    const max = Math.max(min, cat.max_count ?? min);
    return { min, max };
  };

  const getCardMulCount = (cat: Category) => {
    const override = qtyMap[cat.slug];
    if (typeof override === "number") return Math.max(0, override);
    const { min, max } = getMulRange(cat);
    if (max <= min) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  const getLockedItems = (cat: Category) => {
    const locks = tagLockMap[cat.slug];
    if (!locks || locks.size === 0) return [];
    return cat.items.filter((item) => locks.has(getItemKey(item)));
  };

  const getRandomItems = (cat: Category, count: number, excludeKeys: Set<TagLockKey>) => {
    if (count <= 0) return [];
    const activePool = cat.items.filter(
      (item) => item.is_active !== false && !excludeKeys.has(getItemKey(item)),
    );
    if (activePool.length === 0) return [];
    const shuffled = [...activePool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const buildDrawsForCategory = (cat: Category, targetCount: number) => {
    const lockedItems = getLockedItems(cat);
    const lockedKeys = new Set(lockedItems.map(getItemKey));
    const safeTarget = Math.max(targetCount, lockedItems.length);
    if (safeTarget <= 0) return lockedItems.length > 0 ? lockedItems : [];
    const needed = safeTarget - lockedItems.length;
    const randomItems = getRandomItems(cat, needed, lockedKeys);
    return [...lockedItems, ...randomItems];
  };

  const applyGroupRefresh = (currentDraws: Draws, groupId: string) => {
    const groupCategories = configData.filter((cat) => {
      if (groupId === TAB_GENERAL) return isGeneralGroupId(getCategoryGroupId(cat));
      return getCategoryGroupId(cat) === groupId;
    });

    if (groupCategories.length === 0) return currentDraws;

    if (groupId === TAB_GENERAL) {
      const next = { ...currentDraws };
      groupCategories.forEach((cat) => {
        if (cardLockMap[cat.slug]) return;
        if (!isChecked(cat.slug)) {
          next[cat.slug] = [];
          return;
        }
        const targetCount = getCardMulCount(cat);
        next[cat.slug] = buildDrawsForCategory(cat, targetCount);
      });
      return next;
    }

    const fallbackMax = Math.max(1, groupCategories.length);
    const limit = groupLimits[groupId] ?? { min: Math.min(1, fallbackMax), max: fallbackMax };
    const min = Math.max(0, limit.min);
    const max = Math.max(min, limit.max);

    const lockedCounts = new Map<string, number>();
    const preferredPool: string[] = [];
    const fallbackPool: string[] = [];
    let totalLocked = 0;

    groupCategories.forEach((cat) => {
      const lockedItems = getLockedItems(cat);
      const currentCount = currentDraws[cat.slug]?.length ?? 0;
      const lockedCount = cardLockMap[cat.slug]
        ? Math.max(currentCount, lockedItems.length)
        : isChecked(cat.slug)
          ? lockedItems.length
          : 0;
      lockedCounts.set(cat.slug, lockedCount);
      totalLocked += lockedCount;

      if (!isChecked(cat.slug) || cardLockMap[cat.slug]) return;

      const hasActiveItems = cat.items.some((item) => item.is_active !== false);
      if (!hasActiveItems) return;

      const override = qtyMap[cat.slug];
      const maxCount = typeof override === "number" ? Math.max(0, override) : getMulRange(cat).max;
      const available = Math.max(0, maxCount - lockedCount);
      if (available === 0) return;

      const desiredCount = getCardMulCount(cat);
      const preferred = Math.min(Math.max(desiredCount - lockedCount, 0), available);
      for (let i = 0; i < preferred; i += 1) {
        preferredPool.push(cat.slug);
      }

      const remaining = available - preferred;
      for (let i = 0; i < remaining; i += 1) {
        fallbackPool.push(cat.slug);
      }
    });

    const totalCapacity = preferredPool.length + fallbackPool.length;
    const maxBudget = totalLocked + totalCapacity;
    const minBudget = Math.max(totalLocked, Math.min(min, maxBudget));
    const upperBudget = Math.max(minBudget, Math.min(max, maxBudget));
    const targetBudget =
      upperBudget <= minBudget ? minBudget : Math.floor(Math.random() * (upperBudget - minBudget + 1)) + minBudget;
    const remain = Math.max(0, targetBudget - totalLocked);

    const pool = remain > preferredPool.length ? [...preferredPool, ...fallbackPool] : preferredPool;
    const shuffledPool = pool.sort(() => 0.5 - Math.random());
    const picked = shuffledPool.slice(0, remain);
    const pickedCounts = new Map<string, number>();
    picked.forEach((slug) => {
      pickedCounts.set(slug, (pickedCounts.get(slug) ?? 0) + 1);
    });

    const next = { ...currentDraws };
    groupCategories.forEach((cat) => {
      if (cardLockMap[cat.slug]) {
        if ((next[cat.slug] ?? []).length === 0) {
          const lockedItems = getLockedItems(cat);
          if (lockedItems.length > 0) next[cat.slug] = lockedItems;
        }
        return;
      }

      const lockedCount = lockedCounts.get(cat.slug) ?? 0;
      const pickedCount = pickedCounts.get(cat.slug) ?? 0;
      const targetCount = lockedCount + pickedCount;

      if (!isChecked(cat.slug) && lockedCount === 0) {
        next[cat.slug] = [];
        return;
      }

      if (targetCount <= 0) {
        next[cat.slug] = [];
        return;
      }

      next[cat.slug] = buildDrawsForCategory(cat, targetCount);
    });

    return next;
  };

  const buildOutputText = () => {
    const activeConfig = outputConfigs.find((config) => config.id === activeOutputConfigId);
    const activeBlocks = activeConfig?.blocks ?? [];
    const blocks = activeBlocks.length > 0 ? activeBlocks : getDefaultOutputBlocks(configData);
    const orderedCategories = [...configData].sort((a, b) => {
      const orderA = a.sort_order ?? a.id;
      const orderB = b.sort_order ?? b.id;
      return orderA - orderB;
    });

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

  const onGlobalRoll = () => {
    setDraws((prev) => {
      let next: Draws = { ...prev };
      const groupIds = new Set<string>();
      let hasGeneral = false;

      configData.forEach((cat) => {
        const groupId = getCategoryGroupId(cat);
        if (isGeneralGroupId(groupId)) {
          hasGeneral = true;
        } else {
          groupIds.add(groupId);
        }
      });

      groupIds.forEach((groupId) => {
        next = applyGroupRefresh(next, groupId);
      });

      if (hasGeneral) {
        next = applyGroupRefresh(next, TAB_GENERAL);
      }

      return next;
    });
  };

  const onSingleRefresh = (categorySlug: string) => {
    const cat = configData.find((item) => item.slug === categorySlug);
    if (!cat || cardLockMap[categorySlug]) return;
    if (!isChecked(categorySlug)) return;
    const targetCount = getCardMulCount(cat);
    setDraws((prev) => ({ ...prev, [categorySlug]: buildDrawsForCategory(cat, targetCount) }));
  };

  const onRefreshGroup = (groupId: string) => {
    setDraws((prev) => applyGroupRefresh(prev, groupId));
  };

  const onToggleCardLock = (categorySlug: string) => {
    setCardLockMap((prev) => ({ ...prev, [categorySlug]: !prev[categorySlug] }));
  };

  const onToggleTagLock = (categorySlug: string, promptKey: TagLockKey) => {
    setTagLockMap((prev) => {
      const current = prev[categorySlug] ?? new Set<TagLockKey>();
      const nextSet = new Set(current);
      if (nextSet.has(promptKey)) nextSet.delete(promptKey);
      else nextSet.add(promptKey);
      return { ...prev, [categorySlug]: nextSet };
    });
  };

  const onToggleChecked = (categorySlug: string, checked: boolean) => {
    const cat = configData.find((item) => item.slug === categorySlug);
    setCheckedMap((prev) => ({ ...prev, [categorySlug]: checked }));
    if (!cat) return;
    setDraws((prev) => {
      const next = { ...prev };
      if (!checked) {
        next[categorySlug] = [];
        return next;
      }
      if (cardLockMap[categorySlug]) return next;
      if ((prev[categorySlug] ?? []).length === 0) {
        const targetCount = getCardMulCount(cat);
        next[categorySlug] = buildDrawsForCategory(cat, targetCount);
      }
      return next;
    });
  };

  const onToggleGroupChecked = (groupId: string, checked: boolean) => {
    const targets = configData.filter((cat) => {
      if (!isOptionalCategory(cat)) return false;
      if (groupId === TAB_GENERAL) return isGeneralGroupId(getCategoryGroupId(cat));
      return getCategoryGroupId(cat) === groupId;
    });

    setCheckedMap((prev) => {
      const next = { ...prev };
      targets.forEach((cat) => {
        next[cat.slug] = checked;
      });
      return next;
    });

    setDraws((prev) => {
      const next = { ...prev };
      targets.forEach((cat) => {
        if (!checked) {
          next[cat.slug] = [];
          return;
        }
        if (cardLockMap[cat.slug]) return;
        if ((prev[cat.slug] ?? []).length === 0) {
          const targetCount = getCardMulCount(cat);
          next[cat.slug] = buildDrawsForCategory(cat, targetCount);
        }
      });
      return next;
    });
  };

  const onToggleAllOptional = (checked: boolean) => {
    const optionalCats = configData.filter((cat) => isOptionalCategory(cat));
    setCheckedMap((prev) => {
      const next = { ...prev };
      optionalCats.forEach((cat) => {
        next[cat.slug] = checked;
      });
      return next;
    });

    setDraws((prev) => {
      const next = { ...prev };
      optionalCats.forEach((cat) => {
        if (!checked) {
          next[cat.slug] = [];
          return;
        }
        if (cardLockMap[cat.slug]) return;
        if ((prev[cat.slug] ?? []).length === 0) {
          const targetCount = getCardMulCount(cat);
          next[cat.slug] = buildDrawsForCategory(cat, targetCount);
        }
      });
      return next;
    });
  };

  const onUnlockAll = () => {
    setCardLockMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = false;
      });
      return next;
    });

    setTagLockMap(() => {
      const next: Record<string, Set<TagLockKey>> = {};
      configData.forEach((cat) => {
        next[cat.slug] = new Set<TagLockKey>();
      });
      return next;
    });
  };

  const onChangeQty = (categorySlug: string, delta: 1 | -1) => {
    setQtyMap((prev) => {
      const current = prev[categorySlug] ?? 0;
      const nextValue = Math.max(0, current + delta);
      return { ...prev, [categorySlug]: nextValue };
    });
  };

  const onChangeGroupLimit = (groupId: string, type: "min" | "max", delta: 1 | -1) => {
    setGroupLimits((prev) => {
      const current = prev[groupId] ?? { min: 0, max: 0 };
      let nextMin = current.min;
      let nextMax = current.max;

      if (type === "min") {
        nextMin = Math.max(0, current.min + delta);
        if (nextMin > nextMax) nextMax = nextMin;
      } else {
        nextMax = Math.max(0, current.max + delta);
        if (nextMax < nextMin) nextMin = nextMax;
      }

      return { ...prev, [groupId]: { min: nextMin, max: nextMax } };
    });
  };

  const onCreateOutputConfig = async (name: string, blocks: OutputBlock[]) => {
    try {
      const res = await fetch("/api/output-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name, blocks }),
      });
      if (!res.ok) throw new Error("Create output config failed");
      const payload = (await res.json()) as { id?: string };
      const configs = await fetchOutputConfigs();
      applyOutputConfigs(configs);
      return payload.id ?? null;
    } catch (_error) {
      return null;
    }
  };

  const onUpdateOutputConfig = async (id: string, name: string, blocks: OutputBlock[]) => {
    try {
      const res = await fetch("/api/output-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id, name, blocks }),
      });
      if (!res.ok) throw new Error("Update output config failed");
      const configs = await fetchOutputConfigs();
      applyOutputConfigs(configs);
    } catch (_error) {
      // ignore update errors for now
    }
  };

  const onDeleteOutputConfig = async (id: string) => {
    try {
      const res = await fetch("/api/output-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (!res.ok) throw new Error("Delete output config failed");
      const configs = await fetchOutputConfigs();
      applyOutputConfigs(configs);
    } catch (_error) {
      // ignore delete errors for now
    }
  };

  const onSetActiveOutputConfig = async (id: string) => {
    try {
      const res = await fetch("/api/output-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-active", id }),
      });
      if (!res.ok) throw new Error("Set active output config failed");
      const configs = await fetchOutputConfigs();
      applyOutputConfigs(configs);
    } catch (_error) {
      // ignore set-active errors for now
    }
  };

  const onRefreshData = async () => {
    const data = await refreshConfigData();
    setConfigData(data);
    setUseMock(false);
  };

  const onCopy = async () => {
    const text = buildOutputText();

    try {
      await navigator.clipboard.writeText(text);
    } catch (_error) {
      // ignore clipboard errors; still show toast
    }

    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ visible: true, message: "已複製" });
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2000);
  };

  const onSelectOutputConfig = (id: string) => {
    if (!id || id === activeOutputConfigId) return;
    void onSetActiveOutputConfig(id);
  };

  useEffect(() => {
    if (configData.length === 0 || hasAutoRolledRef.current) return;
    onGlobalRoll();
    hasAutoRolledRef.current = true;
  }, [configData]);

  if (view === "admin") {
    return (
      <AdminPanel
        data={configData}
        outputConfigs={outputConfigs}
        activeOutputConfigId={activeOutputConfigId}
        onCreateOutputConfig={onCreateOutputConfig}
        onUpdateOutputConfig={onUpdateOutputConfig}
        onDeleteOutputConfig={onDeleteOutputConfig}
        onSetActiveOutputConfig={onSetActiveOutputConfig}
        onRefreshData={onRefreshData}
        onClose={() => setView("generator")}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin mr-2" /> Loading...
      </div>
    );
  }

  const previewText = buildOutputText();

  const activeTabMode = activeTab === TAB_ALL ? "all" : activeTab === TAB_GENERAL ? "general" : "group";
  const groupTabs = tabs.filter((tab) => tab.mode === "group");
  const hasGeneralTab = tabs.some((tab) => tab.id === TAB_GENERAL);
  const toolbarGroups = [
    ...groupTabs.map((tab) => ({ id: tab.id, label: tab.label })),
    ...(hasGeneralTab ? [{ id: TAB_GENERAL, label: TAB_GENERAL }] : []),
  ];
  const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? activeTab;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <StickyTopArea
        previewText={previewText}
        charCount={previewText.length}
        outputConfigs={outputConfigs}
        activeOutputConfigId={activeOutputConfigId}
        onSelectOutputConfig={onSelectOutputConfig}
        onGlobalRoll={onGlobalRoll}
        onCopy={onCopy}
        onOpenAdmin={() => setView("admin")}
      />

      <TabsBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <ToolbarWrapper
        mode={activeTabMode}
        groups={toolbarGroups}
        activeGroupId={activeTabMode === "group" ? activeTab : undefined}
        activeGroupLabel={activeTabLabel}
        groupLimit={activeTabMode === "group" ? groupLimits[activeTab] : undefined}
        onToggleAllOptional={onToggleAllOptional}
        onToggleGroupChecked={onToggleGroupChecked}
        onRefreshGroup={onRefreshGroup}
        onUnlockAll={onUnlockAll}
        onChangeGroupLimit={onChangeGroupLimit}
      />

      <CardGrid
        categories={configData}
        activeTab={activeTab}
        draws={draws}
        checkedMap={checkedMap}
        cardLockMap={cardLockMap}
        tagLockMap={tagLockMap}
        qtyMap={qtyMap}
        onToggleChecked={onToggleChecked}
        onToggleCardLock={onToggleCardLock}
        onToggleTagLock={onToggleTagLock}
        onSingleRefresh={onSingleRefresh}
        onChangeQty={onChangeQty}
      />

      <CopyToast toast={toast} />

      {useMock && (
        <div className="fixed bottom-4 right-4 bg-yellow-100 text-yellow-800 text-[10px] px-2 py-1 rounded border border-yellow-200">
          Mock Mode
        </div>
      )}
    </div>
  );
}
