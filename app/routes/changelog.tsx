// app/routes/changelog.tsx
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { loadChangelogItems, type ChangelogItem } from "../lib/changelog.server";

export async function loader(args: LoaderFunctionArgs) {
  return loadChangelogItems(args);
}


function Tag({ t }: { t?: ChangelogItem["tag"] }) {
  const map = { add: "新增", fix: "修正", change: "變更", docs: "文件" } as const;
  return t ? <span className="chip">{map[t]}</span> : null;
}

export default function ChangelogPage() {
  const items = useLoaderData() as ChangelogItem[];
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
