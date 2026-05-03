import { Form, useActionData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  assertLoginAllowed,
  clearLoginFailures,
  createAdminSessionCookie,
  getAdminPassword,
  isAdmin,
  recordLoginFailure,
} from "../../features/admin/admin-auth.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  if (await isAdmin(request, context)) {
    const url = new URL("/admin", request.url);
    return new Response(null, {
      status: 302,
      headers: { Location: url.toString() },
    });
  }
  return {}; // noop, renders form
}

export async function action({ request, context }: ActionFunctionArgs) {
  await assertLoginAllowed(request, context);
  const formData = await request.formData();
  const password = (formData.get("password") ?? "").toString();
  const expected = getAdminPassword(context);

  if (!expected) {
    return { error: "未設定管理密碼 (BLOG_ADMIN_PASS 或 ADMIN_PASS)" };
  }

  if (password !== expected) {
    await recordLoginFailure(request, context);
    return { error: "密碼錯誤" };
  }
  await clearLoginFailures(request, context);

  const url = new URL("/admin", request.url);
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Set-Cookie": await createAdminSessionCookie(request, context),
    },
  });
}

export default function AdminLoginPage() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[--color-warm-50] px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white/90 p-6 shadow-lg space-y-4">
        <div className="space-y-1">
          <p className="eyebrow text-neutral-500">Admin</p>
          <h1 className="text-2xl font-semibold text-neutral-900">登入管理後台</h1>
          <p className="text-sm text-neutral-600">請輸入管理密碼繼續。</p>
        </div>

        <Form method="post" className="space-y-3">
          <input
            type="password"
            name="password"
            placeholder="Password"
            autoFocus
            required
            className="input"
          />
          {actionData && "error" in actionData ? (
            <p className="text-sm text-red-600">{(actionData as any).error}</p>
          ) : null}
          <button type="submit" className="btn-primary w-full">
            登入
          </button>
        </Form>
      </div>
    </div>
  );
}
