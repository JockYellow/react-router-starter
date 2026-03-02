import { redirect, useLoaderData, Form } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import {
  MessageSquare,
  Trash2,
  CheckCircle2,
  Building2,
  User,
  Send,
  Bike,
  Clock,
  Globe,
  Phone,
} from "lucide-react";
import { isAdmin, requireAdmin } from "~/features/admin/admin-auth.server";
import { requireBlogDb } from "~/lib/d1.server";
import {
  getAllMessages,
  insertMessage,
  deleteMessage,
  type GuestbookMsg,
} from "~/features/guestbook/guestbook.d1.server";
import { notifyGuestbook } from "~/lib/notify.server";

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request, context }: LoaderFunctionArgs) {
  const db = requireBlogDb(context);
  const messages = await getAllMessages(db);
  const admin = isAdmin(request);
  const url = new URL(request.url);
  const submitted = url.searchParams.get("ok") === "1";
  return { messages, admin, submitted };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request, context }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "delete") {
    requireAdmin(request, context);
    const id = Number(formData.get("id"));
    if (!Number.isFinite(id)) throw new Response("Bad id", { status: 400 });
    const db = requireBlogDb(context);
    await deleteMessage(db, id);
    return redirect("/resume/guestbook");
  }

  // intent === "submit"
  const clean = (key: string) =>
    ((formData.get(key) as string) ?? "").trim() || null;

  const name = clean("name");
  const company = clean("company");
  const contact = clean("contact");
  const message = clean("message");
  const wantContact = formData.get("want_contact") === "1" ? 1 : 0;
  const ip =
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For") ??
    null;

  const db = requireBlogDb(context);
  await insertMessage(db, { name, company, contact, message, wantContact, ip });

  // Fire-and-forget — don't block redirect on notification failure
  notifyGuestbook(context, {
    name,
    company,
    contact,
    message,
    wantContact: wantContact === 1,
    ip,
  }).catch(() => {});

  return redirect("/resume/guestbook?ok=1");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
}

