import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  Bot,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { STATIC_FAQS, matchStaticFaq } from "../faq";
import {
  consumeAIStream,
  getAIErrorMessage,
  type AIUsage,
} from "../client-sse";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  includeInContext: boolean;
  pending?: boolean;
  link?: { href: string; label: string };
};

type ChatStatus = "idle" | "streaming" | "stopped" | "error";

type RetryState = {
  question: string;
  historyBeforeUser: ChatMessage[];
};

const WELCOME_MESSAGE: ChatMessage = {
  id: "portfolio-chat-welcome",
  role: "assistant",
  content: "嗨，我可以用履歷中的已確認資料回答問題。常見題目會直接在本機回答；其他問題才會使用 AI 額度。",
  includeInContext: false,
};

let messageSequence = 0;

function createMessageId(prefix: string): string {
  messageSequence += 1;
  return `${prefix}-${Date.now()}-${messageSequence}`;
}

function recentContext(messages: ChatMessage[]): Array<{ role: ChatRole; content: string }> {
  const selected: Array<{ role: ChatRole; content: string }> = [];
  let totalLength = 0;

  for (let index = messages.length - 1; index >= 0 && selected.length < 8; index -= 1) {
    const message = messages[index];
    if (!message.includeInContext || message.pending) continue;
    const content = message.content.trim().slice(0, 1_000);
    if (!content || totalLength + content.length > 6_000) continue;
    selected.push({ role: message.role, content });
    totalLength += content.length;
  }

  return selected.reverse();
}

function ChatUsage({ usage }: { usage: AIUsage }): React.ReactElement {
  return (
    <p className="text-[10px] leading-4 text-slate-400">
      {usage.inputTokens} in · {usage.outputTokens} out · {usage.cachedTokens} cached
      {usage.remaining !== null ? ` · 剩餘 ${usage.remaining}` : ""}
    </p>
  );
}

