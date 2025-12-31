import { useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent } from "react";
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
import { useAdminMutations } from "../../hooks/useAdminMutations";
import { useCategoriesData } from "../../hooks/useCategoriesData";
import { useOutputConfigs } from "../../hooks/useOutputConfigs";
import { getCardMulCount, getMulRange } from "../../lib/rngPrompt/mul";
import { buildOutputText } from "../../lib/rngPrompt/outputText";
import { blocksToTemplate, getDefaultGroupBlocks, getDefaultOutputBlocks, templateToBlocks } from "../../lib/rngPrompt/outputTemplate";
import { drawFromShuffleBag } from "../../lib/rngPrompt/shuffleBag";
import { readGroupLimitsCookie, readShuffleBags, writeGroupLimitsCookie, writeShuffleBags, type ShuffleBags } from "../../lib/rngPrompt/storage";
import type {
  Category,
  CategoryType,
  Draws,
  GroupLimit,
  OutputBlock,
  OutputConfig,
  PromptItem,
  TagLockKey,
} from "../../lib/rngPrompt/types";
import { TAB_ALL, TAB_GENERAL, getCategoryGroupId, isGeneralGroupId, isOptionalCategory } from "../../lib/rngPrompt/utils";


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

const CATEGORY_CSV_COLUMNS = "id,slug,label,ui_group,is_optional,type,min_count,max_count,sort_order";
const PROMPT_CSV_COLUMNS = "id,category_slug,value,label,is_active";

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
  const [importingType, setImportingType] = useState<"categories" | "prompts" | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [categoriesFile, setCategoriesFile] = useState<File | null>(null);
  const [promptsFile, setPromptsFile] = useState<File | null>(null);
  const categoriesInputRef = useRef<HTMLInputElement | null>(null);
  const promptsInputRef = useRef<HTMLInputElement | null>(null);
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
  const { runAdminMutation } = useAdminMutations({ onRefreshData });

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

  const formatImportError = (payload: any) => {
    if (!payload) return "匯入失敗";
    const details = Array.isArray(payload.details) ? payload.details.slice(0, 3).join(" / ") : "";
    const expected =
      typeof payload.expected === "string" && payload.expected.length > 0 ? `（預期欄位：${payload.expected}）` : "";
    if (payload.error && details) return `${payload.error}：${details}${expected}`;
    if (payload.error) return `${payload.error}${expected}`;
    return "匯入失敗";
  };

  const handleImportCsv = async (type: "categories" | "prompts") => {
    const file = type === "categories" ? categoriesFile : promptsFile;
    if (!file) {
      setImportError("請先選擇 CSV 檔案");
      return;
    }
    setImportingType(type);
    setImportError(null);
    setImportMessage(null);
    const formData = new FormData();
    formData.append("type", type);
    formData.append("file", file);

    try {
      const res = await fetch("/api/rng-prompt/import", {
        method: "POST",
        body: formData,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setImportError(formatImportError(payload));
        return;
      }
      const created = payload?.created ?? 0;
      const updated = payload?.updated ?? 0;
      const backupId = payload?.backupId ?? "-";
      const typeLabel = type === "categories" ? "Categories" : "Prompts";
      setImportMessage(`已匯入 ${typeLabel}，更新 ${updated} 筆、建立 ${created} 筆。備份版本 #${backupId}`);
      if (type === "categories") {
        setCategoriesFile(null);
        if (categoriesInputRef.current) categoriesInputRef.current.value = "";
      } else {
        setPromptsFile(null);
        if (promptsInputRef.current) promptsInputRef.current.value = "";
      }
      await onRefreshData();
    } catch (_error) {
      setImportError("匯入失敗");
    } finally {
      setImportingType(null);
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
            <>
              <div className="p-4 bg-white border-b border-slate-200">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                    <div className="text-xs font-bold text-slate-600">CSV 匯出</div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        className="px-3 py-1.5 rounded bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                        href="/api/rng-prompt/export?type=categories"
                        download
                      >
                        下載 Categories CSV
                      </a>
                      <a
                        className="px-3 py-1.5 rounded bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                        href="/api/rng-prompt/export?type=prompts"
                        download
                      >
                        下載 Prompts CSV
                      </a>
                    </div>
                    <p className="text-[10px] text-slate-500">Categories 欄位：{CATEGORY_CSV_COLUMNS}</p>
                    <p className="text-[10px] text-slate-500">Prompts 欄位：{PROMPT_CSV_COLUMNS}</p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                    <div className="text-xs font-bold text-slate-600">CSV 匯入（自動備份上一版）</div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={categoriesInputRef}
                          type="file"
                          accept=".csv,text/csv"
                          onChange={(event) => {
                            setCategoriesFile(event.target.files?.[0] ?? null);
                            setImportError(null);
                            setImportMessage(null);
                          }}
                          className="text-xs"
                        />
                        <button
                          onClick={() => handleImportCsv("categories")}
                          disabled={!categoriesFile || importingType !== null}
                          className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-semibold disabled:opacity-50"
                        >
                          {importingType === "categories" ? "匯入中..." : "上傳 Categories"}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={promptsInputRef}
                          type="file"
                          accept=".csv,text/csv"
                          onChange={(event) => {
                            setPromptsFile(event.target.files?.[0] ?? null);
                            setImportError(null);
                            setImportMessage(null);
                          }}
                          className="text-xs"
                        />
                        <button
                          onClick={() => handleImportCsv("prompts")}
                          disabled={!promptsFile || importingType !== null}
                          className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-semibold disabled:opacity-50"
                        >
                          {importingType === "prompts" ? "匯入中..." : "上傳 Prompts"}
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500">依 id/slug/組合鍵覆蓋，缺少的資料不會自動刪除。</p>
                    <p className="text-[10px] text-slate-500">建議先匯入 Categories，再匯入 Prompts。</p>
                    {importMessage && <p className="text-[11px] text-emerald-700">{importMessage}</p>}
                    {importError && <p className="text-[11px] text-rose-600">{importError}</p>}
                  </div>
                </div>
              </div>

              {activeCategory ? (
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
                <div className="flex-1 flex items-center justify-center text-slate-400">
                  請選擇左側類別以編輯內容
                </div>
              )}
            </>
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
  const [showPicker, setShowPicker] = useState(false);
  const hasContent = draws.length > 0;
  const isGroup = category.type === "group";
  const isOptional = isOptionalCategory(category);
  const typeLabel = isGroup ? "群組" : isOptional ? "選用" : "必填";
  const typeClass = isGroup
    ? "bg-orange-100 text-orange-700"
    : isOptional
      ? "bg-pink-100 text-pink-700"
      : "bg-blue-100 text-blue-700";

  const selectedKey = tagLocks.size > 0 ? Array.from(tagLocks)[0] : null;
  const selectableItems = category.items.filter((item) => item.is_active !== false);

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
        {selectedKey !== null && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">
            指定
          </span>
        )}
        {typeof qty === "number" && (
          <div
            onClick={(event) => event.stopPropagation()}
            className="shrink-0"
          >
            <Stepper value={qty} onChange={(delta) => onChangeQty(category.slug, delta)} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-2 py-1 border-b border-slate-100 bg-slate-50/80 text-[11px]">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setShowPicker((prev) => !prev);
          }}
          className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
        >
          {showPicker ? "收起直選" : "直選"}
        </button>
        {selectedKey !== null && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleTagLock(category.slug, selectedKey);
            }}
            className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
          >
            清除指定
          </button>
        )}
      </div>

      {showPicker && (
        <div className="px-2 py-2 border-b border-slate-100 bg-white max-h-[140px] overflow-y-auto flex flex-wrap gap-1">
          {selectableItems.length === 0 ? (
            <span className="text-xs text-slate-400">無可選項</span>
          ) : (
            selectableItems.map((item) => {
              const key: TagLockKey = item.id ?? item.value;
              const isSelected = selectedKey === key;
              return (
                <button
                  type="button"
                  key={`${category.slug}-pick-${key}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleTagLock(category.slug, key);
                  }}
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border transition ${
                    isSelected
                      ? "bg-emerald-100 text-emerald-700 border-emerald-300 font-semibold"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  {item.label || item.value}
                </button>
              );
            })
          )}
        </div>
      )}

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
            const isSelected = selectedKey === key;
            return (
              <button
                type="button"
                key={`${category.slug}-${key}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleTagLock(category.slug, key);
                }}
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border transition ${
                  isSelected
                    ? "bg-emerald-100 text-emerald-700 border-emerald-300 font-semibold"
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

type RngState = {
  draws: Draws;
  checkedMap: Record<string, boolean>;
  cardLockMap: Record<string, boolean>;
  tagLockMap: Record<string, Set<TagLockKey>>;
  qtyMap: Record<string, number>;
  groupLimits: Record<string, GroupLimit>;
};

type RngAction =
  | { type: "init_from_data"; data: Category[]; storedGroupLimits: Record<string, GroupLimit> }
  | { type: "set_draws"; draws: Draws }
  | { type: "set_checked"; slug: string; checked: boolean }
  | { type: "set_checked_bulk"; slugs: string[]; checked: boolean }
  | { type: "toggle_card_lock"; slug: string }
  | { type: "set_card_lock_map"; map: Record<string, boolean> }
  | { type: "set_tag_lock"; slug: string; locks: Set<TagLockKey> }
  | { type: "set_tag_lock_map"; map: Record<string, Set<TagLockKey>> }
  | { type: "set_qty"; slug: string; qty: number }
  | { type: "set_group_limit"; groupId: string; limit: GroupLimit }
  | { type: "set_group_limits"; groupLimits: Record<string, GroupLimit> };

const initialRngState: RngState = {
  draws: {},
  checkedMap: {},
  cardLockMap: {},
  tagLockMap: {},
  qtyMap: {},
  groupLimits: {},
};

const rngReducer = (state: RngState, action: RngAction): RngState => {
  switch (action.type) {
    case "init_from_data": {
      if (action.data.length === 0) return state;
      const nextCheckedMap = { ...state.checkedMap };
      const nextCardLockMap = { ...state.cardLockMap };
      const nextTagLockMap = { ...state.tagLockMap };
      const nextQtyMap = { ...state.qtyMap };
      const nextGroupLimits = { ...state.groupLimits };
      const nextDraws = { ...state.draws };
      const storedLimits = action.storedGroupLimits;
      const groupCounts = new Map<string, number>();

      action.data.forEach((cat) => {
        if (nextCheckedMap[cat.slug] === undefined) nextCheckedMap[cat.slug] = true;
        if (nextCardLockMap[cat.slug] === undefined) nextCardLockMap[cat.slug] = false;
        if (nextTagLockMap[cat.slug] === undefined) nextTagLockMap[cat.slug] = new Set<TagLockKey>();
        if (cat.type === "group" && nextQtyMap[cat.slug] === undefined) {
          nextQtyMap[cat.slug] = Math.max(1, cat.min_count ?? 1);
        }
        if (nextDraws[cat.slug] === undefined) nextDraws[cat.slug] = [];
        if (cat.items.length === 0) return;
        const groupId = getCategoryGroupId(cat);
        if (isGeneralGroupId(groupId)) return;
        groupCounts.set(groupId, (groupCounts.get(groupId) ?? 0) + 1);
      });

      groupCounts.forEach((count, groupId) => {
        if (nextGroupLimits[groupId] !== undefined) return;
        const stored = storedLimits[groupId];
        if (stored) {
          const safeMin = Math.max(0, stored.min);
          const safeMax = Math.max(safeMin, stored.max);
          nextGroupLimits[groupId] = { min: safeMin, max: safeMax };
          return;
        }
        const safeMax = Math.max(1, count);
        nextGroupLimits[groupId] = { min: Math.min(1, safeMax), max: safeMax };
      });

      return {
        draws: nextDraws,
        checkedMap: nextCheckedMap,
        cardLockMap: nextCardLockMap,
        tagLockMap: nextTagLockMap,
        qtyMap: nextQtyMap,
        groupLimits: nextGroupLimits,
      };
    }
    case "set_draws":
      return { ...state, draws: action.draws };
    case "set_checked":
      return { ...state, checkedMap: { ...state.checkedMap, [action.slug]: action.checked } };
    case "set_checked_bulk": {
      const next = { ...state.checkedMap };
      action.slugs.forEach((slug) => {
        next[slug] = action.checked;
      });
      return { ...state, checkedMap: next };
    }
    case "toggle_card_lock":
      return {
        ...state,
        cardLockMap: { ...state.cardLockMap, [action.slug]: !state.cardLockMap[action.slug] },
      };
    case "set_card_lock_map":
      return { ...state, cardLockMap: action.map };
    case "set_tag_lock":
      return { ...state, tagLockMap: { ...state.tagLockMap, [action.slug]: action.locks } };
    case "set_tag_lock_map":
      return { ...state, tagLockMap: action.map };
    case "set_qty":
      return { ...state, qtyMap: { ...state.qtyMap, [action.slug]: action.qty } };
    case "set_group_limit":
      return { ...state, groupLimits: { ...state.groupLimits, [action.groupId]: action.limit } };
    case "set_group_limits":
      return { ...state, groupLimits: action.groupLimits };
    default:
      return state;
  }
};

export default function RngPromptRoute() {
  const { configData, loading, useMock, refreshData } = useCategoriesData({ mockData: MOCK_DB_DATA });
  const { outputConfigs, activeOutputConfigId, applyOutputConfigs, fetchOutputConfigs } = useOutputConfigs();
  const [state, dispatch] = useReducer(rngReducer, initialRngState);
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "" });
  const [activeTab, setActiveTab] = useState<string>(TAB_ALL);
  const [view, setView] = useState<"generator" | "admin">("generator");
  const toastTimerRef = useRef<number | null>(null);
  const hasAutoRolledRef = useRef(false);
  const groupLimitsCookieRef = useRef<Record<string, GroupLimit>>({});
  const shuffleBagsRef = useRef<ShuffleBags>({});
  const { draws, checkedMap, cardLockMap, tagLockMap, qtyMap, groupLimits } = state;

  useEffect(() => {
    groupLimitsCookieRef.current = readGroupLimitsCookie();
  }, []);

  useEffect(() => {
    shuffleBagsRef.current = readShuffleBags();
  }, []);

  useEffect(() => {
    if (configData.length === 0) return;
    dispatch({ type: "init_from_data", data: configData, storedGroupLimits: groupLimitsCookieRef.current });
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

  const getActiveItems = (cat: Category) => cat.items.filter((item) => item.is_active !== false);

  const getLockedItems = (cat: Category) => {
    const locks = tagLockMap[cat.slug];
    if (!locks || locks.size === 0) return [];
    return cat.items.filter((item) => locks.has(getItemKey(item)));
  };

  const getRandomItems = (cat: Category, count: number, excludeKeys: Set<TagLockKey>) => {
    const activeItems = getActiveItems(cat);
    const { picked, bags } = drawFromShuffleBag(
      shuffleBagsRef.current,
      cat.slug,
      activeItems,
      getItemKey,
      count,
      excludeKeys,
    );
    shuffleBagsRef.current = bags;
    writeShuffleBags(shuffleBagsRef.current);
    return picked;
  };

  const buildRandomDrawsForCategory = (cat: Category, targetCount: number) => {
    const safeTarget = Math.max(0, targetCount);
    if (safeTarget <= 0) return [];
    return getRandomItems(cat, safeTarget, new Set<TagLockKey>());
  };

  const buildDrawsForCategory = (cat: Category, targetCount: number) => {
    const lockedItems = getLockedItems(cat);
    if (lockedItems.length > 0) return lockedItems;
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
        const targetCount = getCardMulCount(cat, qtyMap[cat.slug]);
        next[cat.slug] = buildDrawsForCategory(cat, targetCount);
      });
      return next;
    }

    const fallbackMax = Math.max(1, groupCategories.length);
    const limit = groupLimits[groupId] ?? { min: Math.min(1, fallbackMax), max: fallbackMax };
    const min = Math.max(0, limit.min);
    const max = Math.max(min, limit.max);

    const lockedCounts = new Map<string, number>();
    const manualSelectionMap = new Map<string, boolean>();
    const preferredPool: string[] = [];
    const fallbackPool: string[] = [];
    let totalLocked = 0;

    groupCategories.forEach((cat) => {
      const lockedItems = getLockedItems(cat);
      manualSelectionMap.set(cat.slug, lockedItems.length > 0);
      const currentCount = currentDraws[cat.slug]?.length ?? 0;
      const lockedCount = cardLockMap[cat.slug]
        ? Math.max(currentCount, lockedItems.length)
        : isChecked(cat.slug)
          ? lockedItems.length
          : 0;
      lockedCounts.set(cat.slug, lockedCount);
      totalLocked += lockedCount;

      if (!isChecked(cat.slug) || cardLockMap[cat.slug]) return;
      if (manualSelectionMap.get(cat.slug)) return;

      const hasActiveItems = cat.items.some((item) => item.is_active !== false);
      if (!hasActiveItems) return;

      const override = qtyMap[cat.slug];
      const maxCount = typeof override === "number" ? Math.max(0, override) : getMulRange(cat).max;
      const available = Math.max(0, maxCount - lockedCount);
      if (available === 0) return;

      const desiredCount = getCardMulCount(cat, qtyMap[cat.slug]);
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

  const onGlobalRoll = () => {
    let next: Draws = { ...draws };
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

    dispatch({ type: "set_draws", draws: next });
  };

  const onSingleRefresh = (categorySlug: string) => {
    const cat = configData.find((item) => item.slug === categorySlug);
    if (!cat || cardLockMap[categorySlug]) return;
    if (!isChecked(categorySlug)) return;
    const targetCount = getCardMulCount(cat, qtyMap[cat.slug]);
    dispatch({
      type: "set_draws",
      draws: { ...draws, [categorySlug]: buildDrawsForCategory(cat, targetCount) },
    });
  };

  const onRefreshGroup = (groupId: string) => {
    dispatch({ type: "set_draws", draws: applyGroupRefresh(draws, groupId) });
  };

  const onToggleCardLock = (categorySlug: string) => {
    dispatch({ type: "toggle_card_lock", slug: categorySlug });
  };

  const onToggleTagLock = (categorySlug: string, promptKey: TagLockKey) => {
    const cat = configData.find((item) => item.slug === categorySlug);
    if (!cat) return;
    const item = cat.items.find((candidate) => getItemKey(candidate) === promptKey);
    const hasSame = tagLockMap[categorySlug]?.size === 1 && tagLockMap[categorySlug]?.has(promptKey);
    const nextSet = new Set<TagLockKey>();
    if (!hasSame && item) nextSet.add(promptKey);
    dispatch({ type: "set_tag_lock", slug: categorySlug, locks: nextSet });

    const next = { ...draws };
    if (hasSame) {
      if (!isChecked(categorySlug)) {
        next[categorySlug] = [];
        dispatch({ type: "set_draws", draws: next });
        return;
      }
      if (!cardLockMap[categorySlug]) {
        const targetCount = getCardMulCount(cat, qtyMap[cat.slug]);
        next[categorySlug] = buildRandomDrawsForCategory(cat, targetCount);
      }
      dispatch({ type: "set_draws", draws: next });
      return;
    }
    if (item) {
      next[categorySlug] = [item];
    }
    dispatch({ type: "set_draws", draws: next });
  };

  const onToggleChecked = (categorySlug: string, checked: boolean) => {
    const cat = configData.find((item) => item.slug === categorySlug);
    dispatch({ type: "set_checked", slug: categorySlug, checked });
    if (!cat) return;
    const next = { ...draws };
    if (!checked) {
      next[categorySlug] = [];
      dispatch({ type: "set_draws", draws: next });
      return;
    }
    if (cardLockMap[categorySlug]) {
      dispatch({ type: "set_draws", draws: next });
      return;
    }
    if ((draws[categorySlug] ?? []).length === 0) {
      const targetCount = getCardMulCount(cat, qtyMap[cat.slug]);
      next[categorySlug] = buildDrawsForCategory(cat, targetCount);
    }
    dispatch({ type: "set_draws", draws: next });
  };

  const onToggleGroupChecked = (groupId: string, checked: boolean) => {
    const targets = configData.filter((cat) => {
      if (!isOptionalCategory(cat)) return false;
      if (groupId === TAB_GENERAL) return isGeneralGroupId(getCategoryGroupId(cat));
      return getCategoryGroupId(cat) === groupId;
    });

    dispatch({ type: "set_checked_bulk", slugs: targets.map((cat) => cat.slug), checked });

    const next = { ...draws };
    targets.forEach((cat) => {
      if (!checked) {
        next[cat.slug] = [];
        return;
      }
      if (cardLockMap[cat.slug]) return;
      if ((draws[cat.slug] ?? []).length === 0) {
        const targetCount = getCardMulCount(cat, qtyMap[cat.slug]);
        next[cat.slug] = buildDrawsForCategory(cat, targetCount);
      }
    });
    dispatch({ type: "set_draws", draws: next });
  };

  const onToggleAllOptional = (checked: boolean) => {
    const optionalCats = configData.filter((cat) => isOptionalCategory(cat));
    dispatch({ type: "set_checked_bulk", slugs: optionalCats.map((cat) => cat.slug), checked });

    const next = { ...draws };
    optionalCats.forEach((cat) => {
      if (!checked) {
        next[cat.slug] = [];
        return;
      }
      if (cardLockMap[cat.slug]) return;
      if ((draws[cat.slug] ?? []).length === 0) {
        const targetCount = getCardMulCount(cat, qtyMap[cat.slug]);
        next[cat.slug] = buildDrawsForCategory(cat, targetCount);
      }
    });
    dispatch({ type: "set_draws", draws: next });
  };

  const onUnlockAll = () => {
    const nextCardLocks = { ...cardLockMap };
    Object.keys(nextCardLocks).forEach((key) => {
      nextCardLocks[key] = false;
    });
    dispatch({ type: "set_card_lock_map", map: nextCardLocks });

    const nextTagLocks: Record<string, Set<TagLockKey>> = {};
    configData.forEach((cat) => {
      nextTagLocks[cat.slug] = new Set<TagLockKey>();
    });
    dispatch({ type: "set_tag_lock_map", map: nextTagLocks });
  };

  const onChangeQty = (categorySlug: string, delta: 1 | -1) => {
    const current = qtyMap[categorySlug] ?? 0;
    const nextValue = Math.max(0, current + delta);
    dispatch({ type: "set_qty", slug: categorySlug, qty: nextValue });
  };

  const onChangeGroupLimit = (groupId: string, type: "min" | "max", delta: 1 | -1) => {
    const current = groupLimits[groupId] ?? { min: 0, max: 0 };
    let nextMin = current.min;
    let nextMax = current.max;

    if (type === "min") {
      nextMin = Math.max(0, current.min + delta);
      if (nextMin > nextMax) nextMax = nextMin;
    } else {
      nextMax = Math.max(0, current.max + delta);
      if (nextMax < nextMin) nextMin = nextMax;
    }

    dispatch({ type: "set_group_limit", groupId, limit: { min: nextMin, max: nextMax } });
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
    await refreshData();
  };

  const onCopy = async () => {
    const text = buildOutputText({
      configData,
      draws,
      checkedMap,
      cardLockMap,
      outputConfigs,
      activeOutputConfigId,
    });

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

  const previewText = buildOutputText({
    configData,
    draws,
    checkedMap,
    cardLockMap,
    outputConfigs,
    activeOutputConfigId,
  });

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
