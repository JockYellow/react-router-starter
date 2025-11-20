import { useState } from "react";
import type { CSSProperties } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { loadChangelogItems, type ChangelogItem } from "../lib/changelog.server";
import { loadBlogCategories } from "../lib/blog.server";
import type { BlogPost, BlogCategory } from "../lib/blog.types";
import { getAllBlogPosts } from "../lib/blog.d1.server";
import { requireBlogDb } from "../lib/d1.server";

const SECTION_DATA = {
  blog: {
    label: "Blog",
    hero: {
      eyebrow: "Blog 模組",
      title: "個人網站 · 實驗室的文章焦點",
      description:
        "Workers、React Router 與 Cloudflare 架構的實戰心得會先在 Blog 模組整理，再同步至 Notion 與 RSS。",
      background: "linear-gradient(130deg, #fff5e3 0%, #f5e8ff 55%, #f0f8ff 100%)",
      borderColor: "rgba(233, 200, 155, 0.7)",
      metrics: [
        { label: "最新文章", value: "03", hint: "Workers 實作" },
        { label: "草稿排程", value: "08", hint: "Notion 同步" },
        { label: "Stack", value: "RRv7 · D1", hint: "Edge first" },
      ],
      preview: [
        {
          category: "焦點",
          title: "Workers + React Router",
          detail: "路由串接、快取策略與混合渲染記錄。",
        },
        {
          category: "設計",
          title: "Design Token 實作",
          detail: "以 tokens 與 CSS variables 讓文章與實驗保持一致。",
        },
      ],
      ctaLabel: "閱讀文章",
    },
    section: {
      eyebrow: "Blog",
      title: "文章列表",
      intro:
        "聚焦雲邊緣、React Router 與 UI 系統，文章以模組化格式記錄，方便快速擴充。",
      tint: "#FFF4E5",
      articles: [
        {
          title: "Workers + React Router 的混合渲染紀錄",
          excerpt: "整理 loader/action、快取、變更通知與 SSR 組合方式。",
          meta: "技術筆記 · 8 min",
          tags: ["Streaming", "Caching", "Routes"],
        },
        {
          title: "Design Token 驅動的 UI 調色流程",
          excerpt: "以 tokens 與 CSS variables 讓多模組維持一致光感。",
          meta: "設計系統 · 6 min",
          tags: ["Token", "UI Kit", "Tailwind"],
        },
        {
          title: "從 CLI 到 Cloudflare Pages 的部署腳本",
          excerpt: "整理 CI、Workers 與 Pages 的自動化部署步驟。",
          meta: "部署 · 5 min",
          tags: ["CLI", "Pages", "DX"],
        },
      ],
    },
  },
  guestbook: {
    label: "Guestbook",
    hero: {
      eyebrow: "Guestbook 模組",
      title: "留言板：把聲音留在邊緣節點",
      description:
        "留言使用 Cloudflare D1 + Durable Objects 進行即時紀錄，並透過 Turnstile 驗證阻擋垃圾訊息。",
      background: "linear-gradient(120deg, #f8ecff 0%, #e5f1ff 70%, #fef6ff 100%)",
      borderColor: "rgba(164, 138, 208, 0.6)",
      metrics: [
        { label: "互動紀錄", value: "48", hint: "最近 30 天" },
        { label: "表單驗證", value: "Turnstile", hint: "Edge action" },
        { label: "資料庫", value: "D1", hint: "雙寫入" },
      ],
      preview: [
        {
          category: "流程",
          title: "Edge Validation",
          detail: "使用 Remix action 結合 Turnstile 與節流策略減少 spam。",
        },
        {
          category: "同步",
          title: "Notion / D1 雙向",
          detail: "留言會推送至 Notion，排程整理後回寫邊緣節點。",
        },
      ],
      ctaLabel: "開啟留言板",
    },
    section: {
      eyebrow: "Guestbook",
      title: "留言板",
      intro: "只要動態表單驗證通過，就能在邊緣留言並即時同步到資料庫。",
      tint: "#F1E9FF",
      messages: [
        {
          name: "Sharon",
          role: "UI 設計師",
          message: "Tokens 色彩很穩，下一版一起把 Figma library 串進來。",
          time: "2 小時前",
          mood: "UI 夥伴",
        },
        {
          name: "Leo",
          role: "DX 工程師",
          message: "Workers action 寫得很乾淨，等你開源 CLI。",
          time: "昨天",
          mood: "DX 建議",
        },
        {
          name: "訪客 A",
          role: "讀者",
          message: "留言體驗順暢，Turnstile 幾乎感覺不到。",
          time: "本週",
          mood: "Feedback",
        },
      ],
    },
  },
  changelog: {
    label: "Changelog",
    hero: {
      eyebrow: "Changelog 模組",
      title: "更新日誌：版本節奏透明",
      description:
        "記錄頁面改版、部署與資料串接節點。追蹤模組狀態方便回溯決策。",
      background: "linear-gradient(120deg, #fef5e6 0%, #e9fff5 60%, #f3f9ff 100%)",
      borderColor: "rgba(190, 214, 189, 0.7)",
      metrics: [
        { label: "本月 PR", value: "12", hint: "包含 UI" },
        { label: "Deploy", value: "Pages", hint: "Auto" },
        { label: "監控", value: "Logpush", hint: "Edge" },
      ],
      preview: [
        {
          category: "版本",
          title: "Hero 動態切換",
          detail: "新首頁 hero 可即時預覽 Blog / Guestbook / Lab。",
        },
        {
          category: "Infra",
          title: "CI/CD",
          detail: "使用 Wrangler + GitHub Actions 部署到 Workers。",
        },
      ],
      ctaLabel: "查看日誌",
    },
    section: {
      eyebrow: "Changelog",
      title: "更新日誌",
      intro: "透過節點式記錄了解每週調整重點，搭配 Git tag 與 Pages Deploy ID。",
      tint: "#ECF9F1",
    },
  },
  lab: {
    label: "Lab",
    hero: {
      eyebrow: "Lab 模組",
      title: "互動實驗室：資料即時可視化",
      description:
        "Lab 模組會展示圖表、動態焦點卡與 Workers side project，為下一波文章鋪路。",
      background: "linear-gradient(120deg, #eef7ff 0%, #e4fffb 65%, #f7f0ff 100%)",
      borderColor: "rgba(148, 197, 219, 0.7)",
      metrics: [
        { label: "Prototype", value: "04", hint: "進行中" },
        { label: "Live Demo", value: "02", hint: "Charts" },
        { label: "Stack", value: "Canvas", hint: "Edge data" },
      ],
      preview: [
        {
          category: "動態",
          title: "焦點圖層",
          detail: "使用 requestAnimationFrame 做滾動感應與暈光。",
        },
        {
          category: "資料",
          title: "Workers Streaming",
          detail: "即時拉取分析資料並渲染圖表。",
        },
      ],
      ctaLabel: "前往實驗室",
    },
    section: {
      eyebrow: "Lab",
      title: "互動實驗",
      intro: "邊緣上的資料視覺化與互動效果都會先在 Lab 試驗，穩定後再搬進正式頁。",
      tint: "#E9F5FF",
      experiments: [
        {
          title: "動態焦點圖",
          description: "以 IntersectionObserver 驅動的 spotlight，會根據滑鼠與捲動做光暈。",
          status: "進行中",
          stack: ["Canvas", "IO", "Token"],
        },
        {
          title: "Live Metrics",
          description: "串流 Workers logpush，將請求量 / 錯誤率轉成即時折線圖。",
          status: "Prototype",
          stack: ["Logpush", "Chart", "Workers"],
        },
        {
          title: "色彩混合器",
          description: "測試色票混合演算法，讓模塊背景在暗色系也能保持層次。",
          status: "概念",
          stack: ["Color", "Shader"],
        },
      ],
    },
  },
} as const;

