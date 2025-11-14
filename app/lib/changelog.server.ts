import type { LoaderFunctionArgs } from "react-router";

export type ChangelogItem = {
  date: string;
  title: string;
  notes?: string[];
  tag?: "add" | "fix" | "change" | "docs";
  filename?: string;
};

/**
 * Shared loader utility so both首頁和 changelog 頁都能讀取相同來源。
 */
export async function loadChangelogItems(_args?: LoaderFunctionArgs) {
  if (import.meta.env.DEV) {
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const { fileURLToPath } = await import("node:url");

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const candidates = [
        path.resolve(__dirname, "../content/changelog"),
        path.resolve(process.cwd(), "app/content/changelog"),
      ];

      let contentDir: string | null = null;
      for (const candidate of candidates) {
        try {
          const stat = await fs.stat(candidate);
          if (stat.isDirectory()) {
            contentDir = candidate;
            break;
          }
        } catch {
          // ignore
        }
      }

      if (contentDir) {
        const NAME_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9\-]+\.json$/i;
        const files = (await fs.readdir(contentDir)).filter((f) => NAME_RE.test(f));
        const items: ChangelogItem[] = [];
        for (const file of files) {
          try {
            const raw = await fs.readFile(path.join(contentDir, file), "utf8");
            const data = JSON.parse(raw) as ChangelogItem;
            items.push({ ...data, filename: file });
          } catch {
            // ignore broken file
          }
        }
        items.sort((a, b) => (a.date < b.date ? 1 : -1));
        return items;
      }
    } catch {
      // dev file read failed, fall back to Vite glob
    }
  }

  const modules = import.meta.glob("../content/changelog/*.json", { eager: true });
  const items: ChangelogItem[] = Object.entries(modules).map(([p, m]: any) => {
    const data = m.default ?? m;
    const filename = p.split("/").pop();
    return { ...data, filename } as ChangelogItem;
  });
  items.sort((a, b) => (a.date < b.date ? 1 : -1));
  return items;
}
