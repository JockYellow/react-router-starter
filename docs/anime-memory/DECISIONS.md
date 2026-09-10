# Anime Memory Decisions

This file records decisions that should survive chat/session replacement.

## D-001 — Reuse existing D1
**Decision:** Anime Memory uses the existing `BLOG_DB` / `blog-db` binding.

**Reason:** The host application already uses this D1 binding for multiple independent features. Anime tables are isolated with an `anime_*` prefix, so a separate Cloudflare database is unnecessary for the initial product.

## D-002 — Runtime-safe schema initialization
**Decision:** Initial Anime schema will follow the repository's existing `CREATE TABLE IF NOT EXISTS` pattern via `ensureAnimeSchema(db)`.

**Reason:** This avoids requiring Cloudflare dashboard access or a separate first-time D1 provisioning step. Schema creation must remain idempotent and non-destructive.

## D-003 — TV progress is seasonal
**Decision:** TV survey progress is keyed by year + season (Winter/Spring/Summer/Fall).

**Reason:** This matches how anime is naturally recalled and avoids one intimidating global progress counter.

## D-004 — Movies are yearly, not seasonal
**Decision:** Movie survey is tracked separately by year.

**Reason:** Forcing movies into TV seasonal buckets adds little value and makes progress less intuitive.

## D-005 — Viewing fact and evaluation are captured in one user flow
**Decision:** The survey starts with `Seen / Want / Not Seen`. Selecting Seen expands in-place to detailed viewing status, one overall evaluation, and optional tags.

**Reason:** The user wants viewing history and personal placement recorded together, but Want/Not Seen must remain fast one-step actions.

## D-006 — Only one overall evaluation scale
**Decision:** No separate mandatory 'quality' and 'liking' scores.

Overall evaluation options:
- 最喜歡
- 很喜歡
- 值得看
- 普通
- 不太喜歡
- 記不清／不評

**Reason:** A second rating axis created unnecessary cognitive load. Nuance is captured by optional concrete tags.

## D-007 — Tags must be concrete
**Decision:** Avoid vague tags such as `劇情強`, `角色強`, `完成度高` when a more specific judgment can be expressed.

Initial tag vocabulary:
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

Tags are optional and may evolve after real usage.

## D-008 — 'Why I watched it' is not a required field
**Decision:** Do not build a mandatory entry-reason/tag system for initial release.

**Reason:** Reconstructing an old viewing trigger is often uncertain and less valuable than preserving the final personal impression.

## D-009 — Notes are secondary
**Decision:** Free-text notes may exist but must not dominate the evaluation flow.

**Reason:** The user sometimes wants to preserve more context, but requiring prose would make large-scale reconstruction too slow.

## D-010 — Continuous persistence
**Decision:** Persist each meaningful decision to D1 as soon as practical; do not rely on a final multi-question submit.

**Reason:** Survey progress must survive closing the page, switching device, or resuming days later.

## D-011 — Chinese-first UI
**Decision:** Primary survey title should be useful Chinese whenever a reliable title is available. Original/Romaji/English titles remain available for recognition/search.

**Reason:** English-only titles materially reduce recall efficiency for this user.

## D-012 — AniList is canonical provider ID; Bangumi is a title fallback
**Decision:** Use AniList ID as primary external catalog identity in the initial architecture. Use Bangumi primarily to improve Chinese-title coverage when needed.

**Reason:** It gives the survey a stable canonical ID while allowing better Chinese display names.

## D-013 — Provider calls are server-side and cached
**Decision:** Browser pages call the application's server routes/loaders; provider results are normalized and cached into D1.

**Reason:** Reduces repeated external API calls, centralizes error handling, and prevents the UI from depending on direct third-party browser requests.

## D-014 — Netflix is provenance/seed, not canonical catalog
**Decision:** The reviewed Netflix history populates `anime_sources` and personal decisions, then maps into canonical anime records.

**Reason:** Netflix naming is useful evidence but not a reliable global anime identity system.

## D-015 — Avoid unsafe fuzzy deduplication
**Decision:** Prefer canonical-ID matches and exact normalized aliases. Ambiguous matches should remain reviewable rather than silently matched using broad substring logic.

**Reason:** The local prototype demonstrated that loose title matching can create false positives.

## D-016 — No smart gap-filling recommendation in initial scope
**Decision:** Do not implement taste-model recommendations, staff/studio affinity scoring, or smart missing-title ranking in the initial product.

**Reason:** The user values a complete, trustworthy archive/survey experience more than a complex recommendation layer.

## D-017 — Export is required
**Decision:** Final product must export personal Anime Memory data as JSON and CSV.

**Reason:** D1 should not be the only durable copy of a long-lived personal viewing archive.

## D-018 — Work is tracked in small batches
**Decision:** Development is split into GitHub issues #5–#8 with #9 as roadmap and #10 as handoff discipline.

**Reason:** Each segment should be independently reviewable, reportable, and resumable by another developer/conversation.
