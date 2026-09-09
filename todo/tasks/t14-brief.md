<!-- aidevops:brief-schema=v2 -->

# t14: Expand class-equivalent badges and performance summaries

## Pre-flight

- [x] Memory recall: `hitfactorcharts worker-ready issue briefs TODO auto-dispatch issue 125 126` → 0 hits — no relevant lessons
- [x] Discovery pass: 0 later commits / 1 foundational merged PR / 0 open PRs supersede the issue; PR #114 is prior art
- [x] File refs verified: 7 refs checked, all present at `ca989a0`
- [x] Tier: `tier:standard` — behavior is decided, but responsive badge markup and shared summary helpers require normal implementation judgment
- [x] Seeded draft PR decision recorded: skipped — issue-only handoff avoids anchoring the worker while adjacent dashboard work remains queued

## Origin

- **Created:** 2026-09-09
- **Session:** OpenCode interactive session
- **Created by:** AI interactive
- **Parent task:** None; source issue GH#125
- **Blocked by:** None
- **Conversation context:** Maintainer review accepted the requested summary expansion while preserving the existing rule that field-placement percentages are not USPSA class equivalents.

## What

Replace the flat `A equivalent` badge treatment with an accessible visual form equivalent to `≈ A Class`, where the class code is visually prominent and `Class` is secondary. Extend eligible performance badges and add best/worst insight tiles so the Non-Classifier Stage Trend and Placement Over Time sections each render four responsive tiles.

Official classifier percentages must remain distinguishable from unofficial match-performance shorthand. Placement percentages must gain best/worst context without receiving class badges.

## Why

GH#125 asks for clearer class shorthand and broader summary coverage. The current shared badge renderer uses flat wording, Recent match score omits a badge, and the placement and non-classifier summary generators return only two tiles.

## Tier

### Tier checklist

- [ ] **Exact execution contract supplied?** The semantic boundary and call sites are fixed, but responsive markup is not prescribed verbatim.
- [x] **Targets and reference pattern verified?** Shared helpers and existing responsive tiles were inspected at current HEAD.
- [x] **No semantic or design decision remains?** Official, unofficial, and ineligible metric behavior is decided below.
- [x] **Bounded, reversible, low-consequence impact?** Presentation and derived summaries only; no stored data changes.
- [x] **No stateful coordination to invent?** All values derive from the existing filtered arrays.
- [x] **Focused verification and rollback are explicit?** Commands and revert path are listed.
- [x] **No dispatch-path risk override?** No aidevops dispatch files are in scope.

**Selected tier:** `tier:standard`

**Tier rationale:** This is bounded UI work following established helpers, but the worker must adapt markup and responsive CSS rather than copy a complete replacement.

## PR Conventions

This is a leaf task. The implementation PR must use `Resolves #125`.

## Seeded Draft PR

- **Decision:** Skipped
- **Rationale:** A complete issue and brief are sufficient; no implementation seed is needed.
- **Status:** `not-created`
- **Freshness evidence:** Memory, PR collision, source, test, and design checks were completed against `ca989a0`.
- **Verification run:** `node --test tests/dashboard-summaries.test.js tests/time-percentage.test.js` passed 5/5 during review.
- **Stale-assumption warning:** Re-check the affected helpers if another dashboard-summary PR lands first.

## How (Approach)

### Files to Modify

- `EDIT: extension/dashboard-summaries.js:20-37,93-147,205-267,312-361` — update badge markup and add badges/best/worst tiles at eligible call sites.
- `EDIT: extension/dashboard.html:275-282,493-520,1718-1742` — style the badge hierarchy and make the affected summaries four-column on wide layouts while retaining narrow stacking.
- `EDIT: tests/dashboard-summaries.test.js:1-32` — cover exact official/unofficial wording, eligibility, and best/worst summary output.
- `EDIT: DESIGN.md:65-88` — record the updated badge form and four-tile summary behavior.
- `EDIT: README.md:59-61,162-188` — update user-facing summary and badge explanations.

### Complete Write Surface

- **Callers/readers:** `extension/dashboard.js` calls `generateSummaries`; `extension/dashboard-summaries.js` owns `_scoreTiles`, `_placementTiles`, `_nonClassifierTiles`, and `_classifierTiles`; `extension/dashboard.html` renders their target containers.
- **Writers/mutation paths:** `_renderSummary` writes generated tile HTML into the six summary containers. No storage or network writer changes are involved.
- **Tests/fixtures:** `tests/dashboard-summaries.test.js` loads the helper in a VM; dashboard visual behavior is exercised by loading the extension dashboard. No separate fixtures exist for these derived summaries.
- **Schemas/config:** `extension/dashboard-summaries.js` derives values from the existing record shape; no schema or configuration writer is changed.
- **Generated/deployed mirrors:** `extension/dashboard.html` and `extension/dashboard-summaries.js` are packaged directly; repository search found no generated mirror to update.
- **Migrations/backfills:** `extension/dashboard-summaries.js` reads existing records without changing their shape, so repository evidence shows no migration or backfill path.
- **Cleanup/rollback paths:** Revert `extension/dashboard-summaries.js`, `extension/dashboard.html`, tests, and docs together; cached user data requires no cleanup.

### Implementation Steps

