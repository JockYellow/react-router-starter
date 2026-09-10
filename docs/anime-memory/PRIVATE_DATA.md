# Anime Memory Private Data Handling

This repository is public. Do not commit personal Anime Memory source data or exports.

## Never commit

- Reviewed Netflix title rows or raw viewing history.
- Personal watched/watchlist snapshots.
- Ratings, evaluation tags, notes, or exported archives containing personal records.
- D1 dumps that contain Anime Memory personal data.

Use the ignored `private-data/` directory for local-only working files when needed.

## Versioned in Git

Git should contain only:

- Import schemas and validation code.
- D1 schema and queue logic.
- Provider/matching code.
- Tests using synthetic fixtures.
- Product/development documentation that does not enumerate personal titles.

## Private Netflix seed flow

1. Convert the reviewed source into the `ReviewedNetflixSeedRow` JSON shape locally/in an authenticated admin UI.
2. `POST` it to `/api/admin/anime/netflix-seed` with `intent: "stage"` and valid admin CSRF protection.
3. Rows are stored in the D1 `anime_seed_queue`, not Git.
4. Resolve a small batch with `intent: "resolve"`; processing is capped at 10 rows per request.
5. Review queue summary counts. Ambiguous/unmatched rows remain unresolved instead of being force-matched.
6. Retry selected queue outcomes only when there is a reason to re-evaluate them.

## Seed precedence

A seed is historical evidence. If an `anime_decisions` record already exists, the seed does not overwrite it. Manual/survey decisions are authoritative over old seed material.
