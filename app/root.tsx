// app/root.tsx
import {
  Link,
  Links,
  Outlet,
  Scripts,
  isRouteErrorResponse,
  useLocation,
  useRouteError,
} from "react-router";
import { useEffect, useRef, useState } from "react";
import "./app.css";

import DevMenu from "./components/DevMenu";



/** 自動隱藏 Header，向下捲動隱藏、向上顯示 */
function AutoHideHeader() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY || 0;
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const goingDown = y > lastY.current;
          const delta = Math.abs(y - lastY.current);
          if (y < 24 || !goingDown || delta > 10) {
            setHidden(false);
          } else if (goingDown && y > 96) {
            setHidden(true);
          }
          lastY.current = y;
          ticking.current = false;
        });
        ticking.current = true;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-transform duration-300 will-change-transform
      ${hidden ? "-translate-y-full" : "translate-y-0"}`}
    >
      <div className="backdrop-blur-md bg-[--color-warm-25]/80 border-b border-[--color-warm-100]">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link to="/jock_space" className="font-semibold tracking-wide">個人網站</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/blog" className="link-soft hidden md:inline">文章列表</Link>
            <Link to="/changelog" className="link-soft">更新日誌</Link>
          </div>
        </div>
      </div>
    </header>
  );
}

/** 頁面框架 */
function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  const isStandalone =
    pathname === "/" ||
    pathname === "/resume" ||
    pathname.startsWith("/resume/") ||
    pathname === "/gift" ||
    pathname.startsWith("/gift/") ||
    pathname === "/spotify" ||
    pathname.startsWith("/spotify/") ||
    pathname === "/call_spotify";

  if (isStandalone) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-[--color-warm-50] text-neutral-900">
      <AutoHideHeader />
      <main className="pt-16">
        <Outlet />
      </main>
      <DevMenu />
      <footer className="mt-16 border-t">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-neutral-600">
          © {new Date().getFullYear()} 個人網站
        </div>
      </footer>
    </div>
  );
}

/** HTML 骨架 */
export function Layout() {
  return (
    <html lang="zh-Hant">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>個人網站</title>
        <Links />
      </head>
      <body>
        <App />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const showDetails = Boolean(import.meta.env?.DEV);

  let title = "發生錯誤";
  let message = "請稍後再試一次。";
  let details: string | undefined;

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    if (typeof error.data === "string" && error.data.trim()) {
      message = error.data;
    } else if (error.data && typeof error.data === "object" && "message" in (error.data as any)) {
      const dataMessage = (error.data as any).message;
      if (typeof dataMessage === "string" && dataMessage.trim()) message = dataMessage;
    }
  } else if (error instanceof Error) {
    message = error.message || message;
    details = error.stack;
  } else if (typeof error === "string") {
    message = error;
  }

  return (
    <div className="min-h-screen bg-[--color-warm-50] text-neutral-900">
      <div className="mx-auto max-w-3xl px-4 py-16 space-y-4">
        <p className="eyebrow text-neutral-500">Error</p>
        <h1 className="text-3xl font-bold text-neutral-900">{title}</h1>
        <p className="text-neutral-700">{message}</p>
        <div className="flex items-center gap-3">
          <Link to="/jock_space" className="btn-ghost">
            回首頁
          </Link>
          <Link to="/admin/login" className="btn-ghost">
            前往登入
          </Link>
        </div>
        {showDetails && details ? (
          <pre className="mt-6 whitespace-pre-wrap rounded-xl border border-neutral-200 bg-white/80 p-4 text-xs text-neutral-700">
            {details}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

export default App;
