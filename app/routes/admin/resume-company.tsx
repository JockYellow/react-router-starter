import { useState } from "react";
import { Form, Link, useLoaderData, useActionData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Trash2, Pencil, Plus, ExternalLink } from "lucide-react";
import { AdminNav } from "../../components/AdminNav";

import { requireAdmin } from "../../features/admin/admin-auth.server";
import { requireBlogDb } from "../../lib/d1.server";
import {
  getAllCompanyPages,
  upsertCompanyPage,
  deleteCompanyPage,
} from "../../features/resume/resume.server";
import type { CompanyPage } from "../../features/resume/resume.types";

type LoaderData = { pages: CompanyPage[] };
type ActionData = { error?: string } | null;

export async function loader({ request, context }: LoaderFunctionArgs) {
  requireAdmin(request, context);
  const db = requireBlogDb(context);
  const pages = await getAllCompanyPages(db);
  return { pages };
}

export async function action({ request, context }: ActionFunctionArgs) {
  requireAdmin(request, context);
  const db = requireBlogDb(context);
  const formData = await request.formData();
  const intent = (formData.get("intent") ?? "").toString();

  if (intent === "delete") {
    const id = parseInt((formData.get("id") ?? "0").toString(), 10);
    if (!id) return { error: "id 無效" };
    await deleteCompanyPage(db, id);
    return null;
  }

  if (intent === "upsert") {
    const slug = (formData.get("slug") ?? "").toString().trim();
    const company_name = (formData.get("company_name") ?? "").toString().trim();
    const why_this_company = (formData.get("why_this_company") ?? "").toString().trim();
    const relevant_experience_raw = (formData.get("relevant_experience") ?? "").toString();
    const what_i_bring = (formData.get("what_i_bring") ?? "").toString().trim();
    const questions_or_ideas = (formData.get("questions_or_ideas") ?? "").toString().trim();

    if (!slug || !company_name) return { error: "Slug 與公司名稱為必填" };

    // 每行一條經歷，轉換為 array
    const relevant_experience = relevant_experience_raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    await upsertCompanyPage(db, {
      slug,
      company_name,
      why_this_company,
      relevant_experience,
      what_i_bring,
      questions_or_ideas,
    });
    return null;
  }

  return { error: "未知操作" };
}

// ── 空表單預設值 ──
const EMPTY_FORM = {
  slug: "",
  company_name: "",
  why_this_company: "",
  relevant_experience: "",
  what_i_bring: "",
  questions_or_ideas: "",
  id: "",
};

