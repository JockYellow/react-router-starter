import type { LoaderFunctionArgs } from "react-router";

type Context = LoaderFunctionArgs["context"];

export type GuestbookNotifyData = {
  name: string | null;
  company: string | null;
  contact: string | null;
  message: string | null;
  wantContact: boolean;
  ip: string | null;
};

function getTelegramVars(context: Context) {
  const ctx = context as any;
  const token =
    ctx?.cloudflare?.env?.TELEGRAM_BOT_TOKEN ??
    ctx?.env?.TELEGRAM_BOT_TOKEN ??
    ctx?.TELEGRAM_BOT_TOKEN;
  const chatId =
    ctx?.cloudflare?.env?.TELEGRAM_CHAT_ID ??
    ctx?.env?.TELEGRAM_CHAT_ID ??
    ctx?.TELEGRAM_CHAT_ID;
  return {
    token: token as string | undefined,
    chatId: chatId as string | undefined,
  };
}

export async function notifyGuestbook(
  context: Context,
  data: GuestbookNotifyData,
): Promise<void> {
  const { token, chatId } = getTelegramVars(context);
  if (!token || !chatId) return;

  const wantLabel = data.wantContact ? "✅ 希望聯繫" : "❌ 不需要";
  const now = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

  const text = [
    "📬 *留言版新訊息*",
    `👤 姓名：${data.name || "（未填）"}`,
    `🏢 公司：${data.company || "（未填）"}`,
    `📞 聯絡方式：${data.contact || "（未填）"}`,
    `💬 留言：${data.message || "（未填）"}`,
    `📲 期待聯繫：${wantLabel}`,
    `🌐 IP：${data.ip || "未知"}`,
    `🕐 時間：${now}`,
  ].join("\n");

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });
}
