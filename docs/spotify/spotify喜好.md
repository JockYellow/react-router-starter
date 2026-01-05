```
# 專案規格書：Spotify 全關注歌手排位賽 (Cloudflare 全端版)

## 專案目標
建立一個部署在 Cloudflare Pages/Workers 的 Web App，讓使用者登入 Spotify 後，抓取「所有」關注藝人(可能數百位)，進行兩兩對決排序，並支援手機操作與進度存檔。

## 技術堆疊
- **Frontend:** React + React Router + Tailwind CSS (已部署於 `react-router-starter.jockhuang77.workers.dev`)
- **Backend:** Cloudflare Workers (Hono Framework)
- **Database:** Cloudflare D1 

---

## 1. 資料庫設計 (D1 Schema)
請建立一個 SQL 檔案 `sql/spotify/schema.sql`，我們需要一張表來存使用者的賽局狀態。

```sql
DROP TABLE IF EXISTS game_sessions;
CREATE TABLE game_sessions (
    user_id TEXT PRIMARY KEY,        -- Spotify User ID
    status TEXT DEFAULT 'IDLE',      -- 'IDLE', 'PLAYING', 'FINISHED'
    artist_ids TEXT,                 -- JSON String: 儲存所有參加排名的 Artist IDs (Array)
    algorithm_state TEXT,            -- JSON String: Merge Sort 的完整狀態物件
    total_count INTEGER DEFAULT 0,   -- 總藝人數 (方便顯示進度)
    updated_at INTEGER               -- Unix Timestamp
);
```

---

## 2. 後端 API (Cloudflare Worker with Hono)

請在 `src/index.ts` (或 backend entry) 實作以下 API。務必設定 CORS 允許前端網域。

### `POST /api/init` (開新局)

* **功能：** 接收前端爬完的「完整 ID 清單」，初始化賽局。
* **Input:**`{ userId: string, artistIds: string[] }`
* **Logic:**
  1. 將 `artistIds` 轉為 Merge Sort 初始狀態：
     * `sublists`: `artistIds.map(id => [id])`
     * `currentPair`: `[0, 1]` (若長度>1)
     * `tempMerged`: `[]`
  2. 寫入 D1 `game_sessions` 表 (使用 `INSERT OR REPLACE`)。
  3. 回傳初始化後的 State。

### `GET /api/session/:userId` (讀取進度)

* **功能：** 讓手機重新整理後能接續進度。
* **Logic:**`SELECT * FROM game_sessions WHERE user_id = ?`。若無資料回傳 `{ status: 'IDLE' }`。

### `POST /api/save` (儲存進度)

* **功能：** 每次投票後呼叫。
* **Input:**`{ userId: string, state: Object }` (state 包含 sublists, currentPair 等)
* **Logic:**`UPDATE game_sessions SET algorithm_state = ?, updated_at = ? WHERE user_id = ?`

---

## 3. 前端邏輯 (React)

### A. 抓取「全部」關注藝人 (Recursive Fetch)

**這是關鍵需求：** Spotify API `GET /me/following` 一次最多給 50 筆。 請實作一個 Helper Function `fetchAllFollowedArtists(token)`：

1. 呼叫 API (`limit=50`)。
2. 檢查 Response 的 `artists.next` (下一頁 URL)。
3. 如果有 `next`，迴圈或遞迴呼叫直到 `next` 為 null。
4. 收集所有藝人的 `id` (只需存 ID，詳細資料之後再 Lazy Load)。
5. **UI 回饋：** 在抓取過程中，請顯示「已讀取 X 位歌手...」的進度條，避免使用者以為當機。

### B. 手機版面優化 (Responsive)

* **排版：** 在手機上將「左右對決」改為「上下堆疊」卡片。
* **觸控：** 圖片按鈕加大，增加點擊回饋 (Active state)。
* **播放器：** 手機瀏覽器通常禁止自動播放聲音，請確保 `<audio>` 只有在使用者點擊後才播放。

### C. 部署設定

* 請檢查 `wrangler.toml`，確保有設定 `[[d1_databases]]` 綁定。
* Redirect URI 設定為：`https://react-router-starter.jockhuang77.workers.dev/call_spotify`



**Client ID=faa338557e2643799b05abc270cdf875**

Client secret=e55bdbfd5c77496aad01981ac259ef65
