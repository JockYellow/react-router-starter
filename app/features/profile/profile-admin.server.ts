import type { ActionFunctionArgs } from "react-router";

import { requireCsrf } from "../admin/admin-auth.server";
import { ProfileValidationError } from "./profile-document";
import {
  publishProfileDraft,
  resetProfileDraft,
  saveProfileDraft,
  type ProfileDocument,
} from "./profile.server";
import { requireBlogDb } from "../../lib/d1.server";

export type ProfileAdminResult =
  | { ok: true; document: ProfileDocument; message: string }
  | { ok: false; error: string };

function errorMessage(error: unknown): string {
  if (error instanceof ProfileValidationError) return error.issues.join("\n");
  return "資料無法儲存，請稍後再試。";
}

export async function handleProfileAdminAction(
  request: ActionFunctionArgs["request"],
  context: ActionFunctionArgs["context"],
): Promise<Response> {
  await requireCsrf(request, context);
  const db = requireBlogDb(context);

  try {
    const body = await request.json() as { intent?: unknown; profile?: unknown };
    if (body.intent === "save") {
      const document = await saveProfileDraft(db, body.profile);
      return Response.json({
        ok: true,
        document,
        message: "草稿已儲存，公開內容尚未變更。",
      } satisfies ProfileAdminResult);
    }
    if (body.intent === "publish") {
      await saveProfileDraft(db, body.profile);
      const document = await publishProfileDraft(db);
      return Response.json({
        ok: true,
        document,
        message: `已發布 revision ${document.publishedRevision}。`,
      } satisfies ProfileAdminResult);
    }
    if (body.intent === "reset") {
      const document = await resetProfileDraft(db);
      return Response.json({
        ok: true,
        document,
        message: "草稿已重設為目前發布版本。",
      } satisfies ProfileAdminResult);
    }
    return Response.json(
      { ok: false, error: "不支援的操作。" } satisfies ProfileAdminResult,
      { status: 400 },
    );
  } catch (error) {
    return Response.json(
      { ok: false, error: errorMessage(error) } satisfies ProfileAdminResult,
      { status: 400 },
    );
  }
}
