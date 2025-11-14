// app/root.tsx
import {
  Link,
  Links,
  Outlet,
  Scripts,
  useLocation,
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

  const tabs = [
    { id: "blog", label: "Blog" },
    { id: "guestbook", label: "Guestbook" },
    { id: "changelog", label: "Changelog" },
    { id: "lab", label: "Lab" },
  ];

  const [active, setActive] = useState("blog");
  useEffect(() => {
    const sections = tabs.map(t => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.25, 0.5, 0.75] }
    );
    sections.forEach(s => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-transform duration-300 will-change-transform
      ${hidden ? "-translate-y-full" : "translate-y-0"}`}
    >
      <div className="backdrop-blur-md bg-[--color-warm-25]/80 border-b border-[--color-warm-100]">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-wide">個人網站</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            {tabs.map(t => (
              <a
                key={t.id}
                href={`/#${t.id}`}
                className={`py-1 border-b-2 -mb-[2px] transition-colors ${
                  active === t.id
                    ? "border-[--color-accent-400] text-neutral-900"
                    : "border-transparent text-neutral-600 hover:text-neutral-800 hover:border-[--color-accent-200]"
                }`}
              >
                {t.label}
              </a>
            ))}
          </nav>
          <Link to="/changelog" className="text-sm link-soft hidden md:inline">更新日誌</Link>
          <a href="#blog" className="md:hidden text-sm text-neutral-600">目錄</a>
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

export default App;
