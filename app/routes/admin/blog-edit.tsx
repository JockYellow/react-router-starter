import { useEffect, useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { loadBlogCategories } from "../../features/blog/blog.server";
import type { BlogCategory, BlogPost } from "../../features/blog/blog.types";
import { requireAdmin } from "../../features/admin/admin-auth.server";

type LoaderData = Awaited<ReturnType<typeof loader>>;

export async function loader({ request, context }: LoaderFunctionArgs) {
  requireAdmin(request, context);
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "";
  const categories = await loadBlogCategories();
  return Response.json({ slug, categories });
}

type FormState = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  tagsInput: string;
  categoryId: string;
  subcategoryId: string;
  publishedAtInput: string;
  updatedAtBase: string;
  isExisting: boolean;
  imageUrl: string;
  imageFile: File | null;
};

function defaultFormState(initialSlug: string): FormState {
  return {
    slug: initialSlug,
    title: "",
    summary: "",
    body: "",
    tagsInput: "",
    categoryId: "",
    subcategoryId: "",
    publishedAtInput: formatDatetimeLocal(new Date().toISOString()),
    updatedAtBase: "",
    isExisting: false,
    imageUrl: "",
    imageFile: null,
  };
}

function formatDatetimeLocal(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return "";
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function parseTags(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function AdminBlogEditPage() {
  const { slug: initialSlug, categories } = useLoaderData() as LoaderData;
  const [formState, setFormState] = useState<FormState>(() => defaultFormState(initialSlug));
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const availableSubcategories = useMemo(() => {
    return categories.find((cat) => cat.id === formState.categoryId)?.children ?? [];
  }, [categories, formState.categoryId]);

  useEffect(() => {
    if (initialSlug) {
      void fetchPost(initialSlug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSlug]);

  useEffect(() => {
    let nextObjectUrl: string | null = null;
    if (formState.imageFile) {
      nextObjectUrl = URL.createObjectURL(formState.imageFile);
      setImagePreview(nextObjectUrl);
    } else {
      setImagePreview(formState.imageUrl || null);
    }
    return () => {
      if (nextObjectUrl) {
        URL.revokeObjectURL(nextObjectUrl);
      }
    };
  }, [formState.imageFile, formState.imageUrl]);

  async function fetchPost(slug: string) {
    if (!slug) return;
    setIsFetching(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/blog-post?slug=${encodeURIComponent(slug)}`);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const post = (await res.json()) as BlogPost;
      setFormState((prev) => ({
        ...prev,
        slug: post.slug ?? slug,
        title: post.title ?? "",
        summary: post.summary ?? "",
        body: post.body ?? "",
        tagsInput: Array.isArray(post.tags) ? post.tags.join(", ") : "",
        categoryId: post.categoryId ?? "",
        subcategoryId: post.subcategoryId ?? "",
        publishedAtInput: formatDatetimeLocal(post.publishedAt),
        updatedAtBase: post.updatedAt ?? "",
        isExisting: true,
        imageUrl: post.imageUrl ?? "",
        imageFile: null,
      }));
      setMessage("已載入最新內容");
    } catch (err: any) {
      setError(err.message || "載入文章失敗");
    } finally {
      setIsFetching(false);
    }
  }

  async function handleSave() {
    if (!formState.title || !formState.body) {
      setError("請至少填寫標題與內容");
      return;
    }
    if (formState.isExisting && !formState.slug) {
      setError("無法更新：缺少 slug");
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    let endpoint = "/api/blog-post";
    let method: "POST" | "PUT" = "POST";

    const formData = new FormData();
    formData.append("title", formState.title);
    formData.append("summary", formState.summary);
    formData.append("body", formState.body);
    formData.append("tags", formState.tagsInput);
    if (formState.categoryId) formData.append("categoryId", formState.categoryId);
    if (formState.subcategoryId) formData.append("subcategoryId", formState.subcategoryId);
    if (formState.publishedAtInput) {
      formData.append("publishedAt", new Date(formState.publishedAtInput).toISOString());
    }
    if (formState.imageFile) {
      formData.append("image", formState.imageFile);
    }

    if (formState.isExisting) {
      method = "PUT";
      endpoint = `/api/blog-post?slug=${encodeURIComponent(formState.slug)}`;
      formData.append("updatedAtBase", formState.updatedAtBase);
    } else if (formState.slug) {
      formData.append("slug", formState.slug);
    }

    try {
      const res = await fetch(endpoint, {
        method,
        body: formData,
      });

      if (res.status === 409) {
        setError("文章已在別處被更新或 slug 重複，請重新載入。");
        if (formState.slug) {
          await fetchPost(formState.slug);
        }
        return;
      }
      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      if (method === "POST") {
        const nextSlug = data.slug as string;
        await fetchPost(nextSlug);
        setMessage("已建立文章");
      } else {
        const refreshed = data.post as any;
        setFormState((prev) => ({
          ...prev,
          imageFile: null,
          imageUrl: refreshed?.imageUrl ?? prev.imageUrl,
          updatedAtBase: refreshed?.updatedAt ?? prev.updatedAtBase,
        }));
        setMessage("已儲存最新內容");
      }
    } catch (err: any) {
      setError(err.message || "儲存失敗");
    } finally {
      setIsSaving(false);
    }
  }

  function handleInputChange<T extends keyof FormState>(key: T, value: FormState[T]) {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  function handleImageChange(file: File | null) {
    setFormState((prev) => ({ ...prev, imageFile: file }));
  }

  function handleCategoryChange(value: string) {
    setFormState((prev) => {
      const category = categories.find((cat) => cat.id === value);
      const subIsValid = category?.children.some((child) => child.id === prev.subcategoryId);
      return {
        ...prev,
        categoryId: value,
        subcategoryId: subIsValid ? prev.subcategoryId : "",
      };
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <header className="space-y-2">
        <p className="eyebrow text-neutral-500">Blog 編輯介面</p>
        <h1 className="text-3xl font-bold text-neutral-900">雲端文章管理</h1>
        <p className="text-sm text-neutral-600">
          透過 Cloudflare D1 直接讀寫文章，更新後網站即時同步，不需重新部署。
        </p>
      </header>

      <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white/90 p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
            Slug
            <input
              type="text"
              value={formState.slug}
              onChange={(e) => handleInputChange("slug", e.target.value)}
              className="input"
              placeholder="color-palette"
              disabled={formState.isExisting}
            />
          </label>
          <button
            type="button"
            className="btn-ghost h-fit self-end"
            onClick={() => fetchPost(formState.slug)}
            disabled={!formState.slug || isFetching}
          >
            {isFetching ? "載入中..." : "重新載入"}
          </button>
        </div>

        <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
          標題
          <input
            type="text"
            value={formState.title}
            onChange={(e) => handleInputChange("title", e.target.value)}
            className="input"
            placeholder="Workers + React Router 的實測"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
          摘要
          <textarea
            value={formState.summary}
            onChange={(e) => handleInputChange("summary", e.target.value)}
            className="textarea"
            rows={3}
            placeholder="文章簡短說明，會用於列表與 meta。"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
            封面圖片
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
              className="input file:mr-2 file:rounded-md file:border-0 file:bg-[--color-accent-50] file:px-3 file:py-2 file:text-sm"
            />
            <span className="text-xs font-normal text-neutral-500">
              新增或更新時若未選擇圖片，會沿用目前封面。
            </span>
          </label>
          <div className="flex flex-col items-start gap-2">
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="文章封面預覽"
                className="h-24 w-36 rounded-lg border border-neutral-200 object-cover"
              />
            ) : (
              <div className="flex h-24 w-36 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-xs text-neutral-500">
                尚未設定封面
              </div>
            )}
            {formState.imageFile ? (
              <button type="button" className="btn-ghost text-xs px-3 py-1" onClick={() => handleImageChange(null)}>
                清除新圖片
              </button>
            ) : null}
          </div>
        </div>

        <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
          內文
          <textarea
            value={formState.body}
            onChange={(e) => handleInputChange("body", e.target.value)}
            className="textarea"
            rows={10}
            placeholder="這裡貼上 Markdown 或純文字內容"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
            標籤（逗號分隔）
            <input
              type="text"
              value={formState.tagsInput}
              onChange={(e) => handleInputChange("tagsInput", e.target.value)}
              className="input"
              placeholder="Workers, React Router, D1"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
            發佈時間
            <input
              type="datetime-local"
              value={formState.publishedAtInput}
              onChange={(e) => handleInputChange("publishedAtInput", e.target.value)}
              className="input"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
            分類
            <select
              className="input"
              value={formState.categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              <option value="">選擇分類</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
            子分類
            <select
              className="input"
              value={formState.subcategoryId}
              onChange={(e) => handleInputChange("subcategoryId", e.target.value)}
              disabled={!availableSubcategories.length}
            >
              <option value="">選擇子分類</option>
              {availableSubcategories.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {subcategory.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={isSaving || isFetching}
          >
            {isSaving ? "儲存中..." : "儲存文章"}
          </button>
          {message ? <p className="text-sm text-green-600">{message}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
