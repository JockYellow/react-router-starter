import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Square,
} from "lucide-react";
import {
  consumeAIStream,
  getAIErrorMessage,
  type AIUsage,
} from "../../features/ai/client-sse";

type AnalysisInput = {
  companyName: string;
  jobTitle: string;
  jobDescription: string;
};

type AnalysisStatus = "idle" | "streaming" | "complete" | "stopped" | "error";

const LIMITS = {
  companyName: 100,
  jobTitle: 150,
  jobDescription: 6_000,
} as const;

function isOnlyUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

export function meta(): Array<{ title: string } | { name: string; content: string }> {
  return [
    { title: "AI 公司適配分析｜黃彥禎履歷" },
    {
      name: "description",
      content: "依據黃彥禎的已確認履歷資料，分析與目標公司及職缺的適配度。",
    },
  ];
}

function UsageSummary({ usage }: { usage: AIUsage }): React.ReactElement {
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500" aria-label="本次 AI 用量">
      <div className="flex gap-1">
        <dt>輸入</dt>
        <dd className="font-mono">{usage.inputTokens}</dd>
      </div>
      <div className="flex gap-1">
        <dt>輸出</dt>
        <dd className="font-mono">{usage.outputTokens}</dd>
      </div>
      <div className="flex gap-1">
        <dt>快取讀取</dt>
        <dd className="font-mono">{usage.cachedTokens}</dd>
      </div>
      <div className="flex gap-1">
        <dt>快取寫入</dt>
        <dd className="font-mono">{usage.cacheWriteTokens}</dd>
      </div>
      {usage.remaining !== null ? (
        <div className="flex gap-1">
          <dt>今日剩餘</dt>
          <dd className="font-mono">{usage.remaining}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export default function CompanyFitPage(): React.ReactElement {
  const [form, setForm] = useState<AnalysisInput>({
    companyName: "",
    jobTitle: "",
    jobDescription: "",
  });
  const [lastSubmitted, setLastSubmitted] = useState<AnalysisInput | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLElement | null>(null);
  const isStreaming = status === "streaming";
  const urlOnly = isOnlyUrl(form.jobDescription);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function runAnalysis(input: AnalysisInput): Promise<void> {
    if (abortRef.current || status === "streaming") return;

    const companyName = input.companyName.trim();
    const jobTitle = input.jobTitle.trim();
    const jobDescription = input.jobDescription.trim();
    if (!companyName) {
      setError("請先填寫公司名稱。");
      return;
    }
    if (isOnlyUrl(jobDescription)) {
      setError("MVP 不會讀取職缺網址，請將職缺內容貼到欄位中。");
      return;
    }

    const normalized = { companyName, jobTitle, jobDescription };
    const controller = new AbortController();
    abortRef.current = controller;
    setLastSubmitted(normalized);
    setStatus("streaming");
    setOutput("");
    setError(null);
    setUsage(null);

    window.requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    try {
      const response = await fetch("/api/ai/company-fit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          companyName,
          ...(jobTitle ? { jobTitle } : {}),
          ...(jobDescription ? { jobDescription } : {}),
        }),
        signal: controller.signal,
      });

      await consumeAIStream(response, {
        onDelta: (delta) => setOutput((current) => current + delta),
        onUsage: setUsage,
      });
      setStatus("complete");
    } catch (caught) {
      if (controller.signal.aborted) {
        setStatus("stopped");
      } else {
        setStatus("error");
        setError(getAIErrorMessage(caught));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function stopAnalysis(): void {
    abortRef.current?.abort();
  }

  return (
    <main className="mx-auto w-full max-w-5xl pb-20">
      <section className="module-panel module-skills mb-6" aria-labelledby="company-fit-title">
        <div className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <span className="resume-kicker">
              <Sparkles size={14} aria-hidden /> AI Company Fit
            </span>
            <h1 id="company-fit-title" className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              這份經歷，能為你的團隊帶來什麼？
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
              輸入公司與職缺資訊，AI 會只根據這份履歷中已確認的經歷，整理適配原因、證據、可帶來的價值與仍需確認之處。
            </p>
            <div className="mt-6 rounded-2xl border border-blue-200/70 bg-white/65 p-4 text-sm leading-6 text-slate-600">
              <p className="font-bold text-slate-800">分析邊界</p>
              <p className="mt-1">
                不會自行瀏覽公司或職缺網站。公司相關判斷會區分「使用者提供」與「推論」，不捏造未提供的公司事實。
              </p>
            </div>
          </div>

          <form
            className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-xl shadow-slate-900/5 sm:p-6"
            onSubmit={(event) => {
              event.preventDefault();
              void runAnalysis(form);
            }}
            aria-busy={isStreaming}
          >
            <div className="space-y-5">
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-sm font-bold text-slate-800">
                  <span>公司名稱 <span className="text-red-600">*</span></span>
                  <span className="font-mono text-[11px] font-normal text-slate-400">{form.companyName.length}/{LIMITS.companyName}</span>
                </span>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-3 text-slate-400" size={17} aria-hidden />
                  <input
                    className="input pl-10"
                    value={form.companyName}
                    maxLength={LIMITS.companyName}
                    onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
                    placeholder="例如：某某科技"
                    autoComplete="organization"
                    disabled={isStreaming}
                    required
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-sm font-bold text-slate-800">
                  <span>職缺名稱 <span className="font-normal text-slate-400">（選填）</span></span>
                  <span className="font-mono text-[11px] font-normal text-slate-400">{form.jobTitle.length}/{LIMITS.jobTitle}</span>
                </span>
                <input
                  className="input"
                  value={form.jobTitle}
                  maxLength={LIMITS.jobTitle}
                  onChange={(event) => setForm((current) => ({ ...current, jobTitle: event.target.value }))}
                  placeholder="例如：Customer Success Manager"
                  disabled={isStreaming}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-sm font-bold text-slate-800">
                  <span>職缺內容 <span className="font-normal text-slate-400">（選填）</span></span>
                  <span className="font-mono text-[11px] font-normal text-slate-400">{form.jobDescription.length}/{LIMITS.jobDescription}</span>
                </span>
                <textarea
                  className="input min-h-44 resize-y leading-6"
                  value={form.jobDescription}
                  maxLength={LIMITS.jobDescription}
                  onChange={(event) => setForm((current) => ({ ...current, jobDescription: event.target.value }))}
                  placeholder="貼上工作內容、必要條件與加分條件。若只有網址，請先複製頁面中的職缺文字。"
                  disabled={isStreaming}
                />
              </label>

              {urlOnly ? (
                <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900" role="alert">
                  <AlertCircle className="mt-0.5 shrink-0" size={15} aria-hidden />
                  MVP 不會開啟或抓取網址；請貼上職缺頁面的文字內容再分析。
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                {isStreaming ? (
                  <button type="button" className="btn-ghost gap-2" onClick={stopAnalysis}>
                    <Square size={13} fill="currentColor" aria-hidden /> 停止產生
                  </button>
                ) : (
                  <button type="submit" className="btn-primary gap-2" disabled={!form.companyName.trim() || urlOnly}>
                    開始分析 <ArrowRight size={15} aria-hidden />
                  </button>
                )}
                <span className="text-xs text-slate-500">每個 IP 每 UTC 日最多 5 次</span>
              </div>
            </div>
          </form>
        </div>
      </section>

      {(status !== "idle" || error) ? (
        <section ref={resultRef} className="card scroll-mt-24" aria-live="polite" aria-busy={isStreaming}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="eyebrow">Analysis</p>
              <h2 className="mt-2 text-xl font-black text-slate-900">
                {lastSubmitted?.companyName ?? form.companyName} 適配分析
              </h2>
              {lastSubmitted?.jobTitle ? <p className="mt-1 text-sm text-slate-500">{lastSubmitted.jobTitle}</p> : null}
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              {status === "streaming" ? <><span className="ai-stream-dot" />正在整理履歷證據</> : null}
              {status === "complete" ? <><CheckCircle2 size={16} className="text-emerald-600" />分析完成</> : null}
              {status === "stopped" ? "已停止" : null}
            </div>
          </div>

          {output ? (
            <div className="ai-prose whitespace-pre-wrap text-sm leading-7 text-slate-700 sm:text-[15px]">{output}</div>
          ) : isStreaming ? (
            <div className="space-y-3" aria-hidden>
              <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
              <AlertCircle className="mt-0.5 shrink-0" size={17} aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            {usage ? <UsageSummary usage={usage} /> : <span className="text-[11px] text-slate-400">AI 內容請搭配實際職缺資訊判斷。</span>}
            {lastSubmitted && !isStreaming ? (
              <button type="button" className="btn-ghost gap-2" onClick={() => void runAnalysis(lastSubmitted)}>
                <RotateCcw size={14} aria-hidden /> 重新產生
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
