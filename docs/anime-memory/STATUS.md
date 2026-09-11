# Anime Memory Status

Last updated: 2026-09-11

## Current branch / review entry

- Base: `main`
- `main` currently includes PR #16 at merge commit `e8977fa825c9ebacc97f0a7f4ddc66a8d3ad6a3c`.
- PR #14 — provider-neutral identity + Bangumi seasonal discovery — merged.
- PR #15 — Bangumi CDN CSP allowlist — merged, but did not solve browser cover rendering by itself.
- PR #16 — same-origin Anime cover proxy — merged and **production-accepted by the user; covers now render successfully**.
- Active development branch: `feature/anime-survey-efficiency`.
- Active batch: #6 — Batch B production acceptance + survey efficiency.
- Batch A: #5 — code-complete; real private Netflix seed execution remains pending.
- Roadmap: #9.

## Current overall state

**The core TV-season survey works in production.**

Confirmed in real production/D1:
- Bangumi seasonal discovery works.
- 2025 Winter initialized successfully.
- Chinese fallback titles render.
- same-origin cover route `/api/anime/cover/:animeId` works; the user confirmed posters display after PR #16.
- Seen / Want / Not Seen and evaluation code paths are implemented.

AniList is no longer a required runtime provider. Jikan was rejected after repeated live 504 probes. Bangumi is the TV-season discovery source. Internal `anime_id` is the stable application identity; provider IDs are optional external identifiers.

## Immediate next phase — survey efficiency

The next development phase was explicitly approved by the user and should resume on branch `feature/anime-survey-efficiency`.

### 1. Fix popularity ordering semantics

Current completed-season ordering is:

`anime_items.popularity DESC -> average_score DESC -> existing position`

Problem discovered during production use:
- Bangumi maps `collection_total` into the shared `anime_items.popularity` field.
- legacy AniList rows may already have a non-null popularity value.
- `cacheAnimeProviderRecord()` currently updates with `popularity = COALESCE(popularity, ?)`, so a legacy AniList popularity value can survive even after the same item is matched to Bangumi.
- AniList popularity and Bangumi `collection_total` are different metrics/scales, so mixing them can make the survey look incorrectly ordered even though a popularity sort is technically being applied.

Required change:
- keep a provider-specific Bangumi popularity / `collection_total` value instead of mixing it with legacy AniList popularity;
- seasonal survey ranking should use Bangumi `collection_total` as the primary signal;
- TV may be used as a small tie-break / priority over WEB/ONA if useful;
- average score should only be a secondary tie-breaker;
- no taste-model / fuzzy recommendation logic is required.

Important compatibility requirement:
- existing frozen/answered user records must not be lost;
- decide explicitly whether an already-started scope is re-ranked or only newly-created scopes use the corrected ranking. Avoid silently moving previously answered positions without a documented migration rule.

### 2. Make Not Seen / Want transitions effectively instant

Current primary-answer path is slower than necessary:

`POST -> D1 save -> refreshSurveyProgress() -> redirect -> full survey loader -> next candidate -> render -> next cover request`

This causes visible latency when repeatedly pressing D / Right for `NOT_SEEN`.

Target UX:
- client keeps a small queue of upcoming unresolved candidates (about 3–5 is enough);
- preload upcoming same-origin cover URLs;
- `NOT_SEEN` and `WANT` advance the visible card optimistically/immediately;
- persist the previous answer in the background with a fetcher/API action;
- refill the queue as it is consumed;
- progress count updates optimistically and reconciles with server state;
- failed background persistence must surface a clear recoverable state and must not silently lose an answer;
- `SEEN` remains different: selecting Seen should keep the current card open and reveal the detail/evaluation flow rather than auto-advance.

Do not trade durability for speed. D1 remains source of truth; optimistic UI is only presentation/interaction behavior.

## Batch B acceptance still pending after efficiency work

Production cover rendering is now accepted. Remaining browser acceptance:
- reload during a newly-initializing season and confirm Bangumi month/category/offset resumes rather than restarting;
- second-tab / repeated-trigger test confirms the D1 initialization lock prevents duplicate loading;
- Seen detail/rating autosave survives reload;
- Want / Not Seen persist reliably, including after the new optimistic flow;
- previous-item/edit mode returns correctly to unresolved flow;
- season switching remains reliable;
- review desktop hotkey behavior after real use.

Once these pass, update and close #6.

## Batch A — still pending in production

Code is already present, but private execution has not been completed:
- execute/verify schema repeatedly against real `BLOG_DB` for idempotency;
- stage the reviewed private Netflix source rows into real D1;
- resolve the seed queue and inspect MATCHED / AMBIGUOUS / UNMATCHED / ERROR counts;
- verify seed writes do not overwrite later manual survey decisions.

Private Netflix/user rows must never be committed to this public repository.

## Later roadmap after Batch B / Netflix seed

### Batch C — Library / detail / watchlist (#7)
- `/anime/library` poster wall.
- title/alias search.
- filters: watch status, evaluation, year/season, tags, studio.
- canonical `/anime/:id` detail/edit page.
- `/anime/watchlist` with useful sorting and Want -> Seen flow.

### Batch D — completion (#8)
- movie survey by year.
- JSON + CSV export.
- mobile survey/library UX.
- persistence / D1 / provider failure QA.
- final deployment and first-run documentation.

### Roadmap gap to add formally
The existing #7/#8 roadmap does not fully cover two parts of the original product goal:
- OVA / OAD / Special / other non-TV non-movie works;
- pre-2011 classic/high-recognition gap-filling.

Recommended product treatment:
- do **not** add OVA/Special noise to every TV seasonal scan;
- provide a separate later catch-up flow;
- pre-2011 should use a high-recognition/high-popularity pass rather than forcing the user through every historical season.

Smart recommendation / taste-model ranking remains out of scope unless the user later changes that decision.

## Architecture notes that must not regress

- `anime_id` is canonical internal identity.
- Bangumi official browse is the required TV seasonal provider.
- seasonal discovery scans all three months × TV/WEB and follows offset pagination; no top-100 cutoff.
- Bangumi `name_cn` is converted with pinned OpenCC cn -> tw as a practical Chinese fallback; it is not claimed to be an authoritative Taiwan-localized title.
- exact external ID or unique exact alias + compatible year only for provider reconciliation; no fuzzy substring merge.
- legacy AniList tables remain for compatibility during transition.
- cover browser URL is same-origin `/api/anime/cover/:animeId`; raw provider cover URLs stay in D1.
- never commit personal Anime Memory/Netflix rows to GitHub.

## Verification baseline

Merged PR #16 passed:
- Anime unit tests;
- repository typecheck;
- React Router build;
- Wrangler deploy dry-run.

Production user acceptance after merge:
- 2025 Winter provider import: success.
- cover proxy/rendering: success.

## Resume instructions for a new developer/chat

1. Read `STATUS.md`, `TODO.md`, `DECISIONS.md`, and issue #6.
2. Continue from branch `feature/anime-survey-efficiency`.
3. First implement the provider-specific Bangumi popularity fix and define migration behavior for already-started scopes.
4. Then implement optimistic queue/preload for `NOT_SEEN` / `WANT`, while keeping `SEEN` on-card for evaluation.
5. Add focused tests before running the full Anime CI, typecheck, build, and Wrangler dry-run.
6. Update STATUS/TODO/#6 at the checkpoint.
7. Do not merge any PR without explicit user instruction.
