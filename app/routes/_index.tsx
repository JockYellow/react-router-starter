// app/routes/_index.tsx
export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* Hero 區 */}
      <section className="py-14 md:py-20">
        <div className="grid md:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
              前端開發者的個人網站
            </h1>
            <p className="mt-4 text-lg text-neutral-700">
              這裡是我的開發筆記與作品集。網站運行於 Cloudflare Workers，前端使用 React Router 與 Tailwind CSS，透過 Notion 與 D1 打通資料流。
            </p>
            <div className="mt-6 flex gap-3">
              <a href="#projects" className="btn-primary">查看作品</a>
              <a href="#contact" className="btn-ghost">聯絡我</a>
            </div>
          </div>
          <div className="rounded-2xl bg-white shadow-md p-6 md:p-8">
            <div className="text-sm text-neutral-500">目前進度</div>
            <ul className="mt-3 space-y-2 text-sm">
              <li>· 首頁與關於頁完成</li>
              <li>· 部落格架構與假資料完成</li>
              <li>· 正在串接 Notion 與留言板</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 關於我 */}
      <section id="about" className="section">
        <h2 className="section-title">關於我</h2>
        <div className="prose max-w-none">
          <p>
            我專注於前端工程，喜歡把內容網站做得快速、可維護且能邊緣運行。這個網站是學習與實作並行的紀錄。
          </p>
        </div>
      </section>

      {/* 技能 */}
      <section id="skills" className="section">
        <h2 className="section-title">技能</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { title: "React / TypeScript", desc: "組件化、狀態管理、型別安全。" },
            { title: "React Router", desc: "檔案式路由、loader/action、SSR。" },
            { title: "Tailwind CSS", desc: "系統化設計與高可讀性樣式。" },
            { title: "Cloudflare Workers", desc: "邊緣運算與 Functions。" },
            { title: "D1 / Notion API", desc: "內容管理與資料庫整合。" },
            { title: "部署與監控", desc: "CI/CD、快取與效能優化。" },
          ].map((item) => (
            <article key={item.title} className="card">
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-neutral-700">{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 作品 */}
      <section id="projects" className="section">
        <h2 className="section-title">作品</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <article className="card hover:shadow-lg transition">
            <h3 className="font-semibold">個人部落格系統</h3>
            <p className="mt-1 text-sm text-neutral-700">
              React Router + Workers + Notion，支援 SSR 與 RSS。
            </p>
            <a href="/blog" className="mt-3 inline-block text-sm text-blue-700 hover:underline">
              前往部落格
            </a>
          </article>
          <article className="card hover:shadow-lg transition">
            <h3 className="font-semibold">留言板</h3>
            <p className="mt-1 text-sm text-neutral-700">
              Cloudflare D1 寫入與查詢，具備表單驗證與錯誤處理。
            </p>
            <a href="/guestbook" className="mt-3 inline-block text-sm text-blue-700 hover:underline">
              前往留言板
            </a>
          </article>
        </div>
      </section>

      {/* 聯絡 */}
      <section id="contact" className="section">
        <h2 className="section-title">聯絡</h2>
        <div className="card">
          <form
            onSubmit={(e) => e.preventDefault()}
            className="grid sm:grid-cols-[1fr_auto] gap-3"
          >
            <input
              type="email"
              required
              placeholder="你的 Email"
              className="input"
            />
            <button className="btn-primary">送出</button>
          </form>
          <p className="mt-3 text-sm text-neutral-600">
            也可以在關於頁查看專案說明與目前進度。
          </p>
        </div>
      </section>
    </div>
  );
}
