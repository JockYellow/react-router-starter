import { useEffect, useRef, useState } from "react";

/**
 * 隱藏的管理入口：
 * - 本機 DEV 自動顯示（加速開發）
 * - 非 DEV：在右下角隱藏熱區「連點 5 下」→ 跳出密碼 prompt →
 *   密碼正確即解鎖並記錄於 localStorage，之後同瀏覽器都會顯示。
 *
 * 注意：這不是嚴格安全機制，僅用於避免一般訪客看到入口。
 * 建議將密碼設在環境變數 `VITE_ADMIN_PASS`（或預設 "letmein"）。
 */
export default function DevMenu() {
  const [show, setShow] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  const tapCount = useRef(0);
  const tapTimer = useRef<number | null>(null);

  const handleSecretTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) {
      window.clearTimeout(tapTimer.current);
    }
    tapTimer.current = window.setTimeout(() => {
      tapCount.current = 0;
    }, 1600);

    if (tapCount.current >= 5) {
      tapCount.current = 0;
      localStorage.setItem("showAdminMenu", "1");
      setShow(true);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("showAdminMenu") === "1";
    const host = window.location.hostname;
    const isLocalHost =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.");

    setIsLocal(import.meta.env.DEV || isLocalHost);

    if (import.meta.env.DEV || isLocalHost || stored) {
      setShow(true);
    }
    return () => {
      if (tapTimer.current) window.clearTimeout(tapTimer.current);
    };
  }, []);

  return (
    <>
      {/* 右下角隱藏熱區：點擊 5 下觸發密碼驗證 */}
      <button
        type="button"
        aria-label="Admin unlock area"
        onClick={handleSecretTap}
        className="fixed bottom-4 right-4 h-10 w-10 opacity-0"
        style={{ zIndex: 40 }}
      />

      {show && (
        <div className="fixed bottom-4 right-4 z-50">
          {isLocal ? (
            <a
              href="http://127.0.0.1:43210/admin/"
              className="px-4 py-2 rounded-xl shadow-md bg-black/80 text-white text-sm hover:bg-black"
            >
              管理後台
            </a>
          ) : (
            <a
              href="/admin"
              title="Blog 管理"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/80 text-white text-lg shadow-md hover:bg-black"
            >
              ✎
            </a>
          )}
        </div>
      )}
    </>
  );
}
