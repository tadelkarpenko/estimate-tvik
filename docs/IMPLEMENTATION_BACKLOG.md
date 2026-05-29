# Implementation Backlog

## Executive Summary

This backlog is intentionally control-first. TVIK Estimator should not chase new features until the current estimating, approval, proposal, and AI writeback rules are protected by tests and documentation.

The highest-priority work is making sure deterministic pricing wins, AI remains advisory, approval is human-controlled, proposal output is safe, and every material change is auditable and version-aware.

## P0 Critical Fixes

### Item P0-1: Restore trustworthy build and test baseline

Problem:

- `npm.cmd run build` and `npm.cmd test` failed before app compilation/test execution because config loading hit an access-denied read.

Business risk:

- The app cannot be safely changed without knowing whether the baseline builds and tests.

Proposed fix:

- Re-run build and tests from a normal local terminal with normal repo permissions.
- If failures remain, fix config/dependency issues before runtime feature work.

Files/modules likely involved:

- `vite.config.ts`
- `vitest.config.ts`
- `package.json`
- Local environment permissions

Acceptance criteria:

- `npm.cmd run build` completes or produces a confirmed app-code error.
- `npm.cmd test` completes or produces confirmed test failures.
- Results are recorded in `docs/PATCH_LOG.md`.

Test plan:

- Run `npm.cmd run build`.
- Run `npm.cmd test`.
- Run `npm.cmd run lint`.

Rollback plan:

- Documentation-only changes can be reverted.
- If config changes are later needed, revert the config patch and return to the last known working config.

### Item P0-2: Centralize estimate status transition rules

Problem:

- Estimate statuses are defined as `Draft`, `Ready`, `Sent`, `Accepted`, `Rejected`, but some logic references `Approved`.

Business risk:

- Controls meant to protect approved estimates may not protect the actual `Accepted` status.

Proposed fix:

- Create one status transition module that defines allowed transitions, blocked transitions, required confirmation, and required audit notes.

Files/modules likely involved:

- `src/lib/types.ts`
- `src/pages/NewEstimate.tsx`
- `src/lib/reliabilityEngine.ts`
- `src/lib/writebackEngine.ts`
- `src/lib/store.ts`

Acceptance criteria:

- All status changes call the same transition rules.
- AI cannot directly mark an estimate `Sent` or `Accepted`.
- `Sent` and `Accepted` require human action.
- Material changes to `Sent` or `Accepted` estimates require reapproval.

Test plan:

- Unit test allowed and blocked transitions.
- Integration test Mark as Sent and Mark as Accepted.
- Test AI writeback blocked or reapproval-required behavior.

Rollback plan:

- Keep old status functions available until the new module passes tests.
- Revert status module and route calls back to existing behavior if needed.

### Item P0-3: Add deterministic pricing tests

Problem:

- The cost engine and risk engine are business-critical, but no confirmed passing tests were observed in this audit.

Business risk:

- A small change could alter totals, margin, risk, or line items without detection.

Proposed fix:

- Add focused unit tests for cost and risk engines before changing pricing behavior.

Files/modules likely involved:

- `src/lib/costEngine.ts`
- `src/lib/riskEngine.ts`
- `src/lib/types.ts`
- `src/test`

Acceptance criteria:

- Tests cover Bath, Kitchen, Full Rehab, and Small Job style inputs.
- Tests verify labor subtotal, material subtotal, subtotal, labor hours, risk low/high, and duration.
- Tests prove AI is not needed for deterministic totals.

Test plan:

- Run `npm.cmd test`.
- Run `npm.cmd run build`.

Rollback plan:

- Remove only the new test files if they are incorrect.
- Do not change pricing logic in the same patch.

### Item P0-4: Protect public proposal output

Problem:

- Public/internal PDF generation exists, but public output safety needs tests.

Business risk:

- A public proposal could expose internal notes, margin, audit content, pending AI suggestions, or unescaped text.

Proposed fix:

- Add tests for public PDF content boundaries and escaping.
- Add a final proposal review gate before sent status.

Files/modules likely involved:

- `src/lib/pdfGenerator.ts`
- `src/pages/NewEstimate.tsx`
- `src/lib/reliabilityEngine.ts`

Acceptance criteria:

- Public PDF excludes internal audit/margin/internal notes.
- Internal PDF can include internal-only content.
- Pending AI suggestions are not included in public PDF.
- User-entered and AI-entered text is escaped before HTML output.

Test plan:

