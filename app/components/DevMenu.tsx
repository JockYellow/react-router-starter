import { useEffect, useState } from "react";

export default function DevMenu() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (import.meta.env.DEV) setShow(true);
  }, []);
  if (!import.meta.env.DEV || !show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <a
        href="http://127.0.0.1:43210/admin/"
        target="_blank"
        rel="noreferrer"
        className="px-4 py-2 rounded-xl shadow-md bg-black/80 text-white text-sm hover:bg-black"
      >
        管理後台
      </a>
    </div>
  );
}
