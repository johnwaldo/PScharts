<!-- aidevops:brief-schema=v2 -->

# t16: Give Accuracy Trend a nonlinear low-percentage scale

## Pre-flight

- [x] Memory recall: `hitfactorcharts Accuracy Trend nonlinear scale worker brief chart y-axis` → 0 hits — no relevant lessons
- [x] Discovery pass: 1 recent Accuracy Trend implementation / 0 related open PRs; current behavior remains reproducible at `cc431f9`
- [x] File refs verified: 7 refs checked, all present at `cc431f9`
- [x] Tier: `tier:standard` — the transform and semantic boundaries are decided, but shared chart integration and visual verification require normal implementation judgment
- [x] Seeded draft PR decision recorded: skipped — t14 is queued against overlapping dashboard and design files, so ordered issue execution is safer

## Origin

- **Created:** 2026-09-09
- **Session:** OpenCode interactive session
- **Created by:** AI interactive
- **Parent task:** None; source issue GH#128
- **Blocked by:** t14 / GH#125 to prevent overlapping dashboard, test, README, and DESIGN.md edits
- **Conversation context:** The requester noted that Accuracy Trend omits A-zone hits, so its displayed C, D, miss, and no-shoot series cluster near zero and are hard to compare on the current linear 0–100% axis.

## What

Render Accuracy Trend with a disclosed piecewise-linear Y-axis that expands 0–5%, gives most chart height to values below 40%, and compresses values above 50%. Preserve raw percentages, ordering, trend calculations, tooltip values, summaries, and exports.

Use these fixed raw-to-visual anchors, expressed from bottom to top as fractions of chart height:

| Raw value | Visual position |
|---:|---:|
| 0% | 0.00 |
| 5% | 0.30 |
| 10% | 0.45 |
| 20% | 0.62 |
| 40% | 0.84 |
| 50% | 0.90 |
| 100% | 1.00 |

Render raw tick labels at 0, 1, 2, 5, 10, 20, 40, 50, and 100. The transform changes geometry only; every displayed number remains the raw percentage.

## Why

Accuracy Trend currently calls `drawMultiSeriesChart` with `yMin: 0` and `yMax: 100`, so low C/D/M/NS values occupy only a few pixels. A task-specific warp reveals meaningful changes without changing the underlying denominator or implying greater raw variation.

## Tier

### Tier checklist

- [ ] **Exact execution contract supplied?** Transform anchors and ticks are exact, but the worker must adapt the shared chart option cleanly.
- [x] **Targets and reference pattern verified?** Existing class warp and Hit Zone nonlinear disclosure provide verified patterns.
- [x] **No semantic or design decision remains?** Scale shape, scope, disclosure, and unchanged raw-data guarantees are fixed.
- [x] **Bounded, reversible, low-consequence impact?** Geometry-only UI change with no persisted data effect.
- [x] **No stateful coordination to invent?** The renderer receives a static warp and existing point arrays.
- [x] **Focused verification and rollback are explicit?** Pure transform tests, existing analytics tests, visual checks, and revert scope are listed.
- [x] **No dispatch-path risk override?** No aidevops dispatch files are in scope.

**Selected tier:** `tier:standard`

**Tier rationale:** This is established Canvas chart work with a decided visual transform, but it modifies a shared renderer and needs careful regression isolation.

## PR Conventions

This is a leaf task. The implementation PR must use `Resolves #128`.

## Seeded Draft PR

- **Decision:** Skipped
- **Rationale:** The task is blocked behind t14, which touches adjacent dashboard files; a seed would create stale conflict risk.
- **Status:** `blocked`
- **Freshness evidence:** Current renderer, Accuracy Trend call site, nonlinear Hit Zone disclosure, tests, DESIGN.md, and README.md were inspected at `cc431f9`.
- **Verification run:** Discovery only; no code change exists yet.
- **Stale-assumption warning:** Rebase after GH#125 closes and re-check every listed line before editing.

## How (Approach)

### Files to Modify

