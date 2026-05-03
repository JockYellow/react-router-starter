import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { ImagePlus, Video, Columns2, Heading2, Quote, Minus, ArrowUp, ArrowDown, Trash2 } from "lucide-react";

import { AdminNav } from "../../components/AdminNav";
import { loadBlogCategories } from "../../features/blog/blog.server";
import type { BlogCategory, BlogContentBlock, BlogMediaAsset } from "../../features/blog/blog.types";
import { getCsrfToken } from "../../features/admin/admin-auth.server";

type LoaderData = {
  slug: string;
  categories: BlogCategory[];
  csrfToken: string;
};

type FormState = {
  slug: string;
  title: string;
  summary: string;
  blocks: BlogContentBlock[];
  tagsInput: string;
  categoryId: string;
  subcategoryId: string;
  publishedAtInput: string;
  updatedAtBase: string;
  isExisting: boolean;
};

function newId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function paragraphBlock(text = ""): BlogContentBlock {
  return { id: newId("paragraph"), type: "paragraph", props: { text } };
}

function defaultFormState(initialSlug: string): FormState {
  return {
    slug: initialSlug,
    title: "",
    summary: "",
    blocks: [paragraphBlock()],
    tagsInput: "",
    categoryId: "",
    subcategoryId: "",
    publishedAtInput: formatDatetimeLocal(new Date().toISOString()),
    updatedAtBase: "",
    isExisting: false,
  };
}

function formatDatetimeLocal(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return "";
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function plainTextFromBlocks(blocks: BlogContentBlock[]) {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === "paragraph" || block.type === "heading" || block.type === "quote") parts.push(block.props.text);
    if (block.type === "columns") {
      for (const column of block.props.columns) parts.push(plainTextFromBlocks(column.blocks));
    }
  }
  return parts.filter(Boolean).join("\n\n");
}

function blockLabel(block: BlogContentBlock) {
  switch (block.type) {
    case "paragraph":
      return "段落";
    case "heading":
      return "標題";
    case "image":
      return "圖片";
    case "video":
      return "影片";
    case "gallery":
      return "圖集";
    case "quote":
      return "引用";
    case "divider":
      return "分隔線";
    case "columns":
      return "雙欄";
  }
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "";
  const categories = await loadBlogCategories();
  const csrf = await getCsrfToken(request, context);
  return Response.json(
    { slug, categories, csrfToken: csrf.token },
    {
      headers: { "Set-Cookie": csrf.cookie },
    },
  );
}

