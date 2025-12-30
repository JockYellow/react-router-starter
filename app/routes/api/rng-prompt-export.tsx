import type { LoaderFunctionArgs } from "react-router";

import { requireBlogDb } from "../../lib/d1.server";
import { buildCategoriesCsv, buildPromptsCsv } from "../../lib/rng-prompt-csv.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (type !== "categories" && type !== "prompts") {
    return Response.json({ error: "Invalid export type" }, { status: 400 });
  }

  const db = requireBlogDb(context);
  const csv = type === "categories" ? await buildCategoriesCsv(db, true) : await buildPromptsCsv(db, true);
  const filename = type === "categories" ? "rng_categories.csv" : "rng_prompts.csv";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
