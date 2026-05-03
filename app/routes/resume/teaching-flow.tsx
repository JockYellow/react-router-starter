import { type CSSProperties } from "react";
import { ArrowDown, ArrowRight, CalendarClock, GraduationCap, Package, Megaphone } from "lucide-react";

type NodeTone = "sales" | "teaching" | "support" | "logistics" | "execution";
type Axis = "h" | "v";
type LineTone = "main" | "info";

type FlowNode = {
  id: string;
  title: string;
  sub: string;
  tone: NodeTone;
  x: number;
  y: number;
  w: number;
  h: number;
  owner?: string;
};

type FlowLink = {
  from: string;
  to: string;
  tone: LineTone;
  axis?: Axis;
  bias?: number;
};

const CANVAS = { width: 1500, height: 860 };

const NODES: FlowNode[] = [
  {
    id: "biz_dev",
    title: "聯絡開發",
    sub: "建立合作窗口，確認開課意願",
    tone: "sales",
    x: 310,
    y: 196,
    w: 210,
    h: 112,
  },
  {
    id: "biz_promote",
    title: "宣傳招生",
    sub: "投放與招募，累積開班名單",
    tone: "sales",
    x: 550,
    y: 196,
    w: 210,
    h: 112,
  },
  {
    id: "promo_event",
    title: "宣傳活動",
    sub: "曝光與說明會",
    tone: "support",
    x: 530,
    y: 336,
    w: 190,
    h: 96,
  },
  {
    id: "teach_design",
    title: "課程設計",
    sub: "教案與學習目標定義",
    tone: "teaching",
    x: 50,
    y: 438,
    w: 210,
    h: 112,
    owner: "主責",
  },
  {
    id: "package_plan",
    title: "套裝規劃",
    sub: "組裝課程包與適用情境",
    tone: "teaching",
    x: 310,
    y: 438,
    w: 210,
    h: 112,
    owner: "主責",
  },
  {
    id: "content_review",
    title: "內容審定",
    sub: "品質檢核與版本定稿",
    tone: "teaching",
    x: 560,
    y: 438,
    w: 210,
    h: 112,
    owner: "主責",
  },
  {
    id: "prep_confirm",
    title: "開班確認",
    sub: "敲定班次與執行條件",
    tone: "sales",
    x: 810,
    y: 196,
    w: 210,
    h: 112,
  },
  {
    id: "prep_ready",
    title: "開班預備",
    sub: "課表、教具、講師整備",
    tone: "teaching",
    x: 850,
    y: 438,
    w: 210,
    h: 112,
    owner: "主責",
  },
  {
    id: "teacher",
    title: "教師",
    sub: "培訓、演練、交付標準",
    tone: "support",
    x: 1070,
    y: 292,
    w: 236,
    h: 138,
  },
  {
    id: "log_eval",
    title: "建置評估",
    sub: "清點設備與場域條件",
    tone: "logistics",
    x: 300,
    y: 658,
    w: 210,
    h: 112,
  },
  {
    id: "procure_make",
    title: "採購製作",
    sub: "備料、組裝、品質確認",
    tone: "logistics",
    x: 550,
    y: 658,
    w: 210,
    h: 112,
  },
  {
    id: "log_ship",
    title: "物流運輸",
    sub: "配送排程與到貨追蹤",
    tone: "logistics",
    x: 850,
    y: 658,
    w: 210,
    h: 112,
  },
  {
    id: "class_exec",
    title: "課程執行",
    sub: "現場授課與回收回饋",
    tone: "execution",
    x: 1300,
    y: 438,
    w: 168,
    h: 112,
    owner: "交付",
  },
];

