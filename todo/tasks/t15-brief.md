<!-- aidevops:brief-schema=v2 -->

# t15: Make Time % the default exclusive chart mode

## Pre-flight

- [x] Memory recall: `hitfactorcharts worker-ready issue briefs TODO auto-dispatch issue 125 126` → 0 hits — no relevant lessons
- [x] Discovery pass: 0 later commits / 1 foundational merged PR / 0 open PRs supersede the issue; PR #115 is prior art
- [x] File refs verified: 7 refs checked, all present at `ca989a0`
- [x] Tier: `tier:standard` — mode semantics are decided, but rendering, export behavior, color, and UI verification require coordinated judgment
- [x] Seeded draft PR decision recorded: skipped — this task is intentionally ordered after t14 to prevent UI-file collisions

## Origin

- **Created:** 2026-09-09
- **Session:** OpenCode interactive session
- **Created by:** AI interactive
- **Parent task:** None; source issue GH#126
- **Blocked by:** t14 / GH#125
- **Conversation context:** Maintainer review accepted changing Time % from an optional overlay into the default exclusive Score Over Time mode with a more distinct visual treatment.

## What

Make Time % active by default in the ranked dashboard and render it as a true exclusive chart mode. While active, the chart shows only valid Time % points with its own title, y-axis wording, unavailable state, and distinct theme-safe color. Other chart modes remain mutually exclusive and turning Time % off returns to the normal score chart.

## Why

GH#126 identifies a mismatch between the three mode controls: Classifiers Only and Adjusted % Only isolate their data, while Time % merely appends an opt-in series. Current state initializes `showTimePct` to false and the normal render branch overlays Time % on score and adjusted series.

## Tier

### Tier checklist

- [ ] **Exact execution contract supplied?** State transitions are fixed, but final accessible color and renderer extraction are not prescribed verbatim.
- [x] **Targets and reference pattern verified?** Existing exclusive-mode and test patterns were inspected.
- [x] **No semantic or design decision remains?** Default, exclusivity, fallback behavior, and preserved calculations are decided.
- [x] **Bounded, reversible, low-consequence impact?** UI mode only; no stored score mutation.
- [x] **No stateful coordination to invent?** The three booleans already coordinate modes synchronously.
- [x] **Focused verification and rollback are explicit?** Commands and revert path are listed.
- [x] **No dispatch-path risk override?** No aidevops dispatch files are in scope.

**Selected tier:** `tier:standard`

**Tier rationale:** This adapts an established renderer across several UI surfaces and requires normal visual/accessibility judgment, without unresolved product semantics.

## PR Conventions

This is a leaf task. The implementation PR must use `Resolves #126`.

## Seeded Draft PR

- **Decision:** Skipped
- **Rationale:** Ordered issue execution is safer than a seed against files that t14 will edit first.
- **Status:** `blocked`
- **Freshness evidence:** Memory, PR collision, source, test, and design checks were completed against `ca989a0`.
- **Verification run:** `node --test tests/dashboard-summaries.test.js tests/time-percentage.test.js` passed 5/5 during review.
- **Stale-assumption warning:** Rebase after t14 closes and re-check `dashboard.js`, `dashboard.html`, DESIGN.md, and README.md before editing.

## How (Approach)

### Files to Modify

- `EDIT: extension/dashboard.js:235-245,909-968,1642-1687` — default mode state, mutual exclusion, exclusive Time % rendering, title, axis, and empty state.
- `EDIT: extension/dashboard.html:441-489,1683-1717` — label Time % as an Only mode, apply an accessible active accent, and revise help copy.
- `EDIT: tests/dashboard-analytics.test.js:1-37` — add source-level mode-state and renderer contract coverage using the established file-inspection pattern.
- `EDIT: tests/time-percentage.test.js:1-34` — preserve calculation and eligibility coverage; extend only if an uncovered render-facing edge is cheapest to prove here.
- `EDIT: DESIGN.md:82-88` — replace opt-in supplemental-series rules with default exclusive-mode rules and color/accessibility requirements.
- `EDIT: README.md:22,59-61` — describe the new default without changing calculation claims.

### Complete Write Surface

- **Callers/readers:** `initializeDashboard` and `renderAll` consume module mode state; checkbox listeners call `setChartMode`; CSV export reads current chart-visible records through existing export logic and must be checked for mode-label assumptions.
- **Writers/mutation paths:** `setChartMode` is the only mode-state mutator after initialization; `switchView` clears ranked-only modes when entering All Matches.
- **Tests/fixtures:** `tests/time-percentage.test.js` covers calculation; `tests/dashboard-analytics.test.js` provides a source-contract harness for dashboard UI invariants. Both tests build their data inline, so no separate fixture files apply.
- **Schemas/config:** `extension/dashboard.js` keeps mode state in memory and does not change the storage schema or manifest.
- **Generated/deployed mirrors:** `extension/dashboard.js` and `extension/dashboard.html` are packaged directly; repository search found no generated mirror to update.
- **Migrations/backfills:** `extension/dashboard.js` continues reading the existing cached record shape, so legacy data needs no migration or backfill.
- **Cleanup/rollback paths:** Revert `extension/dashboard.js`, `extension/dashboard.html`, tests, and docs together; cached data remains untouched.

### Implementation Steps

