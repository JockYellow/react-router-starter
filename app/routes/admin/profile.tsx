import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  useBlocker,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Eye,
  Plus,
  RefreshCcw,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";

import { AdminNav } from "../../components/AdminNav";
import {
  PROFILE_VERSION,
  type InterviewStory,
  type Profile,
  type ProfileStory,
  type ProfileWorkExperience,
} from "../../data/profile";
import { getCsrfToken, requireCsrf } from "../../features/admin/admin-auth.server";
import { buildStableProfilePrefix } from "../../features/ai/prompt";
import {
  ProfileValidationError,
  cloneProfile,
  parseProfile,
  toPublicProfile,
} from "../../features/profile/profile-document";
import {
  getProfileDocument,
  publishProfileDraft,
  resetProfileDraft,
  saveProfileDraft,
  type ProfileDocument,
} from "../../features/profile/profile.server";
import { requireBlogDb } from "../../lib/d1.server";

type LoaderData = { document: ProfileDocument; csrfToken: string };
type ServerResult = { ok: true; document: ProfileDocument; message: string } | { ok: false; error: string };
type PreviewMode = "public" | "admin" | null;

function errorMessage(error: unknown): string {
  if (error instanceof ProfileValidationError) return error.issues.join("\n");
  return "資料無法儲存，請稍後再試。";
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const csrf = await getCsrfToken(request, context);
  const document = await getProfileDocument(requireBlogDb(context));
  return Response.json(
    { document, csrfToken: csrf.token } satisfies LoaderData,
    { headers: { "Set-Cookie": csrf.cookie } },
  );
}

export async function action({ request, context }: ActionFunctionArgs) {
  await requireCsrf(request, context);
  const db = requireBlogDb(context);
  try {
    const body = await request.json() as { intent?: unknown; profile?: unknown };
    if (body.intent === "save") {
      const document = await saveProfileDraft(db, body.profile);
      return Response.json({ ok: true, document, message: "草稿已儲存，公開內容尚未變更。" } satisfies ServerResult);
    }
    if (body.intent === "publish") {
      await saveProfileDraft(db, body.profile);
      const document = await publishProfileDraft(db);
      return Response.json({ ok: true, document, message: `已發布 revision ${document.publishedRevision}。` } satisfies ServerResult);
    }
    if (body.intent === "reset") {
      const document = await resetProfileDraft(db);
      return Response.json({ ok: true, document, message: "草稿已重設為目前發布版本。" } satisfies ServerResult);
    }
    return Response.json({ ok: false, error: "不支援的操作。" } satisfies ServerResult, { status: 400 });
  } catch (error) {
    return Response.json({ ok: false, error: errorMessage(error) } satisfies ServerResult, { status: 400 });
  }
}

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function move<T>(items: T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function replace<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, itemIndex) => itemIndex === index ? value : item);
}