- `EDIT: extension/dashboard-charts.js:13-23,127-163,257-333` — define the Accuracy Trend anchors/ticks and add an optional custom warp/tick contract to the shared multi-series renderer.
- `EDIT: extension/dashboard.js:1818-1881` — pass the Accuracy Trend warp and raw tick set only for `chartAccuracy`.
- `EDIT: extension/dashboard.html:1782-1788` — disclose the nonlinear geometry immediately beside the chart.
- `NEW: tests/dashboard-charts.test.js` — verify anchors, interpolation, monotonicity, and the renderer option contract using the existing Node test infrastructure.
- `EDIT: tests/dashboard-analytics.test.js:14-17` — preserve the raw reported-hit denominator behavior and assert the Accuracy Trend call selects the custom warp.
- `EDIT: DESIGN.md:68-91` — specify Accuracy Trend geometry and the raw-value invariant.
- `EDIT: README.md:177-192` — distinguish Accuracy Trend nonlinear geometry from the separately defined Hit Zone transform.

### Complete Write Surface

- **Callers/readers:** `extension/dashboard.js` calls `drawMultiSeriesChart`; all line charts share `extension/dashboard-charts.js`, so the new option must default to current behavior for every non-Accuracy chart.
- **Writers/mutation paths:** `drawMultiSeriesChart` writes Canvas pixels and `_hitMap`; the change must transform coordinates only and leave point objects/raw `y` values unchanged.
- **Tests/fixtures:** `tests/dashboard-analytics.test.js` covers percentage construction; `tests/dashboard-charts.test.js` will exercise the pure transform with inline values, so no separate fixtures are needed.
- **Schemas/config:** `extension/dashboard.js` continues to consume the existing match/stage record shape; no schema, storage, or manifest configuration changes.
- **Generated/deployed mirrors:** `extension/dashboard-charts.js`, `extension/dashboard.js`, and `extension/dashboard.html` are packaged directly; repository search found no generated mirror.
- **Migrations/backfills:** `extension/dashboard.js` reads existing cached raw counts and percentages unchanged, so repository evidence shows no migration or backfill path.
- **Cleanup/rollback paths:** Revert `extension/dashboard-charts.js`, the Accuracy call-site options, disclosure copy, tests, and docs together; cached user data needs no cleanup.

### Implementation Steps

1. Add immutable Accuracy Trend warp points and raw tick constants near the other chart geometry constants. Reuse or safely generalize `warpPct` for piecewise interpolation; reject or avoid malformed/non-monotonic point sets rather than silently drawing invalid geometry.
2. Extend `drawMultiSeriesChart` with optional custom warp points and tick values. Custom geometry applies to `toY`, grid lines, trend lines, series lines, dots, and hit-map coordinates through the existing shared `toY` function.
3. Keep default behavior unchanged when no custom warp is supplied. Do not combine the Accuracy warp with `showClassBands`, percentage reference guides, or the generic square-root scale.
4. Pass the fixed Accuracy warp and ticks only from the `chartAccuracy` call in `extension/dashboard.js`. Keep `yMin: 0`, `yMax: 100`, `showClassBands: false`, raw `valueUnit: '%'`, and existing trend behavior.
5. Add a visible scale note explaining that 0–5% is expanded, values above 50% are compressed, and tooltips/summaries/exports retain raw percentages. Do not use class labels or imply that visual distance is linear.
6. Add pure tests for every anchor, interpolation within segments, monotonic output from 0–100, unchanged endpoints, custom raw ticks, and absence of the option from other chart call sites.
7. Update DESIGN.md and README.md, then perform focused and full existing checks before responsive visual verification.

### Hazards and Compatibility

- **Concurrency/atomicity:** Canvas rendering is synchronous. One validated warp must feed all coordinates in a render so lines, dots, trends, ticks, and tooltips stay aligned.
- **Migration/rollback:** No migration. A revert restores linear geometry without altering cached or exported values.
- **Mixed-version/backward compatibility:** Legacy records already yield raw shares or unavailable values. The warp must not convert unavailable values to zero or require new fields.
- **Idempotency/retry:** Repeated filters, themes, and resizes must reproduce identical raw-to-visual coordinates without mutating source points.
- **Partial failure/recovery:** Invalid or missing custom warp configuration must fail safely to the existing linear scale or a clear development error; it must never draw misleading partial geometry.

### Verification Before Dispatch