1. Rename `showTimePct` to a mode-oriented name such as `timePctOnly`, or otherwise remove overlay semantics consistently. Initialize it true for the default ranked view.
2. Preserve mutual exclusion in `setChartMode`: enabling one mode disables the other two. Turning Time % off restores normal Score Over Time; entering All Matches continues to hide ranked-only mode controls and render the normal compatible chart.
3. Add an exclusive Time % render branch before the normal score branch. Filter finite points, render only `timeSeries`, set `Time % Over Time`, use raw-time performance axis/value wording, and show a clear message when fewer than two usable points exist.
4. Choose a color with clear visual separation from Division blue `#4a9eff` and Adjusted pink `#ff4081` in both themes. Keep meaning available through labels and dash/shape, not color alone.
5. Rename the control to `Time % Only` and revise dashboard, DESIGN.md, and README.md copy that currently calls Time % opt-in, supplemental, or non-replacing.
6. Inspect CSV export behavior while each mode is active. Preserve existing columns unless the export currently promises chart-series-only output; if the title/selection metadata changes, update it consistently.
7. Add focused tests proving the default state, exclusive branch, mutual exclusion, labels, and the negative guarantee that calculations and invalid-stage exclusions did not change.

### Hazards and Compatibility

- **Concurrency/atomicity:** Mode changes are synchronous UI events. Keep one render after all three booleans are normalized to avoid an intermediate mixed chart.
- **Migration/rollback:** No migration. Reverting restores the opt-in overlay without touching cached matches.
- **Mixed-version/backward compatibility:** Existing cached records may lack usable Time % benchmarks. They must produce the documented unavailable state, not fabricated zeroes or a silent fallback series.
- **Idempotency/retry:** Repeated toggle, filter, resize, and theme events must render one selected mode with unchanged underlying points.
- **Partial failure/recovery:** If Time % lacks enough finite points, keep the Time % mode selected and show its empty state; do not silently switch to Division %.

### Verification Before Dispatch

```bash
node --check extension/dashboard.js
node --test tests/time-percentage.test.js tests/dashboard-analytics.test.js
node --test tests/*.test.js
git diff --check
```

- **Surface mapping:** Syntax checking covers the renderer; focused tests protect Time % calculations and source-level mode contracts; the full existing suite covers shared dashboard behavior; `git diff --check` protects patch formatting.
- **Broad verification trigger:** `dashboard.js` is the shared dashboard controller, so the existing repository test suite is justified after focused checks pass.
- **UI verification:** Load the extension in the ranked view and confirm Time % Only is active on first render, each mode is exclusive, Time % off restores Score Over Time, missing data remains selected with a message, and color/labels are legible in light/dark themes at narrow and desktop widths. Confirm DESIGN.md was updated.

### Recoverability Checkpoint

- [ ] Focused functional verification passes: `node --test tests/time-percentage.test.js tests/dashboard-analytics.test.js`
- [ ] WIP commit created before broad gates: `wip: make Time percent an exclusive mode`
- [ ] Evidence-triggered broad verification then run: `node --test tests/*.test.js`

**Hard boundaries:** Do not change Time % formulas, stage eligibility, the 100% cap, cached record shape, or official classifier behavior.

**AI brief owner:** Interactive maintainer session for GH#126.

**Recovery:** Preserve the worker PR and report any post-t14 conflict or export-contract ambiguity with exact file evidence.

### Files Scope

- `extension/dashboard.js`
- `extension/dashboard.html`
- `tests/dashboard-analytics.test.js`
- `tests/time-percentage.test.js`
- `DESIGN.md`
- `README.md`

## Acceptance Criteria

- [ ] The ranked dashboard initially selects Time % Only and renders only finite Time % points with a matching title and raw-time axis wording.
- [ ] Classifiers Only, Adjusted % Only, and Time % Only remain mutually exclusive; disabling Time % restores normal Score Over Time.
- [ ] A distinct theme-safe Time % color and non-color cues remain legible in light/dark themes and at narrow/desktop widths.
- [ ] Fewer than two usable Time % points produces an explicit unavailable message while retaining the selected mode; no zero or fallback series is fabricated.
- [ ] Existing Time % formulas, exclusions, cap, cached records, official classifiers, and other chart modes do not regress.
- [ ] Focused and existing repository tests pass, and DESIGN.md plus README.md match the delivered default behavior.

## Context & Decisions

- PR #115 introduced Time % as opt-in and supplemental; GH#126 intentionally revises presentation while preserving its raw-time calculation.
- Default means active on initial ranked-dashboard render, not persisted across extension sessions.
- The existing three-control mutual-exclusion pattern remains the reference; this task completes the render-side semantics.

## Relevant Files

- `extension/dashboard.js:235-245` — current false default and overlay-oriented state name.
- `extension/dashboard.js:919-948` — existing mode synchronization and exclusivity.
- `extension/dashboard.js:1642-1687` — adjusted branch and current Time % overlay.
- `extension/dashboard.html:441-489` — shared mode-toggle styles.
- `extension/dashboard.html:1683-1717` — control labels and explanatory copy.
- `tests/dashboard-analytics.test.js:26-37` — existing source-contract test pattern.
- `DESIGN.md:82-88` — current supplemental-series rule to revise.

## Dependencies

- **Blocked by:** t14 / GH#125; sync this as a native GitHub blocked-by relationship before dispatch
- **Blocks:** None
- **External:** None

## Estimate Breakdown

| Phase | Time | Notes |
|---|---:|---|
| Research/read | 15m | Rebase after t14 and inspect export assumptions |
| Implementation | 60m | State, renderer, copy, color, tests, docs |
| Verification | 30m | Focused/full tests and UI mode checks |
| **Total** | **1h 45m** | |
