# Jikan provider-neutral refactor

This branch replaces the runtime seasonal dependency on AniList with Jikan/MyAnimeList while preserving legacy AniList-backed rows through an idempotent compatibility migration.

Core rules:
- internal `anime_id` is the stable primary key;
- `mal_id`, `anilist_id`, and `bangumi_id` are optional external identifiers;
- Jikan/MAL is the primary seasonal catalogue provider;
- AniList remains optional metadata only and must never block survey use;
- legacy AniList tables are kept read-only during this migration so existing D1 data can be copied safely.
