# Anime Memory Decisions

This file records decisions that should survive chat/session replacement.

## D-001 — Reuse existing D1
**Decision:** Anime Memory uses the existing `BLOG_DB` / `blog-db` binding.

**Reason:** The host application already uses this D1 binding for multiple independent features. Anime tables are isolated with an `anime_*` prefix, so a separate Cloudflare database is unnecessary for the initial product.

## D-002 — Runtime-safe schema initialization
**Decision:** Initial Anime schema follows the repository's existing `CREATE TABLE IF NOT EXISTS` pattern via `ensureAnimeSchema(db)`.

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
**Decision:** No separate mandatory quality and liking scores.

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

## D-012 — AniList canonical identity (superseded)
**Original decision:** Use AniList ID as primary external catalog identity and use Bangumi primarily for Chinese-title coverage.

**Status:** Superseded by D-030 after real deployed AniList API failures. Legacy AniList IDs remain useful external identifiers and migration keys, but are no longer the application's canonical identity.

## D-013 — Provider calls are server-side and cached
**Decision:** Browser pages call the application's server routes/loaders; provider results are normalized and cached into D1.

**Reason:** Reduces repeated external API calls, centralizes error handling, and prevents the UI from depending on direct third-party browser requests.

## D-014 — Netflix is provenance/seed, not canonical catalog
**Decision:** The reviewed Netflix history populates source/provenance and personal decisions, then maps into canonical anime records.

**Reason:** Netflix naming is useful evidence but not a reliable global anime identity system.

## D-015 — Avoid unsafe fuzzy deduplication
**Decision:** Prefer external-ID matches and exact normalized aliases. Ambiguous matches should remain reviewable rather than silently matched using broad substring logic.

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

## D-019 — Freeze survey candidate membership and order
**Decision:** Each TV season/movie-year survey stores candidate membership and position when the scope is initialized. Existing scopes reuse that stored sequence rather than rebuilding from current provider rankings.

**Reason:** Provider popularity/order can change over time. A durable personal progress marker must continue to refer to the same sequence after reloads or weeks/months of inactivity.

## D-020 — Preserve unresolved provenance instead of forcing canonical identity
**Decision:** External source rows may remain unresolved/ambiguous. Only safely matched canonical anime records create/update personal decisions automatically.

**Reason:** Historical source titles can be translated, ambiguous, or non-Japanese animation. Losing them is unacceptable, but forcing them onto the wrong work is worse.

## D-021 — Reviewed Netflix title is trusted as zh-TW only after safe match
**Decision:** When a reviewed Netflix row is safely matched, its reviewed display title may populate `title_zh_tw` and a `resolved:zh-tw` alias. An unmatched Netflix title must not be attached to a guessed work merely to obtain Chinese display text.

**Reason:** This lets known Netflix titles immediately benefit the Chinese-first UI without weakening identity matching rules.

## D-022 — Personal Anime Memory data never enters the public Git repository
**Decision:** Reviewed Netflix rows, watched-title snapshots, ratings, notes, and exported personal Anime Memory datasets must not be committed to this repository. The public repo versions only schema, import formats, code, tests, and non-personal aggregate development notes. Private source data stays in D1 or an ignored local/private file.

**Reason:** Git history is durable and this repository is public. Deleting a file later would not reliably remove personal viewing history from prior commits.

## D-023 — Seed imports are staged privately and must not overwrite manual decisions
**Decision:** Private seed input is staged into `anime_seed_queue` in D1, processed incrementally, and records MATCHED/AMBIGUOUS/UNMATCHED/SKIPPED/ERROR outcomes. A safely matched seed creates a decision only when that anime has no existing decision; later manual/survey decisions take precedence.

**Reason:** Staging makes external-provider matching inspectable and resumable without exposing raw source data in Git. Seed material is historical evidence, not an authority that should undo a newer user edit.

## D-024 — Simplified Chinese fallback uses pinned OpenCC `cn -> tw`
**Decision:** Use pinned `opencc-js` 1.4.2 with the `cn -> tw` conversion path for Bangumi `name_cn` values. Do not use `twp` phrase localization for anime titles.

