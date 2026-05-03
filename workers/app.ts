import { createRequestHandler } from "react-router";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

export default {
  async fetch(request, env, ctx) {
    const response = await requestHandler(request, {
      cloudflare: { env, ctx },
    });
    const headers = new Headers(response.headers);
    const mediaBase = env.BLOG_IMAGES_PUBLIC_BASE_URL ? new URL(env.BLOG_IMAGES_PUBLIC_BASE_URL).origin : "";
    const mediaSrc = mediaBase ? ` ${mediaBase}` : "";
    const requestHostname = new URL(request.url).hostname;
    const toolbeltSrc = isLocalHostname(requestHostname) ? " http://127.0.0.1:43210 http://localhost:43210" : "";
    headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        `img-src 'self' data:${mediaSrc}`,
        `media-src 'self' blob:${mediaSrc}`,
        "font-src 'self' data:",
        `connect-src 'self'${toolbeltSrc}`,
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    );
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("X-Frame-Options", "DENY");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;
