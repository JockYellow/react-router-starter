# Anime Memory TODO

Canonical project roadmap issue: #9

Keep work split into independently verifiable segments. Personal Anime Memory rows never belong in this public repository.

## Batch A — Data foundation & Netflix seed (#5)

**State: code-complete; real Cloudflare D1/private seed verification pending.**

### A0–A3. Foundation / providers / matching
- [x] `app/features/anime/` domain structure and stable keys.
- [x] Reuse existing `BLOG_DB`; isolate tables with `anime_*` names.
- [x] Catalog / aliases / decisions / sources / evaluations / tags / survey progress / frozen candidates / seed queue tables.
- [x] Idempotent runtime schema construction by design.
- [x] AniList season, movie-year and title search provider.
- [x] Bangumi Chinese-title fallback.
- [x] Conservative exact-normalized matching; no broad substring auto-match.
- [x] Freeze candidate membership/order per survey scope.
- [x] Pin `opencc-js` 1.4.2.
- [x] Bangumi `name_cn` -> OpenCC `cn -> tw` -> cached `title_zh_tw`.
- [x] Lazy/best-effort Chinese enrichment for the current survey card.
- [ ] Execute schema twice against real Cloudflare D1 and verify idempotency.

### A4. Private Netflix seed
- [x] Read latest reviewed Google Sheet source (2026-09-10; 109 rows observed for migration planning).
- [x] Deterministic reviewed-status mapping.
- [x] `誤判` excluded; `沒看` maps to `NOT_SEEN`.
- [x] Safe MATCHED / AMBIGUOUS / UNMATCHED provenance.
- [x] Private `anime_seed_queue` with PENDING/MATCHED/AMBIGUOUS/UNMATCHED/SKIPPED/ERROR.
- [x] Admin + CSRF protected stage/resolve/retry API.
- [x] Seed cannot overwrite newer manual/survey decisions.
- [x] Private/local Anime data paths ignored by Git.
- [ ] Stage reviewed rows into real D1.
- [ ] Resolve queue and inspect final match/error counts.

### A5. Executable verification
- [x] Anime unit tests run in GitHub Actions.
- [x] Repository typecheck passes.
- [x] React Router build passes.
- [x] Wrangler dry-run passes.
- [x] Existing application remains build-compatible with Anime Memory code.
- [ ] Remote D1 runtime verification.
- [ ] Private seed runtime verification.

---

## Batch B — Seasonal survey, progress & evaluation (#6)

**State: active. Core survey is implemented; first-load reliability is in PR #12 and browser acceptance remains.**

### B0. Dashboard shell
- [x] Add private/admin-authenticated `/anime` route.
- [x] Show total Seen count.
- [x] Show Want count.
- [x] Show Favourite count.
- [x] Show recent Anime Memory activity.
- [x] Provide direct season/resume actions.
- [ ] Add Library/Watchlist shortcuts when Batch C routes exist.

### B1. Seasonal progress matrix
- [x] Track TV progress by year + Winter/Spring/Summer/Fall.
- [x] Show complete / in-progress / not-started states.
- [x] Make each season directly clickable.
- [x] Show processed / candidate count and progress bar.
- [x] Show most recently active season.
- [x] Add `繼續盤點` resume action.

### B2. Survey candidate flow
- [x] Add private/admin-authenticated `/anime/survey` route.
- [x] Load/freeze one seasonal candidate sequence (default 100).
- [x] Continue from next unresolved candidate.
- [x] Chinese-first title with safe fallback.
- [x] Poster.
- [x] Year/season context.
- [x] Studio/format/episode metadata when available.
- [x] Preserve native/Romaji/English title variants for recognition.
- [x] Position-addressable review mode (`position=N`).

### B3. Primary answer flow
- [x] `看過` persists immediately and expands Seen details.
- [x] `想看` saves immediately and advances.
- [x] `沒看` saves immediately and advances.

### B4. Seen detail/evaluation flow
- [x] Completion: 看完.
- [x] Completion: 看完一季／系列未追完.
- [x] Completion: 看過部分.
- [x] Completion: 棄番.
- [x] Completion: 只看電影／特別篇.
- [x] Overall evaluations: 最喜歡 / 很喜歡 / 值得看 / 普通 / 不太喜歡 / 記不清／不評.
- [x] Optional 15 concrete evaluation tags.
- [x] Optional note remains visually secondary.
- [x] Seen item only counts as processed when viewing detail + overall evaluation exist.
- [x] Incremental autosave for detail/rating/tag/note choices.

