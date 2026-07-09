import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  Gauge,
  Globe2,
  MousePointerClick,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type HealthStatus = "healthy" | "watch" | "attention";
type StatusFilter = "all" | HealthStatus;
type SortOption = "default" | "scoreAsc" | "qaAsc" | "wowAsc" | "safetyDesc" | "kbDesc" | "kioskAsc";

type CustomerHealthInput = {
  name: string;
  scene: string;
  qaCount: number;
  wowChange: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  safetyTriggerRate: number;
  kbLastUpdatedDays: number;
  kbItems: number;
  kioskMenuClicks: number;
  kioskCategoryClicks: number;
  kioskLinkClicks: number;
  primaryLanguage: string;
};

type CustomerHealth = CustomerHealthInput & {
  score: number;
  status: HealthStatus;
  reason: string;
};

type WeeklyUsagePoint = {
  week: string;
  qa: number;
  safety: number;
  kiosk: number;
};

type KioskClickBreakdown = {
  name: string;
  value: number;
  fill: string;
};

type LanguageShare = {
  name: string;
  value: number;
  fill: string;
};

const HEALTH_ROUTE = "/resume/ai-health-dashboard";

const weeklyUsage: WeeklyUsagePoint[] = [
  { week: "前 7 週", qa: 1820, safety: 132, kiosk: 940 },
  { week: "前 6 週", qa: 1965, safety: 118, kiosk: 1028 },
  { week: "前 5 週", qa: 2140, safety: 126, kiosk: 1104 },
  { week: "前 4 週", qa: 1884, safety: 149, kiosk: 972 },
  { week: "前 3 週", qa: 2308, safety: 136, kiosk: 1232 },
  { week: "前 2 週", qa: 2486, safety: 141, kiosk: 1308 },
  { week: "前 1 週", qa: 2194, safety: 168, kiosk: 1196 },
  { week: "本週", qa: 2368, safety: 154, kiosk: 1284 },
];

