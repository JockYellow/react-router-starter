# Anime Memory Status

Last updated: 2026-09-10

## Current branch

`feature/anime-memory`

Base branch: `main`

Draft PR: #11 — `feat: build Anime Memory archive`

## Current overall state

**IN PROGRESS — Batch A (#5)**

The project is past planning-only state. Domain types, the initial D1 schema, provider clients, conservative title normalization, and AniList-to-D1 catalog caching now exist. No user-facing Anime route has been added yet.

## Tracking

- #9 — Project roadmap
- #5 — Batch A: Data foundation & Netflix seed (**active**)
- #6 — Batch B: Seasonal survey, progress & evaluation
- #7 — Batch C: Library, detail page & watchlist
- #8 — Batch D: Movie survey, export, mobile UX & QA
- #10 — Documentation & handoff discipline (**completed/closed**)
- #11 — Draft implementation PR

## Completed

### Project setup / handoff
- [x] Identified host repository: `JockYellow/react-router-starter`.
- [x] Confirmed existing Cloudflare Worker + React Router SSR architecture.
- [x] Confirmed existing `BLOG_DB` D1 binding is already used by multiple features.
- [x] Decided to reuse `BLOG_DB`; no Anime-only D1 is planned.
- [x] Created feature branch `feature/anime-memory`.
- [x] Created GitHub roadmap/batch/handoff issues (#5–#10).
- [x] Created Draft PR #11.
- [x] Added canonical `README.md`, `TODO.md`, `DECISIONS.md`, and `STATUS.md` under `docs/anime-memory/`.

### A0 — Domain foundation
- [x] Added `app/features/anime/anime.types.ts`.
- [x] Added stable keys/types for seasons, primary decisions, detailed viewing status, overall evaluation, survey scopes, and the initial 15 evaluation tags.
- [x] Added deterministic survey scope keys (`tv:YEAR:SEASON`, `movie:YEAR`).
- [x] Added conservative title/alias normalization helpers.

### A1 — D1 schema implementation
- [x] Added idempotent `ensureAnimeSchema(db)` using the existing D1 Worker binding model.
- [x] Added `anime_catalog`.
- [x] Added `anime_aliases`.
- [x] Added `anime_decisions`.
- [x] Added `anime_sources` with explicit `MATCHED / AMBIGUOUS / UNMATCHED` provenance states.
- [x] Added `anime_evaluations`.
- [x] Added `anime_evaluation_tags`.
- [x] Added `anime_survey_progress`.
- [x] Added `anime_survey_candidates` to freeze each survey candidate set/order.
- [x] Added indexes for primary filter/search paths.
- [x] Cached schema initialization per D1 binding object for a Worker isolate; failed initialization can retry.

### A2 — Provider layer (partial)
- [x] Added shared provider HTTP timeout/error wrapper.
- [x] Added AniList GraphQL client.
- [x] AniList seasonal discovery by year + season.
- [x] AniList movie discovery by year.
- [x] AniList anime title search (returns multiple candidates rather than assuming the first result is correct).
- [x] Added Bangumi v0 subject search client filtered to anime/non-NSFW.
- [x] Bangumi client sends an identifiable project User-Agent.
- [x] Added AniList metadata/alias D1 cache functions.
- [ ] Reliable Simplified Chinese -> Taiwan Traditional conversion/selection.
- [ ] End-to-end title resolver that safely links a Bangumi subject to an AniList record.
- [ ] Provider cache/read orchestration for a full seasonal survey scope.

### A4 — Netflix source preparation (partial)
- [x] Re-read the live reviewed Google Sheet (`動畫候選`) on 2026-09-10 rather than trusting the old local prototype list.
- [x] Confirmed the current sheet still contains the formal decisions used by the import model (看完 / 看完一季／系列未追完 / 看過一部分 / 棄番 / 沒看 / 誤判, etc.).
- [ ] Implement deterministic seed import from the reviewed data.
- [ ] Resolve Japanese anime to AniList IDs where evidence is strong.
- [ ] Preserve other-region/unmatched/ambiguous rows as provenance instead of forcing AniList IDs.

## Active segment

### A2/A3/A4 — Provider resolution + safe seed import

Next implementation tasks:

1. Add a safe AniList/Bangumi title-resolution layer.
2. Decide and implement a reliable zh-TW conversion path without hand-maintaining a partial conversion dictionary.
3. Add seed import types/status mapping and idempotent `anime_sources` writes.
4. Resolve Netflix rows only when matching evidence is sufficient; preserve ambiguous/unmatched records explicitly.
5. Add survey-scope cache/orchestration that persists candidate order in `anime_survey_candidates`.
6. Perform executable type/build/D1 verification before closing Batch A.

## Important decisions to preserve

- TV survey progress is year + season.
- Movies are tracked separately by year.
- Survey candidate membership/order is persisted so progress cannot drift when third-party rankings change.
- Primary survey choices are Seen / Want / Not Seen.
- Seen expands in-place to detailed viewing status + one overall evaluation + optional concrete tags.
- There is no mandatory separate quality score.
- 'Why I watched it' is not required.
- Free-text note is optional and secondary.
- Every meaningful answer should persist continuously.
- Chinese-first display titles are required for efficient recall.
- AniList is the planned canonical external Anime ID/provider; Bangumi is a Chinese-title fallback/source.
- Netflix is seed/provenance, not canonical identity.
- Ambiguous external title matches must remain reviewable; no broad substring auto-match.
- Smart recommendation/gap-filling is out of scope.
- JSON/CSV export is required before project completion.

## Verification status

### Verified by repository inspection / current official docs
- Existing `BLOG_DB` binding is present in `wrangler.json`.
- Existing repository features already use D1 through Worker bindings.
- Current Cloudflare D1 Worker API supports prepared statements and `batch()`.
- Current AniList API supports POST GraphQL requests, seasonal filters, pagination, and anime title search.
- Current Bangumi v0 API exposes subject search; official guidance requests an identifiable User-Agent for non-browser API clients.

### Not yet executable-verified
- TypeScript build/typecheck for the new files.
- D1 schema execution against local or remote `blog-db`.
- Live AniList/Bangumi requests from the repository runtime.

The ChatGPT execution container cannot directly clone/install/run this GitHub repository because outbound GitHub network access is unavailable there. Do not mark executable verification complete until it is run through the repository's normal development/CI/Cloudflare environment.

## Known constraints / risks

- ChatGPT/GitHub access can modify repository code but does not expose the Cloudflare dashboard directly.
- This is acceptable for schema design because the existing `BLOG_DB` binding already exists.
- The repository has no OpenCC dependency at this point. Do not introduce an untracked or incomplete handwritten Simplified/Traditional conversion table.
- AniList itself warns that title search is not a unique lookup; seed matching must evaluate candidates rather than trusting result #1.
- The reviewed Netflix sheet contains some non-Japanese animation. These records must not be silently dropped or forced into AniList if no canonical Anime entry exists.

## Next exact step for a new developer/session

Read `README.md`, `TODO.md`, and `DECISIONS.md`, then open #5 and Draft PR #11. Continue the A2/A3/A4 provider-resolution/seed work on `feature/anime-memory`. Do not start Batch B UI until Batch A has executable schema/build verification and the seed/candidate-cache path is stable.