export default function AdminResumeCompany() {
  const { pages } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [formValues, setFormValues] = useState(EMPTY_FORM);

  function loadForEdit(page: CompanyPage) {
    let expLines = "";
    try {
      expLines = (JSON.parse(page.relevant_experience ?? "[]") as string[]).join(
        "\n",
      );
    } catch {
      expLines = "";
    }
    setFormValues({
      slug: page.slug,
      company_name: page.company_name,
      why_this_company: page.why_this_company ?? "",
      relevant_experience: expLines,
      what_i_bring: page.what_i_bring ?? "",
      questions_or_ideas: page.questions_or_ideas ?? "",
      id: String(page.id),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setFormValues(EMPTY_FORM);
  }

  const isEditing = !!formValues.id;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-neutral-500">Admin</p>
            <h1 className="text-3xl font-bold text-neutral-900">客製化公司履歷</h1>
            <p className="text-sm text-neutral-600">管理每間公司的客製化履歷頁面，可透過 /resume/:slug 分享。</p>
          </div>
          <Link to="/resume" target="_blank" className="btn-ghost flex items-center gap-1.5 shrink-0">
            主履歷
            <ExternalLink size={13} />
          </Link>
        </div>
        <AdminNav active="resume" />
      </header>

      {/* 表單 */}
      <section className="card bg-white/95 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-neutral-900">
              {isEditing ? `編輯：${formValues.company_name}` : "新增公司頁"}
            </p>
            <p className="text-xs text-neutral-500">同 slug 會自動覆蓋，空欄位會保留原值。</p>
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

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">Slug *</label>
              <input
                name="slug"
                placeholder="company-name（URL 用）"
                className="input text-sm"
                value={formValues.slug}
                onChange={(e) => setFormValues((p) => ({ ...p, slug: e.target.value }))}
                required
                disabled={isEditing} // slug is the primary key, don't allow editing
              />
              {isEditing && (
                <p className="text-[10px] text-neutral-400">編輯時 slug 不可變更</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">公司名稱 *</label>
              <input
                name="company_name"
                placeholder="公司全名"
                className="input text-sm"
                value={formValues.company_name}
                onChange={(e) => setFormValues((p) => ({ ...p, company_name: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">為什麼是這間公司</label>
            <textarea
              name="why_this_company"
              rows={3}
              placeholder="您對這間公司的理解與認同點..."
              className="input text-sm resize-y"
              value={formValues.why_this_company}
              onChange={(e) => setFormValues((p) => ({ ...p, why_this_company: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">
              對應的經歷
              <span className="text-neutral-400 font-normal ml-1">（每行一條，會自動轉為清單）</span>
            </label>
            <textarea
              name="relevant_experience"
              rows={4}
              placeholder={"與該公司需求對應的經歷，每行一條\n例如：主導 React 架構遷移，提升 40% 開發效能"}
              className="input text-sm resize-y font-mono"
              value={formValues.relevant_experience}
              onChange={(e) =>
                setFormValues((p) => ({ ...p, relevant_experience: e.target.value }))
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">我能貢獻什麼</label>
            <textarea
              name="what_i_bring"
              rows={3}
              placeholder="您能貢獻什麼、怎麼貢獻..."
              className="input text-sm resize-y"
              value={formValues.what_i_bring}
              onChange={(e) => setFormValues((p) => ({ ...p, what_i_bring: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">想聊的事</label>
            <textarea
              name="questions_or_ideas"
              rows={3}
              placeholder="對公司產品 / 技術的觀察，或想討論的方向..."
              className="input text-sm resize-y"
              value={formValues.questions_or_ideas}
              onChange={(e) =>
                setFormValues((p) => ({ ...p, questions_or_ideas: e.target.value }))
              }
            />
          </div>

          <button type="submit" className="btn-primary flex items-center gap-2" disabled={isSaving}>
            <Plus size={15} />
            {isSaving ? "儲存中…" : isEditing ? "更新公司頁" : "新增公司頁"}
          </button>
        </Form>
      </section>

      {/* 現有公司頁列表 */}
      <section className="space-y-3">
        <h2 className="section-title text-lg">現有公司頁（{pages.length} 筆）</h2>
        {pages.length === 0 && (
          <p className="text-sm text-neutral-500 bg-warm-50 rounded-xl px-4 py-8 text-center">
            尚無公司頁，請使用上方表單新增。
          </p>
        )}
        {pages.map((page) => {
          let expCount = 0;
          try {
            expCount = (JSON.parse(page.relevant_experience ?? "[]") as string[]).length;
          } catch {
            expCount = 0;
          }
          return (
            <div
              key={page.id}
              className="card bg-white/95 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-bold text-neutral-900">{page.company_name}</span>
                  <span className="chip text-[10px]">/resume/{page.slug}</span>
                  <span className="text-[10px] text-neutral-400">{expCount} 條對應經歷</span>
                </div>
                {page.why_this_company && (
                  <p className="text-xs text-neutral-500 line-clamp-2">{page.why_this_company}</p>
                )}
                <p className="text-[10px] text-neutral-400 mt-1">
                  更新：{new Date(page.updated_at).toLocaleString("zh-Hant")}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link
                  to={`/resume/${page.slug}`}
                  target="_blank"
                  className="btn-ghost text-xs flex items-center gap-1 p-2"
                  title="開啟預覽"
                >
                  <ExternalLink size={13} />
                </Link>
                <button
                  type="button"
                  onClick={() => loadForEdit(page)}
                  className="btn-ghost text-xs flex items-center gap-1"
                >
                  <Pencil size={13} />
                  編輯
                </button>
                <Form method="post" className="inline">
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="id" value={page.id} />
                  <button
                    type="submit"
                    className="btn-ghost text-xs flex items-center gap-1 text-red-500 hover:bg-red-50"
                    onClick={(e) => {
                      if (!confirm(`確定要刪除「${page.company_name}」？`)) {
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
          );
        })}
      </section>
    </div>
  );
}
