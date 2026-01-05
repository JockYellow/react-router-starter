import type { BlogCategory, BlogPost } from "./blog.types";

const ACCENT_PALETTE = ["#B9923E", "#6B5CA0", "#2563EB", "#0EA5E9", "#10B981", "#F97316", "#F43F5E"];

export function deriveAccentColor(post: Pick<BlogPost, "categoryId" | "subcategoryId" | "tags" | "slug">, categories?: BlogCategory[]) {
  if (categories?.length && post.categoryId) {
    const categoryIndex = categories.findIndex((cat) => cat.id === post.categoryId);
    if (categoryIndex >= 0) {
      return ACCENT_PALETTE[categoryIndex % ACCENT_PALETTE.length];
    }
  }
  const source =
    post.subcategoryId ||
    post.categoryId ||
    (Array.isArray(post.tags) && post.tags.length ? post.tags[0] : "") ||
    post.slug ||
    "post";
  const hash = Array.from(source).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length];
}