type SectionKey = keyof typeof SECTION_DATA;
const SECTION_KEYS: SectionKey[] = ["blog", "guestbook", "changelog", "lab"];

const TAG_LABELS = { add: "新增", fix: "修正", change: "變更", docs: "文件" } as const;

function TagBadge({ tag }: { tag?: ChangelogItem["tag"] }) {
  if (!tag) return null;
  return <span className="chip">{TAG_LABELS[tag]}</span>;
}

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

function renderSectionBody(
  sectionKey: SectionKey,
  options: { changelogItems: ChangelogItem[]; blogPosts: BlogPost[]; blogCategories: BlogCategory[] },
) {
  switch (sectionKey) {
    case "blog": {
      const posts = options.blogPosts.slice(0, 3);
      const categories = options.blogCategories;
      const categoryLabel = (post: BlogPost) => {
        const cat = categories.find((c) => c.id === post.categoryId);
        if (!cat) return "";
        const sub = cat.children.find((child) => child.id === post.subcategoryId);
        return sub ? `${cat.title} · ${sub.title}` : cat.title;
      };

      if (!posts.length) {
        return <p className="text-sm text-neutral-600">目前還沒有文章，從後台新增第一篇吧。</p>;
      }

      const excerpt = (body: string) => {
        const firstParagraph = body.split(/\n+/).map((line) => line.trim()).filter(Boolean)[0];
        if (!firstParagraph) return body.slice(0, 120);
        return firstParagraph.length > 180 ? `${firstParagraph.slice(0, 177)}…` : firstParagraph;
      };

      return (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <article
              key={(post.filename ?? post.slug ?? post.title) + post.publishedAt}
              className="card hover-raise h-full bg-white/90 flex flex-col"
            >
              <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
                {formatDate(post.publishedAt)}
              </p>
              <h3 className="mt-3 text-lg font-semibold text-neutral-900">{post.title}</h3>
              {categoryLabel(post) ? (
                <p className="text-xs text-neutral-500 mt-1">{categoryLabel(post)}</p>
              ) : null}
              <p className="mt-3 text-sm text-neutral-700 leading-relaxed flex-1">{excerpt(post.body)}</p>
              <div className="flex items-center justify-between pt-4 text-sm text-[--color-accent-600]">
                <span className="font-medium">純文字筆記</span>
                <a href="/blog" className="link-soft">
                  查看全部
                </a>
              </div>
            </article>
          ))}
        </div>
      );
    }
    case "guestbook": {
      const { messages } = SECTION_DATA.guestbook.section;
      return (
        <div className="grid gap-4 md:grid-cols-2">
          {messages.map((msg) => (
            <article
              key={msg.name}
              className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-neutral-900">{msg.name}</p>
                  <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
                    {msg.role}
                  </p>
                </div>
                <span className="text-xs rounded-full bg-[color:rgba(255,255,255,0.7)] px-3 py-1 text-neutral-600 border border-white/60">
                  {msg.time}
                </span>
              </div>
              <p className="mt-3 text-sm text-neutral-800 leading-relaxed">{msg.message}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.2em] text-[--color-accent-500]">
                {msg.mood}
              </p>
            </article>
          ))}
        </div>
      );
    }
    case "changelog": {
      const timeline = options.changelogItems;
      return (
        <div className="space-y-5">
          {timeline.length ? (
            timeline.map((log, index) => (
              <article
                key={(log.filename ?? log.date) + index}
                className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
                  <time dateTime={log.date} className="font-semibold text-neutral-900">
                    {log.date}
                  </time>
                  <TagBadge tag={log.tag} />
                </div>
                <h3 className="mt-2 text-lg font-semibold text-neutral-900">{log.title}</h3>
                {log.notes?.length ? (
                  <ul className="mt-2 list-disc pl-5 text-sm text-neutral-700 space-y-1">
                    {log.notes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))
          ) : (
            <p className="text-sm text-neutral-500">目前沒有更新日誌，稍後再回來看看。</p>
          )}
        </div>
      );
    }
    case "lab": {
      const { experiments } = SECTION_DATA.lab.section;
      return (
        <div className="grid gap-5 md:grid-cols-2">
          {experiments.map((exp) => (
            <article
              key={exp.title}
              className="card hover-raise h-full bg-white/90 flex flex-col"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-neutral-900">{exp.title}</h3>
                <span className="text-xs rounded-full bg-[color:rgba(236,248,255,0.9)] px-3 py-1 text-neutral-600 border border-white/60">
                  {exp.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-neutral-700 leading-relaxed flex-1">{exp.description}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {exp.stack.map((tag) => (
                  <span key={tag} className="chip">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}

type ModuleButtonsProps = {
  activeSection: SectionKey;
  onHover: (section: SectionKey) => void;
  onSelect: (section: SectionKey) => void;
  className?: string;
};

export async function loader(args: LoaderFunctionArgs) {
  const [changelog, blogCategories] = await Promise.all([
    loadChangelogItems(args),
    loadBlogCategories(),
  ]);
  const db = requireBlogDb(args.context);
  const blogPosts: BlogPost[] = await getAllBlogPosts(db);
  return { changelog, blogPosts, blogCategories };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

function ModuleButtons({ activeSection, onHover, onSelect, className }: ModuleButtonsProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      {SECTION_KEYS.map((section) => {
        const isActive = activeSection === section;
        return (
          <button
            key={section}
            type="button"
            onMouseEnter={() => onHover(section)}
            onFocus={() => onHover(section)}
            onClick={() => onSelect(section)}
            aria-pressed={isActive}
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--color-accent-300]
            ${
              isActive
                ? "bg-neutral-900 text-white border-neutral-900 shadow-lg"
                : "bg-white/75 text-neutral-600 border-white/60 hover:text-neutral-900"
            }`}
          >
            {SECTION_DATA[section].label}
          </button>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const [activeSection, setActiveSection] = useState<SectionKey>("blog");
  const { changelog, blogPosts, blogCategories } = useLoaderData() as LoaderData;
  const changelogItems = changelog.slice(0, 4);
  const heroModule = SECTION_DATA[activeSection].hero;

  const scrollToSection = (section: SectionKey) => {
    if (typeof document === "undefined") return;
    const target = document.getElementById(section);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleHover = (section: SectionKey) => {
    if (section !== activeSection) {
      setActiveSection(section);
    }
  };

  const handleSelect = (section: SectionKey) => {
    setActiveSection(section);
    scrollToSection(section);
  };

  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="pt-16 pb-6 space-y-3">
        <p className="eyebrow text-neutral-600">模組切換</p>
        <ModuleButtons
          activeSection={activeSection}
          onHover={handleHover}
          onSelect={handleSelect}
        />
      </div>

      <section className="section pt-0">
        <div
          className="module-panel module-hero space-y-8"
          style={{ background: heroModule.background, borderColor: heroModule.borderColor }}
        >
          <div className="space-y-8">
            <div className="space-y-4 max-w-3xl">
              <p className="eyebrow">{heroModule.eyebrow}</p>
              <h1 className="text-3xl md:text-5xl font-bold leading-tight text-neutral-900">
                {heroModule.title}
              </h1>
              <p className="text-lg text-neutral-800/90 leading-relaxed">
                {heroModule.description}
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {heroModule.metrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-2xl border border-white/60 bg-white/80 px-5 py-4 shadow-sm"
                    >
                      <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
                        {metric.label}
                      </p>
                      <p className="text-2xl font-semibold text-neutral-900 mt-1">{metric.value}</p>
                      <p className="text-xs text-neutral-600">{metric.hint}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="btn-primary" onClick={() => handleSelect(activeSection)}>
                    {heroModule.ctaLabel}
                  </button>
                  <a href="#lab" className="btn-ghost">
                    看互動實驗
                  </a>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {heroModule.preview.map((item) => (
                  <article key={item.title} className="card bg-white/85">
                    <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
                      {item.category}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-neutral-900">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm text-neutral-700 leading-relaxed">{item.detail}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {SECTION_KEYS.map((sectionKey) => {
        const section = SECTION_DATA[sectionKey].section;
        return (
          <section key={sectionKey} id={sectionKey} className="section">
            <div className="module-panel" style={{ "--module-color": section.tint } as CSSProperties}>
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="eyebrow">{section.eyebrow}</p>
                  <h2 className="section-title">{section.title}</h2>
                </div>
                <p className="text-lg text-neutral-700 leading-relaxed max-w-3xl">
                  {section.intro}
                </p>
                {renderSectionBody(sectionKey, { changelogItems, blogPosts, blogCategories })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
