import { useState } from "react";
import { Form, Link, useLoaderData, useActionData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Trash2, Pencil, Plus } from "lucide-react";

import { requireAdmin } from "../../features/admin/admin-auth.server";
import { requireBlogDb } from "../../lib/d1.server";
import {
  getAllChangelogs,
  upsertChangelog,
  deleteChangelog,
} from "../../features/changelog/changelog.d1.server";
import type { Changelog, ChangelogTag } from "../../features/changelog/changelog.d1.server";
import { AdminNav } from "../../components/AdminNav";

type LoaderData = { changelogs: Changelog[] };
type ActionData = { error?: string } | null;

export async function loader({ request, context }: LoaderFunctionArgs) {
  requireAdmin(request, context);
  const db = requireBlogDb(context);
  const changelogs = await getAllChangelogs(db);
  return { changelogs };
}

export async function action({ request, context }: ActionFunctionArgs) {
  requireAdmin(request, context);
  const db = requireBlogDb(context);
  const formData = await request.formData();
  const intent = (formData.get("intent") ?? "").toString();

  if (intent === "delete") {
    const id = parseInt((formData.get("id") ?? "0").toString(), 10);
    if (!id) return { error: "id 無效" };
    await deleteChangelog(db, id);
    return null;
  }

  if (intent === "upsert") {
    const slug = (formData.get("slug") ?? "").toString().trim();
    const date = (formData.get("date") ?? "").toString().trim();
    const title = (formData.get("title") ?? "").toString().trim();
    const notesRaw = (formData.get("notes") ?? "").toString();
    const tag = (formData.get("tag") ?? "").toString().trim() || null;

    if (!slug || !date || !title) return { error: "Slug、日期與標題為必填" };

    const notes = notesRaw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    await upsertChangelog(db, { slug, date, title, notes, tag });
    return null;
  }

  return { error: "未知操作" };
}

const EMPTY_FORM = {
  id: "",
  slug: "",
  date: "",
  title: "",
  notes: "",
  tag: "" as ChangelogTag | "",
};

const TAG_OPTIONS: { value: ChangelogTag | ""; label: string }[] = [
  { value: "", label: "無標籤" },
  { value: "add", label: "新增功能" },
  { value: "fix", label: "修正" },
  { value: "change", label: "更改" },
  { value: "docs", label: "文件" },
];

const TAG_COLORS: Record<ChangelogTag, string> = {
  add: "bg-emerald-100 text-emerald-700",
  fix: "bg-red-100 text-red-700",
  change: "bg-amber-100 text-amber-700",
  docs: "bg-blue-100 text-blue-700",
};

