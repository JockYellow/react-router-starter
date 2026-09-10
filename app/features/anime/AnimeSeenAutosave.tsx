import { useEffect } from "react";
import { useFetcher } from "react-router";

import type { AnimeSeason } from "./anime.types";

export function AnimeSeenAutosave(props: {
  formId: string;
  year: number;
  season: AnimeSeason;
  anilistId: number;
}) {
  const fetcher = useFetcher();

  useEffect(() => {
    const form = document.getElementById(props.formId);
    if (!(form instanceof HTMLFormElement)) return;

    const baseData = (intent: string) => {
      const data = new FormData();
      data.set("intent", intent);
      data.set("year", String(props.year));
      data.set("season", props.season);
      data.set("anilistId", String(props.anilistId));
      return data;
    };

    const onChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;

      if (target.name === "detailStatus") {
        const data = baseData("seen-detail-autosave");
        data.set("detailStatus", target.value);
        void fetcher.submit(data, { method: "post" });
        return;
      }

      if (target.name === "rating") {
        const data = baseData("seen-rating-autosave");
        data.set("rating", target.value);
        void fetcher.submit(data, { method: "post" });
        return;
      }

      if (target.name === "tags") {
        const data = baseData("seen-tag-toggle-autosave");
        data.set("tag", target.value);
        void fetcher.submit(data, { method: "post" });
      }
    };

    const onFocusOut = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement) || target.name !== "note") return;
      const data = baseData("seen-note-autosave");
      data.set("note", target.value);
      void fetcher.submit(data, { method: "post" });
    };

    form.addEventListener("change", onChange);
    form.addEventListener("focusout", onFocusOut);
    return () => {
      form.removeEventListener("change", onChange);
      form.removeEventListener("focusout", onFocusOut);
    };
  }, [fetcher, props.anilistId, props.formId, props.season, props.year]);

  return (
    <span className="text-[11px] font-semibold text-neutral-600" aria-live="polite">
      {fetcher.state === "idle" ? "選擇會自動儲存" : "儲存中…"}
    </span>
  );
}
