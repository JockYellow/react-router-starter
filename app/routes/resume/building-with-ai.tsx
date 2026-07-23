import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  CircleUserRound,
  Cloud,
  Code2,
  Network,
  PlugZap,
  Rocket,
  ServerCog,
  ShieldCheck,
  Sparkles,
  TestTube2,
  Wrench,
  X,
} from "lucide-react";

export function meta() {
  return [
    { title: "從需求到實作｜我如何與 AI 一起建立個人網站" },
    {
      name: "description",
      content: "從架構選擇、雲端申請到大量功能實作：我如何透過 AI 協作持續學習、串接與拓展個人網站。",
    },
  ];
}

const CORE_CAPABILITIES = [
  {
    icon: Network,
    title: "把需求架構化",
    text: "從使用情境開始，判斷資料放哪裡、誰能操作、要同步還是非同步，以及如何安全上線。",
  },
  {
    icon: Bot,
    title: "讓 AI 進入執行流程",
    text: "我提供現況、限制與驗收條件，讓 AI 協助讀碼、拆解、實作與測試；架構與最後決策仍由我負責。",
  },
  {
    icon: PlugZap,
    title: "遇到新需求就學習拓展",
    text: "需要資料庫、媒體儲存、API 授權或外部服務時，我會理解新的轉接方式，再把它接進既有系統。",
  },
];

const DELIVERY_FLOW = [
  { icon: Sparkles, label: "發想需求" },
  { icon: Network, label: "選擇架構" },
  { icon: CircleUserRound, label: "人工申請設定" },
  { icon: Code2, label: "AI 協作實作" },
  { icon: TestTube2, label: "實際驗證" },
  { icon: Rocket, label: "部署與迭代" },
];

const PHASES = [
  {
    id: "foundation",
    number: "01",
    title: "從零架站",
    short: "先建立能本機開發、正式建置與公開部署的基礎。",
    tags: ["React Router SSR", "Cloudflare Workers", "TypeScript"],
    decision:
      "我需要的不是單一靜態頁，而是一個未來能加入後台、資料與互動功能的平台。因此選擇 React Router SSR，並以 Cloudflare Worker 同時承接頁面與伺服器邏輯。",
    manual:
      "我親自完成 Cloudflare 帳號登入與授權、確認 Worker 專案與正式網址，執行第一次部署並在公開環境驗證。",
    ai:
      "我先要求 AI 讀懂 starter 的檔案與部署關係，再分段調整入口、路由、樣式與指令；每次修改都必須通過 build，而不是只交付程式碼。",
    result: "建立可重複的本機開發 → 正式建置 → Worker 部署路線。",
  },
  {
    id: "data",
    number: "02",
    title: "把內容變成系統",
    short: "從寫死頁面，逐步加入資料庫、後台與媒體儲存。",
    tags: ["Cloudflare D1", "Cloudflare R2", "Migration"],
    decision:
      "內容尚未穩定時先用檔案驗證；需要線上新增、修改與查詢後，再把結構化資料交給 D1、媒體檔案交給 R2，避免所有責任混在一起。",
    manual:
      "我建立 D1 database 與 R2 bucket、取得資源 ID、決定 binding 名稱、設定公開範圍與 secret，再親自執行遠端 schema 和資料遷移。",
    ai:
      "我把既有資料、欄位規則、binding 與不可遺失的內容交給 AI，讓它建立資料存取、migration、上傳與後台操作；我再用實際資料逐筆確認。",
    result: "網站從內容展示升級成可以登入管理、保存資料與處理媒體的系統。",
  },
  {
    id: "tools",
    number: "03",
    title: "從個人需求持續發想工具",
    short: "將生活與工作中的想法，做成真正可使用的同步與非同步功能。",
    tags: ["同步互動", "非同步流程", "External APIs"],
    decision:
      "我不先為了技術而找題目，而是從自己或朋友的使用情境出發，再判斷需要即時共享狀態、非同步整理資料、外部 API，還是單純在瀏覽器完成。",
    manual:
      "我定義使用規則、例外與操作順序，準備測試資料；遇到第三方服務時，親自建立 Developer App、設定 callback、完成授權並管理 secret。",
    ai:
      "AI 協助把規則轉成狀態、路由、資料表與介面。我用真實操作和反例測試，持續修正到功能能被使用，而不是停在展示畫面。",
    result: "個人想法能持續轉化成獨立功能，也能在既有架構上學習新的串接方式。",
  },
  {
    id: "operation",
    number: "04",
    title: "維持拓展與可運作性",
    short: "功能增加後，仍保留安全修改、資料同步與再次部署的能力。",
    tags: ["Build verification", "Security", "Observability"],
    decision:
      "真正的完成不是畫面出現，而是之後還能修改。我把功能拆成 route、feature 與資料層，並建立 build、migration、同步與安全檢查。",
    manual:
      "我決定何時備份與執行遠端 migration，檢查正式環境和 log，並保留帳號操作、資料變更與發布的最後確認權。",
    ai:
      "AI 負責讀取差異與錯誤、執行低風險檢查、提出局部修正並做回歸驗證；我確保它不覆蓋既有資料與無關修改。",
    result: "網站能在面對新需求時持續增加功能，而不是每次都重新開始。",
  },
];

