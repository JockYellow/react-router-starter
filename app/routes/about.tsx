// app/routes/about.tsx
// app/routes/about.tsx
export default function AboutPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 leading-relaxed">
      <h1 className="text-3xl font-bold mb-6">關於這個專案</h1>

      <p className="mb-4">
        這是一個以 React Router Framework 為基礎、部署在 Cloudflare Workers 上的部落格專案。
        主要目標是從零開始，透過實作學習現代前端架構，並體驗「前後端在同一份程式碼中」的開發模式。
      </p>

      <p className="mb-4">
        網站的資料來源使用 Notion 作為 CMS，留言資料存放於 Cloudflare D1。
        所有頁面都由 Workers 在邊緣節點進行伺服端渲染（SSR），使內容能快速且安全地傳遞到世界各地的使用者。
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-3">主要功能規劃</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>首頁與關於頁</li>
        <li>部落格列表與文章頁</li>
        <li>留言板（D1 資料庫）</li>
        <li>RSS Feed</li>
        <li>互動圖表頁（未來示範資料視覺化）</li>
        <li>密碼保護頁（中介層驗證）</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-3">目前進度</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>已完成：基本架構、首頁、關於頁、部落格假資料、樣式設定</li>
        <li>進行中：Notion API 串接與留言板互動</li>
        <li>待完成：RSS、D1 實作、密碼頁、圖表</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-3">技術架構</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>React Router v7（檔案式路由、loader/action）</li>
        <li>Cloudflare Workers（邊緣運算與伺服端渲染）</li>
        <li>Cloudflare D1（留言資料庫）</li>
        <li>Notion API（文章內容來源）</li>
        <li>Tailwind CSS（樣式）</li>
        <li>TypeScript + Vite（開發環境）</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-3">開發理念</h2>
      <p className="mb-4">
        專案採取「邊學邊做」的方式推進。每一週聚焦於不同面向：第一週完成網站骨架，
        第二週整合外部資料與互動功能，第三週優化效能與擴充應用。
      </p>

      <p className="mb-4">
        最終希望這個網站不只是作品展示，也是一份可持續擴充的個人開發框架，
        未來能作為更多 Cloudflare Edge App 的基礎。
      </p>

      <footer className="mt-12 text-sm text-gray-500">
        © {new Date().getFullYear()} 個人專案開發筆記
      </footer>
    </main>
  );
}
