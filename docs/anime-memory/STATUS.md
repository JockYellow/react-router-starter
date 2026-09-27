# Anime Memory Status

Last updated: 2026-09-27

## Current branch / baseline

- Base branch: `main`
- Verified `main` HEAD before this work: `05c0e54d` (PR #23 merged 2026-09-19).
- PR #21 is merged; the rolling survey queue, credits prefetch/cache, finer seasonal loading feedback and Google search shortcut are already in `main`.
- Active remediation branch: `feature/anime-data-foundation-v2`.
- Personal Netflix/history rows remain private and have not been written by this branch.

## Current product state

The provider-neutral Anime Memory application is already the primary runtime:

- `anime_id` is the canonical identity.
- Bangumi is the seasonal discovery provider.
- TV seasonal survey, Seen / Want / Not Seen, evaluation, Library and Watchlist are implemented.
- Bangumi-specific collection metrics exist in `anime_bangumi_metrics`.
- studio/director credits are fetched from Bangumi and cached.
- legacy AniList-keyed tables are still present for compatibility/migration.

## Remediation discovered during 2026-09-27 review

Three user-visible problems share two lower-level consistency issues.

### Seasonal ordering

The recognition ranking implementation itself exists and is correct:

`Bangumi collection_total DESC -> Bangumi score DESC -> TV tie-break -> existing order`

However existing/answered seasonal scopes deliberately keep their old frozen
`anime_scope_candidates.position`, so older seasons may never receive the corrected
recognition-first sequence.

This requires a versioned scope-order migration, not a new ranking formula.

### Production information readability

Studio/director collection already exists. The current cache preserves Bangumi names
as returned, so Japanese studio names may be hard to recognize and the survey currently
renders studio information in more than one place.

The next UI phase should localize/alias display names without overwriting raw provider
identity text.

### Netflix history

The current Netflix seed path is still legacy-shaped:

`Netflix -> resolveAniListByTitle() -> anime_catalog / anime_decisions`

The current application is canonical/provider-neutral:

`anime_items -> anime_user_decisions / anime_item_sources`

The schema contains idempotent legacy-to-canonical copying, but new Netflix writes
should no longer rely on a later schema-initialization copy. Netflix ingestion must be
moved to the canonical tables before the private production seed is executed.

## Current staged plan

### Phase A — canonical data contract

**Implemented on the active branch.**

- Added `docs/anime-memory/DATA_CONTRACT.md`.
- New product writes are defined against provider-neutral canonical tables.
- Legacy AniList tables are compatibility/migration storage only.
- Provider-specific metrics are explicitly separated.
- Personal-data boundary remains unchanged.

### Phase B — shared canonical data capabilities

**Implemented on Draft PR #24; Anime CI run #130 passed tests, typecheck, build and Wrangler dry-run.**

- Added `anime-canonical-match.server.ts`.
- Provider cache now uses the shared conservative matcher rather than private matching logic.
- Added `anime-canonical-metadata.server.ts` as a shared metadata read/enrichment boundary.
- Bangumi collection count and legacy AniList popularity are exposed as different fields.
- Added focused tests for identity matching and display-title fallback.

No seasonal positions, personal decisions, Netflix rows or production D1 data were changed.

### Phase C — versioned seasonal ordering migration

**Implemented on Draft PR #24; Anime CI run #140 passed tests, typecheck, build and Wrangler dry-run.**

- Ordering version v2 is tracked per TV-season scope.
- Established scopes without v2 migrate lazily the next time they are opened.
- Migration rewrites only `anime_scope_candidates.position`.
- Candidate membership and personal decisions/evaluations/tags/notes are untouched.
- Non-empty migrated scopes refresh derived progress after position changes.
- Empty completed legacy scopes keep their existing completion semantics.
- New scopes are marked v2 after their initial recognition ranking.
- A short D1 lock prevents simultaneous position rewrites.
- Missing Bangumi collection metrics do not fall back to the legacy mixed popularity field.
- Tests cover ranking, missing metrics, membership preservation, idempotent re-ordering and resume after a previously answered item.

No production/private D1 data has been migrated by this branch yet.

### Phase D — survey information presentation

**Implemented on Draft PR #24; Anime CI run #154 passed tests, typecheck, build and Wrangler dry-run.**

- Survey candidates expose provider-specific Bangumi collection/score metrics.
- The card shows format, episode count and Bangumi collection count so recognition ordering can be inspected directly.
- Production studio/director information moved into one responsive card block; the fixed hotkey footer no longer duplicates it.
- Bangumi studio person ids are cached per anime.
- Current-card studio display names use provider-supplied PersonDetail aliases: Chinese cn -> tw first, then English alias for kana-heavy raw names, then raw name.
- Raw studio names remain preserved and are shown secondarily when a friendlier display alias is used.
- Person display aliases are cached by Bangumi person id; the first-20 credits prefetch does not add PersonDetail requests for every queued item.
- Provider/display-name failure remains non-blocking.

### Phase E — Netflix ingestion v2

**Implemented on Draft PR #24; Anime CI run #164 passed tests, typecheck, build and Wrangler dry-run.**

- AniList is no longer a required Netflix resolver.
- Existing canonical Netflix source mappings are reused when present.
- Otherwise Bangumi search accepts only a unique exact native/Chinese/cn->tw alias; ambiguous and non-exact results remain unresolved.
- Matched Bangumi subjects are fetched by id and enter the normal canonical provider cache.
- Netflix provenance writes directly to `anime_item_sources`.
- Missing viewing decisions write directly to `anime_user_decisions` with `INSERT OR IGNORE`, preserving later/manual answers.
- Netflix title is retained as a canonical alias; Chinese-looking Netflix titles may fill a missing `title_zh_tw` without overwriting existing titles.
- Queue payloads use resolverVersion 2. Existing v1/unversioned staged rows auto-upgrade and reset to PENDING once before processing.
- Synthetic tests cover exact/ambiguous resolution, canonical writes, decision preservation, queue upgrade, and Bangumi detail normalization.

No production/private Netflix rows have been processed on this branch.

### Phase F — production/private migration and end-to-end acceptance

**Acceptance harness implemented; real D1 execution remains blocked until this Draft PR is deployed.**

- Added authenticated `/anime/acceptance` page with private-safe counts only.
- Added resolver-version, canonical-source/decision consistency, and seasonal-ordering migration counters.
- Added deliberately small Netflix resolve controls (1 or 5 rows); there is no one-click full-queue action.
- The existing admin seed API now returns the same acceptance snapshot after stage/resolve/retry.
- Repository CI can build/dry-run Workers, but this repository has no deployment workflow and available tooling has no Cloudflare/D1 connection.
- validate schema/idempotency against real D1 after deployment;
- process a small private Netflix sample first;
- verify Survey / Library / provenance all point to the same `anime_id`;
- then process the full private queue;
- cross-check old seasonal ordering and Netflix-derived Seen state;
- run final full verification and update issues/docs.

## Architecture rules that must not regress

- `anime_id` remains canonical.
- No fuzzy substring auto-merge.
- Bangumi `collection_total` is not interchangeable with AniList popularity.
- Provider enrichment is best-effort; cached personal data remains usable during provider failure.
- Raw provider names are preserved even when a friendlier display alias is added.
- Personal Anime Memory / Netflix rows never enter this public repository.
- Do not merge the active branch without explicit user instruction.