const LINKS: FlowLink[] = [
  { from: "teach_design", to: "package_plan", tone: "main" },
  { from: "package_plan", to: "content_review", tone: "main" },
  { from: "content_review", to: "prep_ready", tone: "main" },
  { from: "prep_ready", to: "class_exec", tone: "main" },

  { from: "biz_dev", to: "biz_promote", tone: "main" },
  { from: "biz_promote", to: "prep_confirm", tone: "main" },
  { from: "biz_promote", to: "promo_event", tone: "main", axis: "v", bias: -10 },
  { from: "promo_event", to: "package_plan", tone: "main", bias: -12 },
  { from: "package_plan", to: "biz_dev", tone: "main", axis: "v", bias: -10 },

  { from: "prep_ready", to: "teacher", tone: "main", bias: 20 },
  { from: "teacher", to: "class_exec", tone: "main", bias: 12 },

  { from: "log_eval", to: "procure_make", tone: "main" },
  { from: "procure_make", to: "log_ship", tone: "main" },
  { from: "log_ship", to: "class_exec", tone: "main", bias: 24 },

  { from: "prep_confirm", to: "prep_ready", tone: "info", axis: "v" },
  { from: "prep_ready", to: "log_ship", tone: "info", axis: "v" },
  { from: "content_review", to: "log_eval", tone: "info", bias: -14 },
];

const MOBILE_PHASES = [
  {
    title: "宣傳期",
    icon: Megaphone,
    steps: ["聯絡開發", "宣傳招生", "宣傳活動", "課程設計／套裝規劃／內容審定"],
  },
  {
    title: "準備期",
    icon: CalendarClock,
    steps: ["開班確認", "開班預備", "教師培訓", "日程安排與物流銜接"],
  },
  {
    title: "課程執行",
    icon: GraduationCap,
    steps: ["物流運輸到位", "現場授課", "成效回收與下一輪優化"],
  },
];

const CHECKS = [
  { left: 164, top: 388 },
  { left: 430, top: 390 },
  { left: 688, top: 390 },
  { left: 954, top: 610 },
  { left: 1090, top: 346 },
  { left: 1392, top: 390 },
];

const nodeById = new Map(NODES.map((node) => [node.id, node]));

function pct(value: number, total: number) {
  return `${(value / total) * 100}%`;
}

function pickPorts(a: FlowNode, b: FlowNode, axis?: Axis) {
  const aCx = a.x + a.w / 2;
  const aCy = a.y + a.h / 2;
  const bCx = b.x + b.w / 2;
  const bCy = b.y + b.h / 2;
  const dx = bCx - aCx;
  const dy = bCy - aCy;
  const vertical = axis ? axis === "v" : Math.abs(dx) < Math.abs(dy);

  if (vertical) {
    return {
      start: { x: aCx, y: dy > 0 ? a.y + a.h : a.y },
      end: { x: bCx, y: dy > 0 ? b.y : b.y + b.h },
      axis: "v" as const,
    };
  }

  return {
    start: { x: dx > 0 ? a.x + a.w : a.x, y: aCy },
    end: { x: dx > 0 ? b.x : b.x + b.w, y: bCy },
    axis: "h" as const,
  };
}

