# Anime Memory

Anime Memory is a personal anime viewing-history reconstruction and evaluation module inside this repository.

## Product goal

Build a durable personal anime archive that can:

1. Reconstruct what the user has watched, season by season.
2. Preserve viewing facts and personal evaluation together.
3. Maintain a useful watchlist.
4. Make progress safe to stop and resume from any device.
5. Provide a browsable/editable anime library after the survey work is done.
6. Export personal data so Cloudflare D1 is not the only copy.

This is not primarily a recommendation engine. Smart gap-filling/recommendation algorithms are explicitly out of scope for the initial product.

## Existing host architecture

Anime Memory lives inside the existing React Router SSR application and reuses the existing Cloudflare Worker runtime and `BLOG_DB` D1 binding.

Do not create a separate Cloudflare application or database unless a later decision explicitly changes this.

Primary locations:

- `app/features/anime/` — Anime domain/data/provider logic.
- `app/routes/anime/` — Anime pages.
- `docs/anime-memory/` — canonical product/development handoff documentation.

## Core pages

### `/anime`

Dashboard and progress overview.

Shows:

- Watched count.
- Watchlist count.
- Favourite/highest evaluation count.
- Current/most recently active survey season.
- Season-by-season progress matrix.
- Recent records.
- Shortcuts to library/watchlist.

### `/anime/survey`

Primary reconstruction workflow.

TV progress is always grouped by `year + season`:

- Winter
- Spring
- Summer
- Fall

Movies are not forced into seasonal buckets; movie survey is grouped by year.

Primary decision:

- 看過 (`SEEN`)
- 想看 (`WANT`)
- 沒看 (`NOT_SEEN`)

`WANT` and `NOT_SEEN` are intended to remain one-step actions.

When `SEEN` is selected, the same card expands to capture:

#### Viewing detail

- 看完 (`COMPLETE`)
- 看完一季／系列未追完 (`SEASON_COMPLETE`)
- 看過部分 (`PARTIAL`)
- 棄番 (`DROPPED`)
- 只看電影／特別篇 (`MOVIE_ONLY`)

#### Overall evaluation

Use only one rating dimension:

- 最喜歡
- 很喜歡
- 值得看
- 普通
- 不太喜歡
- 記不清／不評

Do not introduce a second mandatory quality/completion rating dimension.

#### Optional concrete evaluation tags

Initial tag set:

- 劇情一直有吸引力
- 越看越好
- 前強後弱
- 收尾漂亮
- 收尾可惜
- 角色很討喜
- 角色互動很好看
- 角色成長寫得好
- 世界觀很吸引人
- 演出有記憶點
- 畫面表現很出色
- 音樂很加分
- 不是我的菜但做得很好
- 有缺點但我很喜歡
- 想重看

Tags are optional. They should add concrete meaning that the single overall evaluation cannot express; they are not a checklist that must be completed.

Optional free-text notes may exist, but should remain visually secondary.

### `/anime/library`

Browsable poster-wall library of watched anime.

Expected filters/search:

- Title/alias search.
- Viewing detail/status.
- Overall evaluation.
- Year/season.
- Evaluation tags.
- Studio when metadata exists.

### Anime detail page

Personal record is displayed before third-party metadata.

The user must be able to edit viewing detail, evaluation, tags, and optional note without entering survey mode again.

### `/anime/watchlist`

Persistent `WANT` list.

A title can move from Want -> Seen and immediately use the same viewing-detail/evaluation/tag flow.

## UX rules

### Save continuously

Do not use a long form that saves only at the end.

Each meaningful selection should be persisted to D1 as soon as practical so that closing the tab does not discard completed work.

### Resume safely

A survey session must be resumable from the next unresolved candidate. The dashboard should expose a direct `繼續盤點` action.

### Allow correction

Provide a previous-item path and allow existing decisions to be edited/upserted. A complex transaction-level undo log is not required for the initial version.

### Chinese-first titles

The UI should prefer a useful Chinese title, while preserving original/Romaji/English names and aliases for identification and search.

Do not depend on English title recognition for the primary survey experience.

## Data model

Initial tables:

### `anime_catalog`
Canonical anime metadata keyed primarily by AniList ID.

Expected fields include IDs, title variants, year, season, format, episodes, cover, studio, genres, popularity/score metadata, and sync timestamp.

### `anime_aliases`
Aliases used for search, Chinese naming, source-title mapping, and deduplication.

### `anime_decisions`
Viewing fact/status:

- Primary status: `SEEN | WANT | NOT_SEEN`
- Optional detailed status for seen titles.

### `anime_sources`
Evidence/provenance that linked a personal record to the catalog, e.g. Netflix or manual survey.

### `anime_evaluations`
Single overall personal evaluation plus optional note.

### `anime_evaluation_tags`
Many-to-many relationship between an anime record and concrete personal evaluation tags.

### `anime_survey_progress`
Durable progress state keyed by survey scope (TV: year + season; movie: year).

## Netflix seed rules

The reviewed Netflix dataset is a seed/provenance source, not the canonical anime catalog.

Mapping intent:

- 看完 -> `SEEN + COMPLETE`
- 看完一季／系列未追完 -> `SEEN + SEASON_COMPLETE`
- 看過一部分 -> `SEEN + PARTIAL`
- 棄番 -> `SEEN + DROPPED`
- 只看特別篇／電影 -> `SEEN + MOVIE_ONLY`
- 沒看 -> `NOT_SEEN`
- 誤判 -> excluded

Netflix titles should be resolved to canonical anime IDs as safely as possible. Do not rely on loose substring matching alone.

## External metadata strategy

The application should use server-side provider code rather than browser-direct cross-origin calls.

Planned providers:

- AniList: canonical discovery/metadata source and ID.
- Bangumi: Chinese title fallback where useful.

Provider results should be cached into D1 rather than repeatedly fetched on every card display.

## Scope exclusions

For the initial product, do not build:

- Smart recommendation algorithms.
- Automatic taste-model scoring.
- Staff/studio affinity ranking logic.
- Mandatory multi-axis ratings.
- A separate Cloudflare database solely for Anime Memory.

## Development tracking

- Project roadmap: GitHub issue #9.
- Batch A: #5.
- Batch B: #6.
- Batch C: #7.
- Batch D: #8.
- Documentation/handoff discipline: #10.

Before continuing development in a new session, read:

1. `docs/anime-memory/STATUS.md`
2. `docs/anime-memory/TODO.md`
3. `docs/anime-memory/DECISIONS.md`
4. The currently active GitHub issue.
