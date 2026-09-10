# Anime Memory TODO

Canonical project roadmap issue: #9

This checklist is intentionally split into small, independently verifiable segments. Update checkboxes as work is completed. Do not collapse multiple batches into one large untracked implementation.

## Batch A — Data foundation & Netflix seed (#5)

### A0. Project skeleton
- [x] Create `app/features/anime/`.
- [ ] Create `app/routes/anime/` (defer until Batch B begins).
- [x] Define domain constants/types for seasons, formats, primary decisions, detailed watch statuses, evaluations, and evaluation tags.
- [x] Document product/module behavior under `docs/anime-memory/`.

### A1. D1 schema
- [x] Implement `ensureAnimeSchema(db)`.
- [x] Create `anime_catalog`.
- [x] Create `anime_aliases`.
- [x] Create `anime_decisions`.
- [x] Create `anime_sources`.
- [x] Create `anime_evaluations`.
- [x] Create `anime_evaluation_tags`.
- [x] Create `anime_survey_progress`.
- [x] Create `anime_survey_candidates` to freeze per-scope candidate membership/order.
- [x] Add indexes for alias lookup, status filtering, year/season filtering, source lookup, evaluation filtering, and survey ordering.
- [x] Make schema creation logically idempotent with `CREATE TABLE/INDEX IF NOT EXISTS` and per-binding initialization caching.
- [x] Keep schema isolated via `anime_*` names.
- [ ] Execute schema twice against a real local/remote D1 environment as final idempotency verification.

### A2. Provider layer
- [x] Add AniList server client.
- [x] Normalize AniList result types.
- [x] Add year + season candidate query.
- [x] Add movie-by-year candidate query.
- [x] Add timeout/error handling wrapper.
- [x] Add Bangumi v0 title fallback client.
- [ ] Add reliable Simplified Chinese -> Taiwan Traditional conversion/selection.
- [x] Add AniList catalog/alias D1 cache functions.
- [x] Add survey-scope orchestration that fetches/caches candidates once and freezes their order.
- [ ] Add end-to-end Chinese-title resolver/cache orchestration.

### A3. Alias/deduplication rules
- [x] Normalize Unicode width/case/punctuation/whitespace conservatively.
- [x] Preserve exact aliases and source information.
- [x] Prefer canonical ID matches over text matches.
- [x] Avoid loose substring-only automatic matching.
- [x] Record source title used for a seed match.
- [x] Make uncertain matches `AMBIGUOUS` rather than silently forcing them.
- [x] Add pure-domain tests covering alias/status behavior (execution still pending).

### A4. Netflix seed
- [x] Read the latest reviewed Netflix decision set from the connected Google Sheet (2026-09-10 snapshot source).
- [x] Define deterministic Netflix review-status mapping.
- [x] Exclude `誤判` from personal decisions.
- [x] Map `沒看` to `NOT_SEEN`, not Seen.
- [x] Map watched statuses to detailed watch statuses.
- [x] Implement conservative AniList title resolution: only unique exact normalized alias matches auto-bind.
- [x] Implement idempotent `anime_sources` upsert for matched/ambiguous/unmatched rows.
- [x] Persist intended decision/candidate snapshots for unresolved seed matches.
- [x] Implement decision upsert only for safely matched canonical anime.
- [x] Ensure imported matched decisions are skipped by `getNextUnresolvedSurveyCandidate()` and counted as processed.
- [ ] Commit a versioned reviewed Netflix seed snapshot into the repository.
- [ ] Add a controlled import entry point/script for the committed seed snapshot.
- [ ] Execute the seed and review MATCHED / AMBIGUOUS / UNMATCHED counts before considering import complete.

### A5. Batch A verification
- [ ] Existing routes remain unaffected after typecheck/build verification.
- [ ] D1 schema initializes using existing `BLOG_DB` in an executable environment.
- [ ] Re-running schema initialization causes no destructive changes.
- [ ] Seed import is repeatable/idempotent in an executable environment.
- [ ] Review ambiguous/unmatched Netflix mappings rather than forcing them.
- [ ] Run `node --import tsx --test tests/anime/*.test.ts`.
- [ ] Run repository typecheck/build/Wrangler dry-run as appropriate.
- [x] Update `STATUS.md` at meaningful checkpoints.
- [x] Update #5 checklist/status at meaningful checkpoints.

---

## Batch B — Seasonal survey, progress & evaluation (#6)

### B0. Dashboard shell
- [ ] Add `/anime` route.
- [ ] Show total Seen count.
- [ ] Show Want count.
- [ ] Show highest/favourite evaluation count.
- [ ] Show recent Anime Memory activity.
- [ ] Add direct links to survey/library/watchlist.

### B1. Seasonal progress matrix
- [ ] Track TV progress by year + Winter/Spring/Summer/Fall.
- [ ] Show complete/in-progress/not-started states.
- [ ] Make each season directly clickable.
- [ ] Show processed / candidate count.
- [ ] Show most recently active season.
- [ ] Add `繼續盤點` resume action.

