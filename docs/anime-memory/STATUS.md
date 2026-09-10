# Anime Memory Status

Last updated: 2026-09-10

## Current branch

`feature/anime-memory`

Base branch: `main`

Draft PR: #11 — `feat: build Anime Memory archive`

## Current overall state

**IN PROGRESS — Batch A (#5)**

The project is past planning-only state. The domain model, D1 schema, external provider clients, conservative title resolution, Netflix seed persistence logic, and stable seasonal survey-scope caching now exist. No user-facing Anime route has been added yet.

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
- [x] Reuse existing `BLOG_DB`; no Anime-only D1.
- [x] Feature branch `feature/anime-memory`.
- [x] Roadmap/batch/handoff issues #5–#10.
- [x] Draft PR #11.
- [x] Canonical README / TODO / DECISIONS / STATUS docs under `docs/anime-memory/`.

### A0 — Domain foundation
- [x] `app/features/anime/anime.types.ts`.
- [x] Stable keys for seasons, primary decisions, viewing detail, evaluation, survey scopes and 15 concrete evaluation tags.
- [x] Deterministic scope keys (`tv:YEAR:SEASON`, `movie:YEAR`).
- [x] Conservative title/alias normalization helpers.
- [x] Pure domain tests added under `tests/anime/anime-domain.test.ts` (not executable-verified yet).

### A1 — D1 schema implementation
- [x] Idempotent `ensureAnimeSchema(db)` using existing Worker D1 binding pattern.
- [x] `anime_catalog`.
- [x] `anime_aliases`.
- [x] `anime_decisions`.
- [x] `anime_sources` with `MATCHED / AMBIGUOUS / UNMATCHED` provenance states.
- [x] `anime_evaluations`.
- [x] `anime_evaluation_tags`.
- [x] `anime_survey_progress`.
- [x] `anime_survey_candidates` to freeze candidate membership/order per scope.
- [x] Primary filter/search/order indexes.

### A2 — Provider layer
- [x] Shared provider timeout/error wrapper.
- [x] AniList GraphQL seasonal discovery.
- [x] AniList movie-by-year discovery.
- [x] AniList title search that returns multiple candidates.
- [x] Bangumi v0 anime search client with identifiable User-Agent.
- [x] AniList metadata/alias D1 cache.
- [x] Stable survey-scope orchestration: provider fetch -> catalog cache -> frozen candidate positions.
- [x] Read APIs for full scope and next unresolved candidate.
- [x] Progress refresh based on actual decisions.
- [ ] Reliable Simplified Chinese -> Taiwan Traditional conversion/selection.
- [ ] End-to-end Chinese-title enrichment of newly discovered survey candidates.

### A3 — Safe matching
- [x] NFKC/case/punctuation/whitespace normalization only.
- [x] No broad substring auto-match.
- [x] AniList resolver only auto-matches a unique exact normalized alias (or unique exact alias narrowed by year when available).
- [x] Search results without exact alias are `AMBIGUOUS`, not silently accepted.
- [x] Bangumi resolver requires exact normalized source-name evidence and uses year as a narrowing signal when available.

### A4 — Netflix seed implementation (partial)
- [x] Re-read live reviewed Google Sheet `動畫候選` on 2026-09-10.
- [x] Exported the current native Sheet to an XLSX snapshot in the execution environment for deterministic extraction; 109 non-empty reviewed title rows were confirmed.
- [x] Current status counts confirmed from the snapshot: 69 看完, 6 看完一季／系列未追完, 11 看過一部分, 11 棄番, 9 沒看, 3 誤判.
- [x] Deterministic status mapping implemented in `netflix-seed.ts`.
- [x] `誤判` / deferred/unknown statuses do not create decisions.
- [x] Safe per-row importer implemented in `netflix-seed.server.ts`.
- [x] Matched rows cache canonical AniList metadata and use the reviewed Netflix title as a trusted zh-TW alias/display title.
- [x] Matched rows upsert personal decisions.
- [x] Ambiguous/unmatched rows preserve provenance, intended decision and candidate snapshots without creating a false canonical decision.
- [x] Imported decisions are automatically skipped by the next-unresolved survey query and counted as processed.
- [ ] Commit a versioned reviewed Netflix seed snapshot into the repository.
- [ ] Add a controlled import entry point/script for that snapshot.
- [ ] Execute import and review MATCHED / AMBIGUOUS / UNMATCHED results.

## Active segment

### A4/A5 — Versioned seed snapshot + executable verification

Next exact tasks:

1. Commit the 2026-09-10 reviewed Netflix data as a versioned repository seed snapshot.
2. Add a controlled seed-import command/entry point that consumes the committed snapshot.
3. Add a reliable zh-TW conversion strategy for non-Netflix provider titles (do not use a handwritten partial mapping table).
4. Execute pure-domain tests.
5. Execute TypeScript typecheck/build/Wrangler dry-run in a repository-capable environment.
6. Execute schema initialization twice against D1 and verify idempotency.
7. Execute the Netflix seed, inspect ambiguous/unmatched rows, and only then close Batch A.

## Important decisions to preserve

- TV survey progress is year + season.
- Movies are tracked separately by year.
- Survey candidate membership/order is persisted so progress cannot drift when third-party rankings change.
- Primary choices are Seen / Want / Not Seen.
- Seen expands to detailed viewing status + one overall evaluation + optional concrete tags.
- No mandatory second quality score.
- 'Why I watched it' is not required.
- Free-text note is optional and secondary.
- Every meaningful answer should persist continuously.
- Chinese-first display titles are required.
- AniList is the canonical external Anime ID/provider; Bangumi is a Chinese-title fallback/source.
- Netflix is seed/provenance, not canonical identity.
- Ambiguous provider matches remain reviewable.
- Non-Japanese/unmatched Netflix animation must not be silently discarded or forced into AniList.
- Smart recommendation/gap-filling is out of scope.
- JSON/CSV export is required before project completion.

## Verification status

### Verified by repository inspection / current official docs
- Existing `BLOG_DB` binding is present and already used by site features.
- Current Cloudflare D1 Worker API supports prepared statements and `batch()`.
- Current AniList API supports POST GraphQL, seasonal filtering, pagination and title search.
- Current Bangumi v0 API exposes subject search and documents an identifiable User-Agent expectation for non-browser clients.

### Not yet executable-verified
- New Anime TypeScript files compile in the repository build.
- Domain tests pass.
- D1 schema executes successfully against local/remote `blog-db`.
- Live provider calls work from the deployed Worker runtime.
- Netflix seed import result counts.

The ChatGPT container cannot directly clone/install/run this GitHub repository because outbound GitHub network access is unavailable there. Do not mark executable verification complete until run through the repository's normal local/CI/Cloudflare environment.

## Next exact step for a new developer/session

Read `README.md`, `TODO.md`, `DECISIONS.md`, issue #5 and Draft PR #11. Continue with the versioned Netflix seed snapshot/import entry point on `feature/anime-memory`, then solve provider zh-TW conversion and perform executable Batch A verification. Do not start Batch B UI before those foundation checks are complete.
