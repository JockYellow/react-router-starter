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

**Implemented on the active branch; CI/PR verification still required.**

- Added `anime-canonical-match.server.ts`.
- Provider cache now uses the shared conservative matcher rather than private matching logic.
- Added `anime-canonical-metadata.server.ts` as a shared metadata read/enrichment boundary.
- Bangumi collection count and legacy AniList popularity are exposed as different fields.
- Added focused tests for identity matching and display-title fallback.

No seasonal positions, personal decisions, Netflix rows or production D1 data were changed.

### Phase C — versioned seasonal ordering migration

Next implementation phase.

- add an ordering version for established TV-season scopes;
- migrate old positions once using current Bangumi recognition ranking;
- preserve membership and every user decision/evaluation;
- recompute progress after position rewrite;
- verify next-unresolved behavior after migration.

### Phase D — survey information presentation

- use the canonical metadata boundary;
- expose Bangumi collection count for visible ordering verification;
- add readable studio/director display names while keeping raw provider values;
- remove duplicated production-information presentation.

### Phase E — Netflix ingestion v2

- resolve against canonical local identity first;
- use Bangumi rather than AniList as the external fallback when needed;
- write `anime_item_sources` and `anime_user_decisions` directly;
- preserve MATCHED / AMBIGUOUS / UNMATCHED handling;
- never overwrite newer manual/survey decisions;
- allow existing staged queue rows to be re-resolved idempotently.

### Phase F — production/private migration and end-to-end acceptance

- validate schema/idempotency against real D1;
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
