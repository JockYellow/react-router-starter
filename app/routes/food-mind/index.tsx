import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, CheckCircle2, HeartHandshake, ListChecks, Loader2, Utensils } from "lucide-react";
import { FOOD_MIND_THEMES } from "../../features/food-mind/food-mind.cards";
import type { FoodMindThemeId } from "../../features/food-mind/food-mind.types";

type CreateRoomPayload = {
  ok?: boolean;
  room?: { id: string };
  error?: string;
};

export function meta() {
  return [{ title: "早餐店讀心局" }, { name: "description", content: "雙人食物喜好互動測驗" }];
}

export default function FoodMindHomePage() {
  const navigate = useNavigate();
  const [creatingThemeId, setCreatingThemeId] = useState<FoodMindThemeId | null>(null);
  const [error, setError] = useState("");

  const createRound = async (themeId: FoodMindThemeId) => {
    setCreatingThemeId(themeId);
    setError("");
    try {
      const response = await fetch("/api/food-mind/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ themeId }),
      });
      const payload = (await response.json().catch(() => null)) as CreateRoomPayload | null;
      if (!response.ok || !payload?.ok || !payload.room?.id) {
        throw new Error(payload?.error || "建立新局失敗");
      }
      navigate(`/food-mind/room/${payload.room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "建立新局失敗");
    } finally {
      setCreatingThemeId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-stone-950">
      <section className="mx-auto grid min-h-screen max-w-6xl content-center gap-10 px-4 py-8 md:px-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
            <Utensils className="h-4 w-4" />
            單次熟悉彼此食物喜好
          </div>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-normal text-stone-950 md:text-6xl">食物讀心局</h1>
            <p className="max-w-2xl text-lg leading-8 text-stone-700">
              選一個主題開局。評分局回答喜不喜歡，手搖飲改用排序，避免品項太細又太看店家。
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => createRound("breakfast_shop")}
              disabled={creatingThemeId !== null}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-stone-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-stone-800"
            >
              {creatingThemeId === "breakfast_shop" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              開早餐局
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#rules"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-5 py-3 text-sm font-bold text-stone-800 transition hover:bg-stone-50"
            >
              看玩法
            </a>
          </div>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
          ) : null}
        </div>

        <div className="grid gap-3">
          {FOOD_MIND_THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => createRound(theme.id)}
              disabled={creatingThemeId !== null}
              className="rounded-lg border border-stone-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                    {theme.mode === "ranking" ? "排序局" : "評分局"}・{theme.estimatedMinutes}
                  </p>
                  <h2 className="mt-1 text-lg font-black text-stone-950">{theme.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{theme.description}</p>
                </div>
                {creatingThemeId === theme.id ? (
                  <Loader2 className="mt-1 h-5 w-5 shrink-0 animate-spin text-emerald-700" />
                ) : (
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-stone-500" />
                )}
              </div>
            </button>
          ))}
          {[
            ["一局一個主題", "每建立一次就是一局新的測驗，連結只用來讓兩台裝置同步。"],
            ["固定兩個身份", "只有柔安與彥禎，不需要輸入名字，也不支援更多玩家。"],
            ["自己 vs 猜對方", "評分局填兩個分數；排序局排自己的順序，也猜對方的順序。"],
            ["畫面專注作答", "先移除參考圖片，避免額外載入與版面干擾。"],
          ].map(([title, body]) => (
            <div key={title} className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-black text-stone-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="rules" className="border-t border-stone-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 md:grid-cols-2 md:px-6">
          <div className="rounded-lg border border-stone-200 p-5">
            <HeartHandshake className="mb-3 h-6 w-6 text-emerald-700" />
            <h2 className="text-xl font-black">每題揭曉</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              顯示你的選擇、對方猜你會怎麼選、對方自己的選擇、你猜對方會怎麼選、真實相性與讀心誤差。
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 p-5">
            <ListChecks className="mb-3 h-6 w-6 text-emerald-700" />
            <h2 className="text-xl font-black">結束統計</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              結果頁整理共同可吃、明確地雷、最大誤判與本局總稱號，方便下次直接點餐。
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
