import { useMemo, useState } from "react";

import type { BlogContentBlock, BlogImageLayout } from "./blog.types";

function imageClass(layout?: BlogImageLayout) {
  switch (layout) {
    case "wide":
      return "mx-auto w-full max-w-5xl";
    case "full":
      return "relative left-1/2 w-screen max-w-none -translate-x-1/2";
    case "float-left":
      return "my-2 md:float-left md:mr-6 md:w-1/2";
    case "float-right":
      return "my-2 md:float-right md:ml-6 md:w-1/2";
    default:
      return "mx-auto w-full max-w-3xl";
  }
}

function Gallery({ block }: { block: Extract<BlogContentBlock, { type: "gallery" }> }) {
  const [index, setIndex] = useState(0);
  const items = block.props.items;
  const active = items[index] ?? items[0];
  const isGrid = block.props.layout === "grid";

  if (isGrid) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item, itemIndex) => (
          <figure key={`${item.src}-${itemIndex}`} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <img src={item.src} alt={item.alt ?? ""} loading="lazy" className="aspect-[4/3] w-full object-cover" />
            {item.caption ? <figcaption className="px-3 py-2 text-sm text-neutral-600">{item.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
    );
  }

  return (
    <section
      className="space-y-3"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") setIndex((value) => Math.max(0, value - 1));
        if (event.key === "ArrowRight") setIndex((value) => Math.min(items.length - 1, value + 1));
      }}
    >
      <figure className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {active ? <img src={active.src} alt={active.alt ?? ""} className="max-h-[70vh] w-full object-contain bg-neutral-950" /> : null}
        {active?.caption ? <figcaption className="px-4 py-3 text-sm text-neutral-600">{active.caption}</figcaption> : null}
      </figure>
      <div className="flex items-center justify-between gap-3">
        <button type="button" className="btn-ghost" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}>
          上一張
        </button>
        <div className="flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto px-1 py-1">
          {items.map((item, itemIndex) => (
            <button
              type="button"
              key={`${item.src}-thumb-${itemIndex}`}
              onClick={() => setIndex(itemIndex)}
              className={`h-16 w-20 flex-none snap-start overflow-hidden rounded border ${
                itemIndex === index ? "border-neutral-900" : "border-neutral-200"
              }`}
            >
              <img src={item.src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
        <button type="button" className="btn-ghost" onClick={() => setIndex((value) => Math.min(items.length - 1, value + 1))} disabled={index >= items.length - 1}>
          下一張
        </button>
      </div>
      <div className="flex justify-center gap-1">
        {items.map((item, itemIndex) => (
          <button
            type="button"
            key={`${item.src}-dot-${itemIndex}`}
            aria-label={`切換到第 ${itemIndex + 1} 張`}
            onClick={() => setIndex(itemIndex)}
            className={`h-2 w-2 rounded-full ${itemIndex === index ? "bg-neutral-900" : "bg-neutral-300"}`}
          />
        ))}
      </div>
    </section>
  );
}

function renderBlock(block: BlogContentBlock) {
  switch (block.type) {
    case "paragraph":
      return <p className="leading-8 text-neutral-800 whitespace-pre-line">{block.props.text}</p>;
    case "heading": {
      const className = block.props.level === 3 ? "text-2xl font-semibold text-neutral-900" : "text-3xl font-bold text-neutral-900";
      return block.props.level === 3 ? <h3 className={className}>{block.props.text}</h3> : <h2 className={className}>{block.props.text}</h2>;
    }
    case "image":
      return (
        <figure className={imageClass(block.props.layout)}>
          <img src={block.props.src} alt={block.props.alt ?? ""} loading="lazy" className="w-full rounded-lg object-cover shadow-sm" />
          {block.props.caption ? <figcaption className="mt-2 text-center text-sm text-neutral-600">{block.props.caption}</figcaption> : null}
        </figure>
      );
    case "video":
      return (
        <figure className="mx-auto w-full max-w-4xl">
          <video controls preload="metadata" className="w-full rounded-lg bg-black shadow-sm">
            <source src={block.props.src} type={block.props.mimeType || undefined} />
          </video>
          {block.props.caption ? <figcaption className="mt-2 text-center text-sm text-neutral-600">{block.props.caption}</figcaption> : null}
        </figure>
      );
    case "gallery":
      return <Gallery block={block} />;
    case "quote":
      return (
        <blockquote className="border-l-4 border-[color:var(--post-accent)] bg-[color:var(--post-accent)]/10 px-5 py-4 text-lg leading-8 text-neutral-800">
          <p>{block.props.text}</p>
          {block.props.cite ? <cite className="mt-3 block text-sm not-italic text-neutral-600">- {block.props.cite}</cite> : null}
        </blockquote>
      );
    case "divider":
      return <hr className="my-8 border-neutral-200" />;
    case "columns":
      return (
        <div className="grid gap-6 md:grid-cols-2">
          {block.props.columns.map((column, index) => (
            <div key={index} className="space-y-5">
              <BlogContentRenderer blocks={column.blocks} compact />
            </div>
          ))}
        </div>
      );
  }
}

export function BlogContentRenderer({ blocks, compact = false }: { blocks: BlogContentBlock[]; compact?: boolean }) {
  const safeBlocks = useMemo(() => blocks.filter(Boolean), [blocks]);
  return (
    <div className={compact ? "space-y-4" : "space-y-8"}>
      {safeBlocks.map((block) => (
        <div key={block.id} className="flow-root">
          {renderBlock(block)}
        </div>
      ))}
    </div>
  );
}
