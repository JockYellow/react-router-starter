import { useState, useEffect } from "react";
import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { isAdmin } from "../features/admin/admin-auth.server";
import { requireBlogDb } from "../lib/d1.server";
import { getAllBlogPosts } from "../features/blog/blog.d1.server";
import { getAllChangelogs } from "../features/changelog/changelog.d1.server";
import type { BlogPost } from "../features/blog/blog.types";
import type { Changelog } from "../features/changelog/changelog.d1.server";

// -----------------------------------------------------------------------------
// 1. 資料讀取（D1 雲端優先）
// -----------------------------------------------------------------------------

export async function loader({ request, context }: LoaderFunctionArgs) {
  const db = requireBlogDb(context);
  const [allPosts, allChangelogs, isAdminUser] = await Promise.all([
    getAllBlogPosts(db),
    getAllChangelogs(db).catch(() => [] as Changelog[]),
    Promise.resolve(isAdmin(request)),
  ]);
  return {
    posts: allPosts.slice(0, 5),
    changelogs: allChangelogs.slice(0, 5),
    isAdminUser,
  };
}

// -----------------------------------------------------------------------------
// 2. 頁面組件
// -----------------------------------------------------------------------------

export default function Index() {
  const { posts, changelogs, isAdminUser } = useLoaderData<typeof loader>() as {
    posts: BlogPost[];
    changelogs: Changelog[];
    isAdminUser: boolean;
  };
  const [activeSection, setActiveSection] = useState("hero");

  // 切換時瞬間回頂，保持乾淨俐落
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeSection]);

  // --- 動態產生 Sections ---
  const sections = {
    hero: {
      id: "hero",
      label: "主頁",
      title: "Welcome",
      description: "歡迎來到我的數位花園。",
      accent: "#60A5FA", // Blue-400
      bg: "bg-blue-50/50",
      meta: "HOME",
      content: (
        <div className="space-y-4">
          <p>這裡整合了我的技術筆記、專案實驗與生活紀錄。</p>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setActiveSection("articles")} className="btn-sm bg-blue-100 text-blue-700 hover:bg-blue-200 px-4 py-1.5 rounded-full text-sm font-medium transition-colors">
              看最新文章
            </button>
            <button onClick={() => setActiveSection("projects")} className="btn-sm bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-1.5 rounded-full text-sm font-medium transition-colors">
              逛逛專案
            </button>
          </div>
        </div>
      ),
    },
    articles: {
      id: "articles",
      label: "文章",
      title: "Latest Posts",
      description: "近期發布的技術文章與心得。",
      accent: "#F59E0B", // Amber-400
      bg: "bg-amber-50/50",
      meta: "WRITING",
      content: (
        <div className="grid gap-3">
          {posts.length > 0 ? (
            posts.map((post) => (
              <Link key={post.slug} to={`/blog/${post.slug}`} className="group block bg-white/60 hover:bg-white p-4 rounded-xl border border-transparent hover:border-amber-200 transition-all shadow-sm hover:shadow-md">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-gray-800 group-hover:text-amber-600 transition-colors">{post.title}</h3>
                  <span className="text-xs font-mono text-gray-400 whitespace-nowrap ml-2">{post.publishedAt?.slice(0, 10)}</span>
                </div>
                {post.summary && <p className="text-sm text-gray-500 mt-1 line-clamp-1">{post.summary}</p>}
              </Link>
            ))
          ) : (
            <div className="text-gray-400 text-sm py-4 italic">目前還沒有文章...</div>
          )}
          <Link to="/blog" className="text-center text-xs text-gray-400 hover:text-amber-600 py-2 block">查看全部文章 →</Link>
        </div>
      ),
    },
    projects: {
      id: "projects",
      label: "專案",
      title: "Featured Projects",
      description: "實作、實驗與開源貢獻。",
      accent: "#10B981", // Emerald-400
      bg: "bg-emerald-50/50",
      meta: "WORK",
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link to="/outerspace" className="group bg-white/60 hover:bg-white p-4 rounded-xl border border-transparent hover:border-emerald-200 transition-all shadow-sm hover:shadow-md">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <span className="text-lg">🪐</span>
                </div>
                <h4 className="font-bold text-gray-800">OuterSpace</h4>
                <p className="text-xs text-gray-500 mt-1">3D 互動實驗室</p>
            </Link>
             <Link to="/tools" className="group bg-white/60 hover:bg-white p-4 rounded-xl border border-transparent hover:border-emerald-200 transition-all shadow-sm hover:shadow-md">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <span className="text-lg">🛠️</span>
                </div>
                <h4 className="font-bold text-gray-800">Dev Tools</h4>
                <p className="text-xs text-gray-500 mt-1">開發者小工具集合</p>
            </Link>
        </div>
      ),
    },
    changelog: {
      id: "changelog",
      label: "日誌",
      title: "Changelog",
      description: "網站更新與維護紀錄。",
      accent: "#EC4899", // Pink-400
      bg: "bg-pink-50/50",
      meta: "LOGS",
      content: (
        <div className="relative border-l-2 border-pink-100 ml-3 space-y-6 py-2">
            {changelogs.length > 0 ? (
                changelogs.map((log) => (
                    <div key={log.id} className="relative pl-6">
                        <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-pink-200" />
                        <div className="text-xs font-mono text-pink-500 mb-1">{log.date}</div>
                        <h4 className="font-bold text-gray-800 text-sm">{log.title}</h4>
                        {log.notes.length > 0 && (
                            <ul className="text-xs text-gray-500 mt-1 space-y-0.5 list-disc list-inside">
                                {log.notes.slice(0, 2).map((note, i) => (
                                    <li key={i} className="line-clamp-1">{note}</li>
                                ))}
                                {log.notes.length > 2 && (
                                    <li className="text-gray-400">…還有 {log.notes.length - 2} 條</li>
                                )}
                            </ul>
                        )}
                    </div>
                ))
            ) : (
                <div className="pl-6 text-sm text-gray-400">尚無更新紀錄</div>
            )}
        </div>
      ),
    },
    about: {
      id: "about",
      label: "關於",
      title: "About Me",
      description: "熱愛開發與設計的工程師。",
      accent: "#8B5CF6", // Violet-400
      bg: "bg-violet-50/50",
      meta: "PROFILE",
      content: (
         <div className="text-sm text-gray-600 space-y-3 leading-relaxed">
            <p>你好！這是一個專注於Vibe coding的個人專案集錦。我喜歡探索新工具，並致力於打造流暢的使用者體驗。</p>
            <div className="flex flex-wrap gap-2 pt-2">
                {["React", "Remix", "TypeScript", "Tailwind", "Vite"].map(tag => (
                    <span key={tag} className="px-2 py-1 rounded-md bg-white border border-violet-100 text-violet-600 text-xs font-medium">
                        {tag}
                    </span>
                ))}
            </div>
         </div>
      )
    }
  };

  const activeData = sections[activeSection as keyof typeof sections];

  return (
    <div className="mx-auto max-w-2xl px-4 min-h-screen">

      {/* 1. 頂部標題與島嶼導覽 (Floating Island Nav) */}
      <div className="sticky top-6 z-50 flex flex-col items-center gap-4 mb-6">

        {/* 島嶼選單：懸浮膠囊設計，徹底移除白色長條背景 */}
        <nav className="p-1.5 bg-white/80 backdrop-blur-xl border border-white/40 shadow-lg shadow-black/5 rounded-full flex gap-1 transition-all hover:scale-[1.02]">
          {Object.values(sections).map((section) => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onMouseEnter={() => setActiveSection(section.id)}
                onClick={() => setActiveSection(section.id)}
                className={`
                  relative px-4 py-2 rounded-full text-xs md:text-sm font-bold transition-all duration-300
                  ${isActive ? "text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600 hover:bg-black/5"}
                `}
                style={{
                    backgroundColor: isActive ? "white" : "transparent",
                    color: isActive ? "var(--tw-text-opacity)" : undefined
                }}
              >
                {section.label}
                {isActive && (
                    <span className="absolute inset-x-0 -bottom-1 mx-auto w-1 h-1 rounded-full bg-current opacity-50" style={{ color: section.accent }}/>
                )}
              </button>
            );
          })}
          {isAdminUser && (
            <Link
              to="/admin"
              className="px-3 py-2 rounded-full text-xs font-bold text-neutral-400 hover:text-neutral-600 hover:bg-black/5 transition-all"
            >
              後台
            </Link>
          )}
        </nav>
      </div>

      {/* 2. 主內容區塊 (無縫滑入) */}
      <main className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div
            className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/40 backdrop-blur-sm shadow-xl shadow-indigo-500/5 p-6 md:p-8 transition-colors duration-500"
            style={{ backgroundColor: activeData.bg }}
        >
            {/* 裝飾背景光暈 */}
            <div
                className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl opacity-30 mix-blend-multiply transition-colors duration-700 pointer-events-none"
                style={{ backgroundColor: activeData.accent }}
            />

            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2 opacity-50">
                    <span className="h-px w-4 bg-current" style={{ color: activeData.accent }}/>
                    <span className="text-[10px] font-bold tracking-widest" style={{ color: activeData.accent }}>{activeData.meta}</span>
                </div>

                <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">{activeData.title}</h2>
                <p className="text-slate-500 text-sm mb-6">{activeData.description}</p>

                {/* 分隔線 */}
                <div className="w-full h-px bg-slate-900/5 mb-6" />

                <div className="min-h-[200px]">
                    {activeData.content}
                </div>
            </div>
        </div>
      </main>

      {/* 底部版權 */}
      <footer className="text-center py-12 text-xs text-gray-300">
        © 2025 Personal Website. Built with Remix.
      </footer>
    </div>
  );
}
