# Anime Memory Status

Last updated: 2026-09-10

## Current branch

`feature/anime-memory`

Base branch: `main`

## Current overall state

**IN PROGRESS — Batch A (#5)**

Project planning/tracking is established. Product implementation has not yet reached a user-facing route.

## Tracking

- #9 — Project roadmap
- #5 — Batch A: Data foundation & Netflix seed (**active**)
- #6 — Batch B: Seasonal survey, progress & evaluation
- #7 — Batch C: Library, detail page & watchlist
- #8 — Batch D: Movie survey, export, mobile UX & QA
- #10 — Documentation & handoff discipline

## Completed

### Project setup
- [x] Identified host repository: `JockYellow/react-router-starter`.
- [x] Confirmed existing Cloudflare Worker + React Router SSR architecture.
- [x] Confirmed existing `BLOG_DB` D1 binding is already used by multiple features.
- [x] Decided to reuse `BLOG_DB`; no Anime-only D1 is planned.
- [x] Created feature branch `feature/anime-memory`.
- [x] Created GitHub roadmap/batch/handoff issues (#5–#10).

### Canonical handoff docs
- [x] `docs/anime-memory/README.md`
- [x] `docs/anime-memory/TODO.md`
- [x] `docs/anime-memory/DECISIONS.md`
- [x] `docs/anime-memory/STATUS.md`

## Active segment

### A0/A1 — Domain skeleton + D1 schema

Next implementation tasks:

1. Create Anime domain types/constants under `app/features/anime/`.
2. Implement `ensureAnimeSchema(db)` using existing `BLOG_DB` conventions.
3. Create the initial `anime_*` tables and indexes idempotently.
4. Add focused verification/tests if repository patterns make that practical.
5. Update #5 and this file before moving to provider integration.

## Important decisions to preserve

- TV survey progress is year + season.
- Movies are tracked separately by year.
- Primary survey choices are Seen / Want / Not Seen.
- Seen expands in-place to detailed viewing status + one overall evaluation + optional concrete tags.
- There is no mandatory separate quality score.
- 'Why I watched it' is not required.
- Free-text note is optional and secondary.
- Every meaningful answer should persist continuously.
- Chinese-first display titles are required for efficient recall.
- AniList is planned as canonical external ID/provider; Bangumi is a Chinese-title fallback.
- Netflix is seed/provenance, not canonical identity.
- Smart recommendation/gap-filling is out of scope.
- JSON/CSV export is required before project completion.

## Known constraints / risks

- ChatGPT/GitHub access can modify repository code but does not expose the Cloudflare dashboard directly.
- This is acceptable because the existing `BLOG_DB` binding already exists and the repository already uses runtime `CREATE TABLE IF NOT EXISTS` patterns.
- External provider matching must avoid unsafe fuzzy/substring-only resolution.
- Netflix seed data should be sourced from the latest reviewed dataset rather than an old hard-coded prototype copy.

## Next exact step for a new developer/session

Read `README.md`, `TODO.md`, and `DECISIONS.md`, then open issue #5. Continue A0/A1 on branch `feature/anime-memory`; do not start Batch B until the initial schema/provider/seed foundation has been verified.
