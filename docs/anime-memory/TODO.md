# Anime Memory TODO

Canonical project roadmap issue: #9

Keep work split into independently verifiable segments. Personal Anime Memory rows never belong in this public repository.

Last reconciled with implementation: 2026-09-17.

## Current checkpoint

- `main` already contains the core TV seasonal survey, provider-neutral identity, Bangumi discovery, same-origin covers, fast background saves, Library, detail editing, Watchlist, production credits, and the first mobile survey pass.
- PR #21 is **code-complete and CI-green, but still Draft / unmerged pending user production testing**.
- PR #21 adds: 20/10 survey queue buffering, credits prefetch + D1 cache, finer 25-row Bangumi load feedback, conservative CN/US-origin seasonal filtering, and direct Google search using `片名 動畫 製作背景`.
- The next action is **production test PR #21**, not more feature work.

---

## Batch A — Data foundation & Netflix seed (#5)

**State: code-complete; real Cloudflare D1/private seed execution still pending.**

### A0–A3. Foundation / providers / matching
- [x] Reuse existing `BLOG_DB` and `anime_*` tables.
- [x] Provider-neutral internal `anime_id`.
- [x] Bangumi TV/WEB seasonal provider.
- [x] Chinese fallback through pinned OpenCC cn -> tw.
- [x] Conservative exact matching; no broad fuzzy/substring merge.
- [x] Frozen survey membership/order.
- [ ] Execute schema repeatedly against real Cloudflare D1 and explicitly verify idempotency.

### A4. Private Netflix seed
- [x] Reviewed source ingestion/mapping code.
- [x] Private seed queue and MATCHED / AMBIGUOUS / UNMATCHED / ERROR handling.
- [x] Seed cannot overwrite later manual decisions.
- [ ] Stage reviewed private Netflix rows into real D1.
- [ ] Resolve queue and inspect final match/error counts.
- [ ] Verify private seed runtime behavior against production D1.

---

## Batch B — Seasonal survey, progress & evaluation (#6)

**State: core implementation is mature and merged; latest loading/search optimizations are in PR #21 pending production acceptance.**

### B0–B8. Core survey
- [x] `/anime` dashboard and `/anime/survey`.
- [x] Seen / Want / Not Seen.
- [x] Seen completion state + overall rating + optional tags/note.
- [x] Incremental Seen autosave.
- [x] Previous/edit mode.
- [x] A / Left, W / Up, D / Right, Z shortcuts with typing protection.
- [x] Bangumi full seasonal scan: 3 months × TV/WEB + offset pagination.
- [x] No top-100 seasonal cutoff.
- [x] Resumable provider load state + D1 duplicate-load lock + retry/backoff.
- [x] Provider-neutral identity and legacy migration.
- [x] Same-origin cover proxy supporting Bangumi and legacy AniList sources.

### B9. Recognition-first ordering
- [x] Stop relying on one mixed AniList/Bangumi popularity scale for seasonal ranking.
- [x] Persist provider-specific Bangumi collection/score metadata.
- [x] Rank new TV-season scopes primarily by Bangumi collection count.
- [x] Use score / deterministic format rules only as secondary ordering signals.
- [x] Preserve already-answered/frozen scope positions rather than silently moving them.
- [x] Add focused ranking tests.

### B10. Fast primary-answer flow
- [x] Optimistic `WANT` / `NOT_SEEN` card advance.
- [x] Dedicated lightweight background-save endpoint.
- [x] Serialize background D1 saves to avoid concurrent write pileups.
- [x] Bounded retry for transient save failures and visible recovery state.
- [x] Refill candidates without a full-page loader cycle per fast answer.
- [x] Update progress optimistically while retaining D1 as source of truth.
- [x] Keep `SEEN` on-card for the detail/evaluation flow.
- [x] Preserve desktop shortcuts.
- [x] Preload upcoming covers.
- [x] PR #21 expands the rolling candidate buffer to 20 and refills at 10.

### B10b. Production information / discovery assistance
- [x] Show Bangumi-derived studio/director when available.
- [x] Provider failures remain non-blocking.
- [x] Add D1-backed credits cache and batch prefetch in PR #21.
- [x] Prepare the first 20 credits before entering a newly initialized survey in PR #21.
- [x] Add direct Google search shortcut; query is `片名 動畫 製作背景` in PR #21.

### B10c. First-load UX / candidate quality — PR #21
- [x] Reduce Bangumi browse batch size to 25 for finer visible feedback.
- [x] Show per-segment / row-range progress instead of only coarse six-step movement.
- [x] Show credits preparation progress before survey entry.
- [x] Conservatively exclude known CN/US-origin seasonal tags before catalog caching.
- [x] CI #125: Anime tests, typecheck, build, and Wrangler dry-run all pass.
- [ ] User production-tests PR #21.
- [ ] Merge PR #21 after explicit user approval.