const customerInputs: CustomerHealthInput[] = [
  { name: "松森百貨", scene: "百貨公司", qaCount: 284, wowChange: 18, avgInputTokens: 248, avgOutputTokens: 612, safetyTriggerRate: 4.8, kbLastUpdatedDays: 3, kbItems: 842, kioskMenuClicks: 218, kioskCategoryClicks: 132, kioskLinkClicks: 74, primaryLanguage: "中文" },
  { name: "東岸動物園", scene: "動物園", qaCount: 46, wowChange: -68, avgInputTokens: 318, avgOutputTokens: 988, safetyTriggerRate: 15.6, kbLastUpdatedDays: 28, kbItems: 416, kioskMenuClicks: 62, kioskCategoryClicks: 44, kioskLinkClicks: 12, primaryLanguage: "中文" },
  { name: "北城車站", scene: "車站", qaCount: 18, wowChange: -42, avgInputTokens: 402, avgOutputTokens: 734, safetyTriggerRate: 10.4, kbLastUpdatedDays: 16, kbItems: 308, kioskMenuClicks: 25, kioskCategoryClicks: 18, kioskLinkClicks: 6, primaryLanguage: "中文" },
  { name: "河港轉運中心", scene: "車站", qaCount: 132, wowChange: 6, avgInputTokens: 236, avgOutputTokens: 548, safetyTriggerRate: 3.2, kbLastUpdatedDays: 5, kbItems: 502, kioskMenuClicks: 110, kioskCategoryClicks: 96, kioskLinkClicks: 38, primaryLanguage: "中文" },
  { name: "城市探索館", scene: "展館", qaCount: 92, wowChange: 104, avgInputTokens: 456, avgOutputTokens: 908, safetyTriggerRate: 8.8, kbLastUpdatedDays: 9, kbItems: 274, kioskMenuClicks: 88, kioskCategoryClicks: 54, kioskLinkClicks: 28, primaryLanguage: "英文" },
  { name: "南灣服務中心", scene: "公部門服務中心", qaCount: 156, wowChange: 12, avgInputTokens: 264, avgOutputTokens: 654, safetyTriggerRate: 5.6, kbLastUpdatedDays: 7, kbItems: 620, kioskMenuClicks: 0, kioskCategoryClicks: 0, kioskLinkClicks: 0, primaryLanguage: "中文" },
  { name: "晴川百貨", scene: "百貨公司", qaCount: 312, wowChange: 8, avgInputTokens: 216, avgOutputTokens: 520, safetyTriggerRate: 2.8, kbLastUpdatedDays: 2, kbItems: 918, kioskMenuClicks: 246, kioskCategoryClicks: 174, kioskLinkClicks: 95, primaryLanguage: "中文" },
  { name: "山線遊客中心", scene: "展館", qaCount: 67, wowChange: -55, avgInputTokens: 374, avgOutputTokens: 962, safetyTriggerRate: 13.4, kbLastUpdatedDays: 23, kbItems: 338, kioskMenuClicks: 42, kioskCategoryClicks: 30, kioskLinkClicks: 9, primaryLanguage: "日文" },
  { name: "海洋教育館", scene: "展館", qaCount: 118, wowChange: -12, avgInputTokens: 252, avgOutputTokens: 610, safetyTriggerRate: 4.1, kbLastUpdatedDays: 6, kbItems: 454, kioskMenuClicks: 72, kioskCategoryClicks: 88, kioskLinkClicks: 33, primaryLanguage: "中文" },
  { name: "星橋商場", scene: "百貨公司", qaCount: 209, wowChange: 31, avgInputTokens: 286, avgOutputTokens: 702, safetyTriggerRate: 6.4, kbLastUpdatedDays: 10, kbItems: 701, kioskMenuClicks: 164, kioskCategoryClicks: 128, kioskLinkClicks: 51, primaryLanguage: "中文" },
  { name: "中央市民服務站", scene: "公部門服務中心", qaCount: 24, wowChange: -18, avgInputTokens: 222, avgOutputTokens: 498, safetyTriggerRate: 7.2, kbLastUpdatedDays: 31, kbItems: 188, kioskMenuClicks: 0, kioskCategoryClicks: 0, kioskLinkClicks: 0, primaryLanguage: "中文" },
  { name: "花園動物園", scene: "動物園", qaCount: 174, wowChange: 14, avgInputTokens: 304, avgOutputTokens: 681, safetyTriggerRate: 5.2, kbLastUpdatedDays: 4, kbItems: 594, kioskMenuClicks: 142, kioskCategoryClicks: 103, kioskLinkClicks: 47, primaryLanguage: "中文" },
  { name: "西門旅運站", scene: "車站", qaCount: 86, wowChange: -7, avgInputTokens: 264, avgOutputTokens: 604, safetyTriggerRate: 6.8, kbLastUpdatedDays: 13, kbItems: 402, kioskMenuClicks: 58, kioskCategoryClicks: 61, kioskLinkClicks: 24, primaryLanguage: "中文" },
  { name: "環河百貨", scene: "百貨公司", qaCount: 256, wowChange: -4, avgInputTokens: 258, avgOutputTokens: 742, safetyTriggerRate: 5.8, kbLastUpdatedDays: 8, kbItems: 812, kioskMenuClicks: 202, kioskCategoryClicks: 148, kioskLinkClicks: 68, primaryLanguage: "中文" },
  { name: "港都動物園", scene: "動物園", qaCount: 39, wowChange: 118, avgInputTokens: 512, avgOutputTokens: 1124, safetyTriggerRate: 16.8, kbLastUpdatedDays: 19, kbItems: 268, kioskMenuClicks: 34, kioskCategoryClicks: 26, kioskLinkClicks: 8, primaryLanguage: "韓文" },
  { name: "北區行政服務中心", scene: "公部門服務中心", qaCount: 141, wowChange: 5, avgInputTokens: 226, avgOutputTokens: 544, safetyTriggerRate: 3.7, kbLastUpdatedDays: 6, kbItems: 536, kioskMenuClicks: 0, kioskCategoryClicks: 0, kioskLinkClicks: 0, primaryLanguage: "中文" },
  { name: "雨林探索館", scene: "展館", qaCount: 112, wowChange: 16, avgInputTokens: 312, avgOutputTokens: 766, safetyTriggerRate: 7.9, kbLastUpdatedDays: 11, kbItems: 444, kioskMenuClicks: 93, kioskCategoryClicks: 64, kioskLinkClicks: 35, primaryLanguage: "英文" },
  { name: "東門車站", scene: "車站", qaCount: 73, wowChange: -61, avgInputTokens: 338, avgOutputTokens: 704, safetyTriggerRate: 9.6, kbLastUpdatedDays: 18, kbItems: 351, kioskMenuClicks: 44, kioskCategoryClicks: 39, kioskLinkClicks: 14, primaryLanguage: "中文" },
  { name: "曙光百貨", scene: "百貨公司", qaCount: 334, wowChange: 21, avgInputTokens: 244, avgOutputTokens: 588, safetyTriggerRate: 3.1, kbLastUpdatedDays: 1, kbItems: 946, kioskMenuClicks: 258, kioskCategoryClicks: 191, kioskLinkClicks: 104, primaryLanguage: "中文" },
  { name: "林間遊客中心", scene: "展館", qaCount: 12, wowChange: -76, avgInputTokens: 292, avgOutputTokens: 836, safetyTriggerRate: 12.6, kbLastUpdatedDays: 35, kbItems: 194, kioskMenuClicks: 16, kioskCategoryClicks: 10, kioskLinkClicks: 4, primaryLanguage: "中文" },
  { name: "南島交通館", scene: "車站", qaCount: 98, wowChange: 9, avgInputTokens: 248, avgOutputTokens: 636, safetyTriggerRate: 4.9, kbLastUpdatedDays: 12, kbItems: 428, kioskMenuClicks: 81, kioskCategoryClicks: 52, kioskLinkClicks: 19, primaryLanguage: "中文" },
  { name: "竹城服務中心", scene: "公部門服務中心", qaCount: 63, wowChange: -24, avgInputTokens: 278, avgOutputTokens: 674, safetyTriggerRate: 8.2, kbLastUpdatedDays: 22, kbItems: 286, kioskMenuClicks: 0, kioskCategoryClicks: 0, kioskLinkClicks: 0, primaryLanguage: "中文" },
  { name: "大樹動物園", scene: "動物園", qaCount: 187, wowChange: 26, avgInputTokens: 306, avgOutputTokens: 718, safetyTriggerRate: 5.5, kbLastUpdatedDays: 5, kbItems: 642, kioskMenuClicks: 151, kioskCategoryClicks: 111, kioskLinkClicks: 42, primaryLanguage: "中文" },
  { name: "北環百貨", scene: "百貨公司", qaCount: 149, wowChange: -9, avgInputTokens: 352, avgOutputTokens: 916, safetyTriggerRate: 11.2, kbLastUpdatedDays: 17, kbItems: 576, kioskMenuClicks: 128, kioskCategoryClicks: 83, kioskLinkClicks: 36, primaryLanguage: "中文" },
  { name: "星野展覽中心", scene: "展館", qaCount: 221, wowChange: 44, avgInputTokens: 274, avgOutputTokens: 622, safetyTriggerRate: 4.5, kbLastUpdatedDays: 4, kbItems: 588, kioskMenuClicks: 177, kioskCategoryClicks: 98, kioskLinkClicks: 61, primaryLanguage: "英文" },
  { name: "西港車站", scene: "車站", qaCount: 54, wowChange: -14, avgInputTokens: 268, avgOutputTokens: 588, safetyTriggerRate: 6.7, kbLastUpdatedDays: 14, kbItems: 302, kioskMenuClicks: 37, kioskCategoryClicks: 29, kioskLinkClicks: 11, primaryLanguage: "中文" },
  { name: "文山公民中心", scene: "公部門服務中心", qaCount: 101, wowChange: 11, avgInputTokens: 232, avgOutputTokens: 514, safetyTriggerRate: 3.8, kbLastUpdatedDays: 6, kbItems: 478, kioskMenuClicks: 0, kioskCategoryClicks: 0, kioskLinkClicks: 0, primaryLanguage: "中文" },
  { name: "湖景商場", scene: "百貨公司", qaCount: 194, wowChange: -5, avgInputTokens: 286, avgOutputTokens: 692, safetyTriggerRate: 6.2, kbLastUpdatedDays: 9, kbItems: 664, kioskMenuClicks: 158, kioskCategoryClicks: 118, kioskLinkClicks: 46, primaryLanguage: "中文" },
  { name: "海線轉運站", scene: "車站", qaCount: 7, wowChange: -83, avgInputTokens: 414, avgOutputTokens: 804, safetyTriggerRate: 14.8, kbLastUpdatedDays: 40, kbItems: 172, kioskMenuClicks: 9, kioskCategoryClicks: 8, kioskLinkClicks: 2, primaryLanguage: "中文" },
  { name: "光谷科教館", scene: "展館", qaCount: 126, wowChange: 19, avgInputTokens: 298, avgOutputTokens: 692, safetyTriggerRate: 6.1, kbLastUpdatedDays: 10, kbItems: 522, kioskMenuClicks: 96, kioskCategoryClicks: 71, kioskLinkClicks: 26, primaryLanguage: "日文" },
];

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function kioskTotal(customer: Pick<CustomerHealthInput, "kioskMenuClicks" | "kioskCategoryClicks" | "kioskLinkClicks">) {
  return customer.kioskMenuClicks + customer.kioskCategoryClicks + customer.kioskLinkClicks;
}

