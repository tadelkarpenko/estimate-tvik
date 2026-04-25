# Test Plan

## Purpose

This document lists the tests TVIK Estimator should have before major refactors or business-rule changes.

## Testing Priority

Highest priority areas are deterministic totals, risk calculations, human approval gates, client-facing proposal content, AI suggestion review/writeback behavior, and estimate status/version/audit behavior.

## Existing Test Tooling

From `package.json`:

- Test runner: Vitest.
- Script: `npm run test`.
- Watch script: `npm run test:watch`.

## Unit Tests To Add First

### Cost Engine

File: `src/lib/costEngine.ts`

Cases:

- Bath estimate uses `sqft` and `fixture_count` correctly.
- Kitchen estimate uses fixture-based rows correctly.
- Small Job uses labor hours correctly.
- Finish material multiplier affects material only.
- Finish materials excluded sets matching material rows to zero.
- Labor subtotal, material subtotal, subtotal, and labor hours are deterministic.

### Risk Engine

File: `src/lib/riskEngine.ts`

Cases:

- Low, medium, and high risk levels calculate expected exposure.
- Overall risk becomes high when a high default risk is included.
- Overall risk changes correctly at threshold values.
- Empty risk library produces safe zero totals.

### Type And Mapping Helpers

File: `src/lib/types.ts`

Cases:

- `categoryToLegacyType` maps project categories to legacy engine project types.
- `normalizePhase` maps common trade words into canonical phases.

## Integration Tests To Add Next

### Estimate Generation Flow

Files: `src/pages/NewEstimate.tsx`, `src/lib/store.ts`, `src/lib/costEngine.ts`, `src/lib/riskEngine.ts`.

Cases:

- Draft save creates an estimate record.
- Generate creates estimate line items.
- Generate updates deterministic totals.
- Generate does not depend on AI success for deterministic totals.
- Failed AI call falls back safely and does not corrupt totals.

### Approval And Status Flow

Files: `src/pages/NewEstimate.tsx`, `src/lib/contractStore.ts`.

Cases:

- Draft can become Ready.
- Sent/Accepted status changes are human-triggered.
- Accepted estimate creates a contract record.
- Accepted estimate creates revision/audit evidence.
- AI cannot directly mark an estimate Accepted.

### Review Queue Flow

Files: `src/pages/ReviewQueuePage.tsx`, `src/lib/suggestionStore.ts`, `src/components/AIIntakePanel.tsx`.

Cases:

- AI-created suggestions start as pending.
- Human can approve, edit, reject, or reset.
- Approved suggestion retains evidence and reviewer decision.
- Sensitive changes require review before writeback.

## Client-Facing Output Tests

File: `src/lib/pdfGenerator.ts`

Cases:

- Public PDF excludes internal audit and margin-only content.
- Internal PDF can include internal audit and margin content.
- User-entered text is escaped before HTML output.
- Public PDF uses approved/canonical line items.
- Proposal output does not include AI-only pending suggestions.

## Manual QA Checklist

Before releasing a patch that touches estimates:

- Create a draft estimate.
- Generate deterministic totals.
- Confirm cost/risk tabs match totals.
- Add a manual line item.
- Recompute totals.
- Generate public PDF.
- Generate internal PDF.
- Confirm public PDF does not show internal financial controls.
- Create AI suggestions.
- Review, approve, edit, reject suggestions.
- Confirm no AI suggestion bypasses human approval.
- Mark estimate accepted only as a human action.
- Confirm contract record is created.

## Release Gate

A patch touching totals, exclusions, allowances, risk notes, approval status, sent proposals, revisions, or client-facing commitments should not ship unless tests or manual QA are documented, `docs/PATCH_LOG.md` is updated, and the owner reviews pricing or client-facing behavior changes.
