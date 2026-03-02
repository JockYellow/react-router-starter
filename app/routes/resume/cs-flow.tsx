import { useEffect, useRef } from "react";
import RAW from "./cs-flow.html?raw";

function extract(src: string, open: string, close: string) {
  const s = src.indexOf(open);
  const e = src.indexOf(close, s);
  return s !== -1 && e !== -1 ? src.slice(s + open.length, e) : "";
}

const rawCSS = extract(RAW, "<style>", "</style>");
const scopedCSS = rawCSS
  // Remove * box-sizing (Tailwind preflight handles it)
  .replace(/\*\s*\{[^}]*box-sizing[^}]*\}/g, "")
  // Keep :root CSS variables on :root — the embedded script reads them via
  // getComputedStyle(document.documentElement), so they must live on :root.
  // Variable names (--purple-primary, --yellow-primary, etc.) don't conflict
  // with the app's --color-brand-* / --color-accent-* / --color-warm-* vars.
  // Only scope presentational rules that could bleed into the outer layout:
  .replace(/\bbody\s*\{/g, ".csf-wrap {")
  .replace(/\bheader\s+p\s*\{/g, ".csf-wrap > header p {")
  .replace(/\bheader\s*\{/g, ".csf-wrap > header {")
  .replace(/\bh1\s*\{/g, ".csf-wrap h1 {");

const rawBody = extract(RAW, "<body>", "</body>");
const scriptSrc = extract(rawBody, "<script>", "</script>");
const bodyHTML = rawBody.replace(/<script>[\s\S]*?<\/script>/, "");

export default function CsFlowPage() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scriptSrc || !wrapRef.current) return;
    const el = document.createElement("script");
    el.textContent = scriptSrc;
    wrapRef.current.appendChild(el);
    // The original script listens for 'load' (never fires in a SPA) and
    // 'resize'. Dispatch a resize after layout settles so draw() re-runs with
    // correct getBoundingClientRect values and resolved CSS custom properties.
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="csf-wrap pb-8">
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: scopedCSS }} />
      <div ref={wrapRef} dangerouslySetInnerHTML={{ __html: bodyHTML }} />
    </div>
  );
}
