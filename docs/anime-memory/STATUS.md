# Anime Memory Status

Last updated: 2026-09-11

## Current branch / review entry

- Base: `main`
- PR #11 — initial Anime Memory vertical slice — merged on 2026-09-10.
- Active branch: `feature/anime-batch-b-reliability`
- Active Draft PR: #12 — `feat(anime): finish Batch B loading reliability`
- Roadmap: #9
- Active batch: #6 — Batch B
- Batch A: #5 — code-complete; remote D1/private seed verification remains open

## Current overall state

**IN PROGRESS — Batch B core survey is implemented; first-time seasonal loading reliability is now implemented in PR #12 and awaiting final CI + deployed browser acceptance.**

`/anime` and `/anime/survey` already exist on `main`. PR #12 changes only the first-time season initialization/reliability path: visible progress, page-sized provider fetches, resumability, duplicate-load suppression, and bounded automatic retries.

## Verification snapshot

The code commit before the latest docs/test-only follow-up passed the complete Anime Memory CI pipeline:

- [x] `npm ci`
- [x] `npm run test:anime`
- [x] repository typecheck
- [x] React Router build
- [x] Wrangler deploy dry-run

The PR head continues to run CI after every follow-up commit. Browser/runtime acceptance against deployed Cloudflare D1 is still required before #6 is closed.

## Batch A — foundation status

### Completed in code
- [x] Reuse existing `BLOG_DB`; no Anime-only D1.
- [x] Stable domain keys and `anime_*` schema.
- [x] AniList discovery/search and catalog/alias cache.
- [x] Bangumi + OpenCC zh-TW fallback.
- [x] Conservative exact-normalized matching.
- [x] Frozen seasonal candidate ordering.
- [x] Private Netflix seed queue/API with safe precedence.
- [x] Anime tests/typecheck/build/Wrangler dry-run in CI.

### Still pending because it requires real Cloudflare/private-data execution
- [ ] Execute schema repeatedly against real remote `BLOG_DB`.
- [ ] Stage the reviewed private Netflix rows into real D1.
- [ ] Resolve the seed queue and inspect MATCHED / AMBIGUOUS / UNMATCHED / ERROR counts.

These remain tracked in #5 and do not block Batch B/C development.

## Batch B — implemented

### Dashboard `/anime`
- [x] Admin-authenticated route.
- [x] Seen / Want / Favourite counts.
- [x] Recent records.
- [x] 2011-to-current-year seasonal matrix.
- [x] Complete / in-progress / not-started states.
- [x] Processed/candidate counts and resume action.

### Seasonal survey `/anime/survey`
- [x] Admin-authenticated route.
- [x] Frozen candidate sequence.
- [x] Chinese-first title + poster + recognition metadata.
- [x] Seen / Want / Not Seen primary flow.
- [x] Seen detail + one overall evaluation + optional tags/note.
- [x] Incremental autosave for Seen details.
- [x] Previous-item/review mode.
- [x] Desktop hotkeys with typing protection.

### First-time season loading reliability — PR #12
- [x] `anime_survey_load_state` persists loading state in D1.
- [x] AniList TV season loading runs in batches of at most 50 records.
- [x] UI shows fetched / target count and current phase.
- [x] Page progress survives reloads; failed later pages do not restart page 1.
- [x] 30-second per-scope D1 lease suppresses duplicate simultaneous initialization.
- [x] Timeout/network/408/425/429/5xx use up to two bounded automatic retries.
- [x] Retry uses exponential backoff + jitter and respects `Retry-After` within a wait cap.
- [x] Exhausted errors show where loading stopped and expose a targeted retry button.
- [x] Non-retryable 4xx fails immediately.
- [x] Provider retry unit tests added.
- [x] Schema test covers `anime_survey_load_state` creation.

## Active segment

### B7 — deployed browser acceptance

After PR #12 CI is green:

1. Merge/deploy PR #12.
2. Open a not-yet-initialized season and confirm progress visibly advances (normally 0 → 50 → up to 100 → build scope → first card).
3. Reload during loading and confirm it resumes rather than restarts.
4. Test a second tab/rapid repeat action and confirm duplicate load suppression.
5. Confirm Seen autosave, Want/Not Seen one-click, season switching and previous-item editing on the deployed Worker.
6. Update/close #6 if those acceptance checks pass.
7. Start Batch C: Library / detail / watchlist.

## Privacy rule

This repository is public. Never commit personal Anime Memory rows, Netflix rows, personal ratings/tags/notes, or exported archives. Private source data belongs in D1 or ignored local/private files.

## Important decisions to preserve

- TV progress is year + season; movies are year-based separately.
- Candidate membership/order is frozen per scope.
- Seen requires viewing detail + one overall evaluation to count as processed.
- Tags and note are optional.
- First-time data loading must be visible, resumable, and resistant to accidental duplicate retries.
- Chinese title fallback failure must never block answering.
- AniList is canonical identity; Bangumi improves Chinese-title coverage.
- Personal data never enters public Git.
- JSON/CSV export remains required before final completion.

## Resume instructions for a new developer/chat

1. Read this file, `TODO.md`, `DECISIONS.md`, and `PRIVATE_DATA.md`.
2. Open #6, #5, and Draft PR #12.
3. Continue on `feature/anime-batch-b-reliability` until #12 is merged.
4. Check the latest Anime Memory CI before merging.
5. Do not reopen solved Batch A architecture questions; only #5 remote/private runtime verification remains there.
