import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { getFoodMindTheme } from "../../features/food-mind/food-mind.cards";

type CreateRoomPayload = {
  ok?: boolean;
  room?: { id: string };
  error?: string;
};

export function meta() {
  return [{ title: "建立早餐店讀心局" }];
}

export default function FoodMindCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = getFoodMindTheme(searchParams.get("themeId"));
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const createRoom = async () => {
    setIsCreating(true);
    setError("");
    try {
      const response = await fetch("/api/food-mind/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ themeId: theme.id }),
      });
      const payload = (await response.json().catch(() => null)) as CreateRoomPayload | null;
      if (!response.ok || !payload?.ok || !payload.room?.id) {
        throw new Error(payload?.error || "建立房間失敗");
      }
      navigate(`/food-mind/room/${payload.room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "建立房間失敗");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f2ea] px-4 py-8 text-stone-950">
      <div className="mx-auto max-w-2xl">
        <Link to="/food-mind" className="inline-flex items-center gap-2 text-sm font-bold text-stone-600 hover:text-stone-950">
          <ArrowLeft className="h-4 w-4" />
          回到介紹
        </Link>

        <section className="mt-8 rounded-lg border border-stone-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-sm font-bold text-emerald-700">Phase 1 MVP</p>
          <h1 className="mt-2 text-3xl font-black text-stone-950">開一局{theme.name}</h1>
          <p className="mt-3 leading-7 text-stone-600">
            建立後會產生這一局的連結。進入後不用輸入名字，只要選自己是「柔安」或「彥禎」。
          </p>

          <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-700">
            {theme.description} 這是{theme.mode === "ranking" ? "排序局" : "評分局"}，預估 {theme.estimatedMinutes}。房間只用來區分不同局，不是為了讓更多人加入。
          </div>

          {error ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
          ) : null}

          <button
            type="button"
            onClick={createRoom}
            disabled={isCreating}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-stone-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            開始新局
          </button>
        </section>
      </div>
    </main>
  );
}
