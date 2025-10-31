// app/root.tsx
import { 
  Link, 
  Links, // <--- 1. 匯入 Links
  Outlet, 
  Scripts, // <--- 2. 匯入 Scripts
  useLocation 
} from "react-router";
import { useEffect, useRef, useState } from "react";
import "./app.css"; 

// 你原本的 AutoHideHeader 元件 (保持不變)
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
    { id: "about", label: "關於我" },
    { id: "skills", label: "技能" },
    { id: "projects", label: "作品" },
    { id: "contact", label: "聯絡" },
  ];

  const [active, setActive] = useState("about");
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
      <div className="backdrop-blur bg-white/75 border-b">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-wide">個人網站</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            {tabs.map(t => (
              <a
                key={t.id}
                href={`/#${t.id}`}
                className={`py-1 border-b-2 -mb-[2px] transition-colors ${
                  active === t.id ? "border-gray-900 text-gray-900" : "border-transparent hover:border-gray-400 text-gray-600"
                }`}
              >
                {t.label}
              </a>
            ))}
          </nav>
          <a href="#about" className="md:hidden text-sm text-gray-600">目錄</a>
        </div>
      </div>
    </header>
  );
}

// 3. 把你原本的 Root 元件重新命名為 App
function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <AutoHideHeader />
      <main className="pt-16">
        <Outlet />
      </main>
      <footer className="mt-16 border-t">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-neutral-600">
          © {new Date().getFullYear()} 個人網站
        </div>
      </footer>
    </div>
  );
}

// 4. 匯出一個 Layout 元件來定義 HTML 骨架
export function Layout() {
  return (
    <html lang="zh-Hant">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>個人網站</title>
        <Links /> {/* <--- 5. 插入 CSS 連結 */}
      </head>
      <body>
        <App /> {/* <--- 6. 渲染你原本的 App 內容 */}
        <Scripts /> {/* <--- 7. 插入 JavaScript 腳本 (關鍵！) */}
      </body>
    </html>
  );
}

// 8. 預設匯出 App (也就是你原本的 Root)
export default App;