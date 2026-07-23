# AI 公司適配分析與履歷 Bot 設定

此功能由同一支 Cloudflare Worker 的 React Router API routes 呼叫 OpenAI。瀏覽器只連線到同源 `/api/ai/*`，不會取得 OpenAI API Key。

## 本機設定

1. 複製 `.dev.vars.example` 為 `.dev.vars`。
2. 填入 `OPENAI_API_KEY` 與一組長度至少 32 字元的 `AI_RATE_LIMIT_SECRET`。
3. 套用本機 D1 migration：

   ```powershell
   npx wrangler d1 migrations apply blog-db --local
   ```

   若既有本機資料庫曾手動套用舊 migration，可能出現「欄位已存在」但 migration ledger 未記錄的情況。請勿修改或重跑既有 migration；先用 `npx wrangler d1 migrations list blog-db --local` 確認，再只對開發資料庫執行本次 AI migration：

   ```powershell
   npx wrangler d1 execute blog-db --local --file=migrations/2026-07-23-ai-usage-counters.sql
   ```

   正式環境仍應先檢查 remote migration ledger，再使用標準 `migrations apply --remote`。

4. 啟動：

   ```powershell
   npm run dev
   ```

沒有 API Key 時，頁面仍可開啟、靜態 FAQ 仍可使用；自由提問與公司分析會顯示「AI 服務尚未設定」。

## 正式環境 Secrets

Secrets 不得寫入 `wrangler.json`、前端程式或 Git：

```powershell
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put AI_RATE_LIMIT_SECRET
```

非秘密設定位於 `wrangler.json`：

- `OPENAI_BASE_URL=https://api.openai.com/v1`
- `OPENAI_MODEL_ANALYSIS=gpt-5.6-terra`
- `OPENAI_MODEL_CHAT=gpt-5.6-luna`
- `PROMPT_CACHE_KEY=huang-profile-v1`
- `AI_DAILY_REQUEST_LIMIT=100`
- `AI_REQUEST_TIMEOUT_MS=90000`

若更新 Profile 內容或固定 Prompt 結構，需同步更新程式內的 `PROFILE_VERSION` 與 `PROMPT_CACHE_KEY`，例如改成 `huang-profile-v2`。

## 正式部署

```powershell
npx wrangler d1 migrations apply blog-db --remote
npm run test:ai
npm run typecheck:ai
npm run build
npx wrangler deploy --dry-run
npm run deploy
```

部署後檢查：

1. `/resume/company-fit` 可以逐步顯示結果並可停止生成。
2. `/resume/*` 的 Bot 靜態 FAQ 不會產生 OpenAI 請求。
3. 重複使用相同固定前綴後，SSE `usage` 與 UI 顯示 `cachedTokens`；第一次請求可能只有 `cacheWriteTokens`。
4. Workers Logs 只包含 request ID、route、延遲、token 與錯誤分類，不應包含使用者問題、IP 或 Secret。
5. 在 client build、HTML 與瀏覽器 Network request 中搜尋不到 `OPENAI_API_KEY`。

## MVP 限制

- 公司分析每個 IP 每 UTC 日 5 次。
- Bot 每個 IP 及 session 每小時各 15 次。
- 全站 OpenAI 呼叫每 UTC 日預設 100 次。
- Bot 只傳送最近 8 則訊息。
- 第一版不擷取職缺網址，也不提供 Web Search、Response Cache、Turnstile 或 AI Gateway。
