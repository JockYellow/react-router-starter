import { type CSSProperties } from "react";
import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { loadBlogCategories, loadBlogPosts } from "../../features/blog/blog.server";
import type { BlogCategory, BlogPost } from "../../features/blog/blog.types";
import { getAllBlogPosts } from "../../features/blog/blog.d1.server";
import { requireBlogDb } from "../../lib/d1.server";
import { deriveAccentColor } from "../../features/blog/blog-accent";

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

function formatCategory(post: BlogPost, categories: BlogCategory[]) {
  const category = categories.find((c) => c.id === post.categoryId);
  const sub = category?.children.find((child) => child.id === post.subcategoryId);
  if (category && sub) return `${category.title} / ${sub.title}`;
  if (category) return category.title;
  return "未分類";
}

function buildExcerpt(post: BlogPost) {
  const paragraph = post.summary || paragraphize(post.body)[0] || "";
  if (!paragraph) return "";
  return paragraph.length > 160 ? `${paragraph.slice(0, 157)}…` : paragraph;
}

function buildLink(categoryId?: string | null, subcategoryId?: string | null) {
  const params = new URLSearchParams();
  if (categoryId) params.set("category", categoryId);
  if (subcategoryId) params.set("subcategory", subcategoryId);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const categoryId = url.searchParams.get("category");
  const subcategoryId = url.searchParams.get("subcategory");

  const categories = await loadBlogCategories();
  const filePosts = await loadBlogPosts().catch<BlogPost[]>((err) => {
    console.error("Failed to load file-based blog posts", err);
    return [];
  });

  let postsFromDb: BlogPost[] = [];
  try {
    const db = requireBlogDb(context);
    postsFromDb = await getAllBlogPosts(db);
  } catch (err) {
    console.error("Failed to load blog posts from D1, falling back to static files", err);
  }

  const mergedMap = new Map<string, BlogPost>();
  for (const post of filePosts) {
    mergedMap.set(post.slug, post);
  }
  for (const post of postsFromDb) {
    mergedMap.set(post.slug, post);
  }
  const posts = Array.from(mergedMap.values()).sort((a, b) =>
    a.publishedAt < b.publishedAt ? 1 : -1,
  );

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

        {posts.length ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => {
              const accent = deriveAccentColor(post, categories);
              const excerpt = buildExcerpt(post);
              const categoryLabel = formatCategory(post, categories);
              return (
                <Link
                  key={(post.filename ?? post.slug ?? post.title) + post.publishedAt}
                  to={`/blog/${post.slug}`}
                  className="group h-full"
                  style={{ "--post-accent": accent } as CSSProperties}
                >
                  <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-[color:rgba(0,0,0,0.08)] bg-white/95 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                    <div className="relative h-48 w-full overflow-hidden">
                      {post.imageUrl ? (
                        <img
                          src={post.imageUrl}
                          alt={post.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[color:var(--post-accent)]/15 text-xs font-medium text-neutral-600">
                          封面待補
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/95 via-white/40 to-transparent" />
                    </div>

                    <div className="flex flex-1 flex-col gap-3 p-6">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-neutral-500">
                        <span>{formatDate(post.publishedAt)}</span>
                        <span className="rounded-full bg-[color:var(--post-accent)]/15 px-3 py-1 text-[10px] font-semibold text-[color:var(--post-accent)]">
                          {categoryLabel}
                        </span>
                      </div>
                      <h2 className="text-xl font-semibold text-neutral-900 transition group-hover:text-neutral-700">
                        {post.title}
                      </h2>
                      {excerpt ? (
                        <p
                          className="text-sm leading-relaxed text-neutral-700"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {excerpt}
                        </p>
                      ) : null}
                      {post.tags?.length ? (
                        <div className="mt-auto flex flex-wrap gap-2 pt-2">
                          {post.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="chip border-[color:var(--post-accent)]/60 bg-[color:var(--post-accent)]/10 text-[color:var(--post-accent)]"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="h-1 bg-[color:var(--post-accent)]/60" />
                  </article>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-neutral-600">目前沒有符合條件的文章。</p>
        )}
      </section>
    </div>
  );
}