function manhattanPath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  axis: Axis,
  bias = 0,
) {
  if (axis === "v") {
    const midY = (start.y + end.y) / 2 + bias;
    return `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
  }

  const midX = (start.x + end.x) / 2 + bias;
  return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
}

function buildPath(link: FlowLink) {
  const from = nodeById.get(link.from);
  const to = nodeById.get(link.to);
  if (!from || !to) return "";
  const ports = pickPorts(from, to, link.axis);
  return manhattanPath(ports.start, ports.end, ports.axis, link.bias ?? 0);
}

function nodeToneStyle(tone: NodeTone): CSSProperties {
  switch (tone) {
    case "sales":
      return {
        background: "linear-gradient(160deg, #fff9df, var(--color-brand-100, #fbefc8))",
      };
    case "teaching":
      return {
        background: "linear-gradient(160deg, #f6f9ff, var(--color-module-skills, #ddebff))",
      };
    case "support":
      return {
        background: "linear-gradient(160deg, #faf8ff, var(--color-module-about, #f6dfff))",
      };
    case "logistics":
      return {
        background: "linear-gradient(160deg, #fff5ee, var(--color-module-contact, #ffe0d9))",
      };
    case "execution":
      return {
        background: "linear-gradient(160deg, #ffffff, #ebe6fa)",
        borderColor: "rgba(107, 92, 160, 0.35)",
      };
    default:
      return {};
  }
}

function DesktopFlow() {
  return (
    <div className="relative mt-6 overflow-hidden rounded-[24px] border border-[rgba(79,101,138,0.22)] bg-[linear-gradient(160deg,rgba(255,255,255,0.9),rgba(244,248,255,0.78)),linear-gradient(90deg,rgba(63,123,210,0.08),rgba(217,180,90,0.08))] shadow-[0_18px_38px_rgba(36,52,85,0.14)] backdrop-blur-[6px]">
      <div className="relative w-full" style={{ aspectRatio: `${CANVAS.width} / ${CANVAS.height}` }}>
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
          aria-hidden
        >
          <defs>
            <marker id="tfArrowMain" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,1 L13,7 L0,13 L3.5,7 z" fill="var(--color-accent-500, #6b5ca0)" />
            </marker>
            <marker id="tfArrowInfo" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,1 L13,7 L0,13 L3.5,7 z" fill="#3f7bd2" />
            </marker>
          </defs>

          {LINKS.map((link, idx) => {
            const d = buildPath(link);
            if (!d) return null;
            return (
              <path
                key={`${link.from}-${link.to}-${idx}`}
                d={d}
                fill="none"
                stroke={link.tone === "info" ? "#3f7bd2" : "var(--color-accent-500, #6b5ca0)"}
                strokeWidth={link.tone === "info" ? 3.4 : 2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd={link.tone === "info" ? "url(#tfArrowInfo)" : "url(#tfArrowMain)"}
              />
            );
          })}
        </svg>

        <div
          className="absolute rounded-2xl border-2 border-[var(--color-accent-200,#dad3fa)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(252,251,247,0.88))] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
          style={{ left: pct(22, CANVAS.width), top: pct(22, CANVAS.height), width: pct(700, CANVAS.width), height: pct(790, CANVAS.height) }}
        >
          <div className="flex h-[11.6%] items-center justify-center border-b-2 border-[var(--color-accent-200,#dad3fa)] bg-[linear-gradient(180deg,#fff,var(--color-warm-50,#f6f5f2))] text-[clamp(18px,2.1vw,50px)] font-black tracking-[0.06em] text-[#2f4473]">
            宣傳期
          </div>
        </div>

        <div
          className="absolute rounded-2xl border-2 border-[var(--color-accent-200,#dad3fa)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(252,251,247,0.88))] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
          style={{ left: pct(748, CANVAS.width), top: pct(22, CANVAS.height), width: pct(540, CANVAS.width), height: pct(790, CANVAS.height) }}
        >
          <div className="flex h-[11.6%] items-center justify-center border-b-2 border-[var(--color-accent-200,#dad3fa)] bg-[linear-gradient(180deg,#fff,var(--color-warm-50,#f6f5f2))] text-[clamp(18px,2.1vw,50px)] font-black tracking-[0.06em] text-[#2f4473]">
            準備期
          </div>
        </div>

        <div
          className="absolute rounded-2xl border-2 border-dashed border-[rgba(107,92,160,0.45)] bg-[linear-gradient(180deg,rgba(237,232,254,0.6),rgba(255,247,225,0.45))]"
          style={{ left: pct(1312, CANVAS.width), top: pct(22, CANVAS.height), width: pct(166, CANVAS.width), height: pct(790, CANVAS.height) }}
        >
          <p className="pt-3 text-center text-[clamp(11px,0.95vw,15px)] font-bold tracking-[0.08em] text-[#5a4d89]">課程執行</p>
        </div>

        <p className="absolute font-black text-[#314a7b] [text-shadow:0_1px_0_rgba(255,255,255,0.62)] text-[clamp(14px,1.6vw,38px)]" style={{ left: pct(344, CANVAS.width), top: pct(140, CANVAS.height) }}>
          業務
        </p>
        <p className="absolute font-black text-[#314a7b] [text-shadow:0_1px_0_rgba(255,255,255,0.62)] text-[clamp(14px,1.6vw,38px)]" style={{ left: pct(80, CANVAS.width), top: pct(378, CANVAS.height) }}>
          教學部
        </p>
        <p className="absolute font-black text-[#314a7b] [text-shadow:0_1px_0_rgba(255,255,255,0.62)] text-[clamp(14px,1.6vw,38px)]" style={{ left: pct(330, CANVAS.width), top: pct(608, CANVAS.height) }}>
          物流
        </p>

        <p className="absolute rounded-[10px] border border-[rgba(122,106,174,0.22)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,245,255,0.82))] px-2.5 py-1 text-[clamp(10px,1vw,24px)] font-bold text-[#32588e] shadow-[0_6px_14px_rgba(48,63,102,0.08)]" style={{ left: pct(842, CANVAS.width), top: pct(288, CANVAS.height) }}>
          時程需求
        </p>
        <p className="absolute rounded-[10px] border border-[rgba(122,106,174,0.22)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,245,255,0.82))] px-2.5 py-1 text-[clamp(10px,1vw,24px)] font-bold text-[#32588e] shadow-[0_6px_14px_rgba(48,63,102,0.08)]" style={{ left: pct(960, CANVAS.width), top: pct(382, CANVAS.height) }}>
          教育訓練
        </p>
        <p className="absolute rounded-[10px] border border-[rgba(122,106,174,0.22)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,245,255,0.82))] px-2.5 py-1 text-[clamp(10px,1vw,24px)] font-bold text-[#32588e] shadow-[0_6px_14px_rgba(48,63,102,0.08)]" style={{ left: pct(840, CANVAS.width), top: pct(568, CANVAS.height) }}>
          日程安排
        </p>

        {NODES.map((node) => (
          <article
            key={node.id}
            className="absolute z-20 flex flex-col justify-center gap-1 rounded-[14px] border border-[rgba(79,101,138,0.26)] px-2.5 py-2 shadow-[0_6px_16px_rgba(27,41,71,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-[3px]"
            style={{
              left: pct(node.x, CANVAS.width),
              top: pct(node.y, CANVAS.height),
              width: pct(node.w, CANVAS.width),
              height: pct(node.h, CANVAS.height),
              ...nodeToneStyle(node.tone),
            }}
          >
            {node.owner && (
              <span className="absolute -top-3 right-2 rounded-full border border-[rgba(185,146,62,0.35)] bg-[linear-gradient(180deg,#fff8e7,#f8f5ff)] px-2 py-[2px] text-[clamp(8px,0.65vw,13px)] font-bold text-[var(--color-brand-600,#8b6c26)]">
                {node.owner}
              </span>
            )}
            <p className="m-0 leading-[1.1] tracking-[0.01em] text-[#2d4270] text-[clamp(10px,1.08vw,34px)] font-black">{node.title}</p>
            <p className="m-0 leading-[1.35] text-[#5b6886] text-[clamp(8px,0.68vw,19px)] font-medium">{node.sub}</p>
          </article>
        ))}

        {CHECKS.map((item, idx) => (
          <span
            key={idx}
            className="absolute z-30 font-black leading-none text-[var(--color-brand-500,#b9923e)] [text-shadow:0_4px_12px_rgba(185,146,62,0.24)] text-[clamp(16px,2.2vw,54px)]"
            style={{ left: pct(item.left, CANVAS.width), top: pct(item.top, CANVAS.height), transform: "rotate(-8deg)" }}
          >
            ✓
          </span>
        ))}
      </div>
    </div>
  );
}

function MobileFlow() {
  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-[var(--color-accent-200,#dad3fa)] bg-[linear-gradient(160deg,rgba(255,255,255,0.92),rgba(246,245,242,0.84))] p-4 shadow-[0_10px_24px_rgba(32,46,78,0.1)]">
        <p className="text-sm font-semibold text-[var(--color-accent-500,#6b5ca0)]">
          手機版採用直式流程，保留同一套節點與邏輯，不需橫向滑動。
        </p>
      </div>

      {MOBILE_PHASES.map((phase, phaseIdx) => {
        const Icon = phase.icon;
        return (
          <section
            key={phase.title}
            className="rounded-2xl border border-[var(--color-accent-200,#dad3fa)] bg-[linear-gradient(160deg,rgba(255,255,255,0.9),rgba(244,248,255,0.8))] p-4 shadow-[0_10px_22px_rgba(32,46,78,0.08)]"
          >
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand-100,#fbefc8)] text-[var(--color-accent-500,#6b5ca0)]">
                <Icon size={16} />
              </div>
              <h2 className="text-lg font-black text-[#2d4270]">{phase.title}</h2>
            </div>

            <div className="space-y-2">
              {phase.steps.map((step, idx) => (
                <div key={step}>
                  <div className="rounded-xl border border-[rgba(79,101,138,0.2)] bg-white/80 px-3 py-2 text-sm font-semibold text-[#324a79]">
                    {step}
                  </div>
                  {idx < phase.steps.length - 1 && (
                    <div className="my-1.5 flex justify-center text-[var(--color-accent-400,#7a6aae)]">
                      <ArrowDown size={14} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {phaseIdx < MOBILE_PHASES.length - 1 && (
              <div className="mt-3 flex items-center justify-center gap-1 text-xs font-semibold text-[var(--color-accent-500,#6b5ca0)]">
                下一階段
                <ArrowRight size={14} />
              </div>
            )}
          </section>
        );
      })}

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[rgba(79,101,138,0.22)] bg-[linear-gradient(160deg,rgba(255,255,255,0.9),rgba(246,245,242,0.8))] p-3">
          <h3 className="mb-1.5 text-sm font-bold text-[#37558a]">閱讀方式</h3>
          <p className="text-xs leading-relaxed text-[#596884]">紫線是主流程，藍線是時程與訓練等協調線，目標是讓跨部門交接可預測。</p>
        </div>
        <div className="rounded-xl border border-[rgba(79,101,138,0.22)] bg-[linear-gradient(160deg,rgba(255,255,255,0.9),rgba(246,245,242,0.8))] p-3">
          <h3 className="mb-1.5 text-sm font-bold text-[#37558a]">教學部價值</h3>
          <p className="text-xs leading-relaxed text-[#596884]">串接課程內容、師資準備與物流配套，確保招生成果被穩定交付為實際教學品質。</p>
        </div>
      </section>
    </div>
  );
}

export default function TeachingFlowPage() {
  return (
    <section className="mx-auto w-full max-w-[1280px] px-2 md:px-4 pb-10 pt-20">
      <header className="text-center">
        <h1 className="text-[clamp(34px,5vw,70px)] font-black leading-none tracking-[0.06em] text-[#425b93]">
          工作階段流程
        </h1>
        <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-[#54617d] md:text-base">
          以教學部為核心，串接「宣傳期、準備期、課程執行」三段流程。黑紫線代表主流程推進，藍線代表時程與訓練協調。
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
          <span className="rounded-full border border-[var(--color-accent-200,#dad3fa)] bg-[linear-gradient(180deg,#f8f5ff,#fff)] px-2.5 py-1 text-[var(--color-accent-500,#6b5ca0)]">教學部主責</span>
          <span className="rounded-full border border-[var(--color-accent-200,#dad3fa)] bg-[linear-gradient(180deg,#f8f5ff,#fff)] px-2.5 py-1 text-[var(--color-accent-500,#6b5ca0)]">業務協作</span>
          <span className="rounded-full border border-[var(--color-accent-200,#dad3fa)] bg-[linear-gradient(180deg,#f8f5ff,#fff)] px-2.5 py-1 text-[var(--color-accent-500,#6b5ca0)]">教師訓練</span>
          <span className="rounded-full border border-[var(--color-accent-200,#dad3fa)] bg-[linear-gradient(180deg,#f8f5ff,#fff)] px-2.5 py-1 text-[var(--color-accent-500,#6b5ca0)]">物流配套</span>
        </div>
      </header>

      <div className="hidden lg:block">
        <DesktopFlow />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[rgba(79,101,138,0.22)] bg-[linear-gradient(160deg,rgba(255,255,255,0.88),rgba(246,245,242,0.78))] p-3 shadow-[0_8px_20px_rgba(30,43,72,0.08)]">
            <h3 className="mb-1.5 text-sm font-bold text-[#37558a]">閱讀方式</h3>
            <p className="text-xs leading-relaxed text-[#596884]">黑紫線是主流程，藍線是時程、訓練與日程等協調資訊。</p>
          </div>
          <div className="rounded-xl border border-[rgba(79,101,138,0.22)] bg-[linear-gradient(160deg,rgba(255,255,255,0.88),rgba(246,245,242,0.78))] p-3 shadow-[0_8px_20px_rgba(30,43,72,0.08)]">
            <h3 className="mb-1.5 text-sm font-bold text-[#37558a]">教學部價值</h3>
            <p className="text-xs leading-relaxed text-[#596884]">把課程內容、教師準備與物流落地串成可複製的交付系統。</p>
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <MobileFlow />
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[var(--color-accent-500,#6b5ca0)] lg:hidden">
        <Package size={14} />
        流程已針對小螢幕改為直式顯示
      </div>
    </section>
  );
}
