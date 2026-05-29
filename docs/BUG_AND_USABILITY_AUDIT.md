# Bug And Usability Audit

## Executive Summary

TVIK Estimator is a real React/Vite/Supabase estimating app with meaningful estimator functionality already in place. It has deterministic cost and risk engines, estimate records, line items, cost and risk libraries, AI intake, a review queue, proposal/PDF output, contracts, jobs, and audit-oriented tables.

The safest current read is: the app has the right direction, but the control surfaces need hardening before business-critical use. The highest-risk areas are AI writeback, status changes, proposal output, incomplete test coverage, and the current lint/build baseline. AI is mostly framed as advisory, but there are code paths that can update estimate fields and line items after approved suggestions. Those paths need stricter guardrails, clearer status naming, and tests before any production use.

No runtime code was changed for this audit.

## Current Repo State

- Repo: `C:\Users\tad1k\Projects\estimate-tvik`
- Branch: `codex-transition`
- Existing dirty files before this audit:
  - `src/components/AIIntakePanel.tsx`
  - `supabase/functions/estimate-ai/index.ts`
- Requested documentation files were not created because repo write access failed:
  - `docs/BUG_AND_USABILITY_AUDIT.md`
  - `docs/BUILDXACT_GAP_ANALYSIS.md`
  - `docs/IMPLEMENTATION_BACKLOG.md`
- Existing documentation file confirmed present:
  - `docs/PATCH_LOG.md`

Important existing docs:

- `AGENTS.md`
- `docs/AI_INTAKE_CONTRACTS.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_PLAN.md`
- `docs/WORKFLOW_MAP.md`
- `docs/PATCH_LOG.md`

## Baseline Command Results

### `npm.cmd run build`

Result: failed before compiling the app.

Failure summary:

- Vite could not load `vite.config.ts`.
- The command reported: `Cannot read directory "../..": Access is denied.`
- It also reported it could not resolve `C:\Users\tad1k\Projects\estimate-tvik\vite.config.ts`.

Likely cause:

- The command appears blocked by the current execution environment while Vite/esbuild is loading config and trying to read a parent directory.
- This may be a local sandbox or permission issue rather than a confirmed app-code compile failure.

Affected files/modules:

- `vite.config.ts`
- Vite/esbuild startup
- Build pipeline

Recommended future fix:

- Re-run the build from a normal local terminal with normal file permissions.
- If it still fails outside this environment, inspect `vite.config.ts`, plugin resolution, and workspace path permissions.

### `npm.cmd test`

Result: failed before running tests.

Failure summary:

- Vitest could not load `vitest.config.ts`.
- The command reported: `Cannot read directory "../..": Access is denied.`
- It also reported it could not resolve `C:\Users\tad1k\Projects\estimate-tvik\vitest.config.ts`.

Likely cause:

- Same likely environment/config-loading permission issue as the build command.

Affected files/modules:

- `vitest.config.ts`
- Vitest/esbuild startup
- Test pipeline

Recommended future fix:

- Re-run tests from a normal local terminal.
- After startup works, add focused tests for cost engine, risk engine, status gates, proposal output, and AI suggestion/writeback behavior.

### `npm.cmd run lint`

Result: failed.

Failure summary:

- ESLint ran and reported 278 problems:
  - 264 errors
  - 14 warnings
- The largest class of errors is `@typescript-eslint/no-explicit-any`.
- Other errors include empty block statements, an empty interface type, `prefer-const`, and a forbidden `require()` import in `tailwind.config.ts`.

Likely cause:

- Existing migration/prototype code has broad `any` usage, especially around Supabase row mapping, AI payloads, writeback, and large UI components.

Affected files/modules:

- `src/components/AIIntakePanel.tsx`
- `src/pages/NewEstimate.tsx`
- `src/pages/ReviewQueuePage.tsx`
- `src/lib/store.ts`
- `src/lib/writebackEngine.ts`
- `src/lib/writePlanStore.ts`
- `src/lib/pdfGenerator.ts`
- `src/lib/reliabilityEngine.ts`
- Contract/job/reporting files
- Supabase functions
- UI component wrappers

Recommended future fix:

- Do not do one large lint rewrite.
- First fix low-risk UI/component lint issues.
- Then add typed AI payload and Supabase row types.
- Treat AI writeback, pricing, status, and proposal files as high-risk and test them before lint refactors.