export default function AdminBlogEditPage() {
  const { slug: initialSlug, categories, csrfToken } = useLoaderData() as LoaderData;
  const [formState, setFormState] = useState<FormState>(() => defaultFormState(initialSlug));
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const availableSubcategories = useMemo(() => {
    return categories.find((cat: BlogCategory) => cat.id === formState.categoryId)?.children ?? [];
  }, [categories, formState.categoryId]);

  useEffect(() => {
    if (initialSlug) void fetchPost(initialSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSlug]);

  async function fetchPost(slug: string) {
    if (!slug) return;
    setIsFetching(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/blog-post?slug=${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error(await res.text());
      const post = (await res.json()) as {
        slug?: string;
        title?: string;
        summary?: string;
        body?: string;
        content?: BlogContentBlock[];
        tags?: string[];
        categoryId?: string | null;
        subcategoryId?: string | null;
        publishedAt?: string;
        updatedAt?: string;
      };
      setFormState((prev) => ({
        ...prev,
        slug: post.slug ?? slug,
        title: post.title ?? "",
        summary: post.summary ?? "",
        blocks: Array.isArray(post.content) && post.content.length ? post.content : [paragraphBlock(post.body ?? "")],
        tagsInput: Array.isArray(post.tags) ? post.tags.join(", ") : "",
        categoryId: post.categoryId ?? "",
        subcategoryId: post.subcategoryId ?? "",
        publishedAtInput: formatDatetimeLocal(post.publishedAt),
        updatedAtBase: post.updatedAt ?? "",
        isExisting: true,
      }));
      setMessage("已載入最新內容");
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入文章失敗");
    } finally {
      setIsFetching(false);
    }
  }

  async function handleSave() {
    const body = plainTextFromBlocks(formState.blocks);
    if (!formState.title || !body) {
      setError("請至少填寫標題與一段內容");
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.append("title", formState.title);
    formData.append("summary", formState.summary);
    formData.append("body", body);
    formData.append("contentJson", JSON.stringify(formState.blocks));
    formData.append("tags", formState.tagsInput);
    if (formState.categoryId) formData.append("categoryId", formState.categoryId);
    if (formState.subcategoryId) formData.append("subcategoryId", formState.subcategoryId);
    if (formState.publishedAtInput) formData.append("publishedAt", new Date(formState.publishedAtInput).toISOString());

    let endpoint = "/api/blog-post";
    let method: "POST" | "PUT" = "POST";
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
        headers: { "x-csrf-token": csrfToken },
        body: formData,
      });
      if (res.status === 409) {
        setError("文章已在別處被更新或 slug 重複，請重新載入。");
        if (formState.slug) await fetchPost(formState.slug);
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { slug?: string };
      const nextSlug = (method === "POST" ? data.slug : formState.slug) || formState.slug;
      await fetchPost(nextSlug);
      setMessage(method === "POST" ? "已建立文章" : "已儲存最新內容");
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setIsSaving(false);
    }
  }

  function updateBlock(index: number, next: BlogContentBlock) {
    setFormState((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block, i) => (i === index ? next : block)),
    }));
  }

  function insertBlock(block: BlogContentBlock, index = formState.blocks.length) {
    setFormState((prev) => ({
      ...prev,
      blocks: [...prev.blocks.slice(0, index), block, ...prev.blocks.slice(index)],
    }));
  }

  function removeBlock(index: number) {
    setFormState((prev) => {
      const blocks = prev.blocks.filter((_, i) => i !== index);
      return { ...prev, blocks: blocks.length ? blocks : [paragraphBlock()] };
    });
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setFormState((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.blocks.length) return prev;
      const blocks = [...prev.blocks];
      const [block] = blocks.splice(index, 1);
      blocks.splice(nextIndex, 0, block);
      return { ...prev, blocks };
    });
  }

  function onDropBlock(event: DragEvent<HTMLDivElement>, targetIndex: number) {
    event.preventDefault();
    if (dragIndex === null || dragIndex === targetIndex) return;
    setFormState((prev) => {
      const blocks = [...prev.blocks];
      const [block] = blocks.splice(dragIndex, 1);
      blocks.splice(targetIndex, 0, block);
      return { ...prev, blocks };
    });
    setDragIndex(null);
  }

  async function uploadImage(file: File) {
    const body = new FormData();
    body.append("file", file);
    body.append("postSlug", formState.slug || `draft-${Date.now().toString(36)}`);
    const res = await fetch("/api/blog-media/image", {
      method: "POST",
      headers: { "x-csrf-token": csrfToken },
      body,
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as { asset: BlogMediaAsset };
    return data.asset;
  }

  async function addImageFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading("圖片上傳中...");
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const asset = await uploadImage(file);
        insertBlock({
          id: newId("image"),
          type: "image",
          props: { mediaId: asset.id, src: asset.publicUrl, alt: asset.alt ?? "", caption: asset.caption ?? "", layout: "normal" },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "圖片上傳失敗");
    } finally {
      setUploading(null);
    }
  }

  async function addGalleryFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading("圖集上傳中...");
    setError(null);
    try {
      const assets = await Promise.all(Array.from(files).map(uploadImage));
      insertBlock({
        id: newId("gallery"),
        type: "gallery",
        props: {
          layout: "carousel",
          items: assets.map((asset) => ({
            mediaId: asset.id,
            src: asset.publicUrl,
            alt: asset.alt ?? "",
            caption: asset.caption ?? "",
          })),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "圖集上傳失敗");
    } finally {
      setUploading(null);
    }
  }

  async function uploadVideo(file: File) {
    setUploading("影片上傳中...");
    setError(null);
    try {
      const initRes = await fetch("/api/blog-media/video/init", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          postSlug: formState.slug || `draft-${Date.now().toString(36)}`,
        }),
      });
      if (!initRes.ok) throw new Error(await initRes.text());
      const init = (await initRes.json()) as { assetId: string; key: string; uploadId: string; partSize: number };
      const parts: Array<{ partNumber: number; etag: string }> = [];
      let offset = 0;
      let partNumber = 1;
      while (offset < file.size) {
        setUploading(`影片上傳中... ${Math.round((offset / file.size) * 100)}%`);
        const chunk = file.slice(offset, Math.min(offset + init.partSize, file.size));
        const partRes = await fetch(
          `/api/blog-media/video/part?key=${encodeURIComponent(init.key)}&uploadId=${encodeURIComponent(
            init.uploadId,
          )}&partNumber=${partNumber}`,
          {
            method: "PUT",
            headers: { "x-csrf-token": csrfToken },
            body: chunk,
          },
        );
        if (!partRes.ok) throw new Error(await partRes.text());
        const data = (await partRes.json()) as { part: { partNumber: number; etag: string } };
        parts.push(data.part);
        offset += init.partSize;
        partNumber += 1;
      }
      const completeRes = await fetch("/api/blog-media/video/complete", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          assetId: init.assetId,
          key: init.key,
          uploadId: init.uploadId,
          parts,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });
      if (!completeRes.ok) throw new Error(await completeRes.text());
      const data = (await completeRes.json()) as { asset: BlogMediaAsset };
      insertBlock({
        id: newId("video"),
        type: "video",
        props: { mediaId: data.asset.id, src: data.asset.publicUrl, mimeType: data.asset.mimeType, caption: "" },
      });
      setUploading(null);
    } catch (err) {
      setUploading(null);
      setError(err instanceof Error ? err.message : "影片上傳失敗");
    }
  }

  function handleCategoryChange(value: string) {
    setFormState((prev) => {
      const category = categories.find((cat: BlogCategory) => cat.id === value);
      const subIsValid = category?.children.some((child) => child.id === prev.subcategoryId);
      return { ...prev, categoryId: value, subcategoryId: subIsValid ? prev.subcategoryId : "" };
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <header className="space-y-4">
        <div>
          <p className="eyebrow text-neutral-500">Blog 編輯介面</p>
          <h1 className="text-3xl font-bold text-neutral-900">區塊文章與雲端媒體</h1>
          <p className="text-sm text-neutral-600">文章內容以安全 block JSON 儲存，圖片與影片上傳到 R2。</p>
        </div>
        <AdminNav active="blog" />
      </header>

      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4 rounded-lg border border-neutral-200 bg-white/95 p-5 shadow-sm">
          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
            Slug
            <div className="flex gap-2">
              <input
                type="text"
                value={formState.slug}
                onChange={(e) => setFormState((prev) => ({ ...prev, slug: e.target.value }))}
                className="input"
                placeholder="post-slug"
                disabled={formState.isExisting}
              />
              <button type="button" className="btn-ghost" onClick={() => fetchPost(formState.slug)} disabled={!formState.slug || isFetching}>
                載入
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
            標題
            <input className="input" value={formState.title} onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))} />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
            摘要
            <textarea className="textarea" rows={3} value={formState.summary} onChange={(e) => setFormState((prev) => ({ ...prev, summary: e.target.value }))} />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
            標籤（逗號分隔）
            <input className="input" value={formState.tagsInput} onChange={(e) => setFormState((prev) => ({ ...prev, tagsInput: e.target.value }))} />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
            發佈時間
            <input
              type="datetime-local"
              className="input"
              value={formState.publishedAtInput}
              onChange={(e) => setFormState((prev) => ({ ...prev, publishedAtInput: e.target.value }))}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
              分類
              <select className="input" value={formState.categoryId} onChange={(e) => handleCategoryChange(e.target.value)}>
                <option value="">選擇分類</option>
                {categories.map((category: BlogCategory) => (
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
                disabled={!availableSubcategories.length}
                onChange={(e) => setFormState((prev) => ({ ...prev, subcategoryId: e.target.value }))}
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

          <div className="space-y-2 border-t border-neutral-200 pt-4">
            <button type="button" className="btn-primary w-full" onClick={handleSave} disabled={isSaving || isFetching || Boolean(uploading)}>
              {isSaving ? "儲存中..." : "儲存文章"}
            </button>
            <Link to={formState.slug ? `/blog/${formState.slug}` : "/blog"} className="btn-ghost block text-center">
              查看前台
            </Link>
            {uploading ? <p className="text-sm text-blue-600">{uploading}</p> : null}
            {message ? <p className="text-sm text-green-600">{message}</p> : null}
            {error ? <p className="whitespace-pre-wrap text-sm text-red-600">{error}</p> : null}
          </div>
        </aside>

        <main className="space-y-4">
          <div className="flex flex-wrap gap-2 rounded-lg border border-neutral-200 bg-white/95 p-3 shadow-sm">
            <button type="button" className="btn-ghost" onClick={() => insertBlock(paragraphBlock())}>
              段落
            </button>
            <button type="button" className="btn-ghost inline-flex items-center gap-2" onClick={() => insertBlock({ id: newId("heading"), type: "heading", props: { text: "小標題", level: 2 } })}>
              <Heading2 size={16} /> 標題
            </button>
            <label className="btn-ghost inline-flex cursor-pointer items-center gap-2">
              <ImagePlus size={16} /> 圖片
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void addImageFiles(e.target.files)} />
            </label>
            <label className="btn-ghost inline-flex cursor-pointer items-center gap-2">
              <ImagePlus size={16} /> 圖集
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void addGalleryFiles(e.target.files)} />
            </label>
            <label className="btn-ghost inline-flex cursor-pointer items-center gap-2">
              <Video size={16} /> 影片
              <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => e.target.files?.[0] && void uploadVideo(e.target.files[0])} />
            </label>
            <button type="button" className="btn-ghost inline-flex items-center gap-2" onClick={() => insertBlock({ id: newId("quote"), type: "quote", props: { text: "引用文字", cite: "" } })}>
              <Quote size={16} /> 引用
            </button>
            <button type="button" className="btn-ghost inline-flex items-center gap-2" onClick={() => insertBlock({ id: newId("divider"), type: "divider", props: {} })}>
              <Minus size={16} /> 分隔
            </button>
            <button
              type="button"
              className="btn-ghost inline-flex items-center gap-2"
              onClick={() =>
                insertBlock({
                  id: newId("columns"),
                  type: "columns",
                  props: { columns: [{ blocks: [paragraphBlock("左欄內容")] }, { blocks: [paragraphBlock("右欄內容")] }] },
                })
              }
            >
              <Columns2 size={16} /> 雙欄
            </button>
          </div>

          <div className="space-y-3">
            {formState.blocks.map((block, index) => (
              <BlockEditor
                key={block.id}
                block={block}
                index={index}
                total={formState.blocks.length}
                onChange={(next) => updateBlock(index, next)}
                onRemove={() => removeBlock(index)}
                onMove={moveBlock}
                onDragStart={() => setDragIndex(index)}
                onDrop={(event) => onDropBlock(event, index)}
              />
            ))}
          </div>

          {import.meta.env.DEV ? (
            <details className="rounded-lg border border-neutral-200 bg-white/95 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-neutral-700">DEV content_json</summary>
              <textarea
                className="textarea mt-3 min-h-64 font-mono text-xs"
                value={JSON.stringify(formState.blocks, null, 2)}
                onChange={(e) => {
                  try {
                    const blocks = JSON.parse(e.target.value) as BlogContentBlock[];
                    setFormState((prev) => ({ ...prev, blocks }));
                  } catch {
                    // keep the editable text area forgiving while typing invalid JSON
                  }
                }}
              />
            </details>
          ) : null}
        </main>
      </section>
    </div>
  );
}

