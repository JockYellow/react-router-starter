# Anime Memory Status

Last updated: 2026-09-10

## Current branch / review entry

- Branch: `feature/anime-memory`
- Base: `main`
- Draft PR: #11 — `feat: build Anime Memory archive`
- Roadmap: #9
- Active batch: #6 — Batch B
- Batch A: #5 — code-complete; remote D1/private seed verification remains open

## Current overall state

**IN PROGRESS — Batch B seasonal survey is now implemented as a first usable vertical slice.**

The project is no longer data-foundation-only. Private `/anime` and `/anime/survey` routes exist, compile in the full application, and are covered by Anime Memory CI. The dashboard shows season-by-season progress from 2011 onward. The survey can load a frozen seasonal candidate sequence, display Chinese-first metadata, persist viewing decisions, and capture Seen detail + one overall evaluation + optional tags/note.

## Verification snapshot

A GitHub Actions run after the first `/anime` UI slice passed:

- [x] `npm ci`
- [x] `npm run test:anime`
- [x] repository typecheck
- [x] React Router build
- [x] Wrangler deploy dry-run

A newer CI run is used for each subsequent Batch B change. Do not mark browser/runtime UX acceptance complete solely from compile CI.

## Batch A — foundation status

### Completed in code
- [x] Reuse existing `BLOG_DB`; no Anime-only D1.
- [x] Stable domain keys for season/status/watch detail/evaluation/tags.
- [x] `anime_catalog`, `anime_aliases`, `anime_decisions`, `anime_sources`.
- [x] `anime_evaluations`, `anime_evaluation_tags`.
- [x] `anime_survey_progress`, `anime_survey_candidates`.
- [x] Private `anime_seed_queue`.
- [x] AniList season/movie/title provider.
- [x] Bangumi title fallback.
- [x] Conservative exact-normalized title resolution; no broad substring auto-match.
- [x] Frozen candidate membership/order per survey scope.
- [x] Private Netflix seed staging/resolve/retry code and admin API.
- [x] Seed data cannot overwrite later manual/survey decisions.
- [x] `opencc-js` 1.4.2 pinned in manifest/lockfile.
- [x] Bangumi `name_cn` -> OpenCC `cn -> tw` -> cached `title_zh_tw` path.
- [x] Chinese-title enrichment is lazy and best-effort, so it does not burst requests for all 100 titles or block the survey when the fallback provider fails.
- [x] Anime CI runs tests/typecheck/build/Wrangler dry-run.

### Still pending because it requires real Cloudflare/private-data execution
- [ ] Execute schema against real remote `BLOG_DB` and verify repeated initialization.
- [ ] Stage the reviewed private Netflix rows into real D1.
- [ ] Resolve the private seed queue and inspect MATCHED / AMBIGUOUS / UNMATCHED / ERROR counts.

Per D-026, these runtime verification items keep #5 open but do not block Batch B UI development.

## Batch B — implemented now

### Dashboard `/anime`
- [x] Private/admin-authenticated route.
- [x] Seen / Want / Favourite counts.
- [x] Recent Anime Memory records.
- [x] 2011-to-current-year TV seasonal matrix.
- [x] Winter / Spring / Summer / Fall cells.
- [x] Not-started / in-progress / completed states.
- [x] Processed / candidate count and progress bar.
- [x] Direct season links.
- [x] Resume latest active season.

### Seasonal survey `/anime/survey`
- [x] Private/admin-authenticated route.
- [x] Initializes/fetches one frozen seasonal candidate sequence (default 100).
- [x] Chinese-first title with native/Romaji/English fallback/aliases.
- [x] Poster, format, episode count and studio metadata when available.
- [x] Primary `看過 / 想看 / 沒看` actions.
- [x] Want / Not Seen save immediately and advance.
- [x] Selecting Seen saves immediately but intentionally keeps the same card unresolved until viewing detail + overall evaluation are supplied.
- [x] Seen detail: Complete / season complete / partial / dropped / movie-only.
- [x] One overall evaluation: Favourite / Love / Recommend / Neutral / Dislike / Unrated.
- [x] Optional 15 concrete tags.
- [x] Optional secondary free-text note.
- [x] Progress semantics require Seen records to have both detail + overall evaluation before they count as processed.
- [x] Position-addressable review mode (`position=N`) for revisiting/editing an earlier card.
- [x] Previous-item navigation and return-to-unresolved flow.
- [x] Desktop primary hotkeys: A/Left = Seen, W/Up = Want, D/Right = Not Seen, Z = previous item.
- [x] Hotkeys are disabled while typing in input/textarea/select/contenteditable controls.

## Active segment

### B5/B6 — persistence/recovery polish + efficient correction

Next exact tasks:

1. Verify the latest previous-item/hotkey implementation in CI and fix any type/build issue.
2. Update #6/TODO checkboxes to reflect the verified vertical slice.
3. Add explicit persistent decision that Anime Memory pages are private/admin-authenticated by default.
4. Improve Seen-flow persistence so meaningful partial choices survive an unexpected close without forcing a long final submit.
5. Add browser-level/manual acceptance coverage for reload/resume, season switching and previous-item edits where feasible.
6. Keep #5 remote D1/private seed verification separate; do not let it expand Batch B scope again.

## Privacy rule

This repository is public. Never commit personal Anime Memory rows, watched-title lists, Netflix rows, personal ratings/tags/notes, or exported archives. Git versions only code/schema/import contracts/tests and non-personal aggregate development notes. Private source data belongs in D1 or ignored local/private files.

## Important decisions to preserve

- TV progress is year + season; movies are year-based separately.
- Candidate membership/order is frozen per scope.
- Seen / Want / Not Seen is the primary question.
- Seen requires detailed viewing status + one overall evaluation to finish a survey item.
- Tags and free-text note remain optional.
- Chinese-first display is required, but title fallback failure must never block answering.
- AniList is canonical identity; Bangumi improves Chinese-title coverage.
- Personal data never enters public Git.
- Seed data is historical evidence and never overrides newer manual decisions.
- Smart recommendation/gap-filling remains out of scope.
- JSON/CSV export remains required before final completion.

## Resume instructions for a new developer/chat

1. Read this file.
2. Read `docs/anime-memory/TODO.md`, `DECISIONS.md`, and `PRIVATE_DATA.md`.
3. Open #6 (active), #5 (remote verification pending), and Draft PR #11.
4. Continue on `feature/anime-memory`.
5. Check the latest Anime Memory CI before expanding the next segment.
6. Continue B5/B6 persistence/recovery and correction UX; do not reopen solved Batch A architecture questions.
