import { useEffect, useState } from "react";

import { loadAnimeDisplayCredits, peekAnimeCredits } from "./anime-credits.client";
import type { AnimeSurveyCredits } from "./anime-credits";

function formatCollectionCount(value: number | null): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return new Intl.NumberFormat("zh-TW").format(Math.trunc(value));
}

function visibleCredits(value: AnimeSurveyCredits | null): AnimeSurveyCredits | null {
  return value && (value.studio || value.directors.length) ? value : null;
}

export function AnimeSurveyProductionInfo(props: {
  animeId: number;
  format: string | null;
  episodes: number | null;
  bangumiCollectionTotal: number | null;
}) {
  const [credits, setCredits] = useState<AnimeSurveyCredits | null>(
    () => visibleCredits(peekAnimeCredits(props.animeId)),
  );

  useEffect(() => {
    let cancelled = false;
    setCredits(visibleCredits(peekAnimeCredits(props.animeId)));

    void loadAnimeDisplayCredits(props.animeId)
      .then((value) => {
        if (!cancelled) setCredits(visibleCredits(value));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [props.animeId]);

  const collection = formatCollectionCount(props.bangumiCollectionTotal);
  const studioDisplay = credits?.studioDisplay ?? credits?.studio ?? null;
  const studioRaw = credits?.studio ?? null;
  const showRawStudio = Boolean(
    studioDisplay
      && studioRaw
      && studioDisplay.trim().toLocaleLowerCase() !== studioRaw.trim().toLocaleLowerCase(),
  );

  const facts = [
    props.format,
    props.episodes != null ? `${props.episodes} 集` : null,
    collection ? `Bangumi 收藏 ${collection}` : null,
  ].filter(Boolean) as string[];

  if (!facts.length && !credits) return null;

  return (
    <aside
      aria-label="作品資訊"
      className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950/45 px-3.5 py-3 sm:mt-5 sm:px-4"
    >
      {facts.length ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-neutral-400">
          {facts.map((fact) => <span key={fact}>{fact}</span>)}
        </div>
      ) : null}

      {credits ? (
        <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-neutral-400 ${facts.length ? "mt-2" : ""}`}>
          {studioDisplay ? (
            <span>
              <span className="text-neutral-600">製作</span>{" "}
              <span className="text-neutral-300">{studioDisplay}</span>
              {showRawStudio ? <span className="ml-1 text-neutral-600">（{studioRaw}）</span> : null}
            </span>
          ) : null}
          {credits.directors.length ? (
            <span>
              <span className="text-neutral-600">導演</span>{" "}
              <span className="text-neutral-300">{credits.directors.join("、")}</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