function lines(value: string): string[] {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function Field(props: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "email" | "url" | "number";
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-neutral-700">
      {props.label}
      <input
        className="input"
        type={props.type ?? "text"}
        value={props.value}
        placeholder={props.placeholder}
        required={props.required}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function TextArea(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-neutral-700">
      {props.label}
      {props.hint ? <span className="text-xs font-normal text-neutral-400">{props.hint}</span> : null}
      <textarea
        className="input resize-y leading-6"
        rows={props.rows ?? 4}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function LinesField(props: { label: string; value: string[]; onChange: (value: string[]) => void; hint?: string }) {
  return <TextArea label={props.label} value={props.value.join("\n")} onChange={(value) => props.onChange(lines(value))} hint={props.hint ?? "每行一項"} />;
}

function Section(props: { title: string; description: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="card overflow-hidden bg-white" open={props.defaultOpen}>
      <summary className="cursor-pointer select-none px-5 py-4 marker:text-neutral-400">
        <span className="ml-2 font-black text-neutral-900">{props.title}</span>
        <span className="ml-3 text-sm text-neutral-400">{props.description}</span>
      </summary>
      <div className="grid gap-5 border-t border-neutral-100 p-5">{props.children}</div>
    </details>
  );
}

function ItemActions(props: { index: number; length: number; onMove: (offset: -1 | 1) => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" className="btn-ghost p-2" disabled={props.index === 0} onClick={() => props.onMove(-1)} aria-label="向上移"><ArrowUp size={15} /></button>
      <button type="button" className="btn-ghost p-2" disabled={props.index === props.length - 1} onClick={() => props.onMove(1)} aria-label="向下移"><ArrowDown size={15} /></button>
      <button type="button" className="btn-ghost p-2 text-red-600" onClick={props.onDelete} aria-label="刪除"><Trash2 size={15} /></button>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="btn-secondary w-fit" onClick={onClick}><Plus size={15} /> {label}</button>;
}

function newCase(): ProfileStory {
  return { situation: "", action: "", result: "" };
}

function newExperience(): ProfileWorkExperience {
  return {
    id: id("exp"), role: "新職務", company: "", location: "", period: "", displayYear: new Date().getFullYear().toString(),
    distance: "", vibe: "", summary: "", highlights: [], details: [], stories: { cases: [] }, tags: [], blogSlug: "", links: [],
  };
}

function newInterviewStory(): InterviewStory {
  return { id: id("star"), title: "新 STAR 故事", situation: "", task: "", action: "", result: "", reflection: "", visibility: "public" };
}

function ExperienceEditor(props: { value: ProfileWorkExperience; index: number; length: number; onChange: (value: ProfileWorkExperience) => void; onMove: (offset: -1 | 1) => void; onDelete: () => void }) {
  const value = props.value;
  return (
    <details className="rounded-2xl border border-neutral-200 bg-neutral-50" open={props.index === 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="font-bold text-neutral-800">{value.role || "未命名職務"} · {value.company || "未填公司"}</span>
        <ItemActions index={props.index} length={props.length} onMove={props.onMove} onDelete={props.onDelete} />
      </summary>
      <div className="grid gap-4 border-t border-neutral-200 p-4 md:grid-cols-2">
        <Field label="職務" value={value.role} required onChange={(role) => props.onChange({ ...value, role })} />
        <Field label="公司" value={value.company} required onChange={(company) => props.onChange({ ...value, company })} />
        <Field label="地點" value={value.location} onChange={(location) => props.onChange({ ...value, location })} />
        <Field label="期間" value={value.period} required onChange={(period) => props.onChange({ ...value, period })} />
        <Field label="顯示年份" value={value.displayYear} required onChange={(displayYear) => props.onChange({ ...value, displayYear })} />
        <Field label="履歷文章 slug" value={value.blogSlug} onChange={(blogSlug) => props.onChange({ ...value, blogSlug })} />
        <Field label="里程／階段文字" value={value.distance} onChange={(distance) => props.onChange({ ...value, distance })} />
        <Field label="視覺氛圍文字" value={value.vibe} onChange={(vibe) => props.onChange({ ...value, vibe })} />
        <div className="md:col-span-2"><TextArea label="經歷摘要" value={value.summary} onChange={(summary) => props.onChange({ ...value, summary })} /></div>
        <LinesField label="具體成果" value={value.highlights} onChange={(highlights) => props.onChange({ ...value, highlights })} />
        <LinesField label="工作細節" value={value.details} onChange={(details) => props.onChange({ ...value, details })} />
        <LinesField label="標籤" value={value.tags} onChange={(tags) => props.onChange({ ...value, tags })} />
        <TextArea label="工作節奏／脈絡" value={value.stories.rhythm ?? ""} onChange={(rhythm) => props.onChange({ ...value, stories: { ...value.stories, rhythm } })} />
        <div className="grid gap-3 md:col-span-2">
          <h4 className="font-bold text-neutral-800">經歷案例</h4>
          {value.stories.cases.map((story, index) => (
            <div key={index} className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-3 md:grid-cols-3">
              <TextArea label="情境" rows={3} value={story.situation} onChange={(situation) => props.onChange({ ...value, stories: { ...value.stories, cases: replace(value.stories.cases, index, { ...story, situation }) } })} />
              <TextArea label="行動" rows={3} value={story.action} onChange={(action) => props.onChange({ ...value, stories: { ...value.stories, cases: replace(value.stories.cases, index, { ...story, action }) } })} />
              <div className="grid gap-2"><TextArea label="結果" rows={3} value={story.result} onChange={(result) => props.onChange({ ...value, stories: { ...value.stories, cases: replace(value.stories.cases, index, { ...story, result }) } })} /><ItemActions index={index} length={value.stories.cases.length} onMove={(offset) => props.onChange({ ...value, stories: { ...value.stories, cases: move(value.stories.cases, index, offset) } })} onDelete={() => props.onChange({ ...value, stories: { ...value.stories, cases: value.stories.cases.filter((_, itemIndex) => itemIndex !== index) } })} /></div>
            </div>
          ))}
          <AddButton label="新增案例" onClick={() => props.onChange({ ...value, stories: { ...value.stories, cases: [...value.stories.cases, newCase()] } })} />
        </div>
        <div className="grid gap-3 md:col-span-2">
          <h4 className="font-bold text-neutral-800">相關連結</h4>
          {(value.links ?? []).map((link, index) => (
            <div key={`${link.url}-${index}`} className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-3 md:grid-cols-[1fr_2fr_auto_auto]">
              <Field label="名稱" value={link.label} onChange={(label) => props.onChange({ ...value, links: replace(value.links ?? [], index, { ...link, label }) })} />
              <Field label="網址" type="url" value={link.url} onChange={(url) => props.onChange({ ...value, links: replace(value.links ?? [], index, { ...link, url }) })} />
              <label className="flex items-center gap-2 self-center text-sm font-semibold text-neutral-700"><input type="checkbox" checked={link.external === true} onChange={(event) => props.onChange({ ...value, links: replace(value.links ?? [], index, { ...link, external: event.target.checked }) })} />外部連結</label>
              <ItemActions index={index} length={(value.links ?? []).length} onMove={(offset) => props.onChange({ ...value, links: move(value.links ?? [], index, offset) })} onDelete={() => props.onChange({ ...value, links: (value.links ?? []).filter((_, itemIndex) => itemIndex !== index) })} />
            </div>
          ))}
          <AddButton label="新增連結" onClick={() => props.onChange({ ...value, links: [...(value.links ?? []), { label: "新連結", url: "", external: true }] })} />
        </div>
      </div>
    </details>
  );
}

export default function AdminProfilePage() {
  const initial = useLoaderData<typeof loader>() as LoaderData;
  const [document, setDocument] = useState(initial.document);
  const [profile, setProfile] = useState(() => cloneProfile(initial.document.draft));
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initial.document.draft));
  const [busy, setBusy] = useState<"save" | "publish" | "reset" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewMode>(null);
  const currentSnapshot = useMemo(() => JSON.stringify(profile), [profile]);
  const dirty = currentSnapshot !== savedSnapshot;
  const blocker = useBlocker(dirty);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const previewText = useMemo(() => {
    if (!preview) return "";
    return buildStableProfilePrefix(preview === "public" ? toPublicProfile(profile) : profile, {
      revision: document.publishedRevision + 1,
      includePrivate: preview === "admin",
    });
  }, [document.publishedRevision, preview, profile]);

  async function submit(intent: "save" | "publish" | "reset") {
    if (busy) return;
    setError(null);
    setNotice(null);
    if (intent !== "reset") {
      try { parseProfile(profile); } catch (caught) { setError(errorMessage(caught)); return; }
    }
    if (intent === "reset" && !window.confirm("確定要捨棄目前草稿，重設為已發布版本？")) return;
    if (intent === "publish" && !window.confirm("發布後履歷、FAQ 與公開 AI 會立即使用這個版本。確定發布？")) return;
    setBusy(intent);
    try {
      const response = await fetch("/admin/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": initial.csrfToken },
        body: JSON.stringify({ intent, ...(intent === "reset" ? {} : { profile }) }),
      });
      const result = await response.json() as ServerResult;
      if (!response.ok || !result.ok) throw new Error(result.ok ? "操作失敗" : result.error);
      setDocument(result.document);
      setProfile(cloneProfile(result.document.draft));
      setSavedSnapshot(JSON.stringify(result.document.draft));
      setNotice(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "操作失敗，請稍後再試。");
    } finally {
      setBusy(null);
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `huang-profile-draft-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 text-neutral-900">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">Admin · Personal Knowledge Base</p>
            <h1 className="mt-1 text-3xl font-black">個人知識庫</h1>
            <p className="mt-2 text-sm text-neutral-500">草稿不影響前台；發布後，履歷、FAQ 與 AI 完整 Context 立即同步。</p>
          </div>
          <AdminNav active="profile" />
        </header>

        <section className="sticky top-3 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <button type="button" className="btn-primary" disabled={Boolean(busy)} onClick={() => void submit("save")}><Save size={16} /> {busy === "save" ? "儲存中…" : "儲存草稿"}</button>
          <button type="button" className="btn-secondary" disabled={Boolean(busy)} onClick={() => void submit("publish")}><Send size={16} /> {busy === "publish" ? "發布中…" : "發布到履歷與 Bot"}</button>
          <button type="button" className="btn-ghost" disabled={Boolean(busy)} onClick={() => void submit("reset")}><RefreshCcw size={15} /> 重設草稿</button>
          <button type="button" className="btn-ghost" onClick={() => setPreview("public")}><Eye size={15} /> 公開 Context</button>
          <button type="button" className="btn-ghost" onClick={() => setPreview("admin")}><Eye size={15} /> 完整 Context</button>
          <button type="button" className="btn-ghost" onClick={exportJson}><Download size={15} /> 匯出 JSON</button>
          <span className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${dirty ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{dirty ? "尚未儲存" : "草稿已儲存"}</span>
        </section>

        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">
          已發布 revision <strong>{document.publishedRevision}</strong> · 發布時間 {new Date(document.publishedAt).toLocaleString("zh-TW")} · 草稿更新 {new Date(document.draftUpdatedAt).toLocaleString("zh-TW")}
        </div>
        {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</p> : null}
        {error ? <p className="whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}

        <Section title="1. 基本資料與聯絡方式" description="公開履歷會直接使用" defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="姓名" required value={profile.personal.name} onChange={(name) => setProfile({ ...profile, personal: { ...profile.personal, name } })} />
            <Field label="職涯標題" required value={profile.personal.title} onChange={(title) => setProfile({ ...profile, personal: { ...profile.personal, title } })} />
            <Field label="所在地" value={profile.personal.location} onChange={(location) => setProfile({ ...profile, personal: { ...profile.personal, location } })} />
            <Field label="Email" type="email" required value={profile.personal.email} onChange={(email) => setProfile({ ...profile, personal: { ...profile.personal, email } })} />
            <Field label="GitHub" type="url" required value={profile.personal.github} onChange={(github) => setProfile({ ...profile, personal: { ...profile.personal, github } })} />
            <Field label="Profile schema version" value={PROFILE_VERSION} onChange={() => undefined} />
            <div className="md:col-span-2"><TextArea label="公開個人簡介" value={profile.personal.intro} onChange={(intro) => setProfile({ ...profile, personal: { ...profile.personal, intro } })} /></div>
            <Field label="客戶數字" type="number" value={profile.personal.stats.clients.value} onChange={(value) => setProfile({ ...profile, personal: { ...profile.personal, stats: { ...profile.personal.stats, clients: { ...profile.personal.stats.clients, value: Math.max(0, Number(value) || 0) } } } })} />
            <Field label="客戶數字標籤" value={profile.personal.stats.clients.label} onChange={(label) => setProfile({ ...profile, personal: { ...profile.personal, stats: { ...profile.personal.stats, clients: { ...profile.personal.stats.clients, label } } } })} />
            <Field label="客戶數字單位" value={profile.personal.stats.clients.unit} onChange={(unit) => setProfile({ ...profile, personal: { ...profile.personal, stats: { ...profile.personal.stats, clients: { ...profile.personal.stats.clients, unit } } } })} />
            <Field label="知識庫數字" type="number" value={profile.personal.stats.issues.value} onChange={(value) => setProfile({ ...profile, personal: { ...profile.personal, stats: { ...profile.personal.stats, issues: { ...profile.personal.stats.issues, value: Math.max(0, Number(value) || 0) } } } })} />
            <Field label="知識庫數字標籤" value={profile.personal.stats.issues.label} onChange={(label) => setProfile({ ...profile, personal: { ...profile.personal, stats: { ...profile.personal.stats, issues: { ...profile.personal.stats.issues, label } } } })} />
            <Field label="知識庫數字單位" value={profile.personal.stats.issues.unit} onChange={(unit) => setProfile({ ...profile, personal: { ...profile.personal, stats: { ...profile.personal.stats, issues: { ...profile.personal.stats.issues, unit } } } })} />
          </div>
        </Section>

        <Section title="2. 求職方向" description="每行一個方向">
          <LinesField label="求職方向" value={profile.jobDirections} onChange={(jobDirections) => setProfile({ ...profile, jobDirections })} />
        </Section>

        <Section title="3. 工作經歷與案例" description="可新增、刪除與排序">
          {profile.workExperience.map((experience, index) => <ExperienceEditor key={experience.id} value={experience} index={index} length={profile.workExperience.length} onChange={(value) => setProfile({ ...profile, workExperience: replace(profile.workExperience, index, value) })} onMove={(offset) => setProfile({ ...profile, workExperience: move(profile.workExperience, index, offset) })} onDelete={() => setProfile({ ...profile, workExperience: profile.workExperience.filter((_, itemIndex) => itemIndex !== index) })} />)}
          <AddButton label="新增工作經歷" onClick={() => setProfile({ ...profile, workExperience: [...profile.workExperience, newExperience()] })} />
        </Section>

        <Section title="4. 技能群組" description="技能每行一項">
          {profile.skillGroups.map((group, index) => <div key={`${group.label}-${index}`} className="grid gap-3 rounded-xl border border-neutral-200 p-4 md:grid-cols-[1fr_2fr_auto]"><Field label="群組名稱" value={group.label} required onChange={(label) => setProfile({ ...profile, skillGroups: replace(profile.skillGroups, index, { ...group, label }) })} /><LinesField label="技能" value={group.skills} onChange={(skills) => setProfile({ ...profile, skillGroups: replace(profile.skillGroups, index, { ...group, skills }) })} /><ItemActions index={index} length={profile.skillGroups.length} onMove={(offset) => setProfile({ ...profile, skillGroups: move(profile.skillGroups, index, offset) })} onDelete={() => setProfile({ ...profile, skillGroups: profile.skillGroups.filter((_, itemIndex) => itemIndex !== index) })} /></div>)}
          <AddButton label="新增技能群組" onClick={() => setProfile({ ...profile, skillGroups: [...profile.skillGroups, { label: "新技能群組", skills: [] }] })} />
        </Section>

        <Section title="5. 作品與專案" description="公開履歷作品區與 Bot 會使用">
          {profile.projects.map((project, index) => <div key={project.id} className="grid gap-3 rounded-xl border border-neutral-200 p-4 md:grid-cols-2"><div className="md:col-span-2 flex justify-end"><ItemActions index={index} length={profile.projects.length} onMove={(offset) => setProfile({ ...profile, projects: move(profile.projects, index, offset) })} onDelete={() => setProfile({ ...profile, projects: profile.projects.filter((_, itemIndex) => itemIndex !== index) })} /></div><Field label="名稱" required value={project.name} onChange={(name) => setProfile({ ...profile, projects: replace(profile.projects, index, { ...project, name }) })} /><Field label="內部文章 slug" value={project.blogSlug} onChange={(blogSlug) => setProfile({ ...profile, projects: replace(profile.projects, index, { ...project, blogSlug }) })} /><div className="md:col-span-2"><TextArea label="描述" value={project.description} onChange={(description) => setProfile({ ...profile, projects: replace(profile.projects, index, { ...project, description }) })} /></div><Field label="外部網址" type="url" value={project.externalUrl} onChange={(externalUrl) => setProfile({ ...profile, projects: replace(profile.projects, index, { ...project, externalUrl }) })} /><LinesField label="標籤" value={project.tags} onChange={(tags) => setProfile({ ...profile, projects: replace(profile.projects, index, { ...project, tags }) })} /></div>)}
          <AddButton label="新增作品" onClick={() => setProfile({ ...profile, projects: [...profile.projects, { id: id("project"), name: "新作品", description: "", tags: [], externalUrl: "", blogSlug: "" }] })} />
        </Section>

        <Section title="6. 自介、動機、優缺點與專業觀點" description="公開 AI Context 的面試回答素材">
          <TextArea label="短版自我介紹" value={profile.interviewKnowledge.careerNarrative.shortIntroduction} onChange={(shortIntroduction) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, careerNarrative: { ...profile.interviewKnowledge.careerNarrative, shortIntroduction } } })} />
          <TextArea label="職涯轉換脈絡" value={profile.interviewKnowledge.careerNarrative.careerTransition} onChange={(careerTransition) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, careerNarrative: { ...profile.interviewKnowledge.careerNarrative, careerTransition } } })} />
          <TextArea label="下一份工作的動機" value={profile.interviewKnowledge.careerNarrative.nextRoleMotivation} onChange={(nextRoleMotivation) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, careerNarrative: { ...profile.interviewKnowledge.careerNarrative, nextRoleMotivation } } })} />
          <LinesField label="優點" value={profile.interviewKnowledge.selfAssessment.strengths} onChange={(strengths) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, selfAssessment: { ...profile.interviewKnowledge.selfAssessment, strengths } } })} />
          <TextArea label="待改善處（含改善方式）" value={profile.interviewKnowledge.selfAssessment.improvementArea} onChange={(improvementArea) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, selfAssessment: { ...profile.interviewKnowledge.selfAssessment, improvementArea } } })} />
          <TextArea label="工作方式" value={profile.interviewKnowledge.selfAssessment.workingStyle} onChange={(workingStyle) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, selfAssessment: { ...profile.interviewKnowledge.selfAssessment, workingStyle } } })} />
          <TextArea label="Customer Success 觀點" value={profile.interviewKnowledge.professionalViews.customerSuccess} onChange={(customerSuccess) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, professionalViews: { ...profile.interviewKnowledge.professionalViews, customerSuccess } } })} />
          <TextArea label="AI 與 RAG 觀點" value={profile.interviewKnowledge.professionalViews.aiAndRag} onChange={(aiAndRag) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, professionalViews: { ...profile.interviewKnowledge.professionalViews, aiAndRag } } })} />
          <TextArea label="知識管理觀點" value={profile.interviewKnowledge.professionalViews.knowledgeManagement} onChange={(knowledgeManagement) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, professionalViews: { ...profile.interviewKnowledge.professionalViews, knowledgeManagement } } })} />
        </Section>

        <Section title="7. STAR 故事庫" description="可選公開或僅管理員可見">
          {profile.interviewKnowledge.stories.map((story, index) => <div key={story.id} className={`grid gap-3 rounded-xl border p-4 md:grid-cols-2 ${story.visibility === "private" ? "border-violet-200 bg-violet-50" : "border-neutral-200 bg-white"}`}><div className="md:col-span-2 flex items-center justify-between"><strong>{story.title}</strong><ItemActions index={index} length={profile.interviewKnowledge.stories.length} onMove={(offset) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, stories: move(profile.interviewKnowledge.stories, index, offset) } })} onDelete={() => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, stories: profile.interviewKnowledge.stories.filter((_, itemIndex) => itemIndex !== index) } })} /></div><Field label="故事標題" required value={story.title} onChange={(title) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, stories: replace(profile.interviewKnowledge.stories, index, { ...story, title }) } })} /><label className="grid gap-1.5 text-sm font-semibold text-neutral-700">可見範圍<select className="input" value={story.visibility} onChange={(event) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, stories: replace(profile.interviewKnowledge.stories, index, { ...story, visibility: event.target.value as "public" | "private" }) } })}><option value="public">公開：可進入 Bot Prompt</option><option value="private">私人：僅管理員預覽</option></select></label><TextArea label="S 情境" value={story.situation} onChange={(situation) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, stories: replace(profile.interviewKnowledge.stories, index, { ...story, situation }) } })} /><TextArea label="T 任務" value={story.task} onChange={(task) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, stories: replace(profile.interviewKnowledge.stories, index, { ...story, task }) } })} /><TextArea label="A 行動" value={story.action} onChange={(action) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, stories: replace(profile.interviewKnowledge.stories, index, { ...story, action }) } })} /><TextArea label="R 結果" value={story.result} onChange={(result) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, stories: replace(profile.interviewKnowledge.stories, index, { ...story, result }) } })} /><div className="md:col-span-2"><TextArea label="反思／可延伸回答" value={story.reflection} onChange={(reflection) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, stories: replace(profile.interviewKnowledge.stories, index, { ...story, reflection }) } })} /></div></div>)}
          <AddButton label="新增 STAR 故事" onClick={() => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, stories: [...profile.interviewKnowledge.stories, newInterviewStory()] } })} />
        </Section>

        <Section title="8. 公開補充與私人面試筆記" description="私人內容不會傳到公開 HTML、FAQ 或 AI">
          <LinesField label="公開補充內容" value={profile.interviewKnowledge.publicNotes} onChange={(publicNotes) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, publicNotes } })} />
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4"><LinesField label="私人面試筆記" value={profile.interviewKnowledge.privateNotes} onChange={(privateNotes) => setProfile({ ...profile, interviewKnowledge: { ...profile.interviewKnowledge, privateNotes } })} hint="只會出現在登入後的完整管理員預覽；公開 loader 與 AI request 會在伺服器端移除" /></div>
          <LinesField label="事實限制規則" value={profile.factRules} onChange={(factRules) => setProfile({ ...profile, factRules })} />
        </Section>
      </div>

      {preview ? <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Context 預覽"><section className="flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b p-4"><div><h2 className="font-black">{preview === "public" ? "公開 Context 預覽" : "完整管理員 Context 預覽"}</h2><p className="text-xs text-neutral-500">僅顯示實際文字，不呼叫付費 AI。</p></div><button type="button" className="btn-ghost p-2" onClick={() => setPreview(null)} aria-label="關閉"><X size={18} /></button></header><pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-neutral-950 p-5 text-xs leading-6 text-neutral-100">{previewText}</pre></section></div> : null}

      {blocker.state === "blocked" ? <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4"><section className="card max-w-md bg-white p-6"><h2 className="text-lg font-black">尚未儲存的修改</h2><p className="mt-2 text-sm leading-6 text-neutral-600">離開後這些修改會消失。要繼續離開嗎？</p><div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => blocker.reset()}>留在此頁</button><button type="button" className="btn-primary" onClick={() => blocker.proceed()}>捨棄並離開</button></div></section></div> : null}
    </main>
  );
}