function calculateHealthScore(customer: CustomerHealthInput) {
  const usageScore = customer.qaCount < 20 ? 22 : clamp(100 - Math.abs(customer.wowChange) * 0.7);
  const kbScore = clamp(100 - customer.kbLastUpdatedDays * 3);
  const safetyScore = clamp(100 - customer.safetyTriggerRate * 6);
  const kioskScore = kioskTotal(customer) === 0 ? 70 : clamp((kioskTotal(customer) / 180) * 100);
  return Math.round(usageScore * 0.35 + kbScore * 0.25 + safetyScore * 0.25 + kioskScore * 0.15);
}

function getStatus(customer: CustomerHealthInput, score: number): Pick<CustomerHealth, "status" | "reason"> {
  if (customer.qaCount < 20 || customer.kbLastUpdatedDays > 21 || customer.safetyTriggerRate > 12) {
    return { status: "attention", reason: "低用量、KB 維運或安全詞需關心" };
  }
  if (
    customer.wowChange <= -50 ||
    customer.wowChange >= 100 ||
    customer.avgOutputTokens > 900 ||
    customer.avgInputTokens > 450 ||
    score < 72
  ) {
    return { status: "watch", reason: "週變化或 token 指標需觀察" };
  }
  return { status: "healthy", reason: "用量與維運節奏穩定" };
}