### B11. Remaining production acceptance
- [x] Bangumi seasonal import works in production (2025 Winter confirmed).
- [x] Same-origin cover proxy works in production; posters render after PR #16.
- [x] Fast answer persistence failure mode was fixed in PR #19.
- [ ] Test a previously unseen season using the PR #21 fine-grained initializer.
- [ ] Verify reload during initialization resumes provider cursor instead of restarting.
- [ ] Verify second-tab/repeated initialization is suppressed by the D1 load lock.
- [ ] Confirm first 20 credits finish preparing and the first card opens automatically.
- [ ] Stress-test very rapid Want/Not Seen input against the 20/10 buffer.
- [ ] Confirm Google search opens separately on desktop and mobile.
- [ ] Confirm Seen detail/rating autosave survives reload.
- [ ] Confirm previous-item edit returns correctly to unresolved flow.
- [ ] Season-switching smoke test.
- [ ] Update/close #6 after production acceptance.

---

## Batch C — Library, detail page & watchlist (#7)

**State: C1/C2/C3 implementation merged in PR #18; roadmap issue #7 is stale and still needs production acceptance/update.**

### C0. Library
- [x] `/anime/library` poster wall.
- [x] Title/alias search.
- [x] Filters for personal status/evaluation/year/season/tags.
- [x] Deterministic sorting and pagination.
- [x] Same-origin cover output.

### C1. Detail page
- [x] Canonical detail route using internal `anime_id`.
- [x] Show/edit personal viewing status, completion state, evaluation, tags and note.
- [x] Separate personal record from external catalog metadata.
- [x] Changing away from Seen safely clears Seen-only evaluation fields where appropriate.

### C2. Watchlist
- [x] `/anime/watchlist` dedicated WANT backlog.
- [x] Search and useful sorting.
- [x] Want -> Seen reuses the normal detail/evaluation flow.
- [x] Safe removal/status transition without deleting the personal record.
- [x] Guard stale actions from overwriting a newer status change.

### C3. Verification
- [x] Focused unit tests for Library query normalization, detail editing and Watchlist behavior.
- [x] CI passed before PR #18 merge.
- [ ] Production UI acceptance for Library / detail / Watchlist.
- [ ] Verify representative search/filter combinations against real accumulated data.
- [ ] Verify edits and Watchlist transitions after reload.
- [ ] Update/close #7 after acceptance.

---

## Batch D — Movies, export, mobile UX & final QA (#8)

**State: partially started through survey/mobile reliability work, but the two largest product gaps — movie survey and durable export — remain.**

### D0. Movie survey
- [ ] Track movies by year separately from TV seasons.
- [ ] Reuse Seen / Want / Not Seen + evaluation flow.
- [ ] Reuse the fast queue/background-save architecture where appropriate.

### D0b. Missing original-scope coverage
- [ ] Add a separate catch-up flow for OVA / OAD / Special / other non-TV non-movie works.
- [ ] Add a pre-2011 high-recognition/high-popularity catch-up pass.
- [ ] Do not force all OVA/Special works into normal seasonal TV scans.
- [ ] Do not force exhaustive year-by-year historical scanning before 2011.

### D1. Export / backup
- [ ] Add full JSON export as the durable backup format.
- [ ] Add CSV export for human-readable analysis.
- [ ] Include internal ID, external IDs, title variants, status/detail/evaluation/tags/note/provenance where useful.
- [ ] Verify exported JSON can be read/restored or otherwise validated independently of D1.

### D2. Mobile UX
- [x] First responsive survey-choice pass merged in PR #20.
- [x] Large touch-friendly primary choice buttons on small screens.
- [x] Compact mobile poster/header spacing for the fast survey path.
- [ ] Production acceptance of the mobile survey after PR #21.
- [ ] Review mobile Seen evaluation form for longer sessions.
- [ ] Responsive Library/Watchlist polish and real-device acceptance.

### D3. Reliability / QA
- [x] Base provider timeout + retry/backoff policy.
- [x] Background primary-answer retry/recovery behavior.
- [ ] Provider partial-data acceptance tests.
- [ ] Broader D1 failure handling beyond first-load and primary-answer paths.
- [ ] Decision/evaluation persistence integration tests.
- [ ] Major-route desktop/mobile smoke test.
- [ ] Final typecheck/build/Wrangler dry-run after all Batch D work.

### D4. Handoff / deploy
- [ ] Document first-run/runtime assumptions.
- [ ] Confirm no new Cloudflare database provisioning is required.
- [ ] Finalize `STATUS.md`, `TODO.md`, roadmap issues, and close completed batches.

---

## Recommended execution order from this checkpoint

1. **Production-test PR #21** on a new/unseen season, including fast input and mobile Google search.
2. Merge PR #21 only after explicit user approval; then close/update the remaining Batch B acceptance items.
3. Run the pending private Netflix seed against real D1 and finish Batch A acceptance.
4. Production-accept Library / detail / Watchlist and close/update Batch C.
5. Implement **JSON + CSV export** so accumulated personal data is no longer dependent on D1 as the only durable copy.
6. Implement the **movie-by-year survey**.
7. Finish mobile Library/Watchlist polish and broader persistence/provider QA.
8. Add OVA/Special + pre-2011 catch-up flows.
9. Final documentation / deployment verification / roadmap cleanup.

## Explicitly out of scope unless the product direction changes

- Automated taste-model ranking / smart gap filling.
- Staff/studio affinity scoring.
- Mandatory multi-axis ratings.
- Separate Anime-only Cloudflare D1 database.
