import { useEffect, useState } from "react";
import { useNavigate, useSubmit } from "react-router";

import type { AnimeSeason } from "./anime.types";

type Credits = {
  studio: string | null;
  directors: string[];
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function ShortcutKey({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 font-mono text-[11px] font-black text-neutral-200">
      {children}
    </kbd>
  );
}

export function AnimeSurveyHotkeys(props: {
  year: number;
  season: AnimeSeason;
  animeId: number;
  primaryEnabled: boolean;
  previousHref: string | null;
  disabled?: boolean;
  onFastPrimary?: (status: "WANT" | "NOT_SEEN") => boolean | void;
}) {
  const submit = useSubmit();
  const navigate = useNavigate();
  const [credits, setCredits] = useState<Credits | null>(null);
  const googleSearchHref = `/anime/google-search/${props.animeId}`;

  useEffect(() => {
    let cancelled = false;
    setCredits(null);

    void fetch(`/api/anime/credits/${props.animeId}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload: unknown = await response.json().catch(() => null);
        if (!payload || typeof payload !== "object") return null;
        const record = payload as Record<string, unknown>;
        const studio = typeof record.studio === "string" && record.studio.trim()
          ? record.studio.trim()
          : null;
        const directors = Array.isArray(record.directors)
          ? record.directors.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
          : [];
        return { studio, directors } satisfies Credits;
      })
      .then((value) => {
        if (!cancelled && value && (value.studio || value.directors.length)) setCredits(value);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [props.animeId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (props.disabled || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === "z") {
        if (!props.previousHref) return;
        event.preventDefault();
        void navigate(props.previousHref);
        return;
      }

      if (!props.primaryEnabled) return;

      let status: "SEEN" | "WANT" | "NOT_SEEN" | null = null;
      if (key === "a" || event.key === "ArrowLeft") status = "SEEN";
      else if (key === "w" || event.key === "ArrowUp") status = "WANT";
      else if (key === "d" || event.key === "ArrowRight") status = "NOT_SEEN";
      if (!status) return;

      event.preventDefault();
      if (status !== "SEEN" && props.onFastPrimary) {
        const handled = props.onFastPrimary(status);
        if (handled !== false) return;
      }

      const form = new FormData();
      form.set("intent", "primary");
      form.set("year", String(props.year));
      form.set("season", props.season);
      form.set("animeId", String(props.animeId));
      form.set("status", status);
      void submit(form, { method: "post" });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    navigate,
    props.animeId,
    props.disabled,
    props.onFastPrimary,
    props.previousHref,
    props.primaryEnabled,
    props.season,
    props.year,
    submit,
  ]);

  return (
    <>
      <a
        href={googleSearchHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="用 Google 搜尋這部作品"
        className="fixed bottom-20 right-3 z-40 rounded-full border border-neutral-700 bg-neutral-950/95 px-3.5 py-2.5 text-xs font-black text-neutral-200 shadow-xl backdrop-blur hover:bg-neutral-900 md:hidden"
      >
        Google 搜尋 ↗
      </a>

      <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex">
        <a
          href={googleSearchHref}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto rounded-xl border border-neutral-700 bg-neutral-950/90 px-4 py-2 text-xs font-black text-neutral-300 shadow-xl backdrop-blur hover:bg-neutral-900 hover:text-white"
        >
          Google 搜尋 ↗
        </a>

        {credits ? (
          <aside
            aria-label="作品製作資訊"
            className="flex max-w-[min(90vw,760px)] flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-xl border border-neutral-800 bg-neutral-950/90 px-4 py-2 text-xs font-bold text-neutral-400 shadow-xl backdrop-blur"
          >
            {credits.studio ? <span><span className="text-neutral-600">製作</span> {credits.studio}</span> : null}
            {credits.directors.length ? <span><span className="text-neutral-600">導演</span> {credits.directors.join("、")}</span> : null}
          </aside>
        ) : null}

        <aside
          aria-label="快捷鍵說明"
          className="flex items-center gap-3 whitespace-nowrap rounded-2xl border border-neutral-800 bg-neutral-950/90 px-4 py-2 text-xs font-bold text-neutral-400 shadow-2xl backdrop-blur"
        >
          <span className="text-neutral-500">快捷鍵</span>
          <span className="flex items-center gap-1"><ShortcutKey>A</ShortcutKey><span>/</span><ShortcutKey>←</ShortcutKey><span>看過</span></span>
          <span className="flex items-center gap-1"><ShortcutKey>W</ShortcutKey><span>/</span><ShortcutKey>↑</ShortcutKey><span>想看</span></span>
          <span className="flex items-center gap-1"><ShortcutKey>D</ShortcutKey><span>/</span><ShortcutKey>→</ShortcutKey><span>沒看過</span></span>
          <span className="flex items-center gap-1"><ShortcutKey>Z</ShortcutKey><span>上一題</span></span>
        </aside>
      </div>
    </>
  );
}
