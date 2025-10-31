# Cloudflare Workers + React Router 實作筆記

# 全新專案 — Cloudflare Workers + React Router 實作筆記

這是一個以 **React Router Framework** 為核心、部署在 **Cloudflare Workers** 上的部落格實驗專案。

目標是從零開始，用 Notion 當 CMS、D1 當留言資料庫，最終打造一個可擴充的個人網站。

---

## 專案簡介

這個網站將包含以下主要頁面與功能：

- 首頁 `/`
- 部落格 `/blog`
- 文章頁 `/blog/:slug`
- 留言板 `/guestbook`
- 關於我 `/about`
- RSS Feed `/rss`
- （未來）統計圖表 `/stats`
- （未來）密碼保護頁 `/private`

所有頁面與資料流都在 Cloudflare 的邊緣節點上執行，

資料抓取（loader）與表單提交（action）皆在 Worker 層完成。

---

## 技術架構


| 模組                   | 用途                                  |
| ---------------------- | ------------------------------------- |
| **React Router v7**    | 檔案式路由、SSR、loader/action 資料流 |
| **Cloudflare Workers** | 邊緣運算與伺服端渲染                  |
| **Cloudflare D1**      | SQLite 相容資料庫，用於留言板         |
| **Notion API**         | 當 CMS，文章來源                      |
| **Tailwind CSS**       | 樣式與排版                            |
| **Cloudflare Pages**   | 部署與流量分析                        |
| **TypeScript + Vite**  | 開發環境與型別檢查                    |

## 系統需求

- Node.js ≥ 18
- npm ≥ 9
- 已安裝 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Cloudflare 帳號與 D1 資料庫
- Notion Integration Token（讀文章用）

---

## 專案進度（Todo）

> ✅ 代表已完成，🔜 代表進行中，🧩 代表待開發。

### 週 1：基礎與前端架構

- [✅] 初始化 Workers + React Router 專案
- [✅] 首頁與關於頁 `/`、`/about`
- [🧩] 巢狀路由與 Layout (`<Outlet />`)
- [🧩] `/blog` 假資料頁面
- [🧩] `/blog/:slug` 動態路由
- [🧩] loader 初體驗（假資料）
- [🧩] Tailwind 基本樣式
- [✅] 部署到 Cloudflare Workers

### 週 2：資料與互動

- [🧩] 建立 Notion Database（文章資料）
- [🧩] 在 `/blog` loader 串 Notion API
- [🧩] `/blog/:slug` 顯示單篇文章內容
- [🧩] `/guestbook` 頁面與留言表單（action）
- [🧩] 建立 D1 schema.sql 與留言資料表
- [🧩] Cloudflare Web Analytics + SEO 設定
- [🧩] `/stats` 互動圖表（假資料）

### 週 3：擴充與完善

- [🧩] `/rss` Feed route
- [🧩] 密碼保護頁（Middleware + Cookie）
- [🧩] 錯誤頁與 Error Boundary
- [🧩] 邊緣快取策略（Cache-Control）
- [🧩] CI/CD 與 Preview Branch
- [🧩] README 與 About 完整文件化

---

## 學習目標

- 理解 SPA 與 SSR 的差異
- 學會使用 React Router 的 loader/action 資料流
- 在 Cloudflare Workers 上實作全端應用（前後端同程式碼）
- 與外部服務（Notion、D1）整合
- 部署、監控與擴充的全流程實踐

---

## 專案架構（快速總覽）

```
app/
 ├─ root.tsx          # 全站佈局與 <Outlet />
 ├─ routes/
 │   ├─ _index.tsx    # 首頁
 │   ├─ about.tsx     # 關於頁
 │   ├─ blog.tsx      # 部落格列表
 │   ├─ blog.$slug.tsx# 單篇文章頁
 │   ├─ guestbook.tsx # 留言板
 │   └─ stats.tsx     # 統計圖表
functions/
 ├─ api/
 │   ├─ posts.ts      # 提供文章 JSON 給 RSS
 │   └─ guestbook.ts  # D1 留言 API
 ├─ rss.ts            # RSS Feed route
 └─ _middleware.ts    # 密碼保護頁 Middleware
public/               # 靜態資源
wrangler.json         # Workers 設定

```

## 開發筆記

- Workers 與 React Router 共生 → 使用 `react-router dev`，**不要用 `vite preview`**。
- loader/action 皆可使用 `fetch()` 呼叫外部 API。
- D1 在本地測試時可使用 `wrangler d1 execute` 操作資料。
- 部署後的 SSR 在 Cloudflare 邊緣執行，無需再做 SPA fallback。

---
