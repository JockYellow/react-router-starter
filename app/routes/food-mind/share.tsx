import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { ArrowLeft, RotateCcw } from "lucide-react";

import { getFoodMindShare } from "../../features/food-mind/food-mind.server";
import type { FoodMindSharePayload } from "../../features/food-mind/food-mind.types";

export function meta() {
  return [{ title: "食物讀心局分享結果" }];
}

export async function loader({ context, params }: LoaderFunctionArgs): Promise<FoodMindSharePayload> {
  return getFoodMindShare(context, params.roomId ?? "");
}

export default function FoodMindSharePage() {
  const share = useLoaderData<typeof loader>();

  return (
    <main className="min-h-screen bg-[#f7f2ea] px-4 py-8 text-stone-950 md:px-6">
      <div className="mx-auto max-w-3xl">
        <Link to="/food-mind" className="inline-flex items-center gap-2 text-sm font-bold text-stone-600 hover:text-stone-950">
          <ArrowLeft className="h-4 w-4" />
          回到食物讀心局
        </Link>

        <section className="mt-6 rounded-lg border border-stone-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-sm font-bold text-emerald-700">{share.themeName}</p>
          <h1 className="mt-2 text-4xl font-black text-stone-950">{share.totalTitle}</h1>
          <p className="mt-3 leading-7 text-stone-600">{share.totalSummary}</p>

          <div className="mt-6 grid gap-3">
            {share.highlights.map((highlight) => (
              <div key={highlight} className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold text-stone-800">
                {highlight}
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-md bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
            <span className="font-black">下次起手式：</span>
            {share.nextStarter}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              to={`/food-mind/room/${share.roomId}/result`}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-stone-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-stone-800"
            >
              看完整結果
            </Link>
            <Link
              to="/food-mind"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-800 transition hover:bg-stone-50"
            >
              <RotateCcw className="h-4 w-4" />
              再開一局
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
