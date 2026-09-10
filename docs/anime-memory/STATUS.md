# Anime Memory Status

Last updated: 2026-09-10

## Current branch / review entry

- Branch: `feature/anime-memory`
- Base: `main`
- Draft PR: #11 — `feat: build Anime Memory archive`
- Roadmap: #9
- Active batch: #5 — Batch A

## Current overall state

**IN PROGRESS — Batch A foundation is substantially implemented.**

There is still no user-facing `/anime` page. The current work intentionally finishes data safety, provider/title handling, seed import, and executable verification before Batch B UI begins.

## Completed

### Project / handoff
- [x] Reuse existing `BLOG_DB`; no Anime-only D1.
- [x] Dedicated feature branch and Draft PR #11.
- [x] Batch issues #5–#8 + roadmap #9.
- [x] Canonical README / TODO / DECISIONS / STATUS docs.
- [x] Documentation/handoff issue #10 completed.

### Domain + D1
- [x] Stable season/status/watch-detail/evaluation/tag keys.
- [x] 15 concrete evaluation tags.
- [x] `anime_catalog`.
- [x] `anime_aliases`.
- [x] `anime_decisions`.
- [x] `anime_sources`.
- [x] `anime_evaluations`.
- [x] `anime_evaluation_tags`.
- [x] `anime_survey_progress`.
- [x] `anime_survey_candidates` freezes each survey scope's membership/order.
- [x] `anime_seed_queue` stages private imports with PENDING/MATCHED/AMBIGUOUS/UNMATCHED/SKIPPED/ERROR states.
- [x] Runtime `ensureAnimeSchema(db)` remains idempotent by construction (`IF NOT EXISTS`).

### Provider / matching
- [x] AniList season discovery, movie-year discovery, title search.
- [x] AniList catalog/alias D1 cache.
- [x] Bangumi v0 title search fallback.
- [x] Shared provider timeout/error handling.
- [x] Conservative exact-normalized alias matching; no broad substring auto-match.
- [x] Ambiguous/unmatched source records remain reviewable rather than forced.
- [x] Stable seasonal candidate orchestration + next-unresolved/progress reads.
- [ ] Reliable Simplified Chinese -> Taiwan Traditional conversion/selection.
- [ ] End-to-end Chinese title enrichment for newly discovered provider candidates.

### Netflix seed
- [x] Latest reviewed Google Sheet was re-read on 2026-09-10; 109 reviewed rows were observed for migration planning.
- [x] Status mapping preserves 看完 / 看完一季 / 部分 / 棄番 / 沒看 semantics and excludes 誤判.
- [x] Reviewed seed row schema now preserves useful source metadata/count fields.
- [x] Validated private seed input parser; max 500 rows per staging request.
- [x] D1 staging queue is resumable and retryable.
- [x] Controlled admin+CSRF API: `/api/admin/anime/netflix-seed`.
- [x] Queue resolves in small batches (max 10) to reduce external-provider pressure.
- [x] MATCHED rows populate canonical metadata/provenance.
- [x] AMBIGUOUS / UNMATCHED rows never create false decisions.
- [x] Seed decisions use insert-if-missing semantics and therefore cannot overwrite a later manual/survey decision.
- [x] Local private-data paths are Git-ignored.
- [ ] Stage the current reviewed dataset privately into D1.
- [ ] Process the queue and inspect final match/error counts.

## Privacy rule

This repository is public. **Never commit personal Anime Memory data**: watched-title lists, Netflix rows, personal ratings/tags/notes, or exported archives. Git versions only code/schema/import formats/tests and non-personal aggregate development notes. Private input belongs in ignored local files or D1.

See DECISIONS D-022/D-023.

## Active segment

### A5 — Executable verification + Chinese-title completion

Next exact tasks:

1. Add `test:anime` script and Anime Memory GitHub Actions CI.
2. Run domain/schema/input tests in CI.
3. Run repository typecheck, build, and Wrangler dry-run in CI.
4. Fix any compile/test failures before progressing.
5. Implement reliable zh-TW conversion/selection and end-to-end title enrichment.
6. Verify schema against an executable D1 environment.
7. Privately stage/process the reviewed Netflix dataset and review ambiguous/unmatched records.
8. Close #5 only after these checks pass; then begin Batch B `/anime` + seasonal survey UI.

## Verification status

### Implemented but not yet execution-verified
- New Anime TypeScript compiles with the entire repository.
- New test files pass.
- D1 schema executes against actual `blog-db`.
- Live AniList/Bangumi calls work from the Worker runtime.
- Private Netflix queue import result counts.

The current chat environment cannot directly run the repository's installed Node/Cloudflare toolchain. GitHub Actions is therefore the preferred immediate executable-verification path.

## Resume instructions for a new developer/chat

1. Read this file.
2. Read `docs/anime-memory/TODO.md` and `DECISIONS.md`.
3. Open issue #5 and Draft PR #11.
4. Continue on `feature/anime-memory`.
5. Do not place private viewing data in GitHub.
6. Do not start Batch B until Batch A verification/title enrichment is resolved, unless the roadmap is deliberately changed and documented.
