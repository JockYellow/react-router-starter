# Anime Memory TODO

Canonical project roadmap issue: #9

Keep work split into independently verifiable segments. Personal Anime Memory rows never belong in this public repository.

## Immediate next phase — survey efficiency (#6)

**State: approved by user; resume on `feature/anime-survey-efficiency`.**

### B9. Correct recognition-first ordering
- [ ] Stop mixing legacy AniList popularity and Bangumi `collection_total` in one ambiguous field for survey ranking.
- [ ] Persist a provider-specific Bangumi popularity / collection count.
- [ ] Rank TV-season candidates primarily by Bangumi collection count.
- [ ] Use score only as a secondary tie-breaker.
- [ ] Consider TV ahead of WEB/ONA as a small deterministic tie-break, not a hard filter.
- [ ] Define behavior for already-created/frozen scopes before changing positions; do not silently invalidate answered positions.
- [ ] Add migration/backfill path for existing Bangumi-matched records where needed.
- [ ] Add tests proving AniList and Bangumi popularity scales cannot be mixed accidentally.

### B10. Fast primary-answer flow
- [ ] Add a small client-side queue of upcoming unresolved candidates (target ~3–5).
- [ ] Preload upcoming `/api/anime/cover/:animeId` images.
- [ ] Make `NOT_SEEN` advance immediately with optimistic UI.
- [ ] Make `WANT` advance immediately with optimistic UI.
- [ ] Save optimistic answers to D1 in the background.
- [ ] Refill candidate queue without a full-page redirect/loader cycle per answer.
- [ ] Update progress optimistically, then reconcile with D1.
- [ ] Surface background-save failure and provide retry/recovery; never silently lose an answer.
- [ ] Keep `SEEN` on the current card and reveal detail/evaluation instead of auto-advancing.
- [ ] Preserve A/W/D/arrow/Z desktop shortcuts.
- [ ] Add tests for queue order, answer persistence, error recovery, and Seen-vs-Not-Seen behavior.

### B11. Remaining production acceptance
- [x] Bangumi seasonal import works in production (2025 Winter confirmed).
- [x] Same-origin cover proxy works in production; user confirmed posters display after PR #16.
- [ ] Reload during a new season initialization and verify provider cursor resumes.
- [ ] Second-tab/repeated initialization test verifies D1 load lock.
- [ ] Seen detail/rating autosave survives reload.
- [ ] Want/Not Seen persist after optimistic-flow refactor.
- [ ] Previous-item edit mode returns to unresolved flow correctly.
- [ ] Season switching smoke test.
- [ ] Review keyboard shortcut behavior after real use.
- [ ] Update/close #6 when accepted.

---

## Batch A — Data foundation & Netflix seed (#5)

**State: code-complete; real Cloudflare D1/private seed execution pending.**

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

### Implemented
- [x] `/anime` dashboard and `/anime/survey`.
- [x] Seen / Want / Not Seen.
- [x] Seen completion state + overall rating + optional tags/note.
- [x] Incremental autosave.
- [x] Previous/edit mode.
- [x] A / Left, W / Up, D / Right, Z shortcuts.
- [x] Bangumi full seasonal scan: 3 months × TV/WEB + offset pagination.
- [x] No top-100 seasonal cutoff.
- [x] resumable provider load state + D1 duplicate-load lock + retry/backoff.
- [x] provider-neutral identity and legacy migration.
- [x] same-origin cover proxy supporting Bangumi and legacy AniList sources.

### Production-confirmed
- [x] 2025 Winter initializes successfully.
- [x] cover images render successfully after PR #16.

### Remaining
- [ ] Complete B9/B10/B11 above.

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
- [ ] Track movies by year separately and reuse the standard answer/evaluation flow.

### D0b. Missing original-scope coverage
- [ ] Add a separate catch-up flow for OVA / OAD / Special / other non-TV non-movie works.
- [ ] Add a pre-2011 high-recognition/high-popularity catch-up pass.
- [ ] Do not force all OVA/Special works into normal seasonal TV scans.
- [ ] Do not force exhaustive year-by-year historical scanning before 2011.

### D1. Export
- [ ] JSON export.
- [ ] CSV export.
- [ ] Include internal ID, external IDs, title variants, status/detail/evaluation/tags/note/provenance where useful.
- [ ] Verify exported data is readable/restorable as a durable personal backup.

### D2. Mobile UX
- [ ] Responsive survey card and progress matrix.
- [ ] Comfortable tap targets / accidental-action protection.
- [ ] Responsive Library grid.

### D3. Reliability / QA
- [x] Base provider timeout + retry/backoff policy.
- [ ] Provider partial-data acceptance tests.
- [ ] D1 failure handling beyond first-load resumability.
- [ ] Decision/evaluation persistence integration tests.
- [ ] Final typecheck/build/Wrangler dry-run and major-route smoke check.

### D4. Handoff / deploy
- [ ] Document first-run/runtime assumptions.
- [ ] Confirm no new Cloudflare database provisioning is required.
- [ ] Finalize `STATUS.md` and close completed issues.

---

## Recommended execution order

1. B9 popularity semantics / ordering.
2. B10 optimistic queue + cover preloading.
3. B11 Batch B browser acceptance and close #6.
4. Finish Batch A private Netflix seed production execution.
5. Batch C Library / detail / watchlist.
6. Batch D movies.
7. OVA/Special + pre-2011 catch-up.
8. Export / mobile / final QA.

## Explicitly out of scope

- Automated taste-model ranking / smart gap filling.
- Staff/studio affinity scoring.
- Mandatory multi-axis ratings.
- Separate Anime-only Cloudflare D1 database.
