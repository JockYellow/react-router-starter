import { useEffect, useState } from "react";
import { Link } from "react-router";

type AdminSection = "blog" | "changelog" | "resume" | "ops";

interface AdminNavProps {
  active: AdminSection;
}

const NAV_ITEMS: { id: AdminSection; label: string; to: string; localOnly?: boolean }[] = [
  { id: "blog", label: "Blog", to: "/admin" },
  { id: "changelog", label: "Changelog", to: "/admin/changelog" },
  { id: "resume", label: "客製化履歷", to: "/admin/resume-company" },
  { id: "ops", label: "Ops/Git", to: "/admin/ops", localOnly: true },
];

function isLocalHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.")
  );
}

export function AdminNav({ active }: AdminNavProps) {
  const [canUseLocalOps, setCanUseLocalOps] = useState(false);

  useEffect(() => {
    setCanUseLocalOps(isLocalHost(window.location.hostname));
  }, []);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-xl">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          if (item.localOnly && !canUseLocalOps) {
            return (
              <span
                key={item.id}
                title="僅限本機使用"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-neutral-300 cursor-not-allowed"
              >
                {item.label}
              </span>
            );
          }

          return (
            <Link
              key={item.id}
              to={item.to}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700 hover:bg-white/60"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <Link
        to="/jock_space"
        className="ml-2 text-xs text-neutral-400 hover:text-neutral-600 px-2 py-1.5"
      >
        ← 返回前台
      </Link>
    </div>
  );
}
