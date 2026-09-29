import { useEffect, useMemo, useRef, useState } from "react";

const API_ID_KEY = "telegram-mover-api-id";
const API_HASH_KEY = "telegram-mover-api-hash";
const SESSION_NAME = "telegram-mover-session-v1";
const QUEUE_TITLE = "Turrit Download Queue";
const SCAN_LIMIT = 5000;
const FORWARD_BATCH_SIZE = 20;

type ChannelOption = {
  id: number;
  title: string;
  username: string | null;
  unreadCount: number;
  lastReadIngoing: number;
};

type VideoCandidate = {
  id: number;
  date: Date;
  protected: boolean;
};

type RangeMode = "unread" | "date";

let telegramClient: any = null;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function forwardedKey(sourceId: number, destinationId: number) {
  return `telegram-mover-forwarded:${sourceId}:${destinationId}`;
}

function readForwarded(sourceId: number, destinationId: number) {
  if (typeof window === "undefined") return new Set<number>();
  try {
    const raw = window.localStorage.getItem(forwardedKey(sourceId, destinationId));
    const values = raw ? JSON.parse(raw) : [];
    return new Set<number>(Array.isArray(values) ? values.filter((value) => Number.isInteger(value)) : []);
  } catch {
    return new Set<number>();
  }
}

