import { useMemo, useState } from "react";
import { Form, Link, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { requireAdmin } from "../../features/admin/admin-auth.server";
import { requireBlogDb } from "../../lib/d1.server";
import { getAllBlogPosts } from "../../features/blog/blog.d1.server";
import type { BlogCategory, BlogPost } from "../../features/blog/blog.types";
import { loadBlogCategories } from "../../features/blog/blog.server";

type LoaderData = {
  posts: BlogPost[];
  categories: BlogCategory[];
  tags: string[];
};

type FormState = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  publishedAt: string;
  tagsInput: string;
  categoryId: string;
  subcategoryId: string;
};

function deriveSummary(body: string) {
  const firstParagraph =
    body
      ?.split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)[0] ?? "";
  if (!firstParagraph) return "";
  return firstParagraph.length > 200 ? `${firstParagraph.slice(0, 197)}…` : firstParagraph;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  requireAdmin(request, context);
  const db = requireBlogDb(context);
  const posts = await getAllBlogPosts(db);
  const categories = await loadBlogCategories();
  const tagSet = new Set<string>();
  for (const post of posts) {
    if (Array.isArray(post.tags)) {
      for (const tag of post.tags) {
        const value = (tag ?? "").toString().trim();
        if (value) tagSet.add(value);
      }
    }
  }
  const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b, "zh-Hant"));
  return { posts, categories, tags };
}

export async function action({ request, context }: ActionFunctionArgs) {
  requireAdmin(request, context);
  const formData = await request.formData();
  const intent = (formData.get("intent") ?? "").toString();
  const db = requireBlogDb(context);

  if (intent === "delete") {
    const slug = (formData.get("slug") ?? "").toString().trim();
    if (!slug) return { error: "slug 必填" };
    await db.prepare("DELETE FROM blog_posts WHERE slug = ?").bind(slug).run();
    const url = new URL("/admin", request.url);
    return new Response(null, {
      status: 302,
      headers: { Location: url.toString() },
    });
  }

  if (intent === "upsert") {
    const slug = (formData.get("slug") ?? "").toString().trim();
    const title = (formData.get("title") ?? "").toString().trim();
    const body = (formData.get("body") ?? "").toString();
    const publishedAt = (formData.get("publishedAt") ?? "").toString().trim();
    const summaryInput = (formData.get("summary") ?? "").toString().trim();
    const tagsInput = (formData.get("tags") ?? "").toString().trim();
    const selectedTags = formData
      .getAll("tag")
      .map((t) => t.toString().trim())
      .filter(Boolean);
    const categoryId = (formData.get("categoryId") ?? "").toString().trim() || null;
    const subcategoryId = (formData.get("subcategoryId") ?? "").toString().trim() || null;

    if (!slug || !title || !body) {
      return { error: "slug、title、body 必填" };
    }
    const now = new Date().toISOString();
    const summary = summaryInput || deriveSummary(body);
    const tagSet = new Set<string>();
    for (const tag of selectedTags) {
      tagSet.add(tag);
    }
    if (tagsInput) {
      for (const raw of tagsInput.split(",")) {
        const value = raw.trim();
        if (value) tagSet.add(value);
      }
    }
    const tags = Array.from(tagSet);
    const pub = publishedAt || now;

    await db
      .prepare(
        `INSERT INTO blog_posts (slug, title, summary, body, tags, category_id, subcategory_id, published_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET
           title = excluded.title,
           summary = excluded.summary,
           body = excluded.body,
           tags = excluded.tags,
           category_id = excluded.category_id,
           subcategory_id = excluded.subcategory_id,
           published_at = excluded.published_at,
           updated_at = excluded.updated_at`,
      )
      .bind(
        slug,
        title,
        summary,
        body,
        JSON.stringify(tags),
        categoryId,
        subcategoryId,
        pub,
        now,
        now,
      )
      .run();

    const url = new URL("/admin", request.url);
    return new Response(null, {
      status: 302,
      headers: { Location: url.toString() },
    });
  }

  return { error: "未知 intent" };
}

function formatDate(date: string) {
  try {
    return new Intl.DateTimeFormat("zh-Hant", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(date),
    );
  } catch {
    return date;
  }
}

