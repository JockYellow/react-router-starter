import { useState, useEffect } from "react";
import { Link } from "react-router";
import {
  Bike,
  Settings,
  Mountain,
  Wind,
  Clock,
  MapPin,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Mail,
  Github,
  ArrowRight,
  Users,
  AlertCircle,
  Timer,
  Wrench,
  Flag,
  Music,
  Film,
} from "lucide-react";

// ---------------------------------------------------------------------------
// 型別定義
// ---------------------------------------------------------------------------

type Story = {
  situation: string;
  action: string;
  result: string;
};

type WorkExp = {
  id: string;
  role: string;
  company: string;
  location: string;
  period: string;
  displayYear: string;
  distance: string;
  vibe: string;
  summary: string;
  highlights: string[];
  details: string[];
  stories: {
    rhythm: string;
    cases: Story[];
  };
  tags: string[];
  blogSlug: string;
  links?: { label: string; url: string; external?: boolean }[];
};

// ---------------------------------------------------------------------------
// 靜態資料
// ---------------------------------------------------------------------------

const PERSONAL = {
  name: "黃彥禎",
  title: "Customer Success · Product Ops · Data-Informed Problem Solver",
  location: "新北市, 台灣",
  email: "hyjock777@outlook.com",
  github: "https://github.com/JockYellow",
  intro:
    "擅長從客戶使用數據中找到問題、設計流程、推動改善。\n從教育現場到 SaaS 客戶成功，每一段經歷都在做同一件事——把混亂變成可運作的系統。\n對我來說，解決問題就像騎車爬坡——找到節奏，持續踩踏，終會抵達。",
  // 底部面板真實數據
  stats: {
    clients: { value: 51, label: "Clients", unit: "accounts" },
    issues: { value: 159, label: "Issues Filed", unit: "tickets" },
  },
};

