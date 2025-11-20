import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

type Context = LoaderFunctionArgs["context"] | ActionFunctionArgs["context"];

export function requireBlogDb(context: Context) {
  const ctx = context as any;
  const db =
    ctx?.cloudflare?.env?.BLOG_DB ??
    ctx?.cloudflare?.env?.blog_db ??
    ctx?.env?.BLOG_DB ??
    ctx?.env?.blog_db ??
    ctx?.BLOG_DB ??
    ctx?.blog_db;
  if (!db) {
    throw new Response("BLOG_DB binding is missing", { status: 500 });
  }
  return db as D1Database;
}