const statusRank: Record<HealthStatus, number> = { attention: 0, watch: 1, healthy: 2 };

const customers: CustomerHealth[] = customerInputs
  .map((customer) => {
    const score = calculateHealthScore(customer);
    return { ...customer, score, ...getStatus(customer, score) };
  })
  .sort((a, b) => {
    return statusRank[a.status] - statusRank[b.status] || a.score - b.score;
  });

const totals = customers.reduce(
  (acc, customer) => {
    acc.qa += customer.qaCount;
    acc.input += customer.avgInputTokens;
    acc.output += customer.avgOutputTokens;
    acc.safety += customer.safetyTriggerRate;
    acc.kbDays += customer.kbLastUpdatedDays;
    acc.kioskMenu += customer.kioskMenuClicks;
    acc.kioskCategory += customer.kioskCategoryClicks;
    acc.kioskLink += customer.kioskLinkClicks;
    return acc;
  },
  { qa: 0, input: 0, output: 0, safety: 0, kbDays: 0, kioskMenu: 0, kioskCategory: 0, kioskLink: 0 },
);

const attentionCount = customers.filter((customer) => customer.status === "attention").length;

const kioskBreakdown: KioskClickBreakdown[] = [
  { name: "菜單式內容點擊", value: totals.kioskMenu, fill: "#2563eb" },
  { name: "類別點擊", value: totals.kioskCategory, fill: "#0f766e" },
  { name: "額外連結點擊", value: totals.kioskLink, fill: "#b45309" },
];

