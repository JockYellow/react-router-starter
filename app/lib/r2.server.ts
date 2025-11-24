import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

type Context = LoaderFunctionArgs["context"] | ActionFunctionArgs["context"];

function resolveEnv(context: Context) {
  const ctx = context as any;
  return (
    ctx?.cloudflare?.env ??
    ctx?.env ??
    ctx ??
    {}
  ) as Record<string, unknown>;
}

export function requireBlogImagesBucket(context: Context) {
  const env = resolveEnv(context);
  const bucket = (env.BLOG_IMAGES ?? (env as any).blog_images) as R2Bucket | undefined;
  if (!bucket) {
    throw new Response("BLOG_IMAGES binding is missing", { status: 500 });
  }
  return bucket;
}

export function requireBlogImagesPublicBase(context: Context) {
  const env = resolveEnv(context);
  const base =
    (env as any).BLOG_IMAGES_PUBLIC_BASE_URL ??
    (env as any).blog_images_public_base_url ??
    (env as any).BLOG_IMAGES_PUBLIC_BASE ??
    (env as any).blog_images_public_base;
  if (!base || typeof base !== "string") {
    throw new Response("BLOG_IMAGES_PUBLIC_BASE_URL is missing", { status: 500 });
  }
  return base.endsWith("/") ? base : `${base}/`;
}

export function buildPublicImageUrl(base: string, key: string) {
  try {
    return new URL(key, base).toString();
  } catch {
    return `${base}${key}`;
  }
}
