import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useEffect, useState } from "react";

import { AdminNav } from "../../components/AdminNav";
import { requireAdmin } from "../../features/admin/admin-auth.server";
import { isLocalHost } from "../../features/admin/local-host";

const TOOLBELT_BASE_URL = "http://127.0.0.1:43210";

type LoaderData = {
  isLocal: boolean;
  detectedHostname: string;
};

type GitCommitPushResult = {
  ok: boolean;
  nothingToCommit?: boolean;
  pushed?: boolean;
  statusBefore?: string;
  statusAfter?: string;
  commit?: { code: number; stdout: string; stderr: string };
  push?: { code: number; stdout: string; stderr: string } | null;
};

type ActionData = {
  ok: boolean;
  error?: string;
  details?: string;
  result?: GitCommitPushResult;
};

function getRequestHostname(request: Request): string {
  // 優先用 Host header（在 wrangler dev / proxy 環境比 request.url 更可靠）
  const hostHeader = request.headers.get("host") ?? "";
  if (hostHeader) return hostHeader.split(":")[0].trim();
  try {
    return new URL(request.url).hostname;
  } catch {
    return "";
  }
}

function isLocalRequest(request: Request) {
  // 同時檢查 Host header 和 request.url
  const fromHost = getRequestHostname(request);
  if (isLocalHost(fromHost)) return true;
  try {
    return isLocalHost(new URL(request.url).hostname);
  } catch {
    return false;
  }
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  requireAdmin(request, context);
  const detectedHostname = getRequestHostname(request);
  return {
    isLocal: isLocalHost(detectedHostname),
    detectedHostname,
  } satisfies LoaderData;
}

export async function action({ request, context }: ActionFunctionArgs) {
  requireAdmin(request, context);
  if (!isLocalRequest(request)) {
    const hostname = getRequestHostname(request);
    return {
      ok: false,
      error: `Git Ops 僅限本機環境（localhost 或私有網段 IP）使用。（偵測到：${hostname}）`,
    } satisfies ActionData;
  }

  const formData = await request.formData();
  const message = (formData.get("message") ?? "").toString().trim();
  if (!message) {
    return { ok: false, error: "Commit message 必填。" } satisfies ActionData;
  }

  try {
    const keyResponse = await fetch(`${TOOLBELT_BASE_URL}/key`);
    if (!keyResponse.ok) {
      return {
        ok: false,
        error: "無法連線到 Toolbelt（/key）。",
        details: `status=${keyResponse.status}`,
      } satisfies ActionData;
    }

    const keyPayload = (await keyResponse.json().catch(() => null)) as { key?: string } | null;
    const toolbeltKey = keyPayload?.key?.trim();
    if (!toolbeltKey) {
      return { ok: false, error: "Toolbelt key 缺失。" } satisfies ActionData;
    }

    const response = await fetch(`${TOOLBELT_BASE_URL}/ops/git/commit-push`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-toolbelt-key": toolbeltKey,
      },
      body: JSON.stringify({ message }),
    });

    const payloadText = await response.text();
    const payload = payloadText
      ? (JSON.parse(payloadText) as GitCommitPushResult)
      : ({ ok: false } as GitCommitPushResult);

    if (!response.ok || !payload.ok) {
      return {
        ok: false,
        error: "Git 操作失敗。",
        details: payloadText || `status=${response.status}`,
      } satisfies ActionData;
    }

    return { ok: true, result: payload } satisfies ActionData;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: "呼叫 Toolbelt 失敗。",
      details: message,
    } satisfies ActionData;
  }
}

export default function AdminOpsPage() {
  const { isLocal: serverIsLocal, detectedHostname } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // 與 AdminNav 相同：用 client-side window.location.hostname 判斷
  // 避免 wrangler dev 環境下 server-side request.url 偵測不準的問題
  const [isLocal, setIsLocal] = useState(serverIsLocal);
  useEffect(() => {
    setIsLocal(isLocalHost(window.location.hostname));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <header className="space-y-4">
        <div>
          <p className="eyebrow text-neutral-500">Admin</p>
          <h1 className="text-3xl font-bold text-neutral-900">Ops / Git</h1>
          <p className="text-sm text-neutral-600">透過本機 Toolbelt 執行 git add/commit/push。</p>
        </div>
        <AdminNav active="ops" />
      </header>

      {!isLocal && (
        <section className="card bg-amber-50 border border-amber-200 text-amber-800">
          此頁僅限本機環境（localhost 或私有網段 IP）可執行。
          <span className="ml-2 text-xs opacity-70">（server 偵測：{detectedHostname}）</span>
        </section>
      )}

      <section className="card bg-white/95 space-y-4">
        <Form method="post" className="space-y-3">
          <label className="space-y-1 block">
            <span className="text-xs font-semibold text-neutral-600">Commit Message *</span>
            <input
              name="message"
              required
              className="input"
              placeholder="例如：chore: unify changelog source"
              disabled={!isLocal || isSubmitting}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={!isLocal || isSubmitting}>
            {isSubmitting ? "執行中…" : "執行 add / commit / push"}
          </button>
        </Form>

        {actionData?.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{actionData.error}</p>
            {actionData.details ? <pre className="mt-2 whitespace-pre-wrap text-xs">{actionData.details}</pre> : null}
          </div>
        )}

        {actionData?.ok && actionData.result ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 space-y-2">
            <p>
              完成：{actionData.result.nothingToCommit ? "沒有可提交變更" : "已建立 commit"}
              {actionData.result.pushed ? "，且已 push" : ""}
            </p>
            <pre className="whitespace-pre-wrap text-xs text-neutral-700 bg-white/80 rounded p-3">
{JSON.stringify(actionData.result, null, 2)}
            </pre>
          </div>
        ) : null}
      </section>
    </div>
  );
}
