// app/routes/changelog.tsx
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { getAllChangelogs, type Changelog, type ChangelogTag } from "../features/changelog/changelog.d1.server";
import { requireBlogDb } from "../lib/d1.server";

type LoaderData = {
  changelogs: Changelog[];
};

export async function loader({ context }: LoaderFunctionArgs) {
  const db = requireBlogDb(context);
  const changelogs = await getAllChangelogs(db).catch(() => [] as Changelog[]);
  return { changelogs };
}

function Tag({ t }: { t?: ChangelogTag | null }) {
  const map = { add: "新增", fix: "修正", change: "變更", docs: "文件" } as const;
  return t ? <span className="chip">{map[t]}</span> : null;
}

export default function ChangelogPage() {
  const { changelogs } = useLoaderData<LoaderData>();
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">更新日誌</h1>
        <p className="mt-2 text-neutral-600">內容由 D1 管理後台同步提供。</p>
        <p className="mt-2"><Link to="/jock_space" className="link-soft">回首頁</Link></p>
      </header>

      <div className="space-y-4">
        {changelogs.map((log) => (
          <article key={log.id} className="card hover-raise">
            <div className="flex items-center gap-3 text-sm text-neutral-600">
              <time dateTime={log.date} className="font-medium text-neutral-800">{log.date}</time>
              <Tag t={log.tag} />
            </div>
            <h2 className="mt-2 text-lg font-semibold">{log.title}</h2>
            {log.notes?.length ? (
              <ul className="mt-2 list-disc pl-5 text-sm text-neutral-700 space-y-1">
                {log.notes.map((note, noteIndex) => <li key={noteIndex}>{note}</li>)}
              </ul>
            ) : null}
          </article>
        ))}
        {!changelogs.length && (
          <p className="text-neutral-500">目前沒有日誌。到後台新增一筆試試。</p>
        )}
      </div>
    </main>
  );
}