const WORK_EXPERIENCE: WorkExp[] = [
  {
    id: "exp-1",
    role: "客戶成功 / 客戶成功營運",
    company: "COMMEET（SaaS 費用管理平台）",
    location: "台北, 台灣",
    period: "2024/07 – 2026/03",
    displayYear: "2024",
    distance: "754 萬導入 / 坡度 12%",
    vibe: "一段陡坡長征——從產品理解、客戶導入、流程建置到數據分析，全程獨力完成。",
    summary: "獨立負責從客戶導入到續約的完整生命週期，同步建立 CS 營運機制與數據分析體系",
    highlights: [
      "負責 51 位客戶經營，其中 31 間從導入期獨立接手，合約導入總額 754 萬元",
      "個人續約金額 320 萬，已續約 29 件，自導入客戶續約率 100%",
      "設計客戶健康度指標，產出六維度客製化成效報告（趨勢、內控、簽核效率、合規、企業卡、效益摘要）",
    ],
    details: [
      "累計提報 159 件系統問題、33 件優化建議，推動產品迭代",
      "建立導入分級流程、信件模板化、需求文件標準化，降低交接風險與屬人化依賴",
      "重建 Zendesk 幫助中心文章結構與導航，導入 GIF 互動式說明與檢核表機制",
      "規劃並執行客戶成功講座（議題設定、名單邀請、活動頁建置、回饋蒐集）",
    ],
    stories: {
      rhythm:
        "日常以客戶導入與客戶進度追蹤為主，每週固定 2~3 場客戶會議（導入對焦或成效追蹤），每月產出季度客製化成效報告，執行一場客戶成功講座。跨部門協作主要對象為 PM 和工程團隊，透過 TASK 提報機制推動產品改善。",
      cases: [
        {
          situation: "【待補充】某客戶導入初期的抵觸情況或特殊挑戰",
          action: "【待補充】你如何應對、用什麼方式重建信任或改變溝通策略",
          result: "【待補充】結果如何，客戶後來的狀況（例：順利續約、成為轉介來源）",
        },
        {
          situation: "【待補充】接手時 CS 流程缺乏標準化，交接困難或資訊流失",
          action: "【待補充】如何設計導入分級制度、建立信件模板和需求文件範本",
          result: "【待補充】流程建立後的具體效益（例：新人上手時間縮短、客訴減少）",
        },
        {
          situation: "【待補充】客戶對系統使用成效缺乏感受，續約前容易猶豫",
          action: "從零設計六維度成效報告，用 SQL 取數、Python 處理、Chart.js 視覺化，將使用數據轉譯為客戶能理解的商業價值",
          result: "【待補充】報告對續約決策的實際影響（例：哪些客戶因看到報告而決定續約）",
        },
      ],
    },
    tags: ["Customer Success", "SQL", "Python", "Zendesk", "Chart.js", "Onboarding", "Data Analysis"],
    blogSlug: "",
    links: [
      { label: "客製化成效報告", url: "/resume/custom-impact-report" },
      { label: "CS 工作定位流程圖", url: "/resume/cs-flow" },
    ],
  },
  {
    id: "exp-2",
    role: "課程規劃師",
    company: "財團法人華岡興業基金會",
    location: "台北, 台灣",
    period: "2022/08 – 2023/01",
    displayYear: "2022",
    distance: "28.5 km / 起伏丘陵",
    vibe: "短距離但地形多變——半年內跑完產品從市場調查到上架銷售的完整流程。",
    summary: "獨立操作實體課程線上販售全流程，從需求調查到預算控管一手包辦",
    highlights: [
      "獨立負責實體課程線上販售全流程：需求調查 → 課程設計 → 預算編製 → 行銷推廣 → 招生執行",
      "編列並控管網路廣告投放預算，追蹤業績表現與轉換成效",
    ],
    details: [
      "撰寫網頁宣傳文案與行銷活動企劃，操作社群與公開資訊平台推廣",
    ],
    stories: {
      rhythm: "【待補充】請描述每週的工作分配、主要溝通對象與決策流程（例：每週幾場會議、與誰協作、如何追蹤成效）",
      cases: [
        {
          situation: "【待補充】選一個這份工作中印象深刻的挑戰或關鍵決定",
          action: "【待補充】你如何分析情況、採取什麼行動",
          result: "【待補充】結果與具體數字（廣告預算規模、課程報名人數或銷售金額）",
        },
      ],
    },
    tags: ["行銷企劃", "文案撰寫", "廣告投放", "預算管理", "課程產品設計"],
    blogSlug: "",
  },
  {
    id: "exp-3",
    role: "專案管理 / 客戶經理",
    company: "社團法人台灣一起夢想公益協會",
    location: "台北, 台灣",
    period: "2022/04 – 2022/06",
    displayYear: "2022",
    distance: "12.0 km / 短程衝刺",
    vibe: "三個月的高強度衝刺——密集開發、快速驗證、即時調整。",
    summary: "三個月內密集開發非營利組織合作夥伴，同步執行募款專案與行銷推廣",
    highlights: [
      "每月探訪 12 間非營利組織，進行超過 100 通電話開發，建立合作夥伴關係",
      "每月執行 3 檔線上募款活動，撰寫專案募款計畫並追蹤資金使用成效",
    ],
    details: [
      "協同 Facebook 行銷推廣，策劃並執行公益活動",
    ],
    stories: {
      rhythm: "【待補充】請描述三個月內的工作節奏（例：每週開發幾間組織、如何兼顧開發與執行）",
      cases: [
        {
          situation: "【待補充】短期衝刺中遇到的最大阻力或轉折點",
          action: "【待補充】你如何快速應對與調整",
          result: "【待補充】三個月總募款金額與達成率",
        },
      ],
    },
    tags: ["專案管理", "募款企劃", "客戶開發", "社群行銷"],
    blogSlug: "",
  },
  {
    id: "exp-4",
    role: "教學部教務人員 / 講師",
    company: "創思文教股份有限公司（倍思科學）",
    location: "台北, 台灣",
    period: "2020/01 – 2022/01",
    displayYear: "2020",
    distance: "120.2 km / 長距離巡航",
    vibe: "兩年的穩定巡航——在這裡建立了系統化思維的肌肉記憶。",
    summary: "負責課程營運全鏈路，從教學執行、師資培訓到 ERP 系統重整與排課管理",
    highlights: [
      "教授超過 400 堂科學課程，作為內部培訓講師進行超過 100 堂課程培訓",
      "重整公司 ERP 系統，月度安排近 500 堂課程並計算講師鐘點費",
      "將排課規則標準化，建立不同學制需求的合作模板，降低排課出錯率",
    ],
    details: [
      "根據市場需求設計課程教具與企劃，確保符合成本效益目標",
      "疫情期間成功將實體課程轉為線上授課模式",
    ],
    stories: {
      rhythm: "【待補充】請描述每週教學堂數、行政排課佔用時間、客戶（家長/學校）溝通頻率",
      cases: [
        {
          situation: "【待補充】接手排課管理時，原本的流程靠人工記憶、容易出錯且難以交接",
          action: "【待補充】如何重整 ERP 系統、定義哪些排課規則與例外情況",
          result: "【待補充】重整後出錯率降低幅度、月度排課效率提升多少",
        },
        {
          situation: "疫情爆發，實體課程面臨全面停擺危機",
          action: "【待補充】在多短時間內完成線上轉型、採用什麼工具與流程",
          result: "【待補充】課程恢復率、學生續報率，或對公司影響的評估",
        },
      ],
    },
    tags: ["教學設計", "ERP 管理", "流程標準化", "師資培訓", "課程企劃"],
    blogSlug: "",
  },
];