- Unit test generated HTML strings.
- Manual test public and internal PDF buttons.

Rollback plan:

- Revert PDF generator changes and keep tests as skipped or pending if needed.

### Item P0-5: Lock AI writeback against approved/sent records

Problem:

- AI write plans and writeback can update estimate fields and line items after suggestions are approved.

Business risk:

- AI could alter client-facing commitments after approval if gates are incomplete.

Proposed fix:

- Add a hard guard that prevents AI writeback from mutating `Sent` or `Accepted` estimates unless a human starts an explicit revision/reapproval flow.

Files/modules likely involved:

- `src/components/AIIntakePanel.tsx`
- `src/lib/writePlanStore.ts`
- `src/lib/writebackEngine.ts`
- `src/lib/suggestionStore.ts`
- `src/pages/ReviewQueuePage.tsx`

Acceptance criteria:

- AI can still create advisory suggestions for protected estimates.
- AI cannot update protected estimate fields directly.
- Attempts are logged or surfaced as requiring human revision.
- Approved estimates cannot be overwritten by AI.

Test plan:

- Unit test writeback blocked for `Sent` and `Accepted`.
- Integration test review queue apply behavior.
- Manual test AI intake on accepted estimate.

Rollback plan:

- Revert only writeback guard changes if they block legitimate drafts.
- Keep audit docs and tests to show expected behavior.

## P1 Core Estimator Workflow

### Item P1-1: Structure allowances, exclusions, assumptions, and clauses

Problem:

- Important client-facing commitments are mostly text fields.

Business risk:

- Text-only fields are hard to audit, compare, approve, and reuse.

Proposed fix:

- Create structured records or typed sections for allowances, exclusions, assumptions, and clauses.

Files/modules likely involved:

- `src/lib/types.ts`
- `src/pages/NewEstimate.tsx`
- `src/lib/store.ts`
- Supabase migrations, only after approval
- `src/lib/pdfGenerator.ts`

Acceptance criteria:

- Each item has text, source, approval status, created date, and version.
- Public PDF only includes approved client-facing items.
- AI suggestions land in review, not directly in approved sections.

Test plan:

- Unit test section filtering.
- Integration test save/load.
- PDF output test.

Rollback plan:

- Keep old text fields during migration.
- Revert new structured rendering if migration is not ready.

### Item P1-2: Add revision delta view

Problem:

- Revision logs exist, but owner-readable before/after differences are not clearly surfaced.

Business risk:

- It is hard to know what changed between versions and why.

Proposed fix:

- Add a revision comparison view showing totals, line items, exclusions, allowances, assumptions, risk notes, and proposal text changes.

Files/modules likely involved:

- `src/pages/NewEstimate.tsx`
- `src/lib/store.ts`
- `src/lib/types.ts`

Acceptance criteria:

- Owner can see previous value, new value, who changed it, when, why, and version.
- Client-facing changes are clearly marked.

Test plan:

- Create revision, change values, confirm delta.
- Test no AI-only changes appear as human-approved.

Rollback plan:

- Hide the revision view and keep raw revision logs.

### Item P1-3: Create proposal review gate

Problem:

- Public PDF can be generated and estimates can be marked sent, but a dedicated final proposal review step is not clearly separated.

Business risk:

- A proposal may be sent or marked sent before final human review.

Proposed fix:

- Add a review checklist before Mark as Sent.

Files/modules likely involved:

- `src/pages/NewEstimate.tsx`
- `src/lib/reliabilityEngine.ts`
- `src/lib/pdfGenerator.ts`

Acceptance criteria:

- Mark as Sent requires passing approval gate.
- User confirms client-facing scope, total, allowances, exclusions, and validity.
- Confirmation creates an audit/revision record.

Test plan:

- Manual test blocked and allowed sent states.
- Unit test approval gate reasons.

Rollback plan:

- Revert UI gate while leaving status transition tests in place.

## P2 Buildxact Gap Improvements

### Item P2-1: Add assembly library

Problem:

- The app has line items and a source type for assemblies, but no mature assembly builder was confirmed.

Business risk:

- Repeated scopes require manual setup and are easier to price inconsistently.

Proposed fix:

- Add assembly definitions that expand into controlled line items.

Files/modules likely involved:

- `src/lib/costEngine.ts`
- `src/lib/store.ts`
- `src/lib/types.ts`
- `src/pages/CostLibraryPage.tsx`
- New Supabase migration, only after approval

Acceptance criteria:

