import { Link } from "react-router";

const EXPERIMENTS = [
  {
    title: "OuterSpace Senter",
    description: "全螢幕 3D 軌道監控介面，Three.js 地球、遙測曲線與可拖曳的返回按鈕。",
    path: "/outerspace/OuterSpaceSenter",
    meta: "視覺實驗 / Three.js",
    points: ["地球視覺 + 玻璃質感 UI", "即時遙測與警示", "全螢幕獨立場景"],
  },
  {
    title: "XENO-DB",
    description: "PokeAPI 生物資料庫介面，雷達圖、資料表與叫聲播放都在一個卡片中。",
    path: "/outerspace/PokeAPIcreatures",
    meta: "資料串接 / PokeAPI",
    points: ["API 取數並整理指標", "雷達圖視覺化", "支援音效與翻轉卡"],
  },
  {
    title: "Gravity Lab",
    description: "行星重力與拖曳模擬，切換行星即可感受不同 g 值與軌跡衰減。",
    path: "/outerspace/Gravity",
    meta: "物理模擬 / Canvas",
    points: ["即時重力計算", "拖曳與拋擲互動", "行星資料快速切換"],
  },
] as const;

export function meta() {
  return [
    { title: "OuterSpace 實驗索引" },
    { name: "description", content: "集中各種實驗性頁面的索引，主題不限太空。" },
  ];
}

export default function OuterSpaceIndexPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 space-y-10">
      <header className="space-y-4">
        <p className="eyebrow text-neutral-600">OuterSpace</p>
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900">實驗索引</h1>
        <p className="text-neutral-700 max-w-3xl leading-relaxed">
          OuterSpace 是用來放各種實驗性頁面的區域，不限定太空主題。從這裡挑一個卡片進入，看到的就是實際頁面（其中有些會進入全螢幕模式並附上返回按鈕）。
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/jock_space" className="link-soft">
            回首頁
          </Link>
          <Link to="/blog" className="link-soft">
            Blog
          </Link>
          <Link to="/changelog" className="link-soft">
            更新日誌
          </Link>
        </div>
      </header>

      <section className="grid gap-5 md:grid-cols-2">
        {EXPERIMENTS.map((item) => (
          <article key={item.path} className="card hover-raise h-full flex flex-col gap-3">
            <div className="text-xs uppercase tracking-[0.24em] text-neutral-500">{item.meta}</div>
            <h2 className="text-xl font-semibold text-neutral-900">{item.title}</h2>
            <p className="text-sm text-neutral-700 leading-relaxed">{item.description}</p>
            <ul className="mt-1 list-disc pl-5 text-sm text-neutral-700 space-y-1">
              {item.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <Link to={item.path} className="btn-ghost w-fit mt-auto">
              進入實驗 →
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