function BlockEditor({
  block,
  index,
  total,
  onChange,
  onRemove,
  onMove,
  onDragStart,
  onDrop,
}: {
  block: BlogContentBlock;
  index: number;
  total: number;
  onChange: (block: BlogContentBlock) => void;
  onRemove: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onDragStart: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className="rounded-lg border border-neutral-200 bg-white/95 p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {index + 1}. {blockLabel(block)}
        </span>
        <div className="flex gap-1">
          <button type="button" className="btn-ghost px-2 py-1" onClick={() => onMove(index, -1)} disabled={index === 0} title="上移">
            <ArrowUp size={15} />
          </button>
          <button type="button" className="btn-ghost px-2 py-1" onClick={() => onMove(index, 1)} disabled={index === total - 1} title="下移">
            <ArrowDown size={15} />
          </button>
          <button type="button" className="btn-ghost px-2 py-1 text-red-600" onClick={onRemove} title="刪除">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {renderBlockControl(block, onChange)}
    </article>
  );
}

function renderBlockControl(block: BlogContentBlock, onChange: (block: BlogContentBlock) => void) {
  if (block.type === "paragraph") {
    return (
      <textarea
        className="textarea min-h-28"
        value={block.props.text}
        onChange={(e) => onChange({ ...block, props: { text: e.target.value } })}
      />
    );
  }
  if (block.type === "heading") {
    return (
      <div className="grid gap-3 md:grid-cols-[140px_1fr]">
        <select
          className="input"
          value={block.props.level}
          onChange={(e) => onChange({ ...block, props: { ...block.props, level: Number(e.target.value) === 3 ? 3 : 2 } })}
        >
          <option value={2}>H2</option>
          <option value={3}>H3</option>
        </select>
        <input className="input" value={block.props.text} onChange={(e) => onChange({ ...block, props: { ...block.props, text: e.target.value } })} />
      </div>
    );
  }
  if (block.type === "image") {
    return (
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <img src={block.props.src} alt={block.props.alt ?? ""} className="aspect-[4/3] w-full rounded-lg border border-neutral-200 object-cover" />
        <div className="space-y-3">
          <select className="input" value={block.props.layout ?? "normal"} onChange={(e) => onChange({ ...block, props: { ...block.props, layout: e.target.value as any } })}>
            <option value="normal">一般寬度</option>
            <option value="wide">寬版</option>
            <option value="full">滿版</option>
            <option value="float-left">左浮動</option>
            <option value="float-right">右浮動</option>
          </select>
          <input className="input" placeholder="Alt" value={block.props.alt ?? ""} onChange={(e) => onChange({ ...block, props: { ...block.props, alt: e.target.value } })} />
          <input className="input" placeholder="Caption" value={block.props.caption ?? ""} onChange={(e) => onChange({ ...block, props: { ...block.props, caption: e.target.value } })} />
        </div>
      </div>
    );
  }
  if (block.type === "video") {
    return (
      <div className="space-y-3">
        <video src={block.props.src} controls preload="metadata" className="max-h-80 w-full rounded-lg border border-neutral-200 bg-black" />
        <input className="input" placeholder="Caption" value={block.props.caption ?? ""} onChange={(e) => onChange({ ...block, props: { ...block.props, caption: e.target.value } })} />
      </div>
    );
  }
  if (block.type === "gallery") {
    return (
      <div className="space-y-3">
        <select className="input max-w-xs" value={block.props.layout ?? "carousel"} onChange={(e) => onChange({ ...block, props: { ...block.props, layout: e.target.value as any } })}>
          <option value="carousel">滑動圖集</option>
          <option value="grid">格狀圖集</option>
        </select>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {block.props.items.map((item, itemIndex) => (
            <div key={`${item.src}-${itemIndex}`} className="rounded-lg border border-neutral-200 p-2">
              <img src={item.src} alt={item.alt ?? ""} className="aspect-[4/3] w-full rounded object-cover" />
              <input
                className="input mt-2"
                placeholder="Caption"
                value={item.caption ?? ""}
                onChange={(e) => {
                  const items = block.props.items.map((next, i) => (i === itemIndex ? { ...next, caption: e.target.value } : next));
                  onChange({ ...block, props: { ...block.props, items } });
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (block.type === "quote") {
    return (
      <div className="space-y-3">
        <textarea className="textarea min-h-24" value={block.props.text} onChange={(e) => onChange({ ...block, props: { ...block.props, text: e.target.value } })} />
        <input className="input" placeholder="引用來源" value={block.props.cite ?? ""} onChange={(e) => onChange({ ...block, props: { ...block.props, cite: e.target.value } })} />
      </div>
    );
  }
  if (block.type === "columns") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {block.props.columns.map((column, columnIndex) => {
          const first = column.blocks[0] && column.blocks[0].type === "paragraph" ? column.blocks[0].props.text : "";
          return (
            <textarea
              key={columnIndex}
              className="textarea min-h-32"
              value={first}
              onChange={(e) => {
                const columns = block.props.columns.map((next, i) =>
                  i === columnIndex ? { blocks: [{ id: newId("paragraph"), type: "paragraph", props: { text: e.target.value } }] as BlogContentBlock[] } : next,
                );
                onChange({ ...block, props: { columns } });
              }}
            />
          );
        })}
      </div>
    );
  }
  return <hr className="border-neutral-300" />;
}