- Assembly includes labor/material components.
- Assembly expansion is deterministic.
- Changes to assembly pricing are versioned.

Test plan:

- Unit test assembly expansion.
- Manual test estimate generation with assembly.

Rollback plan:

- Disable assembly selection and keep line-item generation.

### Item P2-2: Add area/takeoff evidence workflow

Problem:

- Areas/photos/notes exist, but full takeoff evidence is not yet Buildxact-style.

Business risk:

- Quantities may not be traceable to measurements or evidence.

Proposed fix:

- Add measurement source fields and area-level quantity records.

Files/modules likely involved:

- `src/lib/areaStore.ts`
- `src/components/AIIntakePanel.tsx`
- `src/pages/NewEstimate.tsx`
- Supabase migrations, only after approval

Acceptance criteria:

- Quantity has source: user measured, plan measured, site confirmed, photo observation, or unknown.
- AI cannot turn unknown measurements into final quantities.

Test plan:

- Unit test measurement source validation.
- Manual test area scope to line item path.

Rollback plan:

- Keep existing area notes/photos and hide takeoff fields.

## P3 AI Intake Review Queue

### Item P3-1: Add strict AI response schemas

Problem:

- AI response handling uses broad dynamic data shapes.

Business risk:

- Malformed AI output could create confusing, unsafe, or unreviewable suggestions.

Proposed fix:

- Add schema validation for each AI response type before data reaches the app.

Files/modules likely involved:

- `src/components/AIIntakePanel.tsx`
- `src/lib/suggestionStore.ts`
- `supabase/functions/estimate-ai/index.ts`
- `src/lib/types.ts`

Acceptance criteria:

- Invalid AI response becomes an error or review note, not a writeback.
- Suggestions include source, confidence, evidence, target, and materiality.

Test plan:

- Unit test valid and invalid AI payloads.
- Manual test AI intake fallback behavior.

Rollback plan:

- Keep schema validation behind a helper and revert helper use if needed.

### Item P3-2: Separate suggestion approval from estimate approval

Problem:

- A suggestion can be approved, but that must not imply the estimate is approved or sent.

Business risk:

- Owner may confuse applying a suggestion with approving a client-facing estimate.

Proposed fix:

- Rename/reword review queue actions and add clear badges:
  - Suggested
  - Human reviewed
  - Applied to draft
  - Needs reapproval
  - Estimate approved/sent

Files/modules likely involved:

- `src/pages/ReviewQueuePage.tsx`
- `src/components/AIIntakePanel.tsx`
- `src/lib/suggestionStore.ts`

Acceptance criteria:

- UI clearly separates suggestion state from estimate status.
- Applying material suggestions to a previously sent/accepted estimate forces revision/reapproval.

Test plan:

- Manual test queue actions.
- Unit test suggestion state transitions.

Rollback plan:

- Revert label changes only.

## P4 Reporting / Analytics / Scheduling

### Item P4-1: Add estimator performance reports

Problem:

- Dashboard exists, but deeper reporting is limited.

Business risk:

- Owner cannot easily see win rate, estimate aging, margin risk, or AI suggestion quality.

Proposed fix:

- Add reports for pipeline, sent/accepted conversion, margin trend, estimate aging, and AI suggestion acceptance.

Files/modules likely involved:

- `src/pages/Dashboard.tsx`
- `src/lib/store.ts`
- `src/lib/contractStore.ts`
- Supabase views/functions, only after approval

Acceptance criteria:

- Reports are read-only.
- Reports do not mutate estimates.
- Internal financial reports are not client-facing.

Test plan:

- Unit test calculations.
- Manual dashboard smoke test.

Rollback plan:

- Hide new report widgets.

### Item P4-2: Improve job scheduling after estimate acceptance

Problem:

- Jobs and calendar exist, but scheduling depth appears early.

Business risk:

- Accepted estimates may not translate cleanly into job execution plans.

Proposed fix:

- Add job phases, crew assignments, milestones, and reminders after estimate approval is stable.

Files/modules likely involved:

- `src/lib/jobStore.ts`
- `src/pages/JobsList.tsx`
- `src/pages/JobDetail.tsx`
- `src/pages/JobCalendar.tsx`

Acceptance criteria:

- Accepted estimate can create a job.
- Job schedule references estimate phases/line items.
- Scheduling changes do not alter approved estimate pricing.

Test plan:

- Manual accepted-estimate-to-job test.
- Unit test job date/status helpers.

Rollback plan:

- Keep job creation and hide advanced scheduling controls.