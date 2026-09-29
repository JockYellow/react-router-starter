import { useEffect, useMemo, useRef, useState } from "react";

const API_ID_KEY = "telegram-mover-api-id";
const API_HASH_KEY = "telegram-mover-api-hash";
const SESSION_NAME = "telegram-mover-session-v1";
const INDEX_FILE = ".telegram-mover-index.json";
const INDEX_BACKUP_FILE = ".telegram-mover-index.backup.json";
const NOMEDIA_FILE = ".nomedia";
const SCAN_LIMIT = 5000;
const MAX_RETRIES = 3;
const RESUME_ALIGNMENT = 4096;
const STALL_TIMEOUT_MS = 45_000;

type ChannelOption = {
  id: number;
  title: string;
  username: string | null;
  unreadCount: number;
  lastReadIngoing: number;
};

type RangeMode = "unread" | "date";
type DownloadEntryStatus = "complete" | "partial" | "failed";

type DownloadIndexEntry = {
  sourceChannelId: number;
  messageId: number;
  uniqueFileId: string;
  fileName: string;
  expectedSize: number;
  downloadedBytes: number;
  status: DownloadEntryStatus;
  updatedAt: string;
  completedAt?: string;
  error?: string;
};

type DownloadIndex = {
  version: 1;
  entries: Record<string, DownloadIndexEntry>;
};

type VideoCandidate = {
  id: number;
  date: Date;
  media: any;
  uniqueFileId: string;
  originalFileName: string | null;
  targetFileName: string;
  fileSize: number;
  existingBytes: number;
  mimeType: string;
};

type ScanSummary = {
  protectedCount: number;
  invalidCount: number;
  alreadyDoneCount: number;
  duplicateCount: number;
  recoveredCount: number;
};

type ActiveProgress = {
  messageId: number;
  fileName: string;
  downloaded: number;
  total: number;
  index: number;
  count: number;
};

let telegramClient: any = null;

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function emptyIndex(): DownloadIndex {
  return { version: 1, entries: {} };
}

function messageKey(sourceId: number, messageId: number) {
  return String(sourceId) + ":" + String(messageId);
}

function sanitizeFileName(value: string) {
  const cleaned = value
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 140) || "video";
}

function extensionForMime(mimeType: string) {
  const value = mimeType.toLowerCase();
  if (value.includes("webm")) return ".webm";
  if (value.includes("quicktime")) return ".mov";
  if (value.includes("matroska")) return ".mkv";
  return ".mp4";
}

function makeTargetFileName(
  sourceId: number,
  messageId: number,
  date: Date,
  originalFileName: string | null,
  mimeType: string,
) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const sourceToken = String(Math.abs(sourceId));
  let original = sanitizeFileName(originalFileName || "video" + extensionForMime(mimeType));
  if (!/\.[a-z0-9]{2,6}$/i.test(original)) {
    original += extensionForMime(mimeType);
  }
  return year + month + day + "_" + sourceToken + "_" + messageId + "_" + original;
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

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return value.toFixed(index >= 3 ? 2 : 1) + " " + units[index];
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function getFileIfExists(directory: any, fileName: string) {
  try {
    return await directory.getFileHandle(fileName);
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") return null;
    throw error;
  }
}

async function getFileSize(directory: any, fileName: string) {
  const handle = await getFileIfExists(directory, fileName);
  if (!handle) return null;
  const file = await handle.getFile();
  return file.size;
}

async function readTextFile(directory: any, fileName: string) {
  const handle = await getFileIfExists(directory, fileName);
  if (!handle) return null;
  const file = await handle.getFile();
  return file.text();
}

async function writeTextFile(directory: any, fileName: string, content: string) {
  const handle = await directory.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function loadIndex(directory: any): Promise<DownloadIndex> {
  for (const fileName of [INDEX_FILE, INDEX_BACKUP_FILE]) {
    try {
      const raw = await readTextFile(directory, fileName);
      if (!raw?.trim()) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1 && parsed.entries && typeof parsed.entries === "object") {
        return parsed as DownloadIndex;
      }
    } catch {
      // Try the backup copy.
    }
  }
  return emptyIndex();
}

async function persistIndex(directory: any, index: DownloadIndex) {
  const serialized = JSON.stringify(index, null, 2);
  await writeTextFile(directory, INDEX_BACKUP_FILE, serialized);
  await writeTextFile(directory, INDEX_FILE, serialized);
}