export default function AdminPage() {
  const { posts, categories, tags } = useLoaderData<typeof loader>() as LoaderData;
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  const [formState, setFormState] = useState<FormState>(() => ({
    slug: "",
    title: "",
    summary: "",
    body: "",
    publishedAt: "",
    tagsInput: "",
    categoryId: "",
    subcategoryId: "",
  }));

  function handleFormChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setFormState({
      slug: "",
      title: "",
      summary: "",
      body: "",
      publishedAt: "",
      tagsInput: "",
      categoryId: "",
      subcategoryId: "",
    });
  }

  function handleLoadPost(post: BlogPost) {
    setFormState({
      slug: post.slug ?? "",
      title: post.title ?? "",
      summary: post.summary ?? "",
      body: post.body ?? "",
      publishedAt: post.publishedAt ?? "",
      tagsInput: Array.isArray(post.tags) ? post.tags.join(", ") : "",
      categoryId: (post.categoryId ?? "") || "",
      subcategoryId: (post.subcategoryId ?? "") || "",
    });
  }

  const availableSubcategories = useMemo(() => {
    const category = categories.find((cat) => cat.id === formState.categoryId);
    return category?.children ?? [];
  }, [categories, formState.categoryId]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-neutral-500">Admin</p>
          <h1 className="text-3xl font-bold text-neutral-900">Blog 管理</h1>
          <p className="text-sm text-neutral-600">新增 / 更新 / 刪除部落格文章，直接寫入 D1。</p>
        </div>
        <Link to="/jock_space" className="btn-ghost">
          返回前台
        </Link>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card bg-white/95 space-y-4">
          <div>
            <p className="font-semibold text-neutral-900">新增或更新</p>
            <p className="text-xs text-neutral-500">同 slug 會覆蓋內容，空白欄位會沿用保存的值。</p>
          </div>
          <Form method="post" className="space-y-3">
            <input type="hidden" name="intent" value="upsert" />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                name="slug"
                placeholder="slug (唯一)"
                required
                className="input"
                value={formState.slug}
                onChange={(e) => handleFormChange("slug", e.target.value)}
              />
              <input
                name="title"
                placeholder="標題"
                required
                className="input"
                value={formState.title}
                onChange={(e) => handleFormChange("title", e.target.value)}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                name="publishedAt"
                placeholder="發布時間 ISO，可留空"
                className="input"
                value={formState.publishedAt}
                onChange={(e) => handleFormChange("publishedAt", e.target.value)}
              />
              <input
                name="summary"
                placeholder="摘要，可留空自動取第一段"
                className="input"
                value={formState.summary}
                onChange={(e) => handleFormChange("summary", e.target.value)}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                name="categoryId"
                className="input"
                value={formState.categoryId}
                onChange={(e) => {
                  handleFormChange("categoryId", e.target.value);
                  handleFormChange("subcategoryId", "");
                }}
              >
                <option value="">未分類</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.title}
                  </option>
                ))}
              </select>
              <select
                name="subcategoryId"
                className="input"
                value={formState.subcategoryId}
                onChange={(e) => handleFormChange("subcategoryId", e.target.value)}
                disabled={!availableSubcategories.length}
              >
                <option value="">未分類</option>
                {availableSubcategories.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <input
                name="tags"
                placeholder="自訂標籤，以逗號分隔，可留空"
                className="input"
                value={formState.tagsInput}
                onChange={(e) => handleFormChange("tagsInput", e.target.value)}
              />
              {tags.length ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-neutral-700">從現有標籤選擇：</p>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <label
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-700"
                      >
                        <input type="checkbox" name="tag" value={tag} className="h-3 w-3" />
                        <span>{tag}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <textarea
              name="body"
              placeholder="文章內容（支援純文字換行）"
              rows={10}
              required
              className="input"
              value={formState.body}
              onChange={(e) => handleFormChange("body", e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "送出中..." : "儲存 / 更新"}
              </button>
              <button type="button" className="btn-ghost text-sm" onClick={resetForm}>
                清空表單（新增新文章）
              </button>
            </div>
          </Form>
        </div>

        <div className="card bg-white/95 space-y-4">
          <div>
            <p className="font-semibold text-neutral-900">現有文章</p>
            <p className="text-xs text-neutral-500">點擊載入可帶入表單，刪除會立即移除。</p>
          </div>
          <div className="space-y-3 max-h-[600px] overflow-auto">
            {posts.length === 0 ? (
              <p className="text-sm text-neutral-600">目前沒有文章。</p>
            ) : (
              posts.map((post) => (
                <div
                  key={post.slug + post.publishedAt}
                  className="flex items-start justify-between gap-3 rounded-xl border border-neutral-200/80 bg-white/80 px-4 py-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-neutral-900">{post.title}</p>
                    <p className="text-xs text-neutral-500">{post.slug}</p>
                    <p className="text-xs text-neutral-500">{formatDate(post.updatedAt ?? post.createdAt)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => handleLoadPost(post)}
                    >
                      載入到表單
                    </button>
                    <Form
                      method="post"
                      onSubmit={(e) => {
                        if (!window.confirm(`確定刪除「${post.title}」?`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="slug" value={post.slug} />
                      <button type="submit" className="text-xs text-red-600 hover:underline">
                        刪除
                      </button>
                    </Form>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