export default function AdminChangelog() {
  const { changelogs } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [formValues, setFormValues] = useState(EMPTY_FORM);

  function loadForEdit(log: Changelog) {
    setFormValues({
      id: String(log.id),
      slug: log.slug,
      date: log.date,
      title: log.title,
      notes: log.notes.join("\n"),
      tag: log.tag ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setFormValues(EMPTY_FORM);
  }

  const isEditing = !!formValues.id;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <header className="space-y-4">
        <div>
          <p className="eyebrow text-neutral-500">Admin</p>
          <h1 className="text-3xl font-bold text-neutral-900">Changelog 管理</h1>
          <p className="text-sm text-neutral-600">管理網站更新紀錄，直接寫入 D1。</p>
        </div>
        <AdminNav active="changelog" />
      </header>

      {/* 表單 */}
      <section className="card bg-white/95 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-neutral-900">
              {isEditing ? `編輯：${formValues.title}` : "新增更新紀錄"}
            </p>
            <p className="text-xs text-neutral-500">同 slug 會自動覆蓋。</p>
          </div>
          {isEditing && (
            <button type="button" onClick={resetForm} className="btn-ghost text-xs">
              取消編輯
            </button>
          )}
        </div>

        {actionData?.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {actionData.error}
          </p>
        )}

        <Form method="post" className="space-y-3" onSubmit={() => setTimeout(resetForm, 200)}>
          <input type="hidden" name="intent" value="upsert" />
          {isEditing && <input type="hidden" name="id" value={formValues.id} />}

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">Slug *</label>
              <input
                name="slug"
                placeholder="v1-2-0"
                className="input text-sm"
                value={formValues.slug}
                onChange={(e) => setFormValues((p) => ({ ...p, slug: e.target.value }))}
                required
                disabled={isEditing}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">日期 *</label>
              <input
                name="date"
                type="date"
                className="input text-sm"
                value={formValues.date}
                onChange={(e) => setFormValues((p) => ({ ...p, date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">標籤</label>
              <select
                name="tag"
                className="input text-sm"
                value={formValues.tag}
                onChange={(e) =>
                  setFormValues((p) => ({ ...p, tag: e.target.value as ChangelogTag | "" }))
                }
              >
                {TAG_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">標題 *</label>
            <input
              name="title"
              placeholder="版本標題或更新摘要"
              className="input text-sm"
              value={formValues.title}
              onChange={(e) => setFormValues((p) => ({ ...p, title: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">
              更新內容
              <span className="text-neutral-400 font-normal ml-1">（每行一條，會自動轉為清單）</span>
            </label>
            <textarea
              name="notes"
              rows={5}
              placeholder={"每行輸入一條更新內容\n例如：新增 Changelog D1 管理頁\n修正 home.tsx 讀取問題"}
              className="input text-sm resize-y font-mono"
              value={formValues.notes}
              onChange={(e) => setFormValues((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>

          <button type="submit" className="btn-primary flex items-center gap-2" disabled={isSaving}>
            <Plus size={15} />
            {isSaving ? "儲存中…" : isEditing ? "更新紀錄" : "新增紀錄"}
          </button>
        </Form>
      </section>

      {/* 現有紀錄列表 */}
      <section className="space-y-3">
        <h2 className="section-title text-lg">現有紀錄（{changelogs.length} 筆）</h2>
        {changelogs.length === 0 && (
          <p className="text-sm text-neutral-500 bg-warm-50 rounded-xl px-4 py-8 text-center">
            尚無更新紀錄，請使用上方表單新增。
          </p>
        )}
        {changelogs.map((log) => (
          <div key={log.id} className="card bg-white/95 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-bold text-neutral-900">{log.title}</span>
                <span className="chip text-[10px]">{log.slug}</span>
                <span className="text-[10px] font-mono text-neutral-400">{log.date}</span>
                {log.tag && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TAG_COLORS[log.tag]}`}
                  >
                    {log.tag}
                  </span>
                )}
              </div>
              {log.notes.length > 0 && (
                <ul className="text-xs text-neutral-500 space-y-0.5 list-disc list-inside">
                  {log.notes.slice(0, 3).map((note, i) => (
                    <li key={i} className="line-clamp-1">
                      {note}
                    </li>
                  ))}
                  {log.notes.length > 3 && (
                    <li className="text-neutral-400">…還有 {log.notes.length - 3} 條</li>
                  )}
                </ul>
              )}
              <p className="text-[10px] text-neutral-400 mt-1">
                更新：{new Date(log.updatedAt).toLocaleString("zh-Hant")}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => loadForEdit(log)}
                className="btn-ghost text-xs flex items-center gap-1"
              >
                <Pencil size={13} />
                編輯
              </button>
              <Form method="post" className="inline">
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="id" value={log.id} />
                <button
                  type="submit"
                  className="btn-ghost text-xs flex items-center gap-1 text-red-500 hover:bg-red-50"
                  onClick={(e) => {
                    if (!confirm(`確定要刪除「${log.title}」？`)) {
                      e.preventDefault();
                    }
                  }}
                >
                  <Trash2 size={13} />
                  刪除
                </button>
              </Form>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
