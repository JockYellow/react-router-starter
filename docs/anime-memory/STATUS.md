# Anime Memory Status

Last updated: 2026-09-11

## Current branch / review entry

- Base: `main`
- PR #11 — initial Anime Memory vertical slice — merged 2026-09-10.
- PR #12 — Batch B loading reliability — merged.
- PR #13 — browser-direct AniList hotfix — merged; deployed testing still returned AniList 403.
- PR #14 — provider-neutral identity + Bangumi seasonal discovery — merged 2026-09-11.
- Active branch: `fix/anime-bangumi-cover-csp`
- Active PR: #15 — `fix(anime): allow Bangumi cover images`
- Roadmap: #9
- Active batch: #6 — Batch B production acceptance.
- Batch A: #5 — code-complete; remote private-seed verification remains open.

## Current overall state

**PR #14 is deployed and the Bangumi seasonal path has passed its first real production/D1 smoke test: the user successfully initialized 2025 Winter. The first production defect found is cover rendering, traced to the application's CSP rather than Bangumi or D1. PR #15 contains the targeted fix.**

AniList is no longer a required runtime provider. Jikan was rejected after repeated live 504 probes. Bangumi is the TV-season discovery source, while the application uses its own internal `anime_id` and keeps provider IDs optional.

## Production finding — Bangumi covers

2025 Winter imported successfully, but anime posters did not render.

Investigation confirmed:
- Bangumi 2025/1 browse data returns HTTPS cover URLs on `https://lain.bgm.tv`.
- A live probe downloaded a returned cover successfully: HTTP 200, `image/jpeg`, 185,749 bytes.
- `/anime/survey` renders the stored `coverUrl` directly in `<img src>`.
- `workers/app.ts` CSP `img-src` allowed only self/data/blog-media origins and did **not** allow `https://lain.bgm.tv`.

PR #15 therefore adds only `https://lain.bgm.tv` to `img-src` and includes a regression test protecting that origin. Existing D1 rows do not need to be re-imported.

## Provider-neutral / Bangumi architecture

### Identity
- `anime_id` is the stable application identity.
- `mal_id`, `anilist_id`, and `bangumi_id` are optional external IDs.
- Existing AniList-keyed catalog/aliases/decisions/evaluations/tags/sources/frozen candidates are copied idempotently into provider-neutral tables.
- Existing established survey scopes remain frozen.
- Provider reconciliation uses external IDs first; without a shared ID, only a unique exact normalized alias + compatible year may merge. No fuzzy substring merge.

### Seasonal discovery
- One TV season scans all three months.
- Each month scans Anime `TV` and `WEB`: six provider segments per season.
- Offset pagination continues when a segment exceeds one page.
- There is no top-100 seasonal cutoff.
- `name_cn` is converted through pinned OpenCC `cn -> tw` for practical Traditional-Chinese display.
- After complete discovery, candidates are frozen in collection-popularity / score order.

### Loading reliability
- Visible six-segment progress plus current candidate count.
- D1-persisted resume state.
- 30-second per-scope lock suppresses duplicate simultaneous initialization.
- timeout/network/408/425/429/5xx use bounded retry/backoff; `Retry-After` is respected.
- failed provider steps resume without clearing already discovered candidates.
- Bangumi loading uses versioned `anime_scope_load_state_v2`, so old AniList 403 ERROR state is ignored.
- candidate reordering is performed in one D1 transactional batch without deleting the candidate set first.

## Verification snapshot

Provider verification:
- AniList: unsuitable as a required runtime dependency in this deployment environment (403/manual block / unavailable responses).
- Jikan historical season: unsuitable in the observed test window (three consecutive 504 upstream failures).
- Bangumi historical browse: HTTP 200 with historical records.
- Bangumi 2025 cover probe: HTTPS `lain.bgm.tv` URL returned HTTP 200 JPEG.

PR #14 pre-merge verification passed Anime tests, repository typecheck, React Router build, and Wrangler dry-run.

PR #15 current code-bearing head passed:
- [x] Anime unit tests, including Bangumi CSP regression test
- [x] repository typecheck
- [x] React Router build
- [x] Wrangler deploy dry-run

## Batch A — foundation status

### Completed in code
- [x] Reuse existing `BLOG_DB`; no Anime-only D1.
- [x] Provider-neutral domain identity and compatibility migration.
- [x] Conservative exact-normalized matching.
- [x] Private Netflix seed queue/API with safe precedence.
- [x] Anime tests/typecheck/build/Wrangler dry-run in CI.

### Still pending because it requires real Cloudflare/private-data execution
- [ ] Execute schema repeatedly against real remote `BLOG_DB` and explicitly verify idempotency.
- [ ] Stage the reviewed private Netflix rows into real D1.
- [ ] Resolve the seed queue and inspect MATCHED / AMBIGUOUS / UNMATCHED / ERROR counts.

## Batch B — implementation / acceptance status

### Dashboard / survey implementation
- [x] Admin-authenticated `/anime` dashboard and `/anime/survey`.
- [x] Frozen candidate sequence.
- [x] Chinese-first title + poster metadata.
- [x] Seen / Want / Not Seen flow.
- [x] Seen detail + evaluation + optional tags/note.
- [x] Incremental autosave and previous-item/review mode.
- [x] Desktop hotkeys with typing protection.
- [x] Rating autosave safely carries current viewing-detail state.

### Provider loading / recovery
- [x] visible provider progress.
- [x] durable resume state.
- [x] duplicate-load lock.
- [x] bounded transient retry/backoff.
- [x] provider-neutral identity migration.
- [x] Bangumi complete seasonal TV+WEB scan implementation.
- [x] old failed AniList load state does not control the new flow.
- [x] real production/D1 initialization succeeded for 2025 Winter.
- [ ] confirm cover rendering after PR #15 deployment.
- [ ] continue the remaining browser persistence/reload/second-tab acceptance checks.

## Remaining production acceptance

1. Merge/deploy PR #15 and reopen the already-imported 2025 Winter scope; covers should render without re-importing data.
2. Confirm the browser console no longer reports CSP refusal for `https://lain.bgm.tv`.
3. Confirm first card/next cards retain Traditional-Chinese title + poster.
4. Reload during a new season initialization and confirm the provider cursor resumes rather than restarts.
5. Test a second tab/repeated initialization trigger and confirm the D1 lock prevents duplicate loading.
6. Verify Seen autosave survives reload.
7. Verify Want/Not Seen remain reliable one-click actions.
8. Verify previous-item editing returns to unresolved flow correctly.
9. If these pass, close Batch B (#6) and begin Batch C.

## Known intentional compatibility state

- Legacy AniList-keyed tables remain in D1 during this transition and are not deleted.
- The production Bangumi flow uses `anime_scope_load_state_v2` so old provider cursors/errors are not misinterpreted.
- AniList remains an optional external identifier / legacy seed matching source; survey availability no longer depends on its runtime API.

## Privacy rule

This repository is public. Never commit personal Anime Memory rows, Netflix rows, ratings, tags, notes, or exported personal archives. Private source data belongs in D1 or ignored local/private files.

## Resume instructions for a new developer/chat

1. Read this file, `TODO.md`, `DECISIONS.md`, and `PRIVATE_DATA.md`.
2. Open PR #15 and issues #6 / #5.
3. Do not restore AniList or Jikan as a required live seasonal provider without new evidence and an explicit architecture decision.
4. The immediate acceptance target is PR #15 cover rendering on the already-imported 2025 Winter scope.
5. After cover verification, finish the remaining Batch B browser acceptance checklist before starting Batch C.
