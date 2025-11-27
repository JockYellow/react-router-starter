import { type CSSProperties, useMemo } from "react";
import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { loadBlogCategories, loadBlogPosts } from "../lib/blog.server";
import type { BlogPost, BlogCategory } from "../lib/blog.types";
import { requireBlogDb } from "../lib/d1.server";
import { getBlogPostBySlug } from "../lib/blog.d1.server";
import { deriveAccentColor } from "../lib/blog-accent";

type LoaderData = {
  post: BlogPost;
  categories: BlogCategory[];
  accent: string;
};

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

export async function loader({ params, context }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) {
    throw Response.json({ error: "slug is required" }, { status: 400 });
  }
  let post: BlogPost | null = null;
  try {
    const db = requireBlogDb(context);
    post = await getBlogPostBySlug(db, slug);
  } catch (err) {
    console.error("Failed to load post from D1, trying static files", err);
  }
  const categories = await loadBlogCategories();
  if (!post) {
    const filePosts = await loadBlogPosts().catch<BlogPost[]>((err) => {
      console.error("Failed to load file-based blog posts", err);
      return [];
    });
    post = filePosts.find((item) => item.slug === slug) ?? null;
  }
  if (!post) {
    throw Response.json({ error: "Post not found" }, { status: 404 });
  }
  const accent = deriveAccentColor(post, categories);
  return Response.json({ post, categories, accent });
}

export default function BlogPostPage() {
  const { post, categories, accent } = useLoaderData() as LoaderData;
  const categoryLabel = formatCategory(post, categories);
  const accentStyle = useMemo(() => ({ "--post-accent": accent } as CSSProperties), [accent]);
  const paragraphs = useMemo(() => paragraphize(post.body), [post.body]);

  return (
    <div className="min-h-screen pb-12" style={accentStyle}>
      <section className="relative isolate h-72 w-full overflow-hidden bg-[color:var(--post-accent)]/10">
        {post.imageUrl ? (
          <img src={post.imageUrl} alt={post.title} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--post-accent)]/35 via-white to-[color:var(--post-accent)]/15" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/15 to-white" />
        <div className="relative mx-auto flex h-full max-w-5xl items-end px-4 pb-8 text-white">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.22em]">
              <span className="rounded-full bg-white/20 px-3 py-1 font-semibold text-white/90">{categoryLabel}</span>
              <span className="rounded-full bg-white/18 px-3 py-1 font-semibold text-white/80">
                {formatDate(post.publishedAt)}
              </span>
            </div>
            <h1 className="text-3xl font-bold leading-tight drop-shadow-sm md:text-4xl">{post.title}</h1>
            {post.tags?.length ? (
              <div className="flex flex-wrap gap-2">
                {post.tags.slice(0, 6).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <main className="mx-auto mt-8 flex max-w-4xl flex-col gap-6 px-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
          <Link to="/blog" className="text-sm font-medium text-[color:var(--post-accent)] hover:underline">
            ← 返回列表
          </Link>
          <span className="rounded-full border border-[color:var(--post-accent)]/40 bg-[color:var(--post-accent)]/10 px-3 py-1 text-xs font-semibold text-neutral-700">
            {categoryLabel}
          </span>
          <span className="rounded-full border border-[color:var(--post-accent)]/30 bg-white px-3 py-1 text-xs text-neutral-600">
            {formatDate(post.publishedAt)}
          </span>
        </div>

        <article className="rounded-2xl border border-[color:var(--post-accent)]/20 bg-white/95 p-6 shadow-sm">
          <div className="mb-4 h-1 w-16 rounded-full bg-[color:var(--post-accent)]/70" />
          <div className="space-y-6 text-neutral-800">
            {paragraphs.map((paragraph, index) => (
              <p key={index} className="leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        </article>
      </main>
    </div>
  );
}