const languageShare: LanguageShare[] = [
  { name: "中文", value: customers.filter((customer) => customer.primaryLanguage === "中文").length, fill: "#2563eb" },
  { name: "英文", value: customers.filter((customer) => customer.primaryLanguage === "英文").length, fill: "#0f766e" },
  { name: "日文", value: customers.filter((customer) => customer.primaryLanguage === "日文").length, fill: "#7c3aed" },
  { name: "韓文", value: customers.filter((customer) => customer.primaryLanguage === "韓文").length, fill: "#b45309" },
];

const scenes = Array.from(new Set(customers.map((customer) => customer.scene)));

const statusFilters: { label: string; value: StatusFilter }[] = [
  { label: "全部狀態", value: "all" },
  { label: "需關心", value: "attention" },
  { label: "觀察", value: "watch" },
  { label: "健康", value: "healthy" },
];

const sortOptions: { label: string; value: SortOption }[] = [
  { label: "需關心優先", value: "default" },
  { label: "健康度低到高", value: "scoreAsc" },
  { label: "QA 低到高", value: "qaAsc" },
  { label: "週減少最多", value: "wowAsc" },
  { label: "安全詞高到低", value: "safetyDesc" },
  { label: "KB 最久未更新", value: "kbDesc" },
  { label: "機台點擊低到高", value: "kioskAsc" },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-TW").format(value);
}

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(0)}%`;
}

function statusLabel(status: HealthStatus) {
  if (status === "attention") return "需關心";
  if (status === "watch") return "觀察";
  return "健康";
}

function statusClass(status: HealthStatus) {
  if (status === "attention") return "border-red-200 bg-red-50 text-red-700";
  if (status === "watch") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function statusIcon(status: HealthStatus) {
  if (status === "attention") return AlertTriangle;
  if (status === "watch") return ShieldAlert;
  return CheckCircle2;
}

function compareCustomers(a: CustomerHealth, b: CustomerHealth, sortOption: SortOption) {
  if (sortOption === "scoreAsc") return a.score - b.score;
  if (sortOption === "qaAsc") return a.qaCount - b.qaCount;
  if (sortOption === "wowAsc") return a.wowChange - b.wowChange;
  if (sortOption === "safetyDesc") return b.safetyTriggerRate - a.safetyTriggerRate;
  if (sortOption === "kbDesc") return b.kbLastUpdatedDays - a.kbLastUpdatedDays;
  if (sortOption === "kioskAsc") return kioskTotal(a) - kioskTotal(b);
  return statusRank[a.status] - statusRank[b.status] || a.score - b.score;
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const Icon = statusIcon(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(status)}`}>
      <Icon size={12} />
      {statusLabel(status)}
    </span>
  );
}