## Critical Bugs

### 1. Build and test startup are not currently verified

The build and test commands did not reach app compilation or test execution in this audit. Until they run cleanly, there is no trustworthy automated baseline.

Business risk:

- A future change could break the app without being detected.
- The current permission/config failure hides real compile or test failures.

Recommended future fix:

- Re-run build and test outside the restricted execution environment.
- Record the true baseline result in `docs/PATCH_LOG.md`.

### 2. AI writeback can update estimate fields and line items after approval workflow steps

Files:

- `src/components/AIIntakePanel.tsx`
- `src/lib/writePlanStore.ts`
- `src/lib/writebackEngine.ts`
- `src/lib/suggestionStore.ts`

Observed risk:

- The app has a review queue and write-plan concept, which is good.
- However, approved queue items can become write plans, and writeback can update estimate fields or add/edit line items.
- There are version checks and audit inserts, but the future fix should verify that approved/accepted/sent estimates cannot be overwritten by AI without explicit human reapproval.

Business risk:

- Client-facing commitments, exclusions, allowances, risk notes, or line items could drift after approval.

Recommended future fix:

- Add tests proving approved or sent estimates cannot be directly changed by AI writeback.
- Add clear lock rules for `Sent` and `Accepted`.
- Make reapproval explicit and visible to the owner.

### 3. Status language is inconsistent with owner rules

Files:

- `src/lib/types.ts`
- `src/pages/NewEstimate.tsx`
- `src/lib/reliabilityEngine.ts`
- `src/lib/writebackEngine.ts`

Observed risk:

- The app uses statuses: `Draft`, `Ready`, `Sent`, `Accepted`, `Rejected`.
- Some writeback logic checks for `Approved` and `Sent`, but `Approved` is not part of the current `EstimateStatus` type.
- Owner rules mention Approved and Sent, while the app uses Accepted as the main final approval/contract conversion status.

Business risk:

- A rule meant to protect approved estimates may not run if the actual app status is `Accepted`.

Recommended future fix:

- Decide whether the app uses `Approved`, `Accepted`, or both.
- Create a status transition map and tests.
- Ensure AI writeback blocks or reapproval logic covers the exact statuses used by the app.

## Functional Gaps

- No confirmed passing build/test baseline in this audit.
- No visible dedicated test coverage for cost/risk totals, approval gates, PDF public/internal separation, or AI writeback.
- Estimator workflow is concentrated in large files, especially `src/pages/NewEstimate.tsx` and `src/components/AIIntakePanel.tsx`.
- Review queue exists, but the distinction between approving a suggestion and approving/sending an estimate needs stronger enforcement.
- Proposal/PDF generation exists, but output should be tested for escaping, client/internal separation, and pending AI suggestion exclusion.
- Cost library exists, but assembly-style estimating appears limited.
- Reporting exists in dashboard form, but deeper estimate profitability/reporting is not yet mature.

## Usability Issues

- `src/pages/NewEstimate.tsx` appears to hold many workflows in one screen: client details, classification, generation, AI, media, line items, PDF, status, revisions, and job conversion.
- AI intake appears feature-rich but likely dense for a non-technical owner.
- Review queue has multiple filters and states; it may need clearer language separating:
  - AI suggested
  - human approved suggestion
  - applied to estimate
  - estimate approved/sent
- Status buttons such as Mark as Sent and Mark as Accepted appear in the estimate workflow. These need a clear confirmation step and audit note before use.
- Public/internal PDF buttons are near estimate work; there should be a strong visual boundary so internal output is not sent to a client by mistake.

## AI Intake / Review Queue Risks

Strengths:

- AI is documented as advisory.
- AI suggestions can be queued.
- Suggestions can be approved, edited, rejected, or applied.
- Write plans include version and audit concepts.

Risks:

- AI payloads use broad `any` typing, which makes malformed AI responses harder to catch.
- Some AI analysis can update local form state or saved estimate fields when not approved/accepted.
- Approved suggestions may still need a second gate before they affect client-facing commitments.
- The app should ensure AI never invents measurements or prices.
- Post-write checks should create review items, not silently fix business records.

Recommended future fix:

- Add strict AI response schemas.
- Add tests for pending, approved, edited, rejected, applied, and blocked states.
- Require human confirmation for any material writeback.
- Block direct AI mutation of `Sent` and `Accepted` estimates.