// 右側導覽節點（合併同年份）
const NAV_NODES = (() => {
  const seen = new Map<string, { firstId: string; roles: string[]; period: string }>();
  for (const exp of WORK_EXPERIENCE) {
    const year = exp.displayYear;
    if (!seen.has(year)) {
      seen.set(year, { firstId: exp.id, roles: [exp.role], period: exp.period });
    } else {
      seen.get(year)!.roles.push(exp.role);
    }
  }
  return Array.from(seen.entries()).map(([year, data]) => ({ year, ...data }));
})();

const SKILL_GROUPS = [
  {
    label: "數據 & 分析",
    metaphor: "碼表與功率輸出",
    icon: Timer,
    skills: ["SQL（查詢 / 資料檢核）", "Python（資料處理 / Jinja2 模板）", "Tableau", "Power BI", "Excel 進階"],
  },
  {
    label: "客戶成功 & 營運",
    metaphor: "傳動與變速系統",
    icon: Settings,
    skills: ["Zendesk（工單 / 幫助中心）", "Onboarding 流程設計", "客戶健康度指標", "Mailjet（郵件行銷）", "活動通"],
  },
  {
    label: "前端 & 報表呈現",
    metaphor: "車架與幾何",
    icon: Wrench,
    skills: ["HTML / CSS", "Chart.js", "Tailwind CSS", "Git / GitHub", "AI-Assisted Development"],
  },
];

const PROJECTS = [
  {
    id: "proj-1",
    name: "客製化客戶成效報告系統",
    description:
      "為 SaaS 客戶建置六維度分析報告（2200+ 行 HTML），涵蓋費用趨勢、內控健康度、簽核效率、憑證合規、企業卡分析與效益摘要。從 SQL 取數到 Chart.js 視覺化的完整產出流程。",
    tags: ["SQL", "Python", "Chart.js", "Tailwind CSS", "Jinja2"],
    externalUrl: "/resume/custom-impact-report",
    blogSlug: "",
  },
  {
    id: "proj-2",
    name: "Zendesk 幫助中心重建",
    description:
      "重新設計文章結構與導航系統，加入 GIF 操作示範、站台實際頁面示例與保存狀態檢核表，從內容管理推進到知識管理。",
    tags: ["Zendesk", "Knowledge Management", "UX Writing"],
    externalUrl: "",
    blogSlug: "",
  },
  {
    id: "proj-3",
    name: "個人網站",
    description:
      "基於 React 19 + TypeScript + Cloudflare Workers 的個人平台，整合履歷、部落格與作品集。",
    tags: ["React 19", "TypeScript", "Tailwind CSS", "Cloudflare Workers", "D1"],
    externalUrl: PERSONAL.github,
    blogSlug: "",
  },
];