function DetailStat({
  label,
  value,
  note,
  tone = "slate",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "slate" | "blue" | "red" | "amber" | "green";
}) {
  const toneClass = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    red: "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  }[tone];

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-xs font-bold tracking-[0.12em] text-current opacity-70">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
      <p className="mt-1 text-xs leading-relaxed opacity-80">{note}</p>
    </div>
  );
}

function customerDetailText(customer: CustomerHealth) {
  if (customer.status === "attention") {
    return "這類專案通常需要先確認資料來源是否正常，再判斷是否要聯繫客戶。若 QA 低、KB 久未更新或安全詞偏高，優先回看知識庫內容與常見問題缺口。";
  }
  if (customer.status === "watch") {
    return "這類專案還不到需要立即處理，但週變化、token 或安全詞已經出現訊號。適合列入下週追蹤，避免短期活動流量或 prompt 異常被誤判。";
  }
  return "這類專案的使用量、KB 維運和安全詞比例相對穩定，可以作為同場景客戶的基準參考。";
}

function CustomerDetailModal({
  customer,
  onClose,
}: {
  customer: CustomerHealth | null;
  onClose: () => void;
}) {
  if (!customer) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-3 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={customer.status} />
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-500">
                {customer.scene} · {customer.primaryLanguage}
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-950">{customer.name}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">{customer.reason}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
            aria-label="關閉客戶明細"
          >
            <X size={17} />
          </button>
        </div>

        <div className="max-h-[calc(92vh-112px)] overflow-y-auto p-5">
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DetailStat
              label="問答使用量"
              value={`${formatNumber(customer.qaCount)} 句`}
              note={`週變化 ${formatPercent(customer.wowChange)}，用於判斷是否低用量或突然異動。`}
              tone={customer.qaCount < 20 || customer.wowChange <= -50 ? "red" : customer.wowChange >= 100 ? "amber" : "blue"}
            />
            <DetailStat
              label="平均 Token"
              value={`${customer.avgInputTokens} / ${customer.avgOutputTokens}`}
              note="input / output。單句過高時，通常要檢查 KB 內容粒度或 prompt 回答規則。"
              tone={customer.avgOutputTokens > 900 || customer.avgInputTokens > 450 ? "amber" : "slate"}
            />
            <DetailStat
              label="安全詞觸發"
              value={`${customer.safetyTriggerRate.toFixed(1)}%`}
              note="固定拒答或不知道台詞的命中比例，用來觀察回答不了或被亂用的狀況。"
              tone={customer.safetyTriggerRate > 12 ? "red" : "green"}
            />
            <DetailStat
              label="知識庫維運"
              value={`${customer.kbLastUpdatedDays} 天`}
              note={`${formatNumber(customer.kbItems)} 筆內容；超過 21 天未更新會被標成維運偏低。`}
              tone={customer.kbLastUpdatedDays > 21 ? "red" : "green"}
            />
            <DetailStat
              label="GA 點擊"
              value={`${formatNumber(kioskTotal(customer))} 次`}
              note="從 GA 事件撈取，不是自建事件收集系統。"
              tone={kioskTotal(customer) > 0 ? "blue" : "slate"}
            />
            <DetailStat
              label="健康度"
              value={`${customer.score} 分`}
              note="使用量穩定度、KB 維運、安全詞與 kiosk 互動加權後的快速分數。"
              tone={customer.status === "attention" ? "red" : customer.status === "watch" ? "amber" : "green"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-950">機台點擊拆解</h3>
              <div className="space-y-3">
                {[
                  ["菜單式內容點擊", customer.kioskMenuClicks],
                  ["類別點擊", customer.kioskCategoryClicks],
                  ["額外連結點擊", customer.kioskLinkClicks],
                ].map(([label, value]) => {
                  const numericValue = Number(value);
                  const max = Math.max(customer.kioskMenuClicks, customer.kioskCategoryClicks, customer.kioskLinkClicks, 1);
                  return (
                    <div key={label}>
                      <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
                        <span>{label}</span>
                        <span>{formatNumber(numericValue)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${(numericValue / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-bold text-slate-950">個別情況說明</h3>
              <p className="text-sm leading-relaxed text-slate-600">{customerDetailText(customer)}</p>
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">
                問答、token、語言、安全詞與知識庫維護資料是假設透過登入 cookie 取得權限後，逐專案呼叫既有網頁 API 擷取；機台點擊則來自 GA event。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AiHealthDashboardPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerHealth | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sceneFilter, setSceneFilter] = useState("all");
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const filteredCustomers = useMemo(
    () => {
      const matchedCustomers = customers.filter((customer) => {
        const statusMatch = statusFilter === "all" || customer.status === statusFilter;
        const sceneMatch = sceneFilter === "all" || customer.scene === sceneFilter;
        return statusMatch && sceneMatch;
      });
      return [...matchedCustomers].sort((a, b) => compareCustomers(a, b, sortOption));
    },
    [sceneFilter, sortOption, statusFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const visibleCustomers = filteredCustomers.slice(pageStart, pageStart + pageSize);

  function updateStatusFilter(nextStatus: StatusFilter) {
    setStatusFilter(nextStatus);
    setCurrentPage(1);
  }

  function updateSceneFilter(nextScene: string) {
    setSceneFilter(nextScene);
    setCurrentPage(1);
  }

  function updateSortOption(nextSortOption: SortOption) {
    setSortOption(nextSortOption);
    setCurrentPage(1);
  }

  return (
    <main className="mx-auto w-full max-w-[1180px] px-3 pb-12 pt-20 text-slate-900 md:px-5">
      <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_56%,#eef6ff_100%)] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.10)] md:p-7">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            <Bot size={14} />
            示意資料 · 最近 7 天
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
            AI 知識庫健康度檢測
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
            以逐客戶總覽追蹤 AI 問答、RAG 知識庫與 kiosk 前端互動。這是一個內部快速檢視用的單頁網頁示意，用假資料還原使用量、維運與異常關心流程。
          </p>
        </div>
      </section>

      <section className="mb-5 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">逐客戶健康度總覽</h2>
            <p className="mt-1 text-xs text-slate-500">
              預設排序為需關心優先，同一狀態內再依健康度低到高；用量、token、點擊與維運資料都以單一客戶為單位判讀。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 font-bold text-red-700">需關心 {attentionCount}</span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-bold text-amber-700">觀察 {customers.filter((customer) => customer.status === "watch").length}</span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">健康 {customers.filter((customer) => customer.status === "healthy").length}</span>
          </div>
        </div>
        <div className="border-b border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => updateStatusFilter(item.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                    statusFilter === item.value
                      ? "border-blue-300 bg-blue-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
                場景
                <select
                  value={sceneFilter}
                  onChange={(event) => updateSceneFilter(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">全部場景</option>
                  {scenes.map((scene) => (
                    <option key={scene} value={scene}>
                      {scene}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
                排序
                <select
                  value={sortOption}
                  onChange={(event) => updateSortOption(event.target.value as SortOption)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            目前符合條件 {filteredCustomers.length} 筆，第 {currentPage} / {totalPages} 頁，每頁 {pageSize} 筆。
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <div className="rounded-lg border border-red-100 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600">
              <span className="font-bold text-red-700">需關心</span>
              ：代表這個客戶可能要先被拿出來看，不一定是故障。示意條件包含 QA 少於 20 句、KB 超過 21 天未更新，或安全詞觸發率高於 12%。
            </div>
            <div className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600">
              <span className="font-bold text-blue-700">健康度</span>
              ：把使用量穩定度、KB 維運頻率、安全詞觸發率與 kiosk 互動加權成 0-100 分，用來快速排序，不是正式 SLA 分數。
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4">
          {visibleCustomers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              目前沒有符合條件的客戶。
            </div>
          ) : (
            visibleCustomers.map((customer) => (
              <article key={customer.name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={customer.status} />
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500">
                        {customer.scene} · {customer.primaryLanguage}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-950">{customer.name}</h3>
                    <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">{customer.reason}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:min-w-[520px]">
                    <div className="rounded-lg bg-slate-50 p-2">
                      <p className="text-slate-400">問答數量</p>
                      <p className="font-mono text-base font-black text-slate-800">{formatNumber(customer.qaCount)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <p className="text-slate-400">週變化</p>
                      <p className={`inline-flex items-center gap-1 font-mono text-base font-black ${customer.wowChange < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {customer.wowChange < 0 ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                        {formatPercent(customer.wowChange)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <p className="text-slate-400">輸出 Token</p>
                      <p className={`font-mono text-base font-black ${customer.avgOutputTokens > 900 ? "text-amber-700" : "text-slate-800"}`}>
                        {customer.avgOutputTokens}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <p className="text-slate-400">機台點擊</p>
                      <p className="font-mono text-base font-black text-slate-800">{formatNumber(kioskTotal(customer))}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(customer)}
                    aria-label={`查看 ${customer.name} 明細`}
                    className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                  >
                    查看明細
                  </button>
                </div>
              </article>
            ))
          )}

          {filteredCustomers.length > pageSize && (
            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-center text-xs font-semibold text-slate-500 sm:text-left">
                顯示第 {pageStart + 1} - {Math.min(pageStart + pageSize, filteredCustomers.length)} 筆，共 {filteredCustomers.length} 筆
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  上一頁
                </button>
                <span className="min-w-16 text-center text-xs font-bold text-slate-500">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  下一頁
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mb-5 grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        <ChartPanel title="每週問答使用量趨勢" subtitle="此區為趨勢參考；實際判讀仍以逐客戶資料為主。">
          <div className="h-[310px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <LineChart data={weeklyUsage} margin={{ left: -18, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="qa" name="問答數" stroke="#2563eb" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="safety" name="安全詞" stroke="#dc2626" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="kiosk" name="機台點擊" stroke="#0f766e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <div className="grid gap-5">
          <ChartPanel title="機台點擊來源" subtitle="前端為網頁，機台點擊透過 GA event 擷取。">
            <div className="h-[220px] min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <BarChart data={kioskBreakdown} layout="vertical" margin={{ left: 24, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11 }} stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {kioskBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>

          <ChartPanel title="語言分布" subtitle="回答流程已收集語言，順手納入健康度觀察。">
            <div className="h-[220px] min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <PieChart>
                  <Pie data={languageShare} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={3}>
                    {languageShare.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>
        </div>
      </section>

      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-950">方法論 / 資料流程</h2>
            <p className="mt-1 text-xs text-slate-500">示意原始做法：單純網頁，幫內部快速檢視專案狀態。</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: MousePointerClick, title: "機台點擊", text: "前端與 kiosk 都是網頁，點擊資料直接從 GA 事件撈取，分成菜單式內容、類別與額外連結。" },
              { icon: Globe2, title: "逐專案取資料", text: "問答、token、語言、安全詞與知識庫維護資料，使用登入 cookie 取得權限後，逐專案呼叫既有網頁 API。" },
              { icon: Clock3, title: "每週觀察節奏", text: "追蹤週用量大量異動、長期沒使用或超低用量，再決定是否關心客戶或檢查產品設定。" },
              { icon: Gauge, title: "健康度邏輯", text: "使用量穩定度 35%、KB 維運 25%、安全詞 25%、kiosk 互動 15%，快速分成健康、觀察與需關心。" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm">
                      <Icon size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-950">{item.title}</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600">{item.text}</p>
                </article>
              );
            })}
          </div>
      </section>
      <CustomerDetailModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
    </main>
  );
}

export { HEALTH_ROUTE };
