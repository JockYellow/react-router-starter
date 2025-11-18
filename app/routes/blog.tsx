import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import {
  loadBlogCategories,
  loadBlogPosts,
  type BlogCategory,
  type BlogPost,
} from "../lib/blog.server";

function formatDate(date: string) {
  try {
    return new Intl.DateTimeFormat("zh-Hant", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(date));
  } catch {
    return date;
  }
}

function paragraphize(body: string) {
  return body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildLink(categoryId?: string | null, subcategoryId?: string | null) {
  const params = new URLSearchParams();
  if (categoryId) params.set("category", categoryId);
  if (subcategoryId) params.set("subcategory", subcategoryId);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const categoryId = url.searchParams.get("category");
  const subcategoryId = url.searchParams.get("subcategory");

  const [categories, posts] = await Promise.all([loadBlogCategories(), loadBlogPosts()]);

  const selectedCategory = categories.find((cat) => cat.id === categoryId) ?? null;
  const selectedSubcategory = selectedCategory?.children.find((child) => child.id === subcategoryId) ?? null;

  const filteredPosts = posts.filter((post) => {
    if (selectedCategory && post.categoryId !== selectedCategory.id) return false;
    if (selectedSubcategory && post.subcategoryId !== selectedSubcategory.id) return false;
    return true;
  });

  return {
    categories,
    posts: filteredPosts,
    selectedCategoryId: selectedCategory?.id ?? null,
    selectedSubcategoryId: selectedSubcategory?.id ?? null,
  } satisfies {
    categories: BlogCategory[];
    posts: BlogPost[];
    selectedCategoryId: string | null;
    selectedSubcategoryId: string | null;
  };
}

export default function BlogPage() {
  const { categories, posts, selectedCategoryId, selectedSubcategoryId } = useLoaderData() as Awaited<
    ReturnType<typeof loader>
  >;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 space-y-12">
      <header className="space-y-4 text-center">
        <p className="eyebrow text-neutral-500">Blog</p>
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900">兩層分類的純文字筆記</h1>
        <p className="text-neutral-600 max-w-2xl mx-auto">
          從後台新增文章，這裡會根據分類即時顯示。先用文字與段落記錄想法，未來再補圖表與語法上色。
        </p>
      </header>

      <section className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4">
          <div className="card bg-white/90 p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-neutral-800">分類</p>
              <p className="text-xs text-neutral-500">兩層架構，便於將文章歸檔。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to={buildLink()}
                className={`chip ${!selectedCategoryId ? "bg-neutral-900 text-white" : ""}`.trim()}
              >
                全部文章
              </Link>
            </div>
            <div className="space-y-4">
              {categories.map((category) => (
                <div key={category.id} className="space-y-2">
                  <Link
                    to={buildLink(category.id)}
                    className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-sm transition ${
                      selectedCategoryId === category.id
                        ? "bg-neutral-900 text-white border-neutral-900"
                        : "bg-white text-neutral-700 border-neutral-200"
                    }`}
                  >
                    <span>{category.title}</span>
                    <span className="text-xs text-neutral-500">{category.children.length} 子分類</span>
                  </Link>
                  {selectedCategoryId === category.id && category.children.length ? (
                    <div className="flex flex-wrap gap-2">
                      {category.children.map((child) => (
                        <Link
                          key={child.id}
                          to={buildLink(category.id, child.id)}
                          className={`chip ${
                            selectedSubcategoryId === child.id ? "bg-neutral-900 text-white" : ""
                          }`.trim()}
                        >
                          {child.title}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          {posts.length ? (
            posts.map((post) => (
              <article key={(post.filename ?? post.slug ?? post.title) + post.publishedAt} className="card bg-white/95">
                <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">
                  {formatDate(post.publishedAt)}
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-neutral-900">{post.title}</h2>
                <div className="mt-2 text-xs text-neutral-500">
                  {(() => {
                    const category = categories.find((c) => c.id === post.categoryId);
                    const sub = category?.children.find((child) => child.id === post.subcategoryId);
                    if (category && sub) return `${category.title} / ${sub.title}`;
                    if (category) return category.title;
                    return "未分類";
                  })()}
                </div>
                <div className="mt-4 space-y-3 text-neutral-800 leading-relaxed">
                  {paragraphize(post.body).map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <p className="text-sm text-neutral-600">目前沒有符合條件的文章。</p>
          )}
        </div>
      </section>
    </div>
  );
}