## Pricing / Margin / Calculation Risks

Strengths:

- Deterministic cost logic exists in `src/lib/costEngine.ts`.
- Deterministic risk logic exists in `src/lib/riskEngine.ts`.
- Cost library and risk library tables exist.
- `src/pages/NewEstimate.tsx` runs cost first, then risk, then margin.

Risks:

- Manual and AI-added line items can affect totals after initial generation.
- The recompute path should be covered by tests.
- Margin fields are editable in the UI, so sending should be gated by margin checks and owner approval.
- Pricing intelligence should remain advisory and should not directly alter cost library rows without review.

Recommended future fix:

- Add tests for cost engine totals, risk engine totals, manual line item recompute, and margin gate.
- Add audit records for changes to pricing-sensitive fields.

## Approval / Status Workflow Risks

Strengths:

- There is an approval gate helper in `src/lib/reliabilityEngine.ts`.
- Sent and Accepted status changes are human-triggered in the UI.
- Accepted estimate creates contract-related records.

Risks:

- Status transition rules are not centralized.
- Status terminology does not fully match the owner rule vocabulary.
- Mark as Sent and Mark as Accepted should require explicit confirmation and audit context.
- AI writeback reapproval logic should include the actual final statuses used by the app.

Recommended future fix:

- Create a central status transition engine.
- Add tests for all allowed and blocked transitions.
- Require an audit note for Sent and Accepted.

## Proposal / Client Output Risks

Strengths:

- Public and internal PDF functions are separated in `src/lib/pdfGenerator.ts`.
- Public line items can be filtered using `include_in_public_pdf`.
- Internal PDF can include internal risk/audit content.

Risks:

- PDF generation uses HTML strings and `window.open`; user-provided text should be escaped consistently.
- Public PDF should never include internal audit, margin notes, pending AI suggestions, or unresolved review items.
- Proposal output should be blocked or strongly warned when approval gate fails.

Recommended future fix:

- Add tests for public vs internal output.
- Escape all user-entered/client-entered/AI-entered content before HTML output.
- Add a final proposal review screen before sent status.

## Security / Environment Risks

- `.env` exists locally and should never be committed.
- `.env.example` exists, which is good.
- Frontend uses publishable Supabase key variables.
- Supabase Edge Functions use service role keys inside server-side functions, which is expected, but those keys must never enter frontend code.
- Build/test failures may be caused by local permission/sandbox behavior and should be verified outside this audit environment.

Recommended future fix:

- Confirm `.env` is ignored by Git.
- Review Supabase RLS policies for all estimate, AI suggestion, audit, contract, and job tables.
- Ensure Edge Functions never return secrets or internal-only financial controls.

## Recommended Fix Priority

### P0

- Re-run build and test from a normal local terminal.
- Document the true baseline.
- Add status/approval tests before changing approval behavior.
- Add public/internal PDF safety tests.
- Lock AI writeback so `Sent` and `Accepted` records cannot be overwritten by AI.

### P1

- Centralize status transition rules.
- Harden AI writeback so protected records require explicit revision/reapproval.
- Add typed schemas for AI response payloads.
- Add audit requirements for pricing-sensitive and client-facing changes.

### P2

- Split `NewEstimate.tsx` into smaller workflow sections.
- Split `AIIntakePanel.tsx` into smaller panels and services.
- Improve owner-facing labels around review queue states.
- Structure allowances, exclusions, assumptions, and clauses.

### P3

- Expand reporting, scheduling, assemblies, proposal package features, and Buildxact-style workflow polish.

## Do Not Touch / Protected Areas

Do not change these without explicit owner approval and tests:

- `src/components/AIIntakePanel.tsx`
- `supabase/functions/estimate-ai/index.ts`
- `src/pages/NewEstimate.tsx`
- `src/lib/costEngine.ts`
- `src/lib/riskEngine.ts`
- `src/lib/store.ts`
- `src/lib/writebackEngine.ts`
- `src/lib/writePlanStore.ts`
- `src/lib/pdfGenerator.ts`
- `src/pages/ReviewQueuePage.tsx`
- Supabase migrations
- Database schema
- Pricing formulas
- Approval/status behavior
- Proposal/PDF output
- Client-facing commitments