async function ensureNoMedia(directory: any) {
  await directory.getFileHandle(NOMEDIA_FILE, { create: true });
}

async function verifyCompletedEntry(directory: any, entry: DownloadIndexEntry) {
  if (entry.status !== "complete" || entry.expectedSize <= 0) return false;
  const actual = await getFileSize(directory, entry.fileName);
  return actual === entry.expectedSize;
}

function findCompletedByUniqueId(index: DownloadIndex, uniqueFileId: string) {
  return Object.values(index.entries).find(
    (entry) => entry.uniqueFileId === uniqueFileId && entry.status === "complete",
  );
}

class SharedRateLimiter {
  private available = 0;
  private lastUpdated = performance.now();
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly bytesPerSecond: number) {}

  throttle(bytes: number) {
    if (!this.bytesPerSecond || bytes <= 0) return Promise.resolve();

    const task = async () => {
      const now = performance.now();
      const elapsedSeconds = Math.max(0, now - this.lastUpdated) / 1000;
      const maxBurst = this.bytesPerSecond * 0.5;
      this.available = Math.min(maxBurst, this.available + elapsedSeconds * this.bytesPerSecond);
      this.lastUpdated = now;

      if (this.available >= bytes) {
        this.available -= bytes;
        return;
      }

      const missing = bytes - this.available;
      this.available = 0;
      await sleep((missing / this.bytesPerSecond) * 1000);
      this.lastUpdated = performance.now();
    };

    this.queue = this.queue.then(task, task);
    return this.queue;
  }
}

