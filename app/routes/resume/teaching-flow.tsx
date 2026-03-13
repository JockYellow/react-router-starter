import { useEffect, useRef } from "react";
import RAW from "./teaching-flow.html?raw";

function extract(src: string, open: string, close: string) {
  const s = src.indexOf(open);
  const e = src.indexOf(close, s);
  return s !== -1 && e !== -1 ? src.slice(s + open.length, e) : "";
}

const rawCSS = extract(RAW, "<style>", "</style>");
const scopedCSS = rawCSS
  .replace(/\*\s*\{[^}]*box-sizing[^}]*\}/g, "")
  .replace(/\bbody\s*\{/g, ".tsf-wrap {")
  .replace(/\bheader\s+p\s*\{/g, ".tsf-wrap > header p {")
  .replace(/\bheader\s*\{/g, ".tsf-wrap > header {")
  .replace(/\bh1\s*\{/g, ".tsf-wrap h1 {");

const rawBody = extract(RAW, "<body>", "</body>");
const scriptSrc = extract(rawBody, "<script>", "</script>");
const bodyHTML = rawBody.replace(/<script>[\s\S]*?<\/script>/, "");

export default function TeachingFlowPage() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scriptSrc || !wrapRef.current) return;
    const el = document.createElement("script");
    el.textContent = scriptSrc;
    wrapRef.current.appendChild(el);
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="tsf-wrap pb-8">
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: scopedCSS }} />
      <div ref={wrapRef} dangerouslySetInnerHTML={{ __html: bodyHTML }} />
    </div>
  );
}