1. Refactor `_classBadge(percent, kind)` to emit nested, escaped markup with accessible text. Unofficial match-derived values display the requested approximation symbol before a prominent class code and secondary `Class`; official classifier values display the class without approximation. Match-relative classifier fallback remains unbadged.
2. Pass `_classBadge(recentRaw.recentAvg)` into Recent match score when the comparison exists. Add equivalent badges only to higher-is-better normalized performance values.
3. Add reusable best/worst context tiles for finite values. Use them in Non-Classifier Stage Trend with unofficial performance badges. Use them in Placement Over Time without class badges and describe values as field beaten.
4. Keep Classifier vs Match Performance at four tiles. Preserve official class treatment for valid `clf_pct`, add unofficial treatment only to eligible match-finish percentages, and never badge correlation.
5. Apply the existing `chart-summary--wide` responsive grid pattern to the expanded sections, add hierarchy styles that work in both themes, then update DESIGN.md and README.md.
6. Extend focused tests for badge semantics, empty arrays, best/worst values, and the negative placement-badge guarantee.

### Hazards and Compatibility

- **Concurrency/atomicity:** Rendering is synchronous from one filtered snapshot; derive every new tile from the same arrays already used by its chart.
- **Migration/rollback:** No migration. A revert restores prior markup without touching cached scores.
- **Mixed-version/backward compatibility:** Older cached records remain valid because no record shape changes. Missing values must still render unavailable rather than zero.
- **Idempotency/retry:** Repeated rendering replaces container HTML through `_renderSummary`; do not append outside that path.
- **Partial failure/recovery:** A missing or non-finite metric must produce an unavailable tile and must not prevent other summaries from rendering.

### Verification Before Dispatch

```bash
node --check extension/dashboard-summaries.js
node --check extension/dashboard.js
node --test tests/dashboard-summaries.test.js
node --test tests/*.test.js
git diff --check
```

- **Surface mapping:** Syntax checks cover both script boundaries; the focused test proves summary generation and badge semantics; the existing suite protects shared analytics behavior; `git diff --check` protects patch formatting.
- **Broad verification trigger:** The shared summary helper serves multiple charts, so the existing repository test suite is justified after the focused test passes.
- **UI verification:** Load the extension and inspect eligible/ineligible badges and two expanded summaries in light and dark themes at approximately 375px, 1920px, and 2560px. Confirm readable focus and no horizontal overflow. Update DESIGN.md in the same PR.

### Recoverability Checkpoint

- [ ] Focused functional verification passes: `node --test tests/dashboard-summaries.test.js`
- [ ] WIP commit created before broad gates: `wip: expand performance summaries`
- [ ] Evidence-triggered broad verification then run: `node --test tests/*.test.js`

**Hard boundaries:** Placement/field-beaten percentages never receive USPSA class badges. Official classifier percentages never receive an approximation symbol.

**AI brief owner:** Interactive maintainer session for GH#125.

**Recovery:** Preserve the worker PR and report any contradiction with DESIGN.md rather than silently weakening the semantic boundary.

### Files Scope

- `extension/dashboard-summaries.js`
- `extension/dashboard.html`
- `tests/dashboard-summaries.test.js`
- `DESIGN.md`
- `README.md`

## Acceptance Criteria

- [ ] Eligible unofficial match and non-classifier performance values display an accessible `≈ A Class`-style badge with a prominent class code and secondary `Class` label.
- [ ] Official `clf_pct` values display official class wording without `≈`; match-relative fallback values do not appear official.
- [ ] Non-Classifier Stage Trend and Placement Over Time each render four responsive tiles including best and worst finite values.
- [ ] Placement, correlation, variance, counts, and unavailable values receive no class badge; missing values are not treated as zero.
- [ ] The dashboard remains readable without color, in both themes, and at narrow and wide widths without horizontal overflow.
- [ ] Focused and existing repository tests pass, and DESIGN.md plus README.md match the delivered behavior.

## Context & Decisions

- PR #114 established one shared class-band mapping and the official/unofficial distinction.
- GH#125 changes presentation and eligible coverage, not threshold calculations.
- The request to badge placement was constrained during maintainer review because field percentile is not equivalent to percentage of USPSA high hit factor.

## Relevant Files

- `extension/dashboard-summaries.js:32-36` — shared badge renderer.
- `extension/dashboard-summaries.js:205-267` — score, placement, and non-classifier tile generators.
- `extension/dashboard-summaries.js:312-361` — classifier and match-performance tiles.
- `extension/dashboard.html:275-282` — badge styles.
- `extension/dashboard.html:493-520` — responsive summary-grid pattern.
- `tests/dashboard-summaries.test.js:1-32` — existing class-boundary test harness.
- `DESIGN.md:80-88` — semantic rules that the implementation must update without weakening placement safeguards.

## Dependencies

- **Blocked by:** None
- **Blocks:** t15 / GH#126, to avoid concurrent edits to dashboard UI and documentation files
- **External:** None

## Estimate Breakdown

| Phase | Time | Notes |
|---|---:|---|
| Research/read | 15m | Reconfirm helper call sites and current styles |
| Implementation | 60m | Shared markup, tiles, CSS, tests, and docs |
| Verification | 30m | Focused/full tests and responsive theme checks |
| **Total** | **1h 45m** | |
