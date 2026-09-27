# Anime Memory Data Contract

Last updated: 2026-09-27

This document defines the write/read boundary that new Anime Memory work must follow.

## Canonical identity

- `anime_items.anime_id` is the only application identity.
- `mal_id`, `anilist_id`, and `bangumi_id` are optional external identifiers attached to the same canonical row.
- External-provider availability must never determine whether an existing personal record is readable.

## Canonical product tables

New product behavior reads and writes through these tables:

- `anime_items` — canonical work identity and shared catalog metadata.
- `anime_item_aliases` — exact normalized title aliases used for conservative reconciliation/search.
- `anime_user_decisions` — personal Seen / Want / Not Seen state.
- `anime_user_evaluations` and `anime_user_evaluation_tags` — personal evaluation.
- `anime_item_sources` — source/provenance rows such as imported viewing history.
- `anime_scope_candidates` and `anime_survey_progress` — frozen survey membership/order and progress.
- `anime_bangumi_metrics` — Bangumi-specific collection count / score / format observations.
- `anime_survey_credits_cache` — cached Bangumi-derived studio/director credits.

## Provider-specific metrics

Provider popularity scales are not interchangeable.

- `anime_items.popularity` is legacy/shared compatibility data and currently only receives AniList popularity from the provider cache.
- Bangumi `collection_total` belongs in `anime_bangumi_metrics.collection_total`.
- Seasonal recognition ordering must use the Bangumi-specific metric directly.
- UI may display provider-specific metrics, but must label them by meaning/source instead of presenting them as one universal popularity score.

## Canonical matching

All new import/provider reconciliation should share the conservative matcher in
`anime-canonical-match.server.ts`.

Evidence order:

1. exact external/provider id;
2. otherwise, one unique exact normalized alias with compatible year;
3. otherwise remain unresolved.

No fuzzy substring/title similarity merge is allowed as an automatic identity decision.

## Metadata read/enrichment boundary

`anime-canonical-metadata.server.ts` is the shared read boundary for later ordering,
presentation, and external-history work.

It exposes:

- canonical ids;
- Chinese/native/Romaji/English titles and deterministic display-title fallback;
- season/year/format/episodes;
- raw studio/director credits;
- provider-specific Bangumi collection/score metadata;
- legacy AniList popularity explicitly separated from Bangumi metrics.

Chinese-title and credit enrichment are best-effort. Provider failure must not make
already-cached canonical metadata unreadable.

Raw provider names are preserved. Human-friendly studio/director aliases/localization
will be added at the presentation/enrichment layer rather than overwriting provider
identity text.

## Legacy compatibility tables

The following tables remain only for migration/compatibility:

- `anime_catalog`
- `anime_aliases`
- `anime_decisions`
- `anime_sources`
- `anime_evaluations`
- `anime_evaluation_tags`
- `anime_survey_candidates`

Existing idempotent migration code may continue reading/copying these tables.
Explicit legacy compatibility helpers may still write them until removed.

New product features must not introduce a new dependency on these tables, and the
Netflix ingestion v2 phase must write canonical tables directly.

## Personal-data boundary

Personal Netflix/history rows, ratings, notes, watched lists, and D1 dumps never belong
in the public repository. Code/tests use synthetic fixtures only.

## Current staged migration plan

- Phase A: canonical data contract — implemented on `feature/anime-data-foundation-v2`.
- Phase B: shared canonical matching + metadata boundary — implemented on the same branch.
- Phase C: versioned migration of existing seasonal ordering.
- Phase D: survey information presentation/localized credit names.
- Phase E: Netflix ingestion v2 against canonical tables.
- Phase F: real D1/private-data migration and cross-flow acceptance.