/** Floating resume-only chat UI with local FAQ answers and streamed AI fallback. */
export function PortfolioChat(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [retry, setRetry] = useState<RetryState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const busyRef = useRef(false);
  const requestSerialRef = useRef(0);
  const isStreaming = status === "streaming";

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!isOpen) return;
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [isOpen, messages]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        closeChat();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panelRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  function closeChat(): void {
    setIsOpen(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }

  async function requestAI(question: string, historyBeforeUser: ChatMessage[]): Promise<void> {
    if (busyRef.current) return;
    busyRef.current = true;
    requestSerialRef.current += 1;
    const requestSerial = requestSerialRef.current;

    const userMessage: ChatMessage = {
      id: createMessageId("user"),
      role: "user",
      content: question,
      includeInContext: true,
    };
    const assistantId = createMessageId("assistant");
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      includeInContext: true,
      pending: true,
    };
    const requestMessages = recentContext([...historyBeforeUser, userMessage]);
    const controller = new AbortController();

    abortRef.current = controller;
    setMessages([...historyBeforeUser, userMessage, assistantMessage]);
    setRetry({ question, historyBeforeUser });
    setStatus("streaming");
    setError(null);
    setUsage(null);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ messages: requestMessages }),
        signal: controller.signal,
      });

      await consumeAIStream(response, {
        onDelta: (delta) => {
          if (requestSerialRef.current !== requestSerial) return;
          setMessages((current) => current.map((message) =>
            message.id === assistantId
              ? { ...message, content: message.content + delta }
              : message,
          ));
        },
        onUsage: (nextUsage) => {
          if (requestSerialRef.current === requestSerial) setUsage(nextUsage);
        },
      });
      if (requestSerialRef.current !== requestSerial) return;
      setMessages((current) => current.map((message) =>
        message.id === assistantId ? { ...message, pending: false } : message,
      ));
      setStatus("idle");
    } catch (caught) {
      if (requestSerialRef.current !== requestSerial) return;
      if (controller.signal.aborted) {
        setMessages((current) => current.map((message) =>
          message.id === assistantId
            ? { ...message, content: message.content || "已停止產生。", pending: false }
            : message,
        ));
        setStatus("stopped");
      } else {
        setMessages((current) => current.map((message) =>
          message.id === assistantId
            ? { ...message, content: message.content || "這次沒有取得回答。", pending: false }
            : message,
        ));
        setStatus("error");
        setError(getAIErrorMessage(caught));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (requestSerialRef.current === requestSerial) busyRef.current = false;
    }
  }

  function answerQuestion(rawQuestion: string): void {
    const question = rawQuestion.trim();
    if (!question || busyRef.current) return;
    if (question.length > 1_000) {
      setError("每則訊息最多 1,000 字，請縮短後再送出。");
      return;
    }

    setDraft("");
    setError(null);
    const faq = matchStaticFaq(question);
    if (faq) {
      const userMessage: ChatMessage = {
        id: createMessageId("user"),
        role: "user",
        content: question,
        includeInContext: true,
      };
      const answerMessage: ChatMessage = {
        id: createMessageId("faq"),
        role: "assistant",
        content: faq.answer,
        includeInContext: true,
        link: faq.link,
      };
      setMessages((current) => [...current, userMessage, answerMessage]);
      setRetry(null);
      setUsage(null);
      setStatus("idle");
      return;
    }

    void requestAI(question, messages);
  }

  function clearConversation(): void {
    requestSerialRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    setMessages([WELCOME_MESSAGE]);
    setDraft("");
    setError(null);
    setUsage(null);
    setRetry(null);
    setStatus("idle");
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function regenerate(): void {
    if (!retry || busyRef.current) return;
    void requestAI(retry.question, retry.historyBeforeUser);
  }

  return (
    <div className="portfolio-chat-root">
      {isOpen ? (
        <section
          ref={panelRef}
          className="portfolio-chat-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="portfolio-chat-title"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-100 to-amber-100 text-blue-800">
                <Bot size={19} aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 id="portfolio-chat-title" className="truncate text-sm font-black text-slate-900">履歷問答 Bot</h2>
                <p className="text-[11px] text-slate-500">只依據已確認的個人資料回答</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
                onClick={clearConversation}
                aria-label="清除對話"
                title="清除對話（不重設使用額度）"
              >
                <Trash2 size={16} aria-hidden />
              </button>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
                onClick={closeChat}
                aria-label="關閉履歷問答"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite" aria-busy={isStreaming}>
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${message.role === "user" ? "bg-slate-800 text-white" : "bg-blue-100 text-blue-800"}`}>
                    {message.role === "user" ? <UserRound size={14} aria-hidden /> : <Bot size={14} aria-hidden />}
                  </span>
                  <div className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${message.role === "user" ? "rounded-tr-sm bg-slate-800 text-white" : "rounded-tl-sm border border-slate-200 bg-white text-slate-700 shadow-sm"}`}>
                    {message.content}
                    {message.pending ? <span className="ai-stream-dot ml-1 inline-block" aria-label="正在產生" /> : null}
                    {message.link ? (
                      <Link
                        to={message.link.href}
                        className="mt-2 flex w-fit items-center rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600"
                        onClick={closeChat}
                      >
                        {message.link.label}
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {messages.length === 1 ? (
              <div className="mt-5">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <Sparkles size={13} aria-hidden /> 不使用 AI 額度
                </p>
                <div className="flex flex-wrap gap-2">
                  {STATIC_FAQS.map((faq) => (
                    <button
                      key={faq.id}
                      type="button"
                      className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-left text-xs leading-5 text-blue-900 transition hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
                      onClick={() => answerQuestion(faq.question)}
                    >
                      {faq.question}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800" role="alert">{error}</p>
            ) : null}
          </div>

          <footer className="shrink-0 border-t border-slate-200 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                answerQuestion(draft);
              }}
            >
              <label className="sr-only" htmlFor="portfolio-chat-input">詢問履歷問題</label>
              <textarea
                ref={inputRef}
                id="portfolio-chat-input"
                className="input max-h-28 min-h-10 resize-none py-2 text-sm leading-5"
                rows={1}
                value={draft}
                maxLength={1_000}
                placeholder="詢問經歷、技能或成果…"
                disabled={isStreaming}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    answerQuestion(draft);
                  }
                }}
              />
              {isStreaming ? (
                <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-800 text-white" onClick={() => abortRef.current?.abort()} aria-label="停止產生">
                  <Square size={13} fill="currentColor" aria-hidden />
                </button>
              ) : (
                <button type="submit" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-amber-200 to-amber-300 text-slate-900 transition hover:from-amber-300 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-40" disabled={!draft.trim()} aria-label="送出問題">
                  <Send size={16} aria-hidden />
                </button>
              )}
            </form>
            <div className="mt-2 flex min-h-5 items-center justify-between gap-2 px-1">
              {usage ? <ChatUsage usage={usage} /> : <p className="text-[10px] text-slate-400">Enter 送出 · Shift + Enter 換行</p>}
              {retry && !isStreaming ? (
                <button type="button" className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline" onClick={regenerate}>
                  <RotateCcw size={11} aria-hidden /> 重新產生
                </button>
              ) : null}
            </div>
          </footer>
        </section>
      ) : (
        <button
          ref={launcherRef}
          type="button"
          className="portfolio-chat-launcher group"
          onClick={() => setIsOpen(true)}
          aria-label="開啟履歷問答 Bot"
          aria-haspopup="dialog"
        >
          <MessageCircle size={20} aria-hidden />
          <span className="hidden pr-1 text-sm font-bold sm:inline">問問履歷 Bot</span>
          <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" aria-hidden />
        </button>
      )}
    </div>
  );
}

export default PortfolioChat;
