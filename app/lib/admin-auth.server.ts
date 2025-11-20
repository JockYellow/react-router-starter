import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

type Context = LoaderFunctionArgs["context"] | ActionFunctionArgs["context"];

const COOKIE_NAME = "admin_session";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function parseCookies(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  return Object.fromEntries(
    header
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const [k, ...rest] = c.split("=");
        return [k, rest.join("=")];
      }),
  );
}

export function getAdminPassword(context: Context): string | null {
  const ctx = context as any;
  return (
    ctx?.cloudflare?.env?.ADMIN_PASS ??
    ctx?.env?.ADMIN_PASS ??
    ctx?.ADMIN_PASS ??
    process.env.ADMIN_PASS ??
    "letmein"
  );
}

export function isAdmin(request: Request) {
  const cookies = parseCookies(request);
  return cookies[COOKIE_NAME] === "1";
}

export function requireAdmin(request: Request, context: Context) {
  if (isAdmin(request)) return;
  const url = new URL("/admin/login", request.url);
  throw new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
    },
  });
}

export function createAdminSessionCookie() {
  return [
    `${COOKIE_NAME}=1`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${COOKIE_MAX_AGE}`,
  ].join("; ");
}

export function clearAdminSessionCookie() {
  return [`${COOKIE_NAME}=; Path=/`, "HttpOnly", "SameSite=Lax", "Max-Age=0"].join("; ");
}