export function meta() {
  return [
    { title: "Telegram 私人影片下載器" },
    {
      name: "description",
      content: "在手機端掃描 Telegram 私人頻道影片，直接下載到指定資料夾，可限速、續傳與防重複。",
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
  const [rangeMode, setRangeMode] = useState<RangeMode>("unread");
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [directoryHandle, setDirectoryHandle] = useState<any>(null);
  const [directoryName, setDirectoryName] = useState("");
  const indexRef = useRef<DownloadIndex>(emptyIndex());

  const [scanning, setScanning] = useState(false);
  const [candidates, setCandidates] = useState<VideoCandidate[]>([]);
  const [scanSummary, setScanSummary] = useState<ScanSummary>({
    protectedCount: 0,
    invalidCount: 0,
    alreadyDoneCount: 0,
    duplicateCount: 0,
    recoveredCount: 0,
  });
  const [scanHandledIds, setScanHandledIds] = useState<number[]>([]);
  const [scanBlockerIds, setScanBlockerIds] = useState<number[]>([]);
  const [skipNotes, setSkipNotes] = useState<string[]>([]);

  const [limitEnabled, setLimitEnabled] = useState(true);
  const [limitMbps, setLimitMbps] = useState("3");
  const [markReadAfter, setMarkReadAfter] = useState(true);

  const [downloading, setDownloading] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [currentMbps, setCurrentMbps] = useState(0);
  const [activeProgress, setActiveProgress] = useState<ActiveProgress | null>(null);
  const downloadAbortRef = useRef<AbortController | null>(null);

  const source = useMemo(
    () => channels.find((channel) => channel.id === sourceId) ?? null,
    [channels, sourceId],
  );

  const plannedBytes = useMemo(
    () => candidates.reduce((sum, item) => sum + Math.max(0, item.fileSize - item.existingBytes), 0),
    [candidates],
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
          // Ignore stale client cleanup failures.
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
        setStatus("已登入：" + currentUser.displayName);
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
      setStatus("已登入：" + currentUser.displayName);
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
      setStatus("已登入：" + currentUser.displayName);
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
    setStatus("已載入 " + nextChannels.length + " 個頻道");
  }

  async function selectDirectory() {
    setError(null);

    const picker = (window as any).showDirectoryPicker;
    if (typeof picker !== "function") {
      setError("這個瀏覽器不支援資料夾寫入。請用目前的 Chrome for Android 開啟。");
      return;
    }

    try {
      const handle = await picker({
        mode: "readwrite",
        id: "telegram-private-v1",
      });

      const unsafeRootNames = new Set([
        "download",
        "downloads",
        "dcim",
        "camera",
        "pictures",
        "movies",
      ]);

      if (unsafeRootNames.has(String(handle.name || "").toLowerCase())) {
        setError("請不要直接選 Download、DCIM、Camera、Pictures 或 Movies 根目錄。請先建立一個專用子資料夾，例如 TelegramPrivate，再選它。");
        return;
      }

      await ensureNoMedia(handle);
      const loaded = await loadIndex(handle);
      indexRef.current = loaded;
      setDirectoryHandle(handle);
      setDirectoryName(handle.name || "已選資料夾");
      setCandidates([]);
      setScanHandledIds([]);
      setScanBlockerIds([]);
      setSkipNotes([]);
      setStatus(
        "資料夾已就緒：" +
          (handle.name || "未命名") +
          "；索引 " +
          Object.keys(loaded.entries).length +
          " 筆",
      );
    } catch (cause) {
      if (isAbortError(cause)) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function scanVideos() {
    if (!telegramClient || !source || !directoryHandle) return;

    setScanning(true);
    setError(null);
    setCandidates([]);
    setCompletedCount(0);
    setFailedCount(0);
    setCurrentMbps(0);
    setActiveProgress(null);

    const found: VideoCandidate[] = [];
    const handledIds: number[] = [];
    const blockerIds: number[] = [];
    const notes: string[] = [];

    let protectedCount = 0;
    let invalidCount = 0;
    let alreadyDoneCount = 0;
    let duplicateCount = 0;
    let recoveredCount = 0;
    let indexDirty = false;

    const startDate = rangeMode === "date" ? new Date(fromDate + "T00:00:00") : null;

    setStatus("重新讀取下載索引…");

    try {
      const index = await loadIndex(directoryHandle);
      indexRef.current = index;

      const params: Record<string, unknown> = { limit: SCAN_LIMIT };
      if (rangeMode === "unread") params.minId = source.lastReadIngoing;

      setStatus("掃描影片中…");

      for await (const message of telegramClient.iterHistory(source.id, params)) {
        const messageDate = message.date instanceof Date ? message.date : new Date(message.date);
        if (startDate && messageDate < startDate) break;

        const media = message.media;
        const isVideo = media?.type === "video" && !media.isAnimation;
        if (!isVideo) continue;

        if (message.isContentProtected) {
          protectedCount += 1;
          blockerIds.push(message.id);
          if (notes.length < 8) notes.push("訊息 " + message.id + "：來源啟用內容保護，跳過");
          continue;
        }

        const fileSize = Number(media.fileSize ?? 0);
        const uniqueFileId = String(media.uniqueFileId ?? "");
        const mimeType = String(media.mimeType ?? "video/mp4");

        if (!Number.isFinite(fileSize) || fileSize <= 0 || !uniqueFileId) {
          invalidCount += 1;
          blockerIds.push(message.id);
          if (notes.length < 8) notes.push("訊息 " + message.id + "：缺少可靠檔案大小或檔案識別，跳過");
          continue;
        }

        const key = messageKey(source.id, message.id);
        const existingEntry = index.entries[key];

        if (
          existingEntry &&
          existingEntry.uniqueFileId === uniqueFileId &&
          existingEntry.expectedSize === fileSize &&
          (await verifyCompletedEntry(directoryHandle, existingEntry))
        ) {
          alreadyDoneCount += 1;
          handledIds.push(message.id);
          continue;
        }

        const duplicateEntry = findCompletedByUniqueId(index, uniqueFileId);
        if (duplicateEntry && (await verifyCompletedEntry(directoryHandle, duplicateEntry))) {
          duplicateCount += 1;
          handledIds.push(message.id);
          index.entries[key] = {
            sourceChannelId: source.id,
            messageId: message.id,
            uniqueFileId,
            fileName: duplicateEntry.fileName,
            expectedSize: fileSize,
            downloadedBytes: fileSize,
            status: "complete",
            updatedAt: new Date().toISOString(),
            completedAt: duplicateEntry.completedAt || new Date().toISOString(),
          };
          indexDirty = true;
          continue;
        }

        const targetFileName = makeTargetFileName(
          source.id,
          message.id,
          messageDate,
          media.fileName ?? null,
          mimeType,
        );
        const localSize = await getFileSize(directoryHandle, targetFileName);

        if (localSize === fileSize) {
          recoveredCount += 1;
          handledIds.push(message.id);
          index.entries[key] = {
            sourceChannelId: source.id,
            messageId: message.id,
            uniqueFileId,
            fileName: targetFileName,
            expectedSize: fileSize,
            downloadedBytes: fileSize,
            status: "complete",
            updatedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          };
          indexDirty = true;
          continue;
        }

        if (localSize !== null && localSize > fileSize) {
          invalidCount += 1;
          blockerIds.push(message.id);
          if (notes.length < 8) {
            notes.push("訊息 " + message.id + "：本機同名檔比 Telegram 檔案大，為避免覆寫已跳過");
          }
          continue;
        }

        found.push({
          id: message.id,
          date: messageDate,
          media,
          uniqueFileId,
          originalFileName: media.fileName ?? null,
          targetFileName,
          fileSize,
          existingBytes: localSize ?? 0,
          mimeType,
        });
      }

      found.sort((a, b) => a.id - b.id);
      handledIds.sort((a, b) => a - b);
      blockerIds.sort((a, b) => a - b);

      if (indexDirty) {
        await persistIndex(directoryHandle, index);
      }

      setCandidates(found);
      setScanHandledIds(handledIds);
      setScanBlockerIds(blockerIds);
      setSkipNotes(notes);
      setScanSummary({
        protectedCount,
        invalidCount,
        alreadyDoneCount,
        duplicateCount,
        recoveredCount,
      });

      setStatus(
        "掃描完成：待下載 " +
          found.length +
          " 支；可安全跳過 " +
          (alreadyDoneCount + duplicateCount + recoveredCount) +
          " 支",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("掃描失敗");
    } finally {
      setScanning(false);
    }
  }

  async function persistEntry(index: DownloadIndex, entry: DownloadIndexEntry) {
    index.entries[messageKey(entry.sourceChannelId, entry.messageId)] = entry;
    await persistIndex(directoryHandle, index);
  }

  async function downloadCandidate(
    candidate: VideoCandidate,
    candidateIndex: number,
    abortSignal: AbortSignal,
    limiter: SharedRateLimiter | null,
    workingIndex: DownloadIndex,
  ) {
    const key = messageKey(source!.id, candidate.id);
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      attempt += 1;
      let writable: any = null;

      try {
        const fileHandle = await directoryHandle.getFileHandle(candidate.targetFileName, { create: true });
        const currentFile = await fileHandle.getFile();

        if (currentFile.size > candidate.fileSize) {
          throw new Error("本機檔案比 Telegram 原檔大，為避免誤覆寫已停止此檔");
        }

        if (currentFile.size === candidate.fileSize) {
          const now = new Date().toISOString();
          await persistEntry(workingIndex, {
            sourceChannelId: source!.id,
            messageId: candidate.id,
            uniqueFileId: candidate.uniqueFileId,
            fileName: candidate.targetFileName,
            expectedSize: candidate.fileSize,
            downloadedBytes: candidate.fileSize,
            status: "complete",
            updatedAt: now,
            completedAt: now,
          });
          return true;
        }

        const resumeOffset = Math.floor(currentFile.size / RESUME_ALIGNMENT) * RESUME_ALIGNMENT;
        writable = await fileHandle.createWritable({ keepExistingData: true });
        await writable.truncate(resumeOffset);
        await writable.seek(resumeOffset);

        await persistEntry(workingIndex, {
          sourceChannelId: source!.id,
          messageId: candidate.id,
          uniqueFileId: candidate.uniqueFileId,
          fileName: candidate.targetFileName,
          expectedSize: candidate.fileSize,
          downloadedBytes: resumeOffset,
          status: "partial",
          updatedAt: new Date().toISOString(),
        });

        let downloaded = resumeOffset;
        let lastUiAt = performance.now();
        let speedWindowStartedAt = performance.now();
        let speedWindowBytes = 0;

        setActiveProgress({
          messageId: candidate.id,
          fileName: candidate.targetFileName,
          downloaded,
          total: candidate.fileSize,
          index: candidateIndex + 1,
          count: candidates.length,
        });

        for await (const chunk of telegramClient.downloadAsIterable(candidate.media, {
          offset: resumeOffset,
          fileSize: candidate.fileSize,
          abortSignal,
          stallTimeout: STALL_TIMEOUT_MS,
          throttle: limiter ? (chunkSize: number) => limiter.throttle(chunkSize) : undefined,
        })) {
          if (abortSignal.aborted) throw new DOMException("Aborted", "AbortError");

          await writable.write(chunk);
          downloaded += chunk.byteLength;
          speedWindowBytes += chunk.byteLength;

          const now = performance.now();
          if (now - lastUiAt >= 400 || downloaded >= candidate.fileSize) {
            setActiveProgress({
              messageId: candidate.id,
              fileName: candidate.targetFileName,
              downloaded,
              total: candidate.fileSize,
              index: candidateIndex + 1,
              count: candidates.length,
            });
            lastUiAt = now;
          }

          if (now - speedWindowStartedAt >= 1000) {
            const elapsedSeconds = (now - speedWindowStartedAt) / 1000;
            setCurrentMbps((speedWindowBytes * 8) / elapsedSeconds / 1_000_000);
            speedWindowBytes = 0;
            speedWindowStartedAt = now;
          }
        }

        await writable.close();
        writable = null;

        const completedFile = await fileHandle.getFile();
        if (completedFile.size !== candidate.fileSize) {
          throw new Error(
            "下載後大小不符：預期 " +
              candidate.fileSize +
              " bytes，實際 " +
              completedFile.size +
              " bytes",
          );
        }

        const now = new Date().toISOString();
        await persistEntry(workingIndex, {
          sourceChannelId: source!.id,
          messageId: candidate.id,
          uniqueFileId: candidate.uniqueFileId,
          fileName: candidate.targetFileName,
          expectedSize: candidate.fileSize,
          downloadedBytes: candidate.fileSize,
          status: "complete",
          updatedAt: now,
          completedAt: now,
        });

        return true;
      } catch (cause) {
        if (writable) {
          try {
            await writable.abort();
          } catch {
            // Ignore cleanup failures.
          }
        }

        if (isAbortError(cause) || abortSignal.aborted) {
          const partialSize = (await getFileSize(directoryHandle, candidate.targetFileName)) ?? 0;
          await persistEntry(workingIndex, {
            sourceChannelId: source!.id,
            messageId: candidate.id,
            uniqueFileId: candidate.uniqueFileId,
            fileName: candidate.targetFileName,
            expectedSize: candidate.fileSize,
            downloadedBytes: partialSize,
            status: "partial",
            updatedAt: new Date().toISOString(),
          });
          throw cause;
        }

        if (attempt < MAX_RETRIES) {
          setStatus(
            "訊息 " +
              candidate.id +
              " 下載失敗，" +
              (attempt + 1) +
              "/" +
              MAX_RETRIES +
              " 次重試中…",
          );
          await sleep(1200 * attempt);
          continue;
        }

        const partialSize = (await getFileSize(directoryHandle, candidate.targetFileName)) ?? 0;
        await persistEntry(workingIndex, {
          sourceChannelId: source!.id,
          messageId: candidate.id,
          uniqueFileId: candidate.uniqueFileId,
          fileName: candidate.targetFileName,
          expectedSize: candidate.fileSize,
          downloadedBytes: partialSize,
          status: "failed",
          updatedAt: new Date().toISOString(),
          error: cause instanceof Error ? cause.message : String(cause),
        });

        return false;
      }
    }

    return false;
  }

  async function markSafeReadBoundary(handledIds: Set<number>, blockerIds: Set<number>) {
    if (!markReadAfter || !telegramClient || !source || handledIds.size === 0) return null;

    let target = Math.max(...handledIds);
    const blockingBeforeTarget = [...blockerIds].filter((id) => id <= target);
    if (blockingBeforeTarget.length > 0) {
      target = Math.min(target, Math.min(...blockingBeforeTarget) - 1);
    }

    if (target <= 0) return null;
    if (rangeMode === "unread" && target <= source.lastReadIngoing) return null;

    await telegramClient.readHistory(source.id, { maxId: target });
    setChannels((current) =>
      current.map((channel) =>
        channel.id === source.id
          ? {
              ...channel,
              lastReadIngoing: Math.max(channel.lastReadIngoing, target),
              unreadCount: 0,
            }
          : channel,
      ),
    );
    return target;
  }

  async function startDownload() {
    if (!telegramClient || !source || !directoryHandle) return;
    if (candidates.length === 0 && scanHandledIds.length === 0) return;

    const parsedLimit = Number(limitMbps);
    if (limitEnabled && (!Number.isFinite(parsedLimit) || parsedLimit <= 0)) {
      setError("限速值必須大於 0 Mbps");
      return;
    }

    const confirmation =
      "即將處理 " +
      (candidates.length + scanHandledIds.length) +
      " 支影片。\n" +
      "待下載：" +
      candidates.length +
      " 支（約 " +
      formatBytes(plannedBytes) +
      "）\n" +
      "已存在／防重複跳過：" +
      scanHandledIds.length +
      " 支\n" +
      "速度：" +
      (limitEnabled ? parsedLimit + " Mbps" : "不限速") +
      "\n" +
      (markReadAfter
        ? "完成後會把 Telegram 已讀位置推進到安全邊界；失敗／受保護影片不會被跨過。"
        : "不修改 Telegram 已讀狀態。");

    if (!window.confirm(confirmation)) return;

    setDownloading(true);
    setError(null);
    setCompletedCount(0);
    setFailedCount(0);
    setCurrentMbps(0);

    const abortController = new AbortController();
    downloadAbortRef.current = abortController;

    const handledIds = new Set<number>(scanHandledIds);
    const blockerIds = new Set<number>(scanBlockerIds);
    const workingIndex = indexRef.current;
    const bytesPerSecond = limitEnabled ? (parsedLimit * 1_000_000) / 8 : 0;
    const limiter = limitEnabled ? new SharedRateLimiter(bytesPerSecond) : null;

    let wakeLock: any = null;
    let completed = 0;
    let failed = 0;
    let stopped = false;

    try {
      if ((navigator as any).wakeLock?.request) {
        try {
          wakeLock = await (navigator as any).wakeLock.request("screen");
        } catch {
          // Download still works without a wake lock.
        }
      }

      for (let index = 0; index < candidates.length; index += 1) {
        if (abortController.signal.aborted) {
          stopped = true;
          break;
        }

        const candidate = candidates[index];
        setStatus(
          "下載中：" +
            (index + 1) +
            " / " +
            candidates.length +
            "（訊息 " +
            candidate.id +
            "）",
        );

        try {
          const ok = await downloadCandidate(
            candidate,
            index,
            abortController.signal,
            limiter,
            workingIndex,
          );

          if (ok) {
            handledIds.add(candidate.id);
            completed += 1;
            setCompletedCount(completed);
          } else {
            blockerIds.add(candidate.id);
            failed += 1;
            setFailedCount(failed);
          }
        } catch (cause) {
          if (isAbortError(cause) || abortController.signal.aborted) {
            stopped = true;
            blockerIds.add(candidate.id);
            break;
          }
          blockerIds.add(candidate.id);
          failed += 1;
          setFailedCount(failed);
        }
      }

      const readTarget = await markSafeReadBoundary(handledIds, blockerIds);

      if (stopped) {
        setStatus(
          "已停止，可下次續傳。" +
            (readTarget ? " 已讀安全更新至訊息 " + readTarget + "。" : ""),
        );
      } else {
        setStatus(
          "完成：新下載 " +
            completed +
            " 支，失敗 " +
            failed +
            " 支。" +
            (readTarget ? " 已讀安全更新至訊息 " + readTarget + "。" : ""),
        );
      }

      await scanVideos();
    } catch (cause) {
      if (isAbortError(cause) || abortController.signal.aborted) {
        setStatus("已停止，可下次續傳");
      } else {
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus("下載流程中斷；已完成與部分下載紀錄都已保存");
      }
    } finally {
      try {
        await wakeLock?.release();
      } catch {
        // Ignore wake lock release errors.
      }
      downloadAbortRef.current = null;
      setDownloading(false);
      setCurrentMbps(0);
      setActiveProgress(null);
    }
  }

  function stopDownload() {
    downloadAbortRef.current?.abort();
    setStatus("正在停止；目前檔案會保留為可續傳狀態…");
  }

  async function logout() {
    if (!telegramClient) return;
    if (!window.confirm("要登出這個工具的 Telegram Session 嗎？手機裡已下載的影片不受影響。")) return;

    setError(null);
    try {
      await telegramClient.logOut();
      setMe(null);
      setChannels([]);
      setSourceId(null);
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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">
            Local-first Telegram utility
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Telegram 私人影片下載器</h1>
          <p className="text-sm leading-6 text-slate-400">
            直接從 Telegram 下載到這支手機的指定資料夾，不經本站後端、不轉發到其他頻道。資料夾會建立 .nomedia，避免一般相簿與媒體庫自動收錄。
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">狀態</h2>
              <p className="mt-1 text-sm text-slate-400">{status}</p>
            </div>
            {(booting || scanning || downloading) && (
              <span className="text-xs text-sky-300">處理中…</span>
            )}
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
                    <p className="mt-1 text-xs text-slate-400">
                      有效至 {qrExpiresAt.toLocaleTimeString("zh-TW")}
                    </p>
                  )}
                  <a
                    href={qrUrl}
                    className="mt-3 block rounded-xl bg-sky-500 px-4 py-3 text-center font-semibold text-slate-950"
                  >
                    在 Telegram App 開啟
                  </a>
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
                  <p className="mt-1 text-xs text-slate-500">
                    Session 儲存在這支手機瀏覽器的 IndexedDB。
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void loadChannels()}
                    disabled={downloading}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs hover:bg-slate-800 disabled:opacity-40"
                  >
                    重新整理頻道
                  </button>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    disabled={downloading}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40"
                  >
                    登出工具
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="font-semibold">3. 來源與儲存位置</h2>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-300">來源私人頻道</span>
                  <select
                    value={sourceId ?? ""}
                    disabled={downloading}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setSourceId(value || null);
                      setCandidates([]);
                      setScanHandledIds([]);
                      setScanBlockerIds([]);
                    }}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 disabled:opacity-40"
                  >
                    <option value="">請選擇來源</option>
                    {channels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        {channel.title}
                        {channel.unreadCount ? "（未讀 " + channel.unreadCount + "）" : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-2">
                  <span className="text-sm text-slate-300">手機資料夾</span>
                  {directoryHandle ? (
                    <div className="rounded-xl border border-emerald-900 bg-emerald-950/30 px-3 py-3">
                      <p className="font-medium text-emerald-100">{directoryName}</p>
                      <p className="mt-1 text-xs text-emerald-300/70">
                        已建立 .nomedia；VLC 仍可用「瀏覽」直接開啟影片。
                      </p>
                      <button
                        type="button"
                        onClick={() => void selectDirectory()}
                        disabled={downloading}
                        className="mt-2 text-xs text-slate-400 underline disabled:opacity-40"
                      >
                        改選資料夾
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void selectDirectory()}
                      className="rounded-xl border border-emerald-800 bg-emerald-950/30 px-4 py-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-950/60"
                    >
                      選擇專用下載資料夾
                    </button>
                  )}
                  <p className="text-xs leading-5 text-slate-500">
                    防呆：不允許直接選 Download、DCIM、Camera、Pictures 或 Movies 根目錄，避免 .nomedia 影響其他媒體。
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="font-semibold">4. 下載範圍與行為</h2>

              <div className="mt-4 grid gap-3">
                <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <input
                    type="radio"
                    name="range"
                    checked={rangeMode === "unread"}
                    disabled={downloading}
                    onChange={() => setRangeMode("unread")}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium">目前未讀</span>
                    <span className="text-xs text-slate-500">
                      依 Telegram 的 lastReadIngoing 判斷；掃描與下載本身不會自動標記已讀。
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <input
                    type="radio"
                    name="range"
                    checked={rangeMode === "date"}
                    disabled={downloading}
                    onChange={() => setRangeMode("date")}
                    className="mt-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">指定日期之後</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(event) => setFromDate(event.target.value)}
                      disabled={rangeMode !== "date" || downloading}
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 disabled:opacity-40"
                    />
                  </span>
                </label>

                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={limitEnabled}
                      disabled={downloading}
                      onChange={(event) => setLimitEnabled(event.target.checked)}
                    />
                    <span className="font-medium">限制總下載速度</span>
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      inputMode="decimal"
                      value={limitMbps}
                      disabled={!limitEnabled || downloading}
                      onChange={(event) => setLimitMbps(event.target.value)}
                      className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 disabled:opacity-40"
                    />
                    <span className="text-sm text-slate-400">Mbps</span>
                    {!limitEnabled && <span className="text-xs text-emerald-300">目前不限速</span>}
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <input
                    type="checkbox"
                    checked={markReadAfter}
                    disabled={downloading}
                    onChange={(event) => setMarkReadAfter(event.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium">下載後更新 Telegram 已讀位置</span>
                    <span className="text-xs leading-5 text-slate-500">
                      只推進到安全邊界；如果中間有下載失敗、內容保護或異常檔案，就不跨過它。中間的文字／圖片也會隨 Telegram 的 read boundary 一起變成已讀。
                    </span>
                  </span>
                </label>

                {source && rangeMode === "unread" && (
                  <p className="text-xs text-slate-500">
                    Telegram 回報：未讀 {source.unreadCount} 則，最後已讀訊息 ID {source.lastReadIngoing}。
                  </p>
                )}

                <button
                  type="button"
                  disabled={!source || !directoryHandle || scanning || downloading}
                  onClick={() => void scanVideos()}
                  className="rounded-xl bg-indigo-500 px-4 py-3 font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {scanning ? "掃描中…" : "掃描影片"}
                </button>
              </div>
            </section>

            {(candidates.length > 0 ||
              scanHandledIds.length > 0 ||
              scanSummary.protectedCount > 0 ||
              scanSummary.invalidCount > 0) && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <h2 className="font-semibold">5. 掃描結果</h2>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-950 p-3 text-center">
                    <div className="text-2xl font-bold text-sky-300">{candidates.length}</div>
                    <div className="text-xs text-slate-500">待下載</div>
                  </div>
                  <div className="rounded-xl bg-slate-950 p-3 text-center">
                    <div className="text-2xl font-bold text-emerald-300">{scanHandledIds.length}</div>
                    <div className="text-xs text-slate-500">安全跳過</div>
                  </div>
                  <div className="rounded-xl bg-slate-950 p-3 text-center">
                    <div className="text-2xl font-bold text-amber-300">
                      {scanSummary.protectedCount + scanSummary.invalidCount}
                    </div>
                    <div className="text-xs text-slate-500">阻擋／異常</div>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs leading-5 text-slate-400">
                  已由索引確認：{scanSummary.alreadyDoneCount} 支
                  <br />
                  同一 Telegram 檔案去重：{scanSummary.duplicateCount} 支
                  <br />
                  實體檔案大小吻合後復原紀錄：{scanSummary.recoveredCount} 支
                  <br />
                  內容保護：{scanSummary.protectedCount} 支
                  <br />
                  異常／衝突：{scanSummary.invalidCount} 支
                  <br />
                  本輪剩餘下載量：約 {formatBytes(plannedBytes)}
                </div>

                {candidates.length > 0 && (
                  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-400">
                    最舊待下載：{formatDate(candidates[0].date)}
                    <br />
                    最新待下載：{formatDate(candidates[candidates.length - 1].date)}
                  </div>
                )}

                {skipNotes.length > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-900/60 bg-amber-950/20 p-3 text-xs leading-5 text-amber-100/80">
                    {skipNotes.map((note) => (
                      <div key={note}>{note}</div>
                    ))}
                  </div>
                )}

                <div className="mt-4 grid gap-2">
                  {!downloading ? (
                    <button
                      type="button"
                      disabled={candidates.length === 0 && scanHandledIds.length === 0}
                      onClick={() => void startDownload()}
                      className="rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
                    >
                      {candidates.length > 0
                        ? "開始下載 " + candidates.length + " 支影片"
                        : "沒有新檔案；套用安全已讀位置"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopDownload}
                      className="rounded-xl border border-rose-700 bg-rose-950/30 px-4 py-3 font-semibold text-rose-200"
                    >
                      停止（保留進度，可續傳）
                    </button>
                  )}
                </div>
              </section>
            )}

            {(downloading || activeProgress || completedCount > 0 || failedCount > 0) && (
              <section className="rounded-2xl border border-sky-900 bg-sky-950/20 p-4">
                <h2 className="font-semibold text-sky-100">下載進度</h2>
                {activeProgress && (
                  <div className="mt-3">
                    <p className="truncate text-sm text-slate-200">{activeProgress.fileName}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {activeProgress.index} / {activeProgress.count} ・{" "}
                      {formatBytes(activeProgress.downloaded)} / {formatBytes(activeProgress.total)}
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-sky-400 transition-[width]"
                        style={{
                          width:
                            Math.min(
                              100,
                              (activeProgress.downloaded / Math.max(1, activeProgress.total)) * 100,
                            ).toFixed(1) + "%",
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-slate-950 p-2">
                    <div className="text-lg font-semibold text-emerald-300">{completedCount}</div>
                    <div className="text-slate-500">完成</div>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2">
                    <div className="text-lg font-semibold text-rose-300">{failedCount}</div>
                    <div className="text-slate-500">失敗</div>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2">
                    <div className="text-lg font-semibold text-sky-300">{currentMbps.toFixed(2)}</div>
                    <div className="text-slate-500">Mbps</div>
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
              <h2 className="font-semibold text-slate-200">內建防呆</h2>
              <p className="mt-2 leading-6">
                已完成檔案會用來源訊息、Telegram uniqueFileId、索引與實體檔案大小交叉確認；部分檔案採 4 KB 對齊續傳；同名檔異常變大不覆寫；內容保護與缺少可靠 metadata 的影片直接跳過；單檔最多自動重試 3 次，失敗後繼續下一支。索引每次寫入都有備份副本。
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
