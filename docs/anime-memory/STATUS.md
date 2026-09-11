# Anime Memory Status

Last updated: 2026-09-11

## Current branch / review entry

- Base: `main`
- PR #11 — initial Anime Memory vertical slice — merged 2026-09-10.
- PR #12 — Batch B loading reliability — merged.
- PR #13 — browser-direct AniList hotfix — merged; deployed testing still returned AniList 403.
- PR #14 — provider-neutral identity + Bangumi seasonal discovery — merged 2026-09-11.
- PR #15 — allow Bangumi cover CDN in CSP — merged; production diagnostics proved CSP was updated but covers still failed in the user's browser.
- Active branch: `fix/anime-cover-proxy`
- Active PR: #16 — `fix(anime): proxy cover images through Worker`
- Roadmap: #9
- Active batch: #6 — Batch B production acceptance.
- Batch A: #5 — code-complete; remote private-seed verification remains open.

## Current overall state

**The Bangumi seasonal/D1 path works in production: the user successfully initialized 2025 Winter. Cover rendering remains the active production defect. PR #16 replaces direct third-party image embedding with an authenticated same-origin Worker proxy.**

AniList is no longer a required runtime provider. Jikan was rejected after repeated live 504 probes. Bangumi is the TV-season discovery source, while the application uses its own internal `anime_id` and keeps provider IDs optional.

## Production finding — Anime covers

2025 Winter imported successfully, but anime posters still did not render after PR #15.

Production diagnostics now confirm:
- The deployed `/anime` response already has the PR #15 CSP and explicitly allows `https://lain.bgm.tv`.
- All 151 cover URLs returned by the 2025 Winter Bangumi TV/WEB scan use the `https://lain.bgm.tv` origin.
- A browser-like request with the production Referer and Sec-Fetch headers receives HTTP 200 `image/jpeg` from a sampled Bangumi cover.
- Therefore the remaining failure is not explained by stale deployment, the CSP allowlist, mixed content, or a simple Bangumi hotlink rejection.
- Existing legacy rows may also contain AniList `s4.anilist.co` cover URLs because provider-neutral reconciliation preserves an existing non-null `cover_url`.

PR #16 therefore removes browser dependence on provider image origins:
- survey/dashboard expose `/api/anime/cover/:animeId` instead of the raw third-party URL;
- the authenticated Worker reads the stored D1 `cover_url` itself;
- only HTTPS `lain.bgm.tv` and legacy `s4.anilist.co` are accepted;
- upstream non-image/error responses are rejected;
- existing D1 rows and the already-imported 2025 Winter scope do not need to be rebuilt.

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

Provider/runtime verification:
- AniList: unsuitable as a required runtime dependency in this deployment environment (403/manual block / unavailable responses).
- Jikan historical season: unsuitable in the observed test window (three consecutive 504 upstream failures).
- Bangumi historical browse: HTTP 200 with historical records.
- 2025 Winter production initialization: successful.
- Production CSP after PR #15: confirmed to include `https://lain.bgm.tv`.
- 2025 Winter Bangumi cover origins: 151 / 151 use `https://lain.bgm.tv`.
- browser-like Bangumi cover probe: HTTP 200 JPEG.

PR #16 code-bearing head passed:
- [x] Anime unit tests, including strict cover proxy URL allowlist tests
- [x] repository typecheck
- [x] React Router build
- [x] Wrangler deploy dry-run

True Cloudflare Worker image-proxy E2E still requires PR #16 merge/deploy.

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
- [ ] confirm same-origin cover rendering after PR #16 deployment.
- [ ] continue the remaining browser persistence/reload/second-tab acceptance checks.

## Remaining production acceptance

1. Merge/deploy PR #16 and reopen the already-imported 2025 Winter scope; the card image URL should now be same-origin `/api/anime/cover/:animeId` and render without re-importing data.
2. Confirm several consecutive cards show covers, including any rows originally matched to legacy AniList data.
3. Reload during a new season initialization and confirm the provider cursor resumes instead of restarting the season.
4. Test a second tab/repeated initialization trigger and confirm the D1 lock prevents duplicate loading.
5. Verify Seen autosave survives reload.
6. Verify Want/Not Seen remain reliable one-click actions.
7. Verify previous-item editing returns to unresolved flow correctly.
8. If these pass, close Batch B (#6) and begin Batch C.

## Known intentional compatibility state

- Legacy AniList-keyed tables remain in D1 during this transition and are not deleted.
- The production Bangumi flow uses `anime_scope_load_state_v2` so old provider cursors/errors are not misinterpreted.
- AniList remains an optional external identifier / legacy seed matching source; survey availability no longer depends on its runtime API.
- Cover source URLs remain stored in D1 for provider provenance; browser-facing URLs are same-origin proxy paths in PR #16.

## Privacy rule

This repository is public. Never commit personal Anime Memory rows, Netflix rows, ratings, tags, notes, or exported personal archives. Private source data belongs in D1 or ignored local/private files.

## Resume instructions for a new developer/chat

1. Read this file, `TODO.md`, `DECISIONS.md`, and `PRIVATE_DATA.md`.
2. Open PR #16 and issues #6 / #5.
3. Do not restore AniList or Jikan as a required live seasonal provider without new evidence and an explicit architecture decision.
4. The immediate acceptance target is same-origin cover rendering on the already-imported 2025 Winter scope after PR #16 deployment.
5. After cover verification, finish the remaining Batch B browser acceptance checklist before starting Batch C.