### B2. Survey candidate flow
- [ ] Add `/anime/survey` route.
- [ ] Load one seasonal candidate sequence.
- [ ] Exclude already resolved decisions from the next-question flow.
- [ ] Show Chinese-first title.
- [ ] Show poster.
- [ ] Show year/season.
- [ ] Show studio when available.
- [ ] Preserve original/alternate title for recognition.

### B3. Primary answer flow
- [ ] `看過` -> expand Seen details.
- [ ] `想看` -> save immediately and move on.
- [ ] `沒看` -> save immediately and move on.

### B4. Seen detail flow
- [ ] Completion status: 看完.
- [ ] Completion status: 看完一季／系列未追完.
- [ ] Completion status: 看過部分.
- [ ] Completion status: 棄番.
- [ ] Completion status: 只看電影／特別篇.
- [ ] Overall evaluation: 最喜歡.
- [ ] Overall evaluation: 很喜歡.
- [ ] Overall evaluation: 值得看.
- [ ] Overall evaluation: 普通.
- [ ] Overall evaluation: 不太喜歡.
- [ ] Overall evaluation: 記不清／不評.
- [ ] Optional concrete evaluation tags.
- [ ] Optional note remains visually secondary.

### B5. Persistence & recovery
- [ ] Persist each meaningful answer immediately.
- [ ] Resume from next unresolved candidate after reload/device switch.
- [ ] Previous-item navigation.
- [ ] Editing/upsert of previous answers.
- [ ] Prevent accidental duplicate records.
- [ ] Useful loading/error/retry states.

### B6. Desktop efficiency
- [ ] Keyboard shortcuts for primary actions.
- [ ] Shortcut for previous item.
- [ ] Avoid shortcuts that conflict with text entry.

### B7. Batch B verification
- [ ] Stop/reload/resume test.
- [ ] Season switch test.
- [ ] Seen evaluation persistence test.
- [ ] Want/Not Seen one-click flow test.
- [ ] Update `STATUS.md`.
- [ ] Update #6 checklist/status.

---

## Batch C — Library, detail page & watchlist (#7)

### C0. Library
- [ ] Add `/anime/library`.
- [ ] Poster-wall view.
- [ ] Search title/alias.
- [ ] Filter by detailed watch status.
- [ ] Filter by evaluation.
- [ ] Filter by year/season.
- [ ] Filter by evaluation tag.
- [ ] Filter/search by studio where metadata exists.

### C1. Detail page
- [ ] Add canonical anime detail route.
- [ ] Personal record appears before third-party metadata.
- [ ] Show viewing status/detail.
- [ ] Show overall evaluation.
- [ ] Show selected tags.
- [ ] Show optional note.
- [ ] Show core catalog metadata.
- [ ] Allow edits without returning to survey mode.

### C2. Watchlist
- [ ] Add `/anime/watchlist`.
- [ ] Show Want records with posters/metadata.
- [ ] Sort by added time.
- [ ] Sort by year.
- [ ] Sort by external popularity/score when present.
- [ ] Want -> Seen transition uses the standard evaluation flow.
- [ ] Allow safe removal/status change.

### C3. Batch C verification
- [ ] Every survey record can be found in Library/Watchlist.
- [ ] Search/filter combinations work.
- [ ] Detail-page edits persist.
- [ ] Update `STATUS.md`.
- [ ] Update #7 checklist/status.

---

## Batch D — Movies, export, mobile UX & QA (#8)

### D0. Movie survey
- [ ] Track movies by year rather than season.
- [ ] Reuse primary decision flow.
- [ ] Reuse Seen detail/evaluation/tag flow.
- [ ] Show movie-year progress separately from TV seasonal matrix.

### D1. Export
- [ ] Full JSON export.
- [ ] CSV export.
- [ ] Include canonical IDs and title variants.
- [ ] Include viewing decision/detail.
- [ ] Include evaluation/tags/note.
- [ ] Include source/provenance where useful.
- [ ] Verify exported data is understandable outside the app.

### D2. Mobile UX
- [ ] Responsive survey card.
- [ ] Comfortable tap targets.
- [ ] Avoid accidental primary actions.
- [ ] Library grid adapts to small screens.
- [ ] Progress matrix remains usable on mobile.

### D3. Reliability/QA
- [ ] Provider timeout handling.
- [ ] Provider partial-data handling.
- [ ] D1 failure handling.
- [ ] Schema idempotency tests.
- [ ] Decision/evaluation persistence tests.
- [ ] Typecheck.
- [ ] Build.
- [ ] Wrangler dry-run.
- [ ] Existing major routes smoke-check.

### D4. Handoff/deploy
- [ ] Document any required first-run behavior.
- [ ] Document deployment assumptions.
- [ ] Confirm no new Cloudflare DB provisioning is required.
- [ ] Finalize `STATUS.md`.
- [ ] Close completed project issues.

---

## Explicitly out of scope

- Smart recommendation / gap-filling algorithm.
- Automated taste-model ranking.
- Staff/studio affinity scoring.
- Mandatory multi-axis ratings.
- Separate Anime-only Cloudflare D1 database.
