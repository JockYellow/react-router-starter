import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { ArrowLeft, Flame, Heart, Link as LinkIcon, RotateCcw, ShieldAlert, Sparkles } from "lucide-react";

import { getFoodMindResult } from "../../features/food-mind/food-mind.server";
import { getFoodMindScoreLabel } from "../../features/food-mind/food-mind.rules";
import type { FoodMindRankingResultItem, FoodMindResultItem, FoodMindResultPayload } from "../../features/food-mind/food-mind.types";

export function meta() {
  return [{ title: "早餐店讀心局結果" }];
}

export async function loader({ context, params }: LoaderFunctionArgs): Promise<FoodMindResultPayload> {
  return getFoodMindResult(context, params.roomId ?? "");
}

function ResultList({ items, emptyText }: { items: FoodMindResultItem[]; emptyText: string }) {
  if (items.length === 0) {
    return <div className="rounded-md border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-500">{emptyText}</div>;
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div key={item.card.id} className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-black text-stone-950">{item.card.name}</h3>
              <p className="mt-1 text-sm font-bold text-emerald-700">{item.compatibility.label}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {item.card.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-md bg-stone-100 px-2 py-1 text-xs font-bold text-stone-600">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-sm text-stone-600 sm:grid-cols-2">
            {item.scores.map((score) => (
              <div key={score.playerId} className="rounded-md bg-stone-50 p-3">
                <span className="font-black text-stone-950">{score.playerName}</span> 自己：
                {getFoodMindScoreLabel(score.selfScore)}，猜對方：{getFoodMindScoreLabel(score.predictPartnerScore)}
                <span className="block text-xs text-stone-500">讀心：{score.mindRead.label} / 誤差 {score.mindRead.error}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RankingResultList({ items }: { items: FoodMindRankingResultItem[] }) {
  if (items.length === 0) {
    return <div className="rounded-md border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-500">這局還沒有完整排序結果。</div>;
  }

  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <div key={item.set.id} className="rounded-lg border border-stone-200 bg-white p-4">
          <h3 className="text-lg font-black text-stone-950">{item.set.title}</h3>
          <p className="mt-1 text-sm text-stone-600">{item.set.description}</p>
          {item.sharedTop.length > 0 ? (
            <div className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
              共同高順位：<span className="font-black">{item.sharedTop.join("、")}</span>
            </div>
          ) : null}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {item.playerResults.map((result) => (
              <div key={result.player.id} className="rounded-md bg-stone-50 p-3 text-sm">
                <p className="font-black text-stone-950">{result.player.name}</p>
                <p className="mt-2 text-stone-700">自己的前 3 名：{result.selfOrder.slice(0, 3).join("、")}</p>
                <p className="mt-1 text-stone-700">
                  猜對方最大誤判：
                  {result.biggestMisses.map((diff) => `${diff.option} 差 ${diff.error}`).join("、") || "沒有明顯誤判"}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FoodMindResultPage() {
  const result = useLoaderData<typeof loader>();
  const roomPath = `/food-mind/room/${result.room.id}`;
  const sharePath = `/food-mind/share/${result.room.id}`;

  return (
    <main className="min-h-screen bg-[#f7f2ea] px-4 py-8 text-stone-950 md:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link to="/food-mind" className="inline-flex items-center gap-2 text-sm font-bold text-stone-600 hover:text-stone-950">
            <ArrowLeft className="h-4 w-4" />
            回到食物讀心局
          </Link>
          <Link
            to={`/food-mind/create?themeId=${result.theme.id}`}
            className="inline-flex items-center gap-2 rounded-md bg-stone-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-stone-800"
          >
            <RotateCcw className="h-4 w-4" />
            再開一局
          </Link>
          <Link
            to={sharePath}
            className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-800 transition hover:bg-stone-50"
          >
            <LinkIcon className="h-4 w-4" />
            分享版
          </Link>
        </div>

        <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-sm font-bold text-emerald-700">本局總稱號</p>
          <h1 className="mt-2 text-4xl font-black text-stone-950">{result.totalTitle}</h1>
          <p className="mt-3 max-w-3xl leading-7 text-stone-600">{result.totalSummary}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm text-stone-600">
            {result.players.map((player) => (
              <span key={player.id} className="rounded-md bg-stone-100 px-3 py-2 font-bold">
                {player.name}
              </span>
            ))}
            <span className="rounded-md bg-stone-100 px-3 py-2 font-bold">{result.theme.name}</span>
            <span className="rounded-md bg-stone-100 px-3 py-2 font-bold">
              完成 {result.mode === "ranking" ? result.rankingResults.length : result.allResults.length}
              {result.mode === "ranking" ? " 組" : " 題"}
            </span>
          </div>
        </section>

        {result.mode === "ranking" ? (
          <section className="mt-5 rounded-lg border border-stone-200 bg-white/70 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Flame className="h-5 w-5 text-amber-700" />
              <h2 className="text-xl font-black">排序結果</h2>
            </div>
            <RankingResultList items={result.rankingResults} />
          </section>
        ) : (
        <div className="mt-5 grid gap-5">
          <section className="rounded-lg border border-stone-200 bg-white/70 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-700" />
              <h2 className="text-xl font-black">共同喜歡</h2>
            </div>
            <ResultList items={result.mutualLoves} emptyText="這局沒有雙方都高分的項目。" />
          </section>

          <section className="rounded-lg border border-stone-200 bg-white/70 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Heart className="h-5 w-5 text-emerald-700" />
              <h2 className="text-xl font-black">安全可吃</h2>
            </div>
            <ResultList items={result.safePicks} emptyText="這局沒有明確的安全可吃項目。" />
          </section>

          <section className="rounded-lg border border-stone-200 bg-white/70 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-700" />
              <h2 className="text-xl font-black">一方熱情</h2>
            </div>
            <ResultList items={result.oneSidedHeats} emptyText="這局沒有明顯一方很愛、一方不太想的項目。" />
          </section>

          <section className="rounded-lg border border-stone-200 bg-white/70 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Heart className="h-5 w-5 text-amber-700" />
              <h2 className="text-xl font-black">條件型項目</h2>
            </div>
            <ResultList items={result.conditionalItems} emptyText="這局沒有需要特別看情況的項目。" />
          </section>

          <section className="rounded-lg border border-stone-200 bg-white/70 p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-700" />
              <h2 className="text-xl font-black">明確地雷清單</h2>
            </div>
            <ResultList items={result.hardNos} emptyText="這局沒有明確地雷，早餐選擇空間很大。" />
          </section>

          <section className="rounded-lg border border-stone-200 bg-white/70 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Flame className="h-5 w-5 text-amber-700" />
              <h2 className="text-xl font-black">最大誤判清單</h2>
            </div>
            <ResultList items={result.biggestMisses} emptyText="沒有太大的誤判，彼此的早餐雷達滿準。" />
          </section>

          <section className="rounded-lg border border-stone-200 bg-white/70 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-700" />
              <h2 className="text-xl font-black">誰比較會猜對方</h2>
            </div>
            <div className="rounded-md bg-white p-4 text-sm leading-6 text-stone-700">
              <p className="font-black text-stone-950">{result.guessSummary.title}</p>
              <p className="mt-1">{result.guessSummary.detail}</p>
            </div>
          </section>
        </div>
        )}

        <section className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-xl font-black text-stone-950">下次約會起手式</h2>
          <p className="mt-2 text-sm leading-6 text-emerald-950">{result.nextStarter}</p>
        </section>

        <div className="mt-6 rounded-lg border border-stone-200 bg-white p-4 text-sm leading-6 text-stone-600">
          完整結果：<Link to={roomPath} className="font-bold text-emerald-700 hover:text-emerald-900">{roomPath}</Link>
          <br />
          分享版：<Link to={sharePath} className="font-bold text-emerald-700 hover:text-emerald-900">{sharePath}</Link>
        </div>
      </div>
    </main>
  );
}