### B5. Persistence, loading visibility & recovery
- [x] Primary answers persist immediately.
- [x] Seen flow stays on the same card until required detail/evaluation exists.
- [x] Resume from next unresolved candidate after reload/device switch by D1 state.
- [x] Previous-item navigation.
- [x] Existing answer edit/upsert path.
- [x] Prevent duplicate records with canonical IDs/upserts.
- [x] Provider loading/error retry state.
- [x] Persist first-time seasonal load state in D1.
- [x] Fetch first-time AniList season data in batches of at most 50 candidates.
- [x] Show fetched/target progress and current load phase to the user.
- [x] Resume from the saved provider page after reload/failure.
- [x] Add short per-scope D1 load lock to suppress duplicate initialization.
- [x] Automatically retry timeout/network/408/425/429/5xx with bounded exponential backoff.
- [x] Respect provider `Retry-After` when available.
- [x] After automatic retries are exhausted, show the stopped count/error and a targeted retry action.
- [ ] Browser-level first-load progress acceptance test against deployed Worker/D1.
- [ ] Browser-level stop/reload/resume acceptance test.
- [ ] Browser-level previous-item edit acceptance test.

### B6. Desktop efficiency
- [x] A / Left = Seen.
- [x] W / Up = Want.
- [x] D / Right = Not Seen.
- [x] Z = previous item.
- [x] Disable shortcuts while typing in input/textarea/select/contenteditable.
- [ ] Review shortcut behavior after real usage and simplify if any key feels error-prone.

### B7. Batch B verification / polish
- [x] CI unit tests/typecheck/build/Wrangler dry-run for dashboard/survey slice.
- [x] CI unit tests/typecheck/build/Wrangler dry-run for previous-item/hotkey slice.
- [x] CI verification for incremental Seen autosave slice.
- [x] Provider retry policy unit tests added.
- [ ] Final CI on PR #12 head after reliability/docs changes.
- [ ] Manual/browser season-switch test.
- [ ] Manual/browser Seen persistence test.
- [ ] Manual/browser Want/Not Seen one-click test.
- [ ] Manual/browser first-time load/retry/duplicate-tab test.
- [ ] Update/close #6 after deployed browser acceptance.

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
- [ ] Personal record before third-party metadata.
- [ ] Show/edit viewing status/detail.
- [ ] Show/edit overall evaluation.
- [ ] Show/edit tags/note.
- [ ] Show core catalog metadata.

### C2. Watchlist
- [ ] Add `/anime/watchlist`.
- [ ] Show Want records with posters/metadata.
- [ ] Sort by added time/year/provider popularity where useful.
- [ ] Want -> Seen transition reuses standard evaluation flow.
- [ ] Allow safe removal/status change.

### C3. Verification
- [ ] Every survey record can be found in Library/Watchlist.
- [ ] Search/filter combinations work.
- [ ] Detail edits persist.
- [ ] Update #7 / STATUS.

---

## Batch D — Movies, export, mobile UX & QA (#8)

### D0. Movie survey
- [ ] Track movies by year rather than season.
- [ ] Reuse primary decision + Seen evaluation flow.
- [ ] Show movie-year progress separately.

### D1. Export
- [ ] Full JSON export.
- [ ] CSV export.
- [ ] Include canonical IDs/title variants/status/detail/evaluation/tags/note/provenance where useful.
- [ ] Verify export is understandable outside the app.

### D2. Mobile UX
- [ ] Responsive survey card.
- [ ] Comfortable tap targets and accidental-action protection.
- [ ] Library grid adapts to small screens.
- [ ] Progress matrix remains usable on mobile.

### D3. Reliability / QA
- [x] Base provider timeout + retry/backoff policy implemented in Batch B.
- [ ] Provider partial-data handling acceptance tests.
- [ ] D1 failure handling beyond first-load resumability.
- [ ] Decision/evaluation persistence integration tests.
- [ ] Final typecheck/build/Wrangler dry-run.
- [ ] Existing major routes smoke-check.

### D4. Handoff / deploy
- [ ] Document first-run/runtime assumptions.
- [ ] Confirm no new Cloudflare database provisioning is required.
- [ ] Finalize `STATUS.md`.
- [ ] Close completed issues and prepare final PR for merge.

---

## Explicitly out of scope

- Smart recommendation / gap-filling algorithm.
- Automated taste-model ranking.
- Staff/studio affinity scoring.
- Mandatory multi-axis ratings.
- Separate Anime-only Cloudflare D1 database.