**Reason:** The user accepts Simplified-Chinese title wording as a practical fallback as long as the displayed characters are converted to Traditional Chinese. OpenCC character conversion must not be described as proof of an official Taiwan licensed title.

## D-025 — Chinese title enrichment is lazy and best-effort
**Decision:** Legacy/external records without Chinese titles may query Bangumi lazily when the current card is opened. Failure to enrich must not block the survey card.

**Status:** Still applies to migrated legacy records. New Bangumi seasonal records already carry `name_cn` when available and convert it during normalization.

## D-026 — Remote D1 seed verification does not block Batch B implementation
**Decision:** Batch B UI may begin once Anime tests, repository typecheck, build, and Wrangler dry-run are green. Batch A remains open until private seed staging/resolution is executed against the real Cloudflare D1 environment and schema idempotency is verified there.

**Reason:** The remaining Batch A work requires Cloudflare account/runtime access rather than more application architecture.

## D-027 — First-time seasonal loading must be visible and resumable
**Decision:** A new TV season is initialized in small persisted steps rather than one opaque server request. The UI must show candidate count, provider segment/phase, and where a failure stopped. Progress is stored in D1 so reloads resume instead of starting over.

**Reason:** A silent long-running fetch looks broken and encourages unnecessary refresh/retry actions. Visible durable progress makes the system understandable and protects provider/API usage.

## D-028 — Transient provider failures use bounded automatic retry
**Decision:** Provider HTTP requests automatically retry timeout/network failures plus HTTP 408/425/429/5xx up to two retries with bounded exponential backoff and jitter. `Retry-After` is respected when supplied, subject to a maximum wait cap. Non-retryable 4xx responses fail immediately.

**Reason:** Short provider outages and rate limits should not require user intervention, but an application request must not wait indefinitely or retry permanently.

## D-029 — Duplicate seasonal initialization is suppressed with a short D1 lock
**Decision:** Seasonal load state stores a short `locked_until` lease for each scope. A second tab/request observes BUSY and waits/synchronizes rather than issuing the same provider request concurrently. Expired locks are recoverable.

**Reason:** Users may refresh or click repeatedly when a network request is slow. Duplicate initialization would waste provider quota and can create confusing partial progress even when inserts are idempotent.

## D-030 — Application identity is provider-neutral
**Decision:** The application uses its own `anime_id` as the stable internal identity. `mal_id`, `anilist_id`, and `bangumi_id` are optional unique external identifiers on the same record.

Legacy AniList-keyed tables remain during migration and are copied idempotently into provider-neutral `anime_items`, `anime_item_aliases`, `anime_user_*`, and `anime_scope_candidates` tables. Existing answers and frozen scope ordering must survive the migration.

**Reason:** AniList returned deployed/manual-block 403 failures and cannot be allowed to determine whether the personal archive is usable. External provider availability must not define record identity.

## D-031 — Bangumi browse API is the primary TV-season discovery source
**Decision:** For a new TV season, scan all three months of that season for Bangumi Anime category `TV` and `WEB`. Follow offset pagination when a source segment exceeds one page. Do not impose the former top-100 candidate cap.

After discovery completes, deduplicate by internal `anime_id`, then freeze the candidate order by collection popularity first and score second. Existing scopes are never rebuilt.

Bangumi `name_cn` is converted with OpenCC `cn -> tw` and may be used as the practical Chinese display title. It is a fallback display name, not a claim that the wording is the official Taiwan licensed title.

**Reason:** A complete scan better serves memory reconstruction than a popularity cutoff. A live probe on 2026-09-11 successfully returned historical TV and WEB data from Bangumi, while AniList was blocked and Jikan repeatedly returned upstream 504 errors.

## D-032 — Provider migration uses versioned seasonal load state
**Decision:** The Bangumi seasonal loader uses `anime_scope_load_state_v2`, separate from the earlier AniList/Jikan load-state experiments. Old failed 403 state must not block or resume the new provider flow.

**Reason:** SQLite CHECK constraints and provider cursor semantics changed during the migration. A versioned state table is safer and clearer than trying to reinterpret an ERROR/page cursor that belonged to a different provider.
