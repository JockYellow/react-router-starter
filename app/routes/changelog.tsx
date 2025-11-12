// app/routes/changelog.tsx
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";

type Item = {
  date: string;
  title: string;
  notes?: string[];
  tag?: "add" | "fix" | "change" | "docs";
  filename?: string; 
};

export async function loader(_args: LoaderFunctionArgs) {
  // 先嘗試「dev 檔案系統讀取」，但把它包在 try/catch 裡
  if (import.meta.env.DEV) {
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const { fileURLToPath } = await import("node:url");

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const candidates = [
        path.resolve(__dirname, "../content/changelog"),
        path.resolve(process.cwd(), "app/content/changelog"),
      ];

      let contentDir: string | null = null;
      for (const p of candidates) {
        try {
          const stat = await fs.stat(p);
          if (stat.isDirectory()) { contentDir = p; break; }
        } catch {}
      }

      if (contentDir) {
        const NAME_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9\-]+\.json$/i;
        const files = (await fs.readdir(contentDir)).filter(f => NAME_RE.test(f));
        const items: Item[] = [];
        for (const f of files) {
          try {
            const raw = await fs.readFile(path.join(contentDir, f), "utf8");
            const data = JSON.parse(raw) as Item;
            items.push({ ...data, filename: f });
          } catch {}
        }
        items.sort((a, b) => (a.date < b.date ? 1 : -1));
        return items;
      }
      // 若找不到資料夾，繼續走 fallback
    } catch {
      // 只要 import('node:fs/...') 失敗（多半因為 SPA），就走 fallback
    }
  }

  // fallback（dev SPA 或 prod 都可用）
  const modules = import.meta.glob("../content/changelog/*.json", { eager: true });
  const items: Item[] = Object.entries(modules).map(([p, m]: any) => {
    const data = m.default ?? m;
    const filename = p.split("/").pop();
    return { ...data, filename };
  });
  items.sort((a, b) => (a.date < b.date ? 1 : -1));
  return items;
}


function Tag({ t }: { t?: Item["tag"] }) {
  const map = { add: "新增", fix: "修正", change: "變更", docs: "文件" } as const;
  return t ? <span className="chip">{map[t]}</span> : null;
}

export default function ChangelogPage() {
  const items = useLoaderData() as Item[];
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">更新日誌</h1>
        {import.meta.env.DEV ? (
          <p className="mt-2 text-neutral-600">
            開發模式即時讀取檔案（app/content/changelog/）
          </p>
        ) : (
          <p className="mt-2 text-neutral-600">靜態內容（build 時打包）</p>
        )}
        <p className="mt-2"><Link to="/" className="link-soft">回首頁</Link></p>
      </header>

      <div className="space-y-4">
        {items.map((log, i) => (
          <article key={(log.filename ?? "") + i} className="card hover-raise">
            <div className="flex items-center gap-3 text-sm text-neutral-600">
              <time dateTime={log.date} className="font-medium text-neutral-800">{log.date}</time>
              <Tag t={log.tag} />
            </div>
            <h2 className="mt-2 text-lg font-semibold">{log.title}</h2>
            {log.notes?.length ? (
              <ul className="mt-2 list-disc pl-5 text-sm text-neutral-700 space-y-1">
                {log.notes.map((n, j) => <li key={j}>{n}</li>)}
              </ul>
            ) : null}
            {import.meta.env.DEV && log.filename ? (
              <p className="mt-2 text-xs text-neutral-400">{log.filename}</p>
            ) : null}
          </article>
        ))}
        {!items.length && (
          <p className="text-neutral-500">目前沒有日誌。到後台新增一筆試試。</p>
        )}
      </div>
    </main>
  );
}
