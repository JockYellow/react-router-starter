# Project Context

## Project Summary
Personal website and experimentation hub built on React Router SSR deployed to Cloudflare Workers, with blog, tools, and interactive apps backed by D1 and R2.

## Tech Stack
- Language: TypeScript 5.8.3, SQL (SQLite/D1), JSON content files.
- Frontend: React 19, React Router 7.6.3 (SSR + loader/action), Vite 6, Tailwind CSS 4.1.1.
- Runtime/Hosting: Cloudflare Workers (Wrangler 4.49.0, compatibility_date 2025-10-08).
- Data/Storage: Cloudflare D1 (SQLite), Cloudflare R2 (image storage).
- Key Libraries: lucide-react 0.554.0, recharts 3.4.1, three 0.181.2, jsquash (jpeg/png/webp/resize), isbot 5.1.26.
- Tooling: @cloudflare/vite-plugin, @react-router/dev, Playwright (dev), tsx for scripts.

## Architecture Overview
- Single Cloudflare Worker entrypoint at `workers/app.ts` uses `createRequestHandler` to serve the React Router server build.
- SSR streaming is handled in `app/entry.server.tsx` with bot-aware `allReady` waiting.
- Route definitions live in `app/routes.ts` and map to `app/routes/**` files.
- Data access is implemented in loader/action functions with D1 (SQLite) and R2 integrations.
- Static content (blog posts, changelogs) is stored under `app/content` and loaded via `import.meta.glob`.
- Some tools rely on external services (Spotify API, KKTIX scraping) and local toolbelt helpers.

## Key Directories
- `app/`: React Router app code (SSR shell, routes, UI).
- `app/routes/`: Route handlers and pages (UI + loader/action).
- `app/features/`: Feature modules (blog, rng-prompt, gift, spotify, changelog) with co-located logic.
- `app/lib/`: Shared server utilities (D1, R2, image processing).
- `app/components/`: Shared UI components (e.g., DevMenu).
- `app/content/`: JSON content for blog posts, categories, and changelogs.
- `workers/`: Cloudflare Worker entrypoint and runtime glue.
- `sql/`: Feature-specific SQL scripts and schemas.
- `migrations/`: D1 migration files.
- `scripts/`: Node-based helper scripts (Wrangler tooling, imports).
- `toolbelt/`: Local helper service for scraping/ops (used by tools).
- `public/`: Static assets.
- `docs/`: Design notes, scripts, and reference documents.
- `dumps/`: Debug dumps and snapshots.

## Business Logic
- Admin auth: `/admin/login` validates `ADMIN_PASS`, sets `admin_session` cookie; `requireAdmin` guards admin routes.
- Blog content: categories from `app/content/blog/categories.json`; posts loaded from D1 when available, otherwise from `app/content/blog/posts/*.json`. D1 posts override file posts by slug. Summary auto-derived when missing.
- Blog editing: create/update via `/api/blog-post` with optimistic concurrency (`updatedAtBase`). Slugs are derived by `slugify` and must be unique. Images are resized to WebP and stored in R2.
- RNG prompt tool: categories/prompts stored in D1 tables (`categories`, `prompts`). Each category has type and min/max draw rules. Shuffle bags persist in localStorage to avoid repeats; group limits persist in cookies. Output templates are stored in `output_configs`. CSV import/export enforces strict headers and creates a backup table on import.
- Gift exchange: D1 tables manage gifts, players, stages, picks, and votes. Stage flow is `idle -> r1 -> s1 -> s2`. Entering `r1` clears current round picks. Gift assignment updates pick outcomes; votes are weighted and summarized.
- Voting tool: a user can cast up to 3 votes total and cannot vote the same option twice; users can delete only their own votes.
- Concert events: KKTIX events are scraped (remote or via local toolbelt), deduped by `source + source_id`, and upserted into D1 with `first_seen_at/last_seen_at`.
- Spotify ranking: D1 stores artist datasets and game sessions. The ranking game runs 3 rounds; picking 1 artist yields +3 points, picking 2 yields +1. Final tiers are computed via a fixed pyramid distribution (S-F).