type Phase = (typeof PHASES)[number];

const SCALE = [
  { value: "71", label: "Route modules" },
  { value: "10", label: "Feature domains" },
  { value: "49", label: "版本節點" },
];

function PhaseModal({ phase, onClose }: { phase: Phase; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phase-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[1.75rem] border border-white/20 bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 p-5 backdrop-blur md:p-7">
          <div>
            <p className="mb-1 font-mono text-xs font-black tracking-[0.18em] text-accent-500">PHASE {phase.number}</p>
            <h2 id="phase-modal-title" className="text-xl font-black text-slate-950 md:text-2xl">{phase.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="關閉階段細節">
            <X size={18} />
          </button>
        </header>
        <div className="grid gap-4 p-5 md:p-7">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900"><Network size={15} />我的判斷</p>
            <p className="text-sm leading-7 text-slate-600">{phase.decision}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-brand-100 bg-brand-50/65 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-black text-brand-700"><Wrench size={15} />我親自操作</p>
              <p className="text-sm leading-7 text-slate-600">{phase.manual}</p>
            </div>
            <div className="rounded-2xl border border-accent-100 bg-accent-50/65 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-black text-accent-700"><Bot size={15} />我如何與 AI 協作</p>
              <p className="text-sm leading-7 text-slate-600">{phase.ai}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
            <Rocket size={14} className="mr-2 inline" /><strong>形成的能力：</strong>{phase.result}
          </div>
          <div className="flex flex-wrap gap-2">{phase.tags.map((tag) => <span key={tag} className="chip text-[11px]">{tag}</span>)}</div>
        </div>
      </div>
    </div>
  );
}

export default function BuildingWithAiPage() {
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);

  return (
    <main className="mx-auto -mt-28 w-full max-w-[1100px] px-3 pb-16 pt-16 text-slate-900 md:-mt-28 md:px-6 md:pt-16">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_22px_65px_rgba(37,55,86,0.12)] backdrop-blur md:p-8">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand-200/60 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-accent-200/45 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50/80 px-3 py-1 text-[10px] font-black tracking-[0.16em] text-accent-600">
              <ServerCog size={12} /> FROM IDEA TO WORKING PRODUCT
            </div>
            <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-950 md:text-5xl">
              我把新需求，<span className="text-accent-500">變成能實際運作的功能</span>
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
              我從零選擇網站架構、完成雲端申請，並透過與 AI 協作進行大量實作。面對新的需求，我能學習資料儲存、API 授權與不同轉接方式，把個人用途的發想持續做成可使用、可拓展的同步與非同步功能。
            </p>
          </div>
          <div className="flex gap-2 lg:grid lg:grid-cols-3">
            {SCALE.map((item) => (
              <div key={item.label} className="min-w-0 flex-1 rounded-xl border border-white bg-white/80 px-3 py-2 shadow-sm lg:min-w-24">
                <p className="font-mono text-lg font-black text-slate-950">{item.value}</p>
                <p className="truncate text-[10px] font-semibold text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 py-4 md:grid-cols-3">
        {CORE_CAPABILITIES.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-600"><Icon size={16} /></div>
                <h2 className="font-black text-slate-950">{item.title}</h2>
              </div>
              <p className="text-xs leading-5 text-slate-600">{item.text}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black tracking-[0.18em] text-brand-300">MY DELIVERY FLOW</p>
            <h2 className="mt-1 font-black">從想法到上線，我負責把每一棒接起來</h2>
          </div>
          <Link to="/resume" className="hidden shrink-0 text-xs font-bold text-slate-300 hover:text-white sm:inline">回到履歷 →</Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {DELIVERY_FLOW.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="relative rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5">
                <div className="flex items-center gap-2"><Icon size={14} className="text-brand-300" /><span className="text-xs font-bold">{item.label}</span></div>
                {index < DELIVERY_FLOW.length - 1 && <ArrowRight size={12} className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-brand-300 lg:block" />}
              </div>
            );
          })}
        </div>
      </section>

      <section className="py-4">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black tracking-[0.18em] text-accent-500">FOUR BUILDING PHASES</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">四個階段看完建站能力，點擊再看細節</h2>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PHASES.map((phase) => (
            <button key={phase.id} type="button" aria-label={`查看${phase.title}細節`} onClick={() => setSelectedPhase(phase)} className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-md">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-xs font-black text-accent-500">PHASE {phase.number}</span>
                <ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-accent-500" />
              </div>
              <h3 className="font-black text-slate-950">{phase.title}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-500">{phase.short}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
            <span className="flex items-center gap-2 text-sm font-black text-slate-950"><Cloud size={16} className="text-accent-500" />我親自完成哪些申請與設定？</span>
            <ChevronDown size={16} className="text-slate-400 transition group-open:rotate-180" />
          </summary>
          <div className="grid gap-2 border-t border-slate-100 p-4 text-xs leading-6 text-slate-600 sm:grid-cols-2">
            {[
              "Cloudflare 帳號授權、Worker 建立與正式網址驗證",
              "D1 database、R2 bucket、binding 與遠端 migration",
              "Developer App、callback URL、第三方 OAuth 授權",
              "secret 管理、公開範圍、正式資料與部署確認",
            ].map((item) => <p key={item} className="flex items-start gap-2"><Check size={13} className="mt-1 shrink-0 text-brand-500" />{item}</p>)}
          </div>
        </details>

        <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
            <span className="flex items-center gap-2 text-sm font-black text-slate-950"><Bot size={16} className="text-accent-500" />我提供什麼，讓 AI 能真正完成？</span>
            <ChevronDown size={16} className="text-slate-400 transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-slate-100 p-4">
            <div className="grid gap-2 text-xs leading-6 text-slate-600 sm:grid-cols-2">
              {[
                "既有架構、route、資料來源與不可破壞的內容",
                "binding 名稱、schema、API 回傳格式，但不提供 secret",
                "實際使用流程、例外、同步方式與驗收條件",
                "完整錯誤 log、操作步驟與最後成功版本",
              ].map((item) => <p key={item} className="flex items-start gap-2"><Check size={13} className="mt-1 shrink-0 text-brand-500" />{item}</p>)}
            </div>
            <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800"><ShieldCheck size={13} className="mr-1 inline" />帳號授權、secret、遠端資料變更與正式發布，始終保留人工確認。</p>
          </div>
        </details>
      </section>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent-100 bg-accent-50/70 px-4 py-3">
        <p className="max-w-3xl text-xs leading-5 text-slate-600">
          <strong className="text-slate-950">真正的成果：</strong>我能透過 AI 快速跨進陌生技術，並把新的資料、授權、儲存與互動需求整合成可持續運作的功能。
        </p>
        <Link to="/resume" className="btn-primary shrink-0 gap-2 text-xs">回到履歷 <ArrowRight size={13} /></Link>
      </footer>

      {selectedPhase && <PhaseModal phase={selectedPhase} onClose={() => setSelectedPhase(null)} />}
    </main>
  );
}