function displayName(msg: GuestbookMsg) {
  if (msg.name && msg.company) return `${msg.name} · ${msg.company}`;
  if (msg.name) return msg.name;
  if (msg.company) return msg.company;
  return "匿名訪客";
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function SubmitForm({ submitted }: { submitted: boolean }) {
  return (
    <div className="card mb-10">
      {/* Success banner */}
      {submitted && (
        <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
          <CheckCircle2 size={16} className="shrink-0" />
          留言已送出，謝謝！
        </div>
      )}

      <Form method="post" className="space-y-4">
        <input type="hidden" name="intent" value="submit" />

        {/* Row 1: name + company */}
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
              <User size={11} />
              姓名
              <span className="font-normal text-neutral-300 normal-case tracking-normal">選填</span>
            </span>
            <input
              type="text"
              name="name"
              placeholder="你的名字"
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent transition"
            />
          </label>

          <label className="block">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
              <Building2 size={11} />
              公司 / 組織
              <span className="font-normal text-neutral-300 normal-case tracking-normal">選填</span>
            </span>
            <input
              type="text"
              name="company"
              placeholder="你所在的公司或單位"
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent transition"
            />
          </label>
        </div>

        {/* Row 2: contact */}
        <label className="block">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
            <Phone size={11} />
            聯絡方式（Email / LINE / LinkedIn …）
            <span className="font-normal text-neutral-300 normal-case tracking-normal">選填 · 不公開顯示</span>
          </span>
          <input
            type="text"
            name="contact"
            placeholder="方便聯繫你的方式，僅站主可見"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent transition"
          />
        </label>

        {/* Row 3: message */}
        <label className="block">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
            <MessageSquare size={11} />
            留言
            <span className="font-normal text-neutral-300 normal-case tracking-normal">選填</span>
          </span>
          <textarea
            name="message"
            placeholder="想說的話、工作機會、或者只是打個招呼……"
            rows={4}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent transition resize-none"
          />
        </label>

        {/* Row 4: want_contact */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              name="want_contact"
              value="1"
              className="peer sr-only"
            />
            <div className="w-4.5 h-4.5 rounded border-2 border-neutral-300 bg-white peer-checked:border-brand-400 peer-checked:bg-brand-400 transition-all flex items-center justify-center">
              <CheckCircle2 size={10} className="text-white opacity-0 peer-checked:opacity-100" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-700 group-hover:text-neutral-900 transition-colors">
              我有興趣進一步聯繫 / 期待你主動聯繫我
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              勾選後，你的意願將優先通知站主
            </p>
          </div>
        </label>

        {/* Submit */}
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="btn-primary flex items-center gap-2 group"
          >
            <Send size={13} className="group-hover:translate-x-0.5 transition-transform" />
            送出留言
          </button>
        </div>
      </Form>
    </div>
  );
}

function MessageCard({ msg, admin }: { msg: GuestbookMsg; admin: boolean }) {
  const name = displayName(msg);

  return (
    <div className="card group relative">
      {/* Admin: delete button */}
      {admin && (
        <Form
          method="post"
          className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={msg.id} />
          <button
            type="submit"
            title="刪除"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-all"
            onClick={(e) => {
              if (!confirm("確定刪除這則留言？")) e.preventDefault();
            }}
          >
            <Trash2 size={14} />
          </button>
        </Form>
      )}

      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-xl bg-warm-100 flex items-center justify-center shrink-0 text-brand-500 font-bold text-sm select-none">
          {msg.name ? msg.name.charAt(0).toUpperCase() : "?"}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-neutral-800 truncate">{name}</p>

          {/* Admin meta */}
          {admin && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              {msg.contact && (
                <span className="text-[11px] text-accent-500 font-medium">{msg.contact}</span>
              )}
              {msg.ip && (
                <span className="flex items-center gap-0.5 text-[11px] text-neutral-400">
                  <Globe size={9} />
                  {msg.ip}
                </span>
              )}
              <span className="flex items-center gap-0.5 text-[11px] text-neutral-400">
                <Clock size={9} />
                {formatDate(msg.createdAt)}
              </span>
            </div>
          )}
        </div>

        {/* Want contact badge */}
        {msg.wantContact === 1 && (
          <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 border border-brand-200">
            <CheckCircle2 size={9} />
            期待聯繫
          </span>
        )}
      </div>

      {/* Message body */}
      {msg.message ? (
        <p className="text-sm text-neutral-600 leading-relaxed pl-12 whitespace-pre-wrap">
          {msg.message}
        </p>
      ) : (
        <p className="text-sm text-neutral-300 italic pl-12">（沒有留下文字）</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GuestbookPage() {
  const { messages, admin, submitted } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen text-neutral-900 font-sans">
      <main className="relative pt-20 pb-32 max-w-2xl mx-auto px-6">

        {/* Hero */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-brand-300 p-1.5 rounded-lg shadow-sm">
              <Bike className="w-4 h-4 text-neutral-800" />
            </div>
            <p className="eyebrow">GUESTBOOK · 留言板</p>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
            留個話，讓我知道你來過
          </h1>
          <p className="text-neutral-500 text-sm leading-relaxed max-w-md">
            無論是工作機會、合作邀請，或者只是想打個招呼——
            所有欄位都是選填的，匿名也完全沒問題。
          </p>
        </section>

        {/* Form */}
        <SubmitForm submitted={submitted} />

        {/* Message list */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="section-title">
              訪客留言{" "}
              <span className="text-sm font-normal text-neutral-400 ml-1.5">
                {messages.length} 則
              </span>
            </h2>
            {admin && (
              <span className="chip text-[10px] bg-accent-50 text-accent-500 border-accent-200">
                管理員模式
              </span>
            )}
          </div>

          {messages.length === 0 ? (
            <div className="card text-center py-12 text-neutral-400">
              <MessageSquare size={28} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">還沒有留言，成為第一個留言的人吧！</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <MessageCard key={msg.id} msg={msg} admin={admin} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