const INTERESTS: { id: string; title: string; subtitle?: string; description: string }[] = [
  {
    id: "bike",
    title: "恬靜的單車生活",
    description: "喜歡在杳無人煙的環境下暢行、享受寧靜。世界僅需定佇當下的風景與呼吸。",
  },
  {
    id: "music",
    title: "現場音樂演出",
    subtitle: "音樂、演出",
    description: "在現場感受音樂的衝擊與共鳴，為每個交織的樂器獻出搖擺的身體。",
  },
  {
    id: "anime",
    title: "日本動畫及電影",
    description: "描刻的細膩情感與充滿想像力的畫面，讓我著迷於每一個故事的綻放。",
  },
  {
    id: "motto",
    title: "座右銘",
    description: "我想要怎樣的生活、生活想要怎樣的我。",
  },
];

const REST_STOP_PHOTOS = {
  bike: "/images/resume/bike-life-yunlin.jpg",
  music: "/images/resume/live-music-songyan.jpg",
};


// ---------------------------------------------------------------------------
// 主元件
// ---------------------------------------------------------------------------

export default function ResumePage() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const winScroll = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
      setScrollProgress(scrolled);

      const sections = WORK_EXPERIENCE.map((exp) =>
        document.getElementById(exp.id),
      );
      sections.forEach((section, index) => {
        if (section) {
          const rect = section.getBoundingClientRect();
          if (
            rect.top < window.innerHeight / 2 &&
            rect.bottom > window.innerHeight / 2
          ) {
            setActiveSection(index);
          }
        }
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  // 底部面板數字遞增（滾動到 60% 時達到最大值）
  const statProgress = Math.min(scrollProgress / 60, 1);
  const clientCount = Math.round(PERSONAL.stats.clients.value * statProgress);
  const issueCount = Math.round(PERSONAL.stats.issues.value * statProgress);

  // 右側導覽：哪個 year node 是 active
  const activeYear = WORK_EXPERIENCE[activeSection]?.displayYear ?? "";

  return (
    <div className="min-h-screen text-neutral-900 font-sans selection:bg-brand-100">

      {/* ── 左側捲動路線 SVG ── */}
      <div className="fixed left-8 top-32 bottom-40 w-px hidden md:block z-10 pointer-events-none">
        <svg className="absolute top-0 left-[-16px] w-8 h-full overflow-visible">
          <defs>
            <linearGradient id="routeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--color-brand-400)" />
              <stop offset="100%" stopColor="var(--color-accent-500)" />
            </linearGradient>
          </defs>
          <path
            d="M 16 0 Q 40 300 16 600 T 16 1200 T 16 1800"
            fill="none"
            stroke="var(--color-warm-100)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M 16 0 Q 40 300 16 600 T 16 1200 T 16 1800"
            fill="none"
            stroke="url(#routeGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="3000"
            strokeDashoffset={3000 - (3000 * scrollProgress) / 100}
            className="transition-all duration-200 ease-out"
          />
        </svg>
      </div>

      {/* ── 主內容 ── */}
      <main className="relative pt-20 pb-48 max-w-5xl mx-auto px-6 md:px-12">

        {/* Hero */}
        <section className="module-panel module-hero mb-20 md:ml-16">
          <div className="flex flex-col md:flex-row md:items-end gap-6 justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-brand-300 p-1.5 rounded-lg shadow-sm">
                  <Bike className="w-5 h-5 text-neutral-800" />
                </div>
                <p className="eyebrow">JOURNEY · RESUME</p>
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-none mb-4">
                {PERSONAL.name}
              </h1>
              <p className="text-lg font-semibold text-accent-500 mb-4">
                {PERSONAL.title}
              </p>
              <p className="text-neutral-600 max-w-lg leading-relaxed whitespace-pre-line">
                {PERSONAL.intro}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <a href={`mailto:${PERSONAL.email}`} className="chip">
                <Mail size={13} />
                {PERSONAL.email}
              </a>
              <a
                href={PERSONAL.github}
                target="_blank"
                rel="noreferrer"
                className="chip"
              >
                <Github size={13} />
                GitHub
              </a>
              <span className="chip">
                <MapPin size={13} />
                {PERSONAL.location}
              </span>
            </div>
          </div>
        </section>

        <div className="md:ml-16 space-y-32">

          {/* ── 工作經歷 ── */}
          <div>
            <h2 className="section-title mb-10">工作經歷</h2>
            <div className="space-y-16">
              {WORK_EXPERIENCE.map((exp, index) => {
                return (
                  <section
                    key={exp.id}
                    id={exp.id}
                    className={`transition-all duration-700 transform ${
                      activeSection === index
                        ? "opacity-100 translate-x-0"
                        : "opacity-40 translate-x-4"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row gap-6 items-start">

                      {/* 側欄：SEGMENT + 路線數據 */}
                      <div className="md:w-44 shrink-0">
                        <div className="flex items-center gap-1.5 text-brand-500 font-black text-xs mb-2">
                          <Mountain size={13} />
                          <span>SEGMENT {index + 1}</span>
                        </div>
                        <div className="font-mono text-xs text-neutral-400 space-y-1">
                          <p className="flex items-center gap-1">
                            <Clock size={11} />
                            {exp.period}
                          </p>
                          <p className="flex items-center gap-1">
                            <Wind size={11} />
                            {exp.distance}
                          </p>
                          <p className="flex items-center gap-1">
                            <MapPin size={11} />
                            {exp.location}
                          </p>
                        </div>
                      </div>

                      {/* 卡片 */}
                      <div className="flex-1 card group">

                        {/* 卡頭：role + company + summary */}
                        <div className="mb-4">
                          <h3 className="text-xl font-bold mb-0.5 group-hover:text-accent-500 transition-colors">
                            {exp.role}
                          </h3>
                          <p className="text-sm font-semibold text-neutral-500 mb-1">
                            {exp.company}
                          </p>
                          <p className="text-sm font-medium text-neutral-400">
                            {exp.summary}
                          </p>
                        </div>

                        {/* Vibe 引言 */}
                        <p className="italic text-neutral-400 text-sm mb-5 border-l-4 border-brand-200 pl-4">
                          "{exp.vibe}"
                        </p>

                        {/* Highlights（核心成果） */}
                        <ul className="space-y-2 mb-4">
                          {exp.highlights.map((item, i) => (
                            <li
                              key={i}
                              className="flex gap-3 items-start text-sm text-neutral-600 leading-relaxed"
                            >
                              <ChevronRight
                                className="shrink-0 mt-0.5 text-brand-400"
                                size={15}
                              />
                              {item}
                            </li>
                          ))}
                        </ul>

                        {/* Details（支撐細節） */}
                        {exp.details.length > 0 && (
                          <ul className="space-y-1.5 mb-5 border-t border-neutral-100 pt-3 mt-3">
                            {exp.details.map((item, i) => (
                              <li
                                key={i}
                                className="flex gap-2.5 items-start text-[13px] text-neutral-400 leading-relaxed"
                              >
                                <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full bg-neutral-300" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* 作品連結 */}
                        {exp.links && exp.links.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4 pt-3 border-t border-neutral-100">
                            {exp.links.map((lk) => {
                              const cls =
                                "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100 hover:border-brand-400 transition-all";
                              return lk.external ? (
                                <a
                                  key={lk.url}
                                  href={lk.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={cls}
                                >
                                  <ExternalLink size={11} className="shrink-0 opacity-70" />
                                  {lk.label}
                                </a>
                              ) : (
                                <Link key={lk.url} to={lk.url} className={cls}>
                                  <ExternalLink size={11} className="shrink-0 opacity-70" />
                                  {lk.label}
                                </Link>
                              );
                            })}
                          </div>
                        )}

                        {/* 標籤列 + 展開按鈕 */}
                        <div className="flex flex-wrap items-center gap-2">
                          {exp.tags.map((tag) => (
                            <span key={tag} className="chip text-[11px]">
                              {tag}
                            </span>
                          ))}
                          {exp.blogSlug && (
                            <Link
                              to={`/blog/${exp.blogSlug}`}
                              className="btn-ghost text-xs flex items-center gap-1"
                            >
                              <BookOpen size={12} />
                              查看相關文章
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          {/* ── 技術能力 ── */}
          <section>
            <h2 className="section-title mb-8">
              裝備與功率輸出{" "}
              <span className="text-sm font-normal text-neutral-400 ml-2">GEAR & WATTS</span>
            </h2>
            <div className="module-panel module-skills">
              <div className="grid md:grid-cols-3 gap-6">
                {SKILL_GROUPS.map((group) => {
                  const GroupIcon = group.icon;
                  return (
                    <div key={group.label} className="skill-card">
                      <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                          <GroupIcon size={16} className="text-brand-500" />
                        </div>
                        <p className="eyebrow leading-none">{group.label}</p>
                      </div>
                      <p className="text-[11px] text-neutral-400 mb-4 pl-10">{group.metaphor}</p>
                      <ul className="space-y-1.5">
                        {group.skills.map((skill) => (
                          <li
                            key={skill}
                            className="text-sm text-neutral-700 flex items-center gap-2"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
                            {skill}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ── 作品集 ── */}
          <section>
            <h2 className="section-title mb-8">
              攻克路線{" "}
              <span className="text-sm font-normal text-neutral-400 ml-2">ACHIEVED ROUTES</span>
            </h2>
            <div className="module-panel module-projects">
              <div className="grid md:grid-cols-3 gap-5">
                {PROJECTS.map((proj) => (
                  <div key={proj.id} className="card hover-raise flex flex-col relative">
                    <div className="absolute top-4 right-4 text-neutral-200">
                      <Flag size={16} />
                    </div>
                    <h3 className="font-bold text-base mb-2 pr-6">{proj.name}</h3>
                    <p className="text-sm text-neutral-500 leading-relaxed mb-4 flex-1">
                      {proj.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {proj.tags.map((tag) => (
                        <span key={tag} className="chip text-[11px]">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {proj.externalUrl && (
                        <a
                          href={proj.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost text-xs flex items-center gap-1"
                        >
                          <ExternalLink size={12} />
                          查看路線細節
                        </a>
                      )}
                      {proj.blogSlug && (
                        <Link
                          to={`/blog/${proj.blogSlug}`}
                          className="link-soft text-xs flex items-center gap-1"
                        >
                          <BookOpen size={12} />
                          閱讀文章
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 text-center">
                <Link to="/blog" className="btn-ghost inline-flex items-center gap-2">
                  <BookOpen size={15} />
                  瀏覽所有文章與技術分享
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </section>
          {/* ── 補給站 ── */}
          <section>
            <h2 className="section-title mb-8">
              補給站{" "}
              <span className="text-sm font-normal text-neutral-400 ml-2">REST STOP</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-4">

              {/* Block A: 單車生活 (2×2) */}
              <div className="md:col-span-2 md:row-span-2 relative rounded-2xl overflow-hidden min-h-72 bg-gradient-to-br from-neutral-800 to-neutral-900 group">
                <img
                  src={REST_STOP_PHOTOS.bike}
                  alt="單車生活：雲林騎乘路線風景"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                {/* 海拔剪影 SVG */}
                <svg
                  viewBox="0 0 400 200"
                  preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full opacity-[0.15]"
                  aria-hidden
                >
                  <path
                    d="M0 180 L60 180 L100 130 L140 70 L180 90 L220 110 L270 40 L320 100 L360 120 L400 80 L400 200 L0 200 Z"
                    fill="white"
                  />
                </svg>
                <div className="absolute inset-0 bg-black/10" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6 text-white">
                  <div className="max-w-[92%] rounded-xl bg-black/20 backdrop-blur-[1px] border border-white/25 px-4 py-3 shadow-[0_8px_20px_rgba(0,0,0,0.25)]">
                    <div className="flex items-center gap-2 mb-2">
                      <Bike size={15} className="text-brand-300" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-brand-200">
                        真實的單車生活
                      </span>
                    </div>
                    <p className="text-2xl font-black leading-tight mb-2 text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.55)]">
                      遍歷皆有趣 這裡是雲林
                    </p>
                    <p className="text-sm text-white/90 leading-relaxed [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]">
                      {INTERESTS[0].description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Block B: 現場音樂 (2×1) */}
              <div className="md:col-span-2 md:row-span-1 relative rounded-2xl overflow-hidden min-h-48 group">
                <img
                  src={REST_STOP_PHOTOS.music}
                  alt="現場音樂：松菸演出現場"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/8" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/30 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <div className="absolute inset-0 p-6 flex items-end">
                  <div className="rounded-xl bg-black/20 backdrop-blur-[1px] border border-white/25 px-4 py-3 shadow-[0_8px_20px_rgba(0,0,0,0.25)] max-w-xl">
                    <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 mb-3 border border-white/25">
                      <Music size={22} className="text-brand-300" />
                    </div>
                    <p className="eyebrow mb-0.5 text-white">{INTERESTS[1].title}</p>
                    {INTERESTS[1].subtitle && (
                      <h3 className="font-bold text-base text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.55)]">{INTERESTS[1].subtitle}</h3>
                    )}
                    <p className="text-sm text-white/90 mt-1 leading-relaxed [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]">
                      {INTERESTS[1].description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Block C: 日本動畫及電影 (1×1) */}
              <div className="md:col-span-1 md:row-span-1 card p-5 flex flex-col justify-between">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center mb-3">
                  <Film size={18} className="text-brand-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                    動畫 & 電影
                  </p>
                  <h3 className="font-bold text-sm">{INTERESTS[2].title}</h3>
                  <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                    {INTERESTS[2].description}
                  </p>
                </div>
              </div>

              {/* Block D: 座右銘 (1×1) */}
              <div className="md:col-span-1 md:row-span-1 card p-5 flex flex-col justify-center bg-neutral-900 text-white rounded-2xl border-0">
                <p className="text-3xl font-black leading-none mb-3 text-brand-300">"</p>
                <p className="text-sm font-medium leading-relaxed">
                  {INTERESTS[3].description}
                </p>
                <p className="text-[10px] text-neutral-500 mt-3 uppercase tracking-widest font-bold">
                  {INTERESTS[3].title}
                </p>
              </div>

            </div>
          </section>

        </div>
      </main>

      {/* ── 右側：單車 Tracker + 年份導覽（合併同年份節點） ── */}
      <div className="fixed right-6 md:right-14 top-1/2 -translate-y-1/2 h-[60vh] flex flex-col items-center z-20 hidden md:flex">
        {/* 鏈條軌道 */}
        <div className="absolute top-0 bottom-0 w-1 bg-warm-100 rounded-full overflow-hidden">
          <div
            className="w-full bg-gradient-to-b from-brand-400 to-accent-500 transition-all duration-100"
            style={{ height: `${scrollProgress}%` }}
          />
        </div>

        {/* 單車圖示（隨捲動移動） */}
        <div
          className="absolute z-20 transition-all duration-150 ease-out"
          style={{ top: `${scrollProgress}%`, transform: "translateY(-50%)" }}
        >
          <div className="bg-white p-2 rounded-xl shadow-xl border border-brand-200">
            <div className="relative">
              <Bike className="w-5 h-5 text-brand-500" />
              <Settings
                className="absolute -left-1 -bottom-1 w-3 h-3 text-accent-500"
                style={{ transform: `rotate(${scrollProgress * 10}deg)` }}
              />
              <Settings
                className="absolute -right-1 -bottom-1 w-3 h-3 text-accent-500"
                style={{ transform: `rotate(${scrollProgress * 10}deg)` }}
              />
            </div>
          </div>
        </div>

        {/* 年份節點（合併 2022） */}
        <div className="h-full flex flex-col justify-between py-4 z-10 w-24">
          {NAV_NODES.map((node) => {
            const isActive = activeYear === node.year;
            return (
              <div key={node.year} className="relative flex justify-center group">
                <button
                  onClick={() => scrollTo(node.firstId)}
                  className={`px-3 py-1 rounded-full text-[10px] font-black tracking-tighter transition-all duration-300 border-2
                    ${
                      isActive
                        ? "bg-brand-300 border-brand-400 text-neutral-900 scale-125 shadow-lg shadow-brand-200"
                        : "bg-white/80 border-warm-100 text-neutral-400 hover:border-accent-200 hover:text-accent-500"
                    }`}
                >
                  {node.year}
                </button>

                {/* Hover 氣泡（顯示全部同年份的職位） */}
                <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 w-52 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 translate-x-4 group-hover:translate-x-0 z-30">
                  <div className="bg-neutral-900 text-white p-3 rounded-xl shadow-2xl relative space-y-2">
                    {node.roles.map((role, ri) => {
                      const exp = WORK_EXPERIENCE.find(
                        (e) => e.displayYear === node.year && e.role === role,
                      );
                      return (
                        <div key={ri}>
                          {ri > 0 && <div className="border-t border-white/10 pt-2" />}
                          <p className="text-[9px] text-brand-300 font-bold uppercase tracking-widest mb-0.5">
                            {exp?.period}
                          </p>
                          <p className="text-xs font-semibold leading-snug">{role}</p>
                        </div>
                      );
                    })}
                    <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-neutral-900 rotate-45" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 底部真實數據面板 ── */}
      <footer className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl bg-neutral-900/92 backdrop-blur-xl rounded-2xl border border-white/10 px-5 md:px-8 py-4 text-white z-40 shadow-2xl">
        <div className="flex justify-between items-center gap-4">
          <div className="flex gap-6 md:gap-10">
            {/* 服務客戶數 */}
            <div>
              <p className="text-[9px] text-neutral-400 uppercase font-black tracking-widest mb-1">
                {PERSONAL.stats.clients.label}
              </p>
              <div className="flex items-center gap-1.5">
                <Users className="text-brand-300 animate-pulse" size={15} />
                <span className="font-mono text-lg font-bold">
                  {clientCount}
                  {" "}
                  <span className="text-xs font-normal opacity-50">
                    {PERSONAL.stats.clients.unit}
                  </span>
                </span>
              </div>
            </div>
            {/* 問題提報數 */}
            <div>
              <p className="text-[9px] text-neutral-400 uppercase font-black tracking-widest mb-1">
                {PERSONAL.stats.issues.label}
              </p>
              <div className="flex items-center gap-1.5 text-brand-300">
                <AlertCircle
                  className="animate-spin"
                  style={{ animationDuration: "4s" }}
                  size={15}
                />
                <span className="font-mono text-lg font-bold">
                  {issueCount}
                  {" "}
                  <span className="text-xs font-normal opacity-50">
                    {PERSONAL.stats.issues.unit}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <a
            href={`mailto:${PERSONAL.email}`}
            className="btn-primary flex items-center gap-2 group shrink-0"
          >
            CONTACT
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </footer>

      {/* ── 裝飾性網格背景 ── */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(var(--color-warm-100) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
    </div>
  );
}
