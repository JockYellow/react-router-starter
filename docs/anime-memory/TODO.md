# Anime Memory TODO

Canonical project roadmap issue: #9

This checklist is intentionally split into small, independently verifiable segments. Update checkboxes as work is completed. Do not collapse multiple batches into one large untracked implementation.

## Batch A — Data foundation & Netflix seed (#5)

### A0. Project skeleton
- [ ] Create `app/features/anime/`.
- [ ] Create `app/routes/anime/`.
- [ ] Define domain constants/types for seasons, formats, primary decisions, detailed watch statuses, evaluations, and evaluation tags.
- [ ] Add a small feature README or module comments where behavior is non-obvious.

### A1. D1 schema
- [ ] Implement `ensureAnimeSchema(db)`.
- [ ] Create `anime_catalog`.
- [ ] Create `anime_aliases`.
- [ ] Create `anime_decisions`.
- [ ] Create `anime_sources`.
- [ ] Create `anime_evaluations`.
- [ ] Create `anime_evaluation_tags`.
- [ ] Create `anime_survey_progress`.
- [ ] Add indexes for alias lookup, status filtering, year/season filtering, and source lookup.
- [ ] Ensure schema initialization is idempotent.
- [ ] Keep schema isolated via `anime_*` names.

### A2. Provider layer
- [ ] Add AniList server client.
- [ ] Normalize AniList result types.
- [ ] Add year + season candidate query.
- [ ] Add movie-by-year candidate query.
- [ ] Add reasonable timeout/error handling.
- [ ] Add Bangumi title fallback.
- [ ] Add Chinese title normalization strategy.
- [ ] Cache normalized provider results into D1.

### A3. Alias/deduplication rules
- [ ] Normalize punctuation/whitespace safely.
- [ ] Preserve exact aliases.
- [ ] Prefer canonical ID matches over text matches.
- [ ] Avoid loose substring-only matching.
- [ ] Record source title used for a match.
- [ ] Make uncertain matches reviewable rather than silently forcing them.

### A4. Netflix seed
- [ ] Read the latest reviewed Netflix decision set.
- [ ] Exclude `誤判`.
- [ ] Map `沒看` to `NOT_SEEN`, not Seen.
- [ ] Map watched statuses to detailed watch statuses.
- [ ] Resolve titles to canonical IDs where reliable.
- [ ] Persist provenance in `anime_sources`.
- [ ] Prevent confirmed Netflix records from resurfacing as unresolved survey candidates.
- [ ] Record unresolved/ambiguous seed matches for later review.

### A5. Batch A verification
- [ ] Existing routes remain unaffected.
- [ ] D1 schema can initialize using existing `BLOG_DB`.
- [ ] Re-running schema initialization causes no destructive changes.
- [ ] Seed import is repeatable/idempotent.
- [ ] Update `STATUS.md`.
- [ ] Update #5 checklist/status.

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
- [ ] Exclude already resolved decisions.
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
