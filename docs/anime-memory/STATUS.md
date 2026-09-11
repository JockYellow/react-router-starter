# Anime Memory Status

Last updated: 2026-09-11

## Current branch / review entry

- Base: `main`
- PR #11 — initial Anime Memory vertical slice — merged 2026-09-10.
- PR #12 — Batch B loading reliability — merged before the provider failures were discovered.
- PR #13 — browser-direct AniList hotfix — merged; deployed testing proved AniList still returned 403.
- Active branch: `refactor/anime-provider-neutral`
- Active Draft PR: #14 — `refactor(anime): decouple catalog identity from AniList`
- Roadmap: #9
- Active batch: #6 — Batch B, deployment acceptance blocked on PR #14 merge/deploy.
- Batch A: #5 — code-complete; remote D1/private seed verification remains open.

## Current overall state

**PR #14 is the provider-neutral recovery for Batch B. Code is ready for merge-and-deploy acceptance; production runtime/D1 verification is intentionally still pending.**

The deployed AniList path failed with `403` manual-block responses. A browser-direct AniList fallback also failed. A separate GitHub runner probe reached AniList but received an API-unavailable 403. Jikan was evaluated next; a live historical-season probe returned three consecutive upstream `504` responses and was rejected as the primary dependency.

Bangumi's official browse API was then probed live. The 2011 January TV and WEB requests both returned HTTP 200 with historical records. PR #14 now uses Bangumi as the TV-season discovery source and keeps provider availability separate from application identity.

## PR #14 architecture

### Provider-neutral identity
- `anime_id` is the stable application identity.
- `mal_id`, `anilist_id`, and `bangumi_id` are optional external IDs.
- Existing AniList-keyed catalog/aliases/decisions/evaluations/tags/sources/frozen candidates are copied idempotently into provider-neutral tables.
- Existing established survey scopes remain frozen and are not rebuilt.
- Bangumi records first match external IDs; without a shared external ID they may merge only through an exact normalized alias + compatible year when the result is unique. No fuzzy substring merge.

### Bangumi seasonal discovery
- A TV season scans all three months.
- For each month it scans Anime `TV` and `WEB` categories: six provider segments per season.
- Offset pagination continues when a segment exceeds one page.
- The former top-100 cutoff is removed.
- `name_cn` is converted through pinned OpenCC `cn -> tw` for practical Traditional-Chinese display.
- After complete discovery, candidates are frozen in collection-popularity / score order.

### Loading reliability retained
- Visible six-segment progress plus current candidate count.
- D1-persisted resume state.
- 30-second per-scope lock suppresses duplicate simultaneous initialization.
- timeout/network/408/425/429/5xx use bounded retry/backoff; `Retry-After` is respected.
- failed provider steps resume without clearing already discovered candidates.
- Bangumi loading uses versioned `anime_scope_load_state_v2`, so old AniList 403 ERROR state is ignored.
- candidate reordering is performed in one D1 transactional batch without deleting the candidate set first.

## Verification snapshot

Live provider verification completed before integration:
- AniList: unsuitable as a runtime dependency in this deployment environment (403/manual block / unavailable responses).
- Jikan historical season: unsuitable in the observed test window (three consecutive 504 upstream failures).
- Bangumi historical browse: **HTTP 200** for both 2011/1 TV and WEB; data returned.

Latest code-bearing PR #14 head after the transactional reorder fix passed:
- [x] Anime unit tests
- [x] repository typecheck
- [x] React Router build
- [x] Wrangler deploy dry-run

Bangumi provider unit coverage includes URL/query construction, TV normalization, Simplified-to-Traditional title conversion, offset pagination, six-segment advancement, and final-segment completion.

## Batch A — foundation status

### Completed in code
- [x] Reuse existing `BLOG_DB`; no Anime-only D1.
- [x] Provider-neutral domain identity and compatibility migration added in PR #14.
- [x] Conservative exact-normalized matching.
- [x] Private Netflix seed queue/API with safe precedence.
- [x] Anime tests/typecheck/build/Wrangler dry-run in CI.

### Still pending because it requires real Cloudflare/private-data execution
- [ ] Execute schema repeatedly against real remote `BLOG_DB`.
- [ ] Stage the reviewed private Netflix rows into real D1.
- [ ] Resolve the seed queue and inspect MATCHED / AMBIGUOUS / UNMATCHED / ERROR counts.

## Batch B — implementation status

### Dashboard `/anime`
- [x] Admin-authenticated route.
- [x] Seen / Want / Favourite counts.
- [x] Recent records.
- [x] 2011-to-current-year seasonal matrix.
- [x] Complete / in-progress / not-started states.

### Seasonal survey `/anime/survey`
- [x] Admin-authenticated route.
- [x] Frozen candidate sequence.
- [x] Chinese-first title + poster + recognition metadata.
- [x] Seen / Want / Not Seen primary flow.
- [x] Seen detail + one overall evaluation + optional tags/note.
- [x] Incremental autosave.
- [x] Rating autosave carries current viewing-detail state so clicking rating first does not lose/fail the prerequisite.
- [x] Previous-item/review mode.
- [x] Desktop hotkeys with typing protection.

### Provider loading / recovery
- [x] visible provider progress.
- [x] durable resume state.
- [x] duplicate-load lock.
- [x] bounded transient retry/backoff.
- [x] targeted manual retry.
- [x] provider-neutral identity migration.
- [x] Bangumi complete seasonal TV+WEB scan implementation.
- [x] old failed AniList load state does not control the new flow.
- [ ] deployed Cloudflare Worker + real D1 acceptance after PR #14 merge.

## Required production acceptance after PR #14 merge

1. Open a season whose previous AniList initialization failed and confirm the UI starts a Bangumi six-segment scan rather than showing the old 403.
2. Confirm candidate count increases and segment label advances through the season months / TV+WEB sources.
3. Confirm initialization reaches READY and automatically opens the first anime card.
4. Confirm Chinese fallback titles display in Traditional characters when `name_cn` exists.
5. Reload midway and confirm the current segment resumes instead of restarting the season.
6. Open a second tab during loading and confirm duplicate provider requests are suppressed by the D1 lock.
7. Answer Seen / Want / Not Seen and reload to verify persistence.
8. Verify previous-item editing and Seen autosave.
9. Inspect the real D1 only if an error occurs; do not delete legacy tables during this acceptance pass.
10. If these checks pass, close Batch B (#6) and begin Batch C.

## Known intentional compatibility state

- Legacy AniList-keyed tables remain in D1 during this transition. They are not deleted by PR #14.
- The original provider-neutral experimental load-state table may exist, but the production Bangumi flow uses `anime_scope_load_state_v2` to avoid interpreting old provider cursors/errors.
- AniList remains an optional external identifier / legacy seed matching source; survey availability no longer depends on its runtime API.

## Privacy rule

This repository is public. Never commit personal Anime Memory rows, Netflix rows, personal ratings/tags/notes, or exported archives. Private source data belongs in D1 or ignored local/private files.

## Resume instructions for a new developer/chat

1. Read this file, `TODO.md`, `DECISIONS.md`, and `PRIVATE_DATA.md`.
2. Open PR #14 and issues #6 / #5.
3. Do not restore AniList or Jikan as a required live seasonal provider without new evidence and an explicit architecture decision.
4. PR #14 must be merged by the user before true Cloudflare Worker + remote D1 acceptance is possible.
5. After deployment, run the production acceptance checklist above before declaring Batch B complete.