function writeForwarded(sourceId: number, destinationId: number, values: Set<number>) {
  window.localStorage.setItem(forwardedKey(sourceId, destinationId), JSON.stringify([...values]));
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function meta() {
  return [
    { title: "Telegram 影片搬運器" },
    {
      name: "description",
      content: "在手機端掃描 Telegram 私人頻道影片，批次轉發到 Turrit 下載佇列。",
    },
  ];
}

export function links() {
  return [
    { rel: "manifest", href: "/telegram-mover.webmanifest" },
    { rel: "icon", href: "/telegram-mover-icon.svg", type: "image/svg+xml" },
  ];
}

export default function TelegramMover() {
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [credentialsReady, setCredentialsReady] = useState(false);
  const [booting, setBooting] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [status, setStatus] = useState("等待設定");
  const [error, setError] = useState<string | null>(null);

  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<Date | null>(null);
  const authAbortRef = useRef<AbortController | null>(null);

  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [destinationId, setDestinationId] = useState<number | null>(null);
  const [rangeMode, setRangeMode] = useState<RangeMode>("unread");
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [scanning, setScanning] = useState(false);
  const [candidates, setCandidates] = useState<VideoCandidate[]>([]);
  const [protectedCount, setProtectedCount] = useState(0);
  const [alreadyDoneCount, setAlreadyDoneCount] = useState(0);

  const [forwarding, setForwarding] = useState(false);
  const [forwardedCount, setForwardedCount] = useState(0);

  const source = useMemo(() => channels.find((channel) => channel.id === sourceId) ?? null, [channels, sourceId]);
  const destination = useMemo(
    () => channels.find((channel) => channel.id === destinationId) ?? null,
    [channels, destinationId],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedApiId = window.localStorage.getItem(API_ID_KEY) ?? "";
    const savedApiHash = window.localStorage.getItem(API_HASH_KEY) ?? "";
    setApiId(savedApiId);
    setApiHash(savedApiHash);
    setCredentialsReady(Boolean(savedApiId && savedApiHash));
  }, []);

  useEffect(() => {
    if (!credentialsReady || !apiId || !apiHash) return;
    void bootClient();
    return () => {
      authAbortRef.current?.abort();
    };
  }, [credentialsReady]);

  async function bootClient() {
    setBooting(true);
    setError(null);
    setStatus("載入 Telegram Client…");

    try {
      const parsedApiId = Number(apiId);
      if (!Number.isInteger(parsedApiId) || parsedApiId <= 0) {
        throw new Error("API ID 格式不正確");
      }

      const { TelegramClient } = await import("@mtcute/web");

      if (telegramClient) {
        try {
          await telegramClient.destroy();
        } catch {
          // ignore stale client cleanup failures
        }
      }

      telegramClient = new TelegramClient({
        apiId: parsedApiId,
        apiHash: apiHash.trim(),
        storage: SESSION_NAME,
      });

      try {
        const currentUser = await telegramClient.getMe();
        setMe(currentUser);
        setStatus(`已登入：${currentUser.displayName}`);
        await loadChannels();
        if (navigator.storage?.persist) {
          void navigator.storage.persist();
        }
      } catch {
        setMe(null);
        setStatus("尚未登入 Telegram");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("初始化失敗");
    } finally {
      setBooting(false);
    }
  }

  function saveCredentials() {
    const parsedApiId = Number(apiId);
    if (!Number.isInteger(parsedApiId) || parsedApiId <= 0 || !apiHash.trim()) {
      setError("請填入有效的 API ID 與 API Hash");
      return;
    }
    window.localStorage.setItem(API_ID_KEY, String(parsedApiId));
    window.localStorage.setItem(API_HASH_KEY, apiHash.trim());
    setError(null);
    setCredentialsReady(true);
  }

  function resetCredentials() {
    authAbortRef.current?.abort();
    window.localStorage.removeItem(API_ID_KEY);
    window.localStorage.removeItem(API_HASH_KEY);
    setCredentialsReady(false);
    setMe(null);
    setChannels([]);
    setSourceId(null);
    setDestinationId(null);
    setCandidates([]);
    setQrUrl(null);
    setStatus("等待設定");
  }

  async function loginWithTelegramApp() {
    if (!telegramClient) return;
    authAbortRef.current?.abort();
    const abortController = new AbortController();
    authAbortRef.current = abortController;

    setError(null);
    setQrUrl(null);
    setStatus("正在產生 Telegram App 授權連結…");

    try {
      const currentUser = await telegramClient.start({
        qrCodeHandler: (url: string, expires: Date) => {
          setQrUrl(url);
          setQrExpiresAt(expires);
          setStatus("請點下方按鈕到 Telegram App 確認登入");
        },
        password: async () => window.prompt("Telegram 兩步驟驗證密碼") ?? "",
        abortSignal: abortController.signal,
      });

      setMe(currentUser);
      setQrUrl(null);
      setQrExpiresAt(null);
      setStatus(`已登入：${currentUser.displayName}`);
      await loadChannels();
    } catch (cause) {
      if (abortController.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("Telegram App 授權未完成");
    }
  }

  async function loginWithPhone() {
    if (!telegramClient) return;
    authAbortRef.current?.abort();
    const abortController = new AbortController();
    authAbortRef.current = abortController;

    const phone = window.prompt("輸入 Telegram 手機號碼（含國碼，例如 +886…）");
    if (!phone) return;

    setError(null);
    setQrUrl(null);
    setStatus("等待 Telegram 驗證碼…");

    try {
      const currentUser = await telegramClient.start({
        phone,
        code: async () => window.prompt("輸入 Telegram 傳來的驗證碼") ?? "",
        password: async () => window.prompt("若有兩步驟驗證，請輸入密碼") ?? "",
        abortSignal: abortController.signal,
      });

      setMe(currentUser);
      setStatus(`已登入：${currentUser.displayName}`);
      await loadChannels();
    } catch (cause) {
      if (abortController.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("驗證碼登入失敗");
    }
  }

  async function loadChannels() {
    if (!telegramClient) return;
    setStatus("讀取頻道清單…");
    const nextChannels: ChannelOption[] = [];

    for await (const dialog of telegramClient.iterDialogs({
      archived: "keep",
      limit: 1000,
    })) {
      const peer = dialog.peer;
      if (peer?.type !== "chat" || peer.chatType !== "channel") continue;

      nextChannels.push({
        id: peer.id,
        title: peer.displayName || peer.title || String(peer.id),
        username: peer.username ?? null,
        unreadCount: dialog.unreadCount ?? 0,
        lastReadIngoing: dialog.lastReadIngoing ?? 0,
      });
    }

    nextChannels.sort((a, b) => a.title.localeCompare(b.title, "zh-Hant"));
    setChannels(nextChannels);

    const queue = nextChannels.find((channel) => channel.title === QUEUE_TITLE);
    if (queue) setDestinationId(queue.id);

    setStatus(`已載入 ${nextChannels.length} 個頻道`);
  }

  async function ensureQueueChannel() {
    if (!telegramClient) return;
    setError(null);

    const existing = channels.find((channel) => channel.title === QUEUE_TITLE);
    if (existing) {
      setDestinationId(existing.id);
      return;
    }

    setStatus("建立私人下載佇列…");

    try {
      const chat = await telegramClient.createChannel({
        title: QUEUE_TITLE,
        description: "由 Telegram 影片搬運器建立，供 Turrit 自動下載使用。",
      });

      const queue: ChannelOption = {
        id: chat.id,
        title: chat.displayName || chat.title || QUEUE_TITLE,
        username: chat.username ?? null,
        unreadCount: 0,
        lastReadIngoing: 0,
      };

      setChannels((current) => [...current, queue].sort((a, b) => a.title.localeCompare(b.title, "zh-Hant")));
      setDestinationId(queue.id);
      setStatus("下載佇列已建立");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("建立下載佇列失敗");
    }
  }

  async function scanVideos() {
    if (!telegramClient || !source || !destinationId) return;

    setScanning(true);
    setError(null);
    setCandidates([]);
    setProtectedCount(0);
    setAlreadyDoneCount(0);
    setForwardedCount(0);

    const done = readForwarded(source.id, destinationId);
    const found: VideoCandidate[] = [];
    let protectedVideos = 0;
    let alreadyDone = 0;
    const startDate = rangeMode === "date" ? new Date(`${fromDate}T00:00:00`) : null;

    setStatus("掃描影片中…");

    try {
      const params: Record<string, unknown> = { limit: SCAN_LIMIT };
      if (rangeMode === "unread") params.minId = source.lastReadIngoing;

      for await (const message of telegramClient.iterHistory(source.id, params)) {
        const messageDate = message.date instanceof Date ? message.date : new Date(message.date);

        if (startDate && messageDate < startDate) break;

        const media = message.media;
        const isVideo = media?.type === "video" && !media.isAnimation;
        if (!isVideo) continue;

        if (message.isContentProtected) {
          protectedVideos += 1;
          continue;
        }

        if (done.has(message.id)) {
          alreadyDone += 1;
          continue;
        }

        found.push({
          id: message.id,
          date: messageDate,
          protected: false,
        });
      }

      setCandidates(found);
      setProtectedCount(protectedVideos);
      setAlreadyDoneCount(alreadyDone);
      setStatus(`掃描完成：可搬運 ${found.length} 支影片`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("掃描失敗");
    } finally {
      setScanning(false);
    }
  }

  async function forwardVideos() {
    if (!telegramClient || !source || !destinationId || candidates.length === 0) return;

    setForwarding(true);
    setError(null);
    setForwardedCount(0);
    setStatus("開始批次轉發…");

    const done = readForwarded(source.id, destinationId);

    try {
      for (let offset = 0; offset < candidates.length; offset += FORWARD_BATCH_SIZE) {
        const batch = candidates.slice(offset, offset + FORWARD_BATCH_SIZE);
        const ids = batch.map((item) => item.id);

        await telegramClient.forwardMessagesById({
          fromChatId: source.id,
          toChatId: destinationId,
          messages: ids,
          silent: true,
        });

        ids.forEach((id) => done.add(id));
        writeForwarded(source.id, destinationId, done);
        setForwardedCount(Math.min(offset + batch.length, candidates.length));
        setStatus(`轉發中：${Math.min(offset + batch.length, candidates.length)} / ${candidates.length}`);

        if (offset + FORWARD_BATCH_SIZE < candidates.length) {
          await sleep(1200);
        }
      }

      setStatus(`完成：已轉發 ${candidates.length} 支影片`);
      setCandidates([]);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(
        message.includes("CHAT_FORWARDS_RESTRICTED")
          ? "來源頻道啟用了內容保護，Telegram 不允許轉發。"
          : message,
      );
      setStatus("轉發中斷；已完成的項目已記錄，下次不會重複搬運");
    } finally {
      setForwarding(false);
    }
  }

  function resetForwardedHistory() {
    if (!sourceId || !destinationId) return;
    if (!window.confirm("清除這組來源/目的地的本機搬運紀錄？之後重新掃描可能再次轉發相同影片。")) return;
    window.localStorage.removeItem(forwardedKey(sourceId, destinationId));
    setCandidates([]);
    setAlreadyDoneCount(0);
    setStatus("已清除本機搬運紀錄");
  }

  async function logout() {
    if (!telegramClient) return;
    if (!window.confirm("要登出這個工具的 Telegram Session 嗎？Turrit 不受影響。")) return;

    setError(null);
    try {
      await telegramClient.logOut();
      setMe(null);
      setChannels([]);
      setSourceId(null);
      setDestinationId(null);
      setCandidates([]);
      setStatus("已登出");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-7 sm:px-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">Local-first Telegram utility</p>
          <h1 className="text-3xl font-bold tracking-tight">Telegram 影片搬運器</h1>
          <p className="text-sm leading-6 text-slate-400">
            網頁只在這支手機上登入 Telegram。影片本體不經本站伺服器，工具只要求 Telegram 將既有影片訊息轉發到你的私人下載佇列。
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">狀態</h2>
              <p className="mt-1 text-sm text-slate-400">{status}</p>
            </div>
            {booting && <span className="text-xs text-sky-300">處理中…</span>}
          </div>
          {error && (
            <div className="mt-3 rounded-xl border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          )}
        </section>

        {!credentialsReady && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="font-semibold">1. Telegram API 憑證</h2>
            <p className="mt-1 text-sm text-slate-400">
              從 my.telegram.org/apps 取得。只保存於這個網站在手機上的 localStorage，不會送到本站後端。
            </p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">API ID</span>
                <input
                  inputMode="numeric"
                  value={apiId}
                  onChange={(event) => setApiId(event.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 outline-none focus:border-sky-500"
                  placeholder="12345678"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">API Hash</span>
                <input
                  value={apiHash}
                  onChange={(event) => setApiHash(event.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 font-mono outline-none focus:border-sky-500"
                  placeholder="32 字元 API Hash"
                />
              </label>
              <button
                type="button"
                onClick={saveCredentials}
                className="rounded-xl bg-sky-500 px-4 py-3 font-semibold text-slate-950 hover:bg-sky-400"
              >
                儲存並初始化
              </button>
            </div>
          </section>
        )}

        {credentialsReady && !me && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">2. 登入 Telegram</h2>
                <p className="mt-1 text-sm text-slate-400">優先使用已登入的 Telegram App 授權。</p>
              </div>
              <button type="button" onClick={resetCredentials} className="text-xs text-slate-500 underline">
                重設 API 憑證
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {!qrUrl ? (
                <button
                  type="button"
                  onClick={() => void loginWithTelegramApp()}
                  disabled={booting}
                  className="rounded-xl bg-sky-500 px-4 py-3 font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
                >
                  使用 Telegram App 授權
                </button>
              ) : (
                <div className="rounded-xl border border-sky-800 bg-sky-950/40 p-3">
                  <p className="text-sm text-sky-100">授權連結已產生，請在失效前開啟 Telegram 並確認。</p>
                  {qrExpiresAt && (
                    <p className="mt-1 text-xs text-slate-400">有效至 {qrExpiresAt.toLocaleTimeString("zh-TW")}</p>
                  )}
                  <a
                    href={qrUrl}
                    className="mt-3 block rounded-xl bg-sky-500 px-4 py-3 text-center font-semibold text-slate-950"
                  >
                    在 Telegram App 開啟
                  </a>
                  <p className="mt-2 text-xs text-slate-500">確認後切回這個頁面即可，網頁仍在等待授權結果。</p>
                </div>
              )}

              <button
                type="button"
                onClick={() => void loginWithPhone()}
                className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                改用手機號碼＋驗證碼
              </button>
            </div>
          </section>
        )}

        {me && (
          <>
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">已登入 {me.displayName}</h2>
                  <p className="mt-1 text-xs text-slate-500">Session 儲存在這支手機瀏覽器的 IndexedDB。</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void loadChannels()}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs hover:bg-slate-800"
                  >
                    重新整理頻道
                  </button>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800"
                  >
                    登出工具
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="font-semibold">3. 來源與下載佇列</h2>

              <div className="mt-4 grid gap-4">
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-300">來源私人頻道</span>
                  <select
                    value={sourceId ?? ""}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setSourceId(value || null);
                      setCandidates([]);
                    }}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3"
                  >
                    <option value="">請選擇來源</option>
                    {channels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        {channel.title}{channel.unreadCount ? `（未讀 ${channel.unreadCount}）` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-2">
                  <span className="text-sm text-slate-300">目的地</span>
                  {destination ? (
                    <div className="flex items-center justify-between rounded-xl border border-emerald-900 bg-emerald-950/30 px-3 py-3">
                      <div>
                        <p className="font-medium text-emerald-100">{destination.title}</p>
                        <p className="text-xs text-emerald-300/70">私人 Channel，供 Turrit 自動下載</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDestinationId(null)}
                        className="text-xs text-slate-400 underline"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void ensureQueueChannel()}
                      className="rounded-xl border border-emerald-800 bg-emerald-950/30 px-4 py-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-950/60"
                    >
                      建立／取得「{QUEUE_TITLE}」
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="font-semibold">4. 選擇範圍</h2>

              <div className="mt-4 grid gap-3">
                <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <input
                    type="radio"
                    name="range"
                    checked={rangeMode === "unread"}
                    onChange={() => setRangeMode("unread")}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium">目前未讀</span>
                    <span className="text-xs text-slate-500">
                      依 Telegram 的 lastReadIngoing 判斷；掃描本身不會把來源頻道標成已讀。
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <input
                    type="radio"
                    name="range"
                    checked={rangeMode === "date"}
                    onChange={() => setRangeMode("date")}
                    className="mt-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">指定日期之後</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(event) => setFromDate(event.target.value)}
                      disabled={rangeMode !== "date"}
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 disabled:opacity-40"
                    />
                  </span>
                </label>

                {source && rangeMode === "unread" && (
                  <p className="text-xs text-slate-500">
                    目前 Telegram 回報：未讀 {source.unreadCount} 則，最後已讀訊息 ID {source.lastReadIngoing}。
                  </p>
                )}

                <button
                  type="button"
                  disabled={!source || !destinationId || scanning || forwarding}
                  onClick={() => void scanVideos()}
                  className="rounded-xl bg-indigo-500 px-4 py-3 font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {scanning ? "掃描中…" : "掃描影片"}
                </button>
              </div>
            </section>

            {(candidates.length > 0 || protectedCount > 0 || alreadyDoneCount > 0) && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <h2 className="font-semibold">5. 掃描結果</h2>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-950 p-3">
                    <div className="text-2xl font-bold text-sky-300">{candidates.length}</div>
                    <div className="text-xs text-slate-500">可搬運</div>
                  </div>
                  <div className="rounded-xl bg-slate-950 p-3">
                    <div className="text-2xl font-bold text-slate-300">{alreadyDoneCount}</div>
                    <div className="text-xs text-slate-500">已搬過</div>
                  </div>
                  <div className="rounded-xl bg-slate-950 p-3">
                    <div className="text-2xl font-bold text-amber-300">{protectedCount}</div>
                    <div className="text-xs text-slate-500">禁止轉發</div>
                  </div>
                </div>

                {candidates.length > 0 && (
                  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-400">
                    最新：{formatDate(candidates[0].date)}
                    <br />
                    最舊：{formatDate(candidates[candidates.length - 1].date)}
                  </div>
                )}

                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    disabled={candidates.length === 0 || forwarding}
                    onClick={() => void forwardVideos()}
                    className="rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
                  >
                    {forwarding ? `轉發中 ${forwardedCount} / ${candidates.length}` : `開始轉發 ${candidates.length} 支影片`}
                  </button>
                  <button
                    type="button"
                    disabled={!sourceId || !destinationId || forwarding}
                    onClick={resetForwardedHistory}
                    className="rounded-xl border border-slate-800 px-4 py-2 text-xs text-slate-500 hover:bg-slate-800"
                  >
                    清除這組來源／目的地的「已搬過」紀錄
                  </button>
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
              <h2 className="font-semibold text-slate-200">Turrit 端還要做一次</h2>
              <p className="mt-2 leading-6">
                在 Turrit 對頻道影片開啟 Wi-Fi 自動下載，並把下載位置設成你要的資料夾。之後本工具只負責把舊影片變成下載佇列中的新訊息。
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
