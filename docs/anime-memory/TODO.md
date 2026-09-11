# Anime Memory TODO

Canonical project roadmap issue: #9

Keep work split into independently verifiable segments. Personal Anime Memory rows never belong in this public repository.

## Batch A — Data foundation & Netflix seed (#5)

**State: code-complete; real Cloudflare D1/private seed verification pending.**

### A0–A3. Foundation / providers / matching
- [x] `app/features/anime/` domain structure and stable keys.
- [x] Reuse existing `BLOG_DB`; isolate tables with `anime_*` names.
- [x] Legacy catalog / aliases / decisions / sources / evaluations / tags / survey progress / seed queue tables.
- [x] Provider-neutral `anime_id` catalog and user-record tables added in PR #14.
- [x] Existing AniList-keyed data migrates idempotently into provider-neutral tables.
- [x] Bangumi official browse provider for historical TV-season discovery.
- [x] Bangumi Chinese title fallback through pinned OpenCC `cn -> tw`.
- [x] Conservative exact-normalized matching; no broad substring auto-match.
- [x] Exact alias + compatible-year + unique-result reconciliation for Bangumi vs legacy records.
- [x] Freeze candidate membership/order per survey scope.
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

**State: PR #14 code-ready; merge/deploy acceptance pending.**

### B0–B4. Dashboard / seasonal survey / answering / evaluation
- [x] Private/admin-authenticated `/anime` dashboard.
- [x] Seasonal progress matrix with counts/resume.
- [x] `/anime/survey` with frozen candidate sequence.
- [x] Chinese-first title, poster and recognition metadata.
- [x] Seen / Want / Not Seen primary flow.
- [x] Seen completion + one overall evaluation + optional 15 tags + optional note.
- [x] Incremental Seen autosave.
- [x] Rating autosave carries viewing detail so rating-first interaction is safe.
- [x] Position-addressable previous/edit mode.

### B5. Provider-neutral seasonal discovery
- [x] Remove AniList as a required runtime identity/provider dependency.
- [x] Reject Jikan as primary provider after live repeated 504 probe failures.
- [x] Verify Bangumi historical TV and WEB browse endpoints with live HTTP 200 responses.
- [x] Scan all three months × TV/WEB for each TV season.
- [x] Follow Bangumi offset pagination when a source segment exceeds 100 results.
- [x] Remove former top-100 seasonal cutoff.
- [x] Deduplicate discovered records by internal `anime_id`.
- [x] Preserve external `mal_id` / `anilist_id` / `bangumi_id` when known.
- [x] Reconcile legacy records only through external ID or unique exact alias + compatible year.
- [x] Freeze completed seasonal order by collection popularity, then score.
- [x] Reorder positions transactionally without deleting the candidate set.

### B6. Loading visibility & recovery
- [x] Primary answers persist immediately.
- [x] Resume from D1 after reload/device switch.
- [x] Version seasonal provider state as `anime_scope_load_state_v2` so old AniList 403 state is ignored.
- [x] UI shows current candidate count and six-segment provider progress.
- [x] Resume from the saved Bangumi month/category/offset after reload/failure.
- [x] Add short per-scope D1 lock to suppress duplicate initialization.
- [x] Retry timeout/network/408/425/429/5xx with bounded exponential backoff + jitter.
- [x] Respect provider `Retry-After` within a capped wait.
- [x] Non-retryable 4xx fails immediately.
- [x] Exhausted failures preserve discovered candidates and expose targeted retry.
- [ ] Browser-level first-load progress acceptance against deployed Worker/D1.
- [ ] Browser-level reload/resume acceptance.
- [ ] Browser-level duplicate-tab/repeated-trigger acceptance.

### B7. Desktop efficiency
- [x] A / Left = Seen.
- [x] W / Up = Want.
- [x] D / Right = Not Seen.
- [x] Z = previous item.
- [x] Disable shortcuts while typing.
- [ ] Review shortcut behavior after real usage.

### B8. Verification / production acceptance
- [x] Provider HTTP retry policy unit tests.
- [x] Bangumi seasonal provider unit tests: query normalization, Simplified-to-Traditional title conversion, offset pagination and final segment completion.
- [x] Provider-neutral code passes Anime tests, repository typecheck, React Router build, and Wrangler dry-run.
- [x] Live Bangumi 2011/1 TV+WEB probe returned HTTP 200 and real data.
- [ ] Merge/deploy PR #14.
- [ ] Confirm a previously failed AniList season starts the new Bangumi flow rather than resurfacing the 403 state.
- [ ] Confirm six-segment scan reaches READY and opens the first card.
- [ ] Manual/browser season-switch test.
- [ ] Manual/browser Seen persistence test.
- [ ] Manual/browser Want/Not Seen one-click test.
- [ ] Manual/browser reload/resume and duplicate-tab test.
- [ ] Update/close #6 after deployed browser acceptance.

---

## Batch C — Library, detail page & watchlist (#7)

### C0. Library
- [ ] Add `/anime/library` poster wall.
- [ ] Search title/alias.
- [ ] Filter by watch status, evaluation, year/season, tag and studio.

### C1. Detail page
- [ ] Add canonical anime detail route using internal `anime_id`.
- [ ] Show/edit personal viewing status, evaluation, tags and note.
- [ ] Show core catalog metadata and external provider IDs where useful.

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
- [ ] Include internal ID, external IDs, title variants, status/detail/evaluation/tags/note/provenance where useful.

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
