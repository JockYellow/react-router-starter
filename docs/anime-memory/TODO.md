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

**State: code-complete in PR #12; deployed browser acceptance pending.**

### B0–B4. Dashboard / seasonal survey / answering / evaluation
- [x] Private/admin-authenticated `/anime` dashboard.
- [x] Seasonal progress matrix with counts/resume.
- [x] `/anime/survey` with frozen candidate sequence.
- [x] Chinese-first title, poster and recognition metadata.
- [x] Seen / Want / Not Seen primary flow.
- [x] Seen completion + one overall evaluation + optional 15 tags + optional note.
- [x] Incremental Seen autosave.
- [x] Position-addressable previous/edit mode.

### B5. Persistence, loading visibility & recovery
- [x] Primary answers persist immediately.
- [x] Resume from D1 after reload/device switch.
- [x] Prevent duplicate records with canonical IDs/upserts.
- [x] Persist first-time seasonal load state in `anime_survey_load_state`.
- [x] Fetch AniList in batches of at most 50 candidates.
- [x] Show fetched / target progress and current load phase.
- [x] Resume from the saved provider page after reload/failure.
- [x] Add short per-scope D1 lock to suppress duplicate initialization.
- [x] Retry timeout/network/408/425/429/5xx with bounded exponential backoff + jitter.
- [x] Respect provider `Retry-After` within a capped wait.
- [x] Non-retryable 4xx fails immediately.
- [x] Exhausted failures show stopped count/error and a targeted retry action.
- [ ] Browser-level first-load progress acceptance against deployed Worker/D1.
- [ ] Browser-level reload/resume acceptance.
- [ ] Browser-level duplicate-tab/repeated-trigger acceptance.

### B6. Desktop efficiency
- [x] A / Left = Seen.
- [x] W / Up = Want.
- [x] D / Right = Not Seen.
- [x] Z = previous item.
- [x] Disable shortcuts while typing.
- [ ] Review shortcut behavior after real usage.

### B7. Verification / polish
- [x] Dashboard/survey CI verified.
- [x] Previous-item/hotkey CI verified.
- [x] Incremental Seen autosave CI verified.
- [x] Provider retry policy unit tests.
- [x] Load-state schema test.
- [x] Reliability implementation passed Anime tests, repository typecheck, React Router build, and Wrangler dry-run before the final docs-only checkpoint.
- [ ] Manual/browser season-switch test.
- [ ] Manual/browser Seen persistence test.
- [ ] Manual/browser Want/Not Seen one-click test.
- [ ] Manual/browser first-time load/retry/duplicate-tab test.
- [ ] Update/close #6 after deployed browser acceptance.

---

## Batch C — Library, detail page & watchlist (#7)

### C0. Library
- [ ] Add `/anime/library` poster wall.
- [ ] Search title/alias.
- [ ] Filter by watch status, evaluation, year/season, tag and studio.

### C1. Detail page
- [ ] Add canonical anime detail route.
- [ ] Show/edit personal viewing status, evaluation, tags and note.
- [ ] Show core catalog metadata.

### C2. Watchlist
- [ ] Add `/anime/watchlist`.
- [ ] Show/sort Want records.
- [ ] Want -> Seen transition reuses standard evaluation flow.
- [ ] Allow safe removal/status change.

### C3. Verification
- [ ] Survey records appear correctly in Library/Watchlist.
- [ ] Search/filter combinations work.
- [ ] Detail edits persist.
- [ ] Update #7 / STATUS.

---

## Batch D — Movies, export, mobile UX & QA (#8)

### D0. Movie survey
- [ ] Track movies by year separately and reuse the answer flow.

### D1. Export
- [ ] JSON export.
- [ ] CSV export.
- [ ] Include canonical IDs/title variants/status/detail/evaluation/tags/note/provenance where useful.

### D2. Mobile UX
- [ ] Responsive survey card and progress matrix.
- [ ] Comfortable tap targets / accidental-action protection.
- [ ] Responsive Library grid.

### D3. Reliability / QA
- [x] Base provider timeout + retry/backoff policy implemented in Batch B.
- [ ] Provider partial-data acceptance tests.
- [ ] D1 failure handling beyond first-load resumability.
- [ ] Decision/evaluation persistence integration tests.
- [ ] Final typecheck/build/Wrangler dry-run and major-route smoke check.

### D4. Handoff / deploy
- [ ] Document first-run/runtime assumptions.
- [ ] Confirm no new Cloudflare database provisioning is required.
- [ ] Finalize `STATUS.md` and close completed issues.

---

## Explicitly out of scope

- Smart recommendation / gap-filling algorithm.
- Automated taste-model ranking.
- Staff/studio affinity scoring.
- Mandatory multi-axis ratings.
- Separate Anime-only Cloudflare D1 database.