```bash
node --check extension/dashboard-charts.js
node --check extension/dashboard.js
node --test tests/dashboard-charts.test.js tests/dashboard-analytics.test.js
node --test tests/*.test.js
git diff --check
```

- **Surface mapping:** Syntax checks cover the shared renderer and caller; focused tests prove scale geometry plus unchanged raw analytics; the existing suite protects all shared chart consumers; `git diff --check` protects patch formatting.
- **Broad verification trigger:** `drawMultiSeriesChart` is shared by multiple dashboard charts, so the existing repository test suite is required after focused checks pass.
- **UI verification:** Load representative Accuracy Trend values around 0%, 1%, 2%, 5%, 10%, 20%, 40%, 50%, and above 50%. In light and dark themes at narrow and desktop widths, confirm readable ticks/disclosure, aligned dots/trends/tooltips, no overflow, and exact raw tooltip values. Confirm every other chart retains prior geometry.

### Recoverability Checkpoint

- [ ] Focused functional verification passes: `node --test tests/dashboard-charts.test.js tests/dashboard-analytics.test.js`
- [ ] WIP commit created before broad gates: `wip: add Accuracy Trend scale`
- [ ] Evidence-triggered broad verification then run: `node --test tests/*.test.js`

**Hard boundaries:** Never alter raw percentages, denominators, summaries, exports, stored records, or any chart other than Accuracy Trend. Never add USPSA class semantics to accuracy shares.

**AI brief owner:** Interactive maintainer session for GH#128.

**Recovery:** Preserve the worker PR and report any conflict with t14 or shared-renderer regression with exact evidence before widening scope.

### Files Scope

- `extension/dashboard-charts.js`
- `extension/dashboard.js`
- `extension/dashboard.html`
- `tests/dashboard-charts.test.js`
- `tests/dashboard-analytics.test.js`
- `DESIGN.md`
- `README.md`

## Acceptance Criteria

- [ ] Accuracy Trend maps 0, 5, 10, 20, 40, 50, and 100 percent to the exact documented visual anchors and renders the specified raw ticks.
- [ ] Accuracy Trend visibly expands 0–5%, prioritizes values below 40%, and compresses values above 50% while preserving monotonic ordering.
- [ ] Tooltips, summaries, exports, trend inputs, denominators, and stored records retain exact raw percentages; missing values never become zero.
- [ ] Other charts do not receive the Accuracy warp and retain their current geometry, tick behavior, and class/reference semantics.
- [ ] The chart includes a readable nonlinear-scale disclosure in light/dark themes and narrow/desktop layouts without overflow.
- [ ] Focused and existing repository tests pass, and DESIGN.md plus README.md match delivered behavior.

## Context & Decisions

- Accuracy Trend intentionally omits A and currently displays C, D, M, and NS shares, so most useful values cluster near zero.
- The existing class-band warp is semantic to official classifier percentages and must not be reused as an accuracy-class scale.
- The Hit Zone chart proves the project accepts disclosed nonlinear geometry while preserving raw data; Accuracy Trend receives its own low-value-focused anchors.

## Relevant Files

- `extension/dashboard-charts.js:127-163` — existing piecewise warp pattern.
- `extension/dashboard-charts.js:257-333` — shared multi-series scale and tick pipeline.
- `extension/dashboard.js:1818-1881` — Accuracy Trend raw shares, series, and renderer call.
- `extension/dashboard.html:1782-1788` — Accuracy Trend header and summary container.
- `tests/dashboard-analytics.test.js:14-17` — raw share denominator coverage.
- `DESIGN.md:68-91` — chart semantics and raw-value invariants.
- `README.md:177-192` — user-facing Accuracy and Hit Zone explanations.

## Dependencies

- **Blocked by:** t14 / GH#125; synchronize a native blocked-by relationship before dispatch
- **Blocks:** None
- **External:** None

## Estimate Breakdown

| Phase | Time | Notes |
|---|---:|---|
| Research/read | 20m | Rebase after t14 and re-check shared renderer |
| Implementation | 70m | Warp option, caller, disclosure, tests, and docs |
| Verification | 35m | Focused/full tests and visual regression checks |
| **Total** | **2h 5m** | |
