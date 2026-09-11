import { useEffect } from "react";
import { useNavigate, useSubmit } from "react-router";

import type { AnimeSeason } from "./anime.types";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
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

  return null;
}
