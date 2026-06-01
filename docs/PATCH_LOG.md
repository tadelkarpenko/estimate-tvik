# Patch Log

This file records intentional changes made during the Lovable-to-Codex transition.

## Format

Each entry should include date, branch, summary, files changed, whether behavior changed, business-critical areas touched, tests/checks run, and follow-up needed.

## Entries

### 2026-06-01 - P0 Scope Mismatch Warning-Only Runtime Patch

Branch: `codex-transition`

Patch name:

Deterministic Scope Mismatch Warning Shell

Purpose:

- Added warning-only deterministic scope mismatch detection for `deck_staining` and `windows_doors`.
- Displays an owner-facing `Scope mismatch warning` on New Estimate when a narrow service includes likely unrelated trades.
- Preserves estimator control by warning only; it does not block save, approval, sending, proposal use, or PDF generation.

Files changed:

- `src/lib/scopeMismatchEngine.ts`
- `src/lib/scopeMismatchEngine.test.ts`
- `src/pages/NewEstimate.tsx`

Behavior changed: yes, warning-only UI/helper behavior

Business-critical areas touched:

- Pricing changed: no.
- Cost engine changed: no.
- Database/schema changed: no.
- PDF/proposal behavior changed: no.
- Approval/status behavior changed: no.
- AI runtime changed: no.
- Migrations changed: no.
- Auth/security changed: no.
- No line items are mutated by the warning helper.
- No health-check records are written by this patch.

Tests or checks run:

- `src/lib/scopeMismatchEngine.test.ts` unit tests added.
- Local test/build verification required before commit.

Follow-up needed:

- Before commit, run `npm.cmd test` and `npm.cmd run build`.
- Next safe patch should keep scope-mismatch health-check reporting warning-only unless approval/status workflow changes are separately reviewed and approved.

### 2026-06-01 - Service Classification Cost Library QA Source Package

Branch: `codex-transition`

Patch name:

Service Classification + Cost Library QA Docs Integration

Purpose:

- Integrated the TVIK Service Classification + Cost Library QA Package v1 into repo documentation.
- Preserved the package as source material for future `service_slug` classification, allowed/blocked trade rules, required input checklists, measurement/unit rules, cost-library QA, assembly/recipe structure, scope mismatch health checks, PDF safety, AI boundary rules, golden regression tests, and TVIK-owned Buildxact-inspired workflow planning.
- Kept Buildxact framed only as a public workflow and UI benchmark.

Files changed:

- `docs/TVIK_SERVICE_CLASSIFICATION_COST_LIBRARY_QA_MASTER_v1.md`
- `docs/CHATGPT_PROJECT_INSTRUCTIONS_TVIK_ESTIMATOR_BUILDXACT_MODE.md`
- `docs/CHATGPT_SOURCE_MEMORY_TVIK_ESTIMATOR_BUILDXACT_MODE.md`
- `docs/BUILDXACT_UI_AND_WORKFLOW_BENCHMARK.md`
- `docs/SERVICE_CLASSIFICATION_MATRIX.csv`
- `docs/COST_LIBRARY_QA_CHECKLIST.csv`
- `docs/SERVICE_GOLDEN_TEST_CASES.csv`
- `docs/CODEX_PROMPTS_SERVICE_CLASSIFICATION_v1.md`
- `docs/IMPLEMENTATION_SEQUENCE_SERVICE_CLASSIFICATION.md`
- `docs/ARTIFACT_PACKAGE_MANIFEST.md`
- `docs/PACKAGE_SUMMARY.json`
- `docs/PATCH_LOG.md`

Behavior changed: no

Business-critical areas touched:

- Documentation/source artifacts only.
- No runtime application code changed.
- No `src/` files changed.
- No Supabase functions changed.
- No migrations or database schema changed.
- No pricing calculations changed.
- No cost engine behavior changed.
- No proposal/PDF behavior changed.
- No approval/status workflow changed.
- No AI runtime behavior changed.
- No auth/security logic changed.
- No service classification or cost-library filtering was implemented in code.

Tests or checks run:

- `git status --short`
- No runtime tests run. Documentation-only change.

Follow-up needed:

- Review the integrated source package.
- Use the implementation sequence doc to plan the first report-only or warning-only service classification patch.
- Do not calibrate pricing until service classification and cost-library filtering are stable.

### 2026-06-01 - Deck Staining Failure Documentation Integration

Branch: `codex-transition`

Patch name:

Deck Staining Docs-Only Integration

Purpose:

- Document the confirmed EST-0016 deck-staining pricing/scope failure.
- Preserve the attached TVIK Deck Staining Pricing + Scope Library Package v1 as repo documentation.
- Define the safe implementation path before any pricing, generation, health-check, approval, or proposal/PDF runtime changes.

Files changed:

- `docs/PRICING_FAILURE_ANALYSIS_DECK_STAINING.md`
- `docs/DECK_STAINING_SCOPE_AND_ASSEMBLY_SPEC.md`
- `docs/SERVICE_CLASSIFICATION_AND_TRADE_FILTER_RULES.md`
- `docs/COST_LIBRARY_RESTRUCTURE_PLAN.md`
- `docs/ESTIMATE_HEALTH_CHECK_SCOPE_MISMATCH_RULES.md`
- `docs/DECK_STAINING_GOLDEN_TEST_CASES.md`
- `docs/PATCH_LOG.md`

Behavior changed: no

Business-critical areas touched:

- Documentation only.
- No runtime code changed.
- No pricing logic changed.
- No estimator calculations changed.
- No approval/status logic changed.
- No proposal/PDF logic changed.
- No AI runtime or writeback logic changed.
- No Supabase functions changed.
- No migrations or database schema changed.
- No auth/security logic changed.
- No existing estimate records changed.

Root-cause summary documented:

- EST-0016 was intended as deck staining / deck refinishing.
- The bad line items came from seeded `Full Rehab` cost-library rows selected by deterministic cost-library matching.
- `250 sf` was propagated by `qty_rule = sqft` using the estimate square footage.
- Generated deterministic rows were labeled `CostLibrary`.
- Public PDF inclusion currently behaves as checked unless explicitly false.
- Existing classification fields do not yet include `service_slug`, `trade_family`, or a `deck_staining` filter.
- Existing health checks do not yet detect deck-staining scope mismatch.

Tests or checks run:

- `git status --short`
- No runtime tests run. Documentation-only change.

Follow-up needed:

- Add warning/report health-check behavior for deck-staining scope mismatch.
- Add service classification and trade filtering for `deck_staining`.
- Add deck-staining assembly and cost-library rows after docs and tests are accepted.
- Add golden tests before pricing calibration.
- Keep proposal/PDF polish as a later explicit patch.

### 2026-04-24 - Documentation Foundation

Branch: `codex-transition`

Summary:

- Added documentation-only files to support migration from Lovable prototype behavior into a controlled GitHub/Codex workflow.
- No app behavior changed.

Files changed:

- `docs/TVIK_MASTER_BLUEPRINT.md`
- `docs/LOVABLE_TO_CODEX_MIGRATION.md`
- `docs/DATA_MODEL.md`
- `docs/AI_INTAKE_CONTRACTS.md`
- `docs/WORKFLOW_MAP.md`
- `docs/TEST_PLAN.md`
- `docs/PATCH_LOG.md`
- `AGENTS.md`
- `.env.example`

Behavior changed: no

Business-critical areas touched:

- Documentation only.
- No pricing, approval, proposal, revision, estimate, contract, or client-facing runtime code changed.

Tests or checks run:

- Not run. Documentation-only change.

Follow-up needed:

- Add focused tests for deterministic cost and risk engines.
- Add safety checks around proposal output and AI review gates.
- Keep this patch log updated for future Codex changes.

### 2026-04-25 - Project Classification Patch

Branch: `codex-transition`

Commit message:

`Add project classification fields to new estimate`

Patch name:

Project Classification Patch

Purpose:

- Replace the old vague Project Type workflow on new estimates with a clearer, professional estimator classification section.
- Help the estimator describe the project using three separate business concepts instead of one broad type.
- Remove `Small Job` from new selectable workflows while preserving compatibility for legacy records that may still contain `Small Job`.

Files changed:

- `src/pages/NewEstimate.tsx`

Fields added to the new estimate workflow:

- Project Category
- Scope Class
- Job Size / Complexity

Project Category options:

- Full Renovation
- Kitchen Renovation
- Bathroom Renovation
- Basement / Lower Level Finish
- Interior Refresh
- Exterior Renovation
- Roofing / Siding / Gutters
- Windows / Doors
- Structural / Framing
- Plumbing Scope
- Electrical Scope
- HVAC Scope
- Water / Moisture / Damage Repair
- Punch List / Repair Scope
- Custom Scope

Scope Class options:

- Full-Scope Multi-Trade
- Single-Room Remodel
- Multi-Room Remodel
- Single-Trade Scope
- Repair / Correction
- Replacement / Install
- Finish Upgrade
- Diagnostic / Site Visit
- Insurance / Damage Scope
- Punch List / Closeout

Job Size / Complexity options:

- Quick Repair
- Minor Scope
- Standard Scope
- Complex Scope
- Full Project

UI location:

- New Estimate page.
- Section title: `Project Classification`.
- Helper text:
  - Project Category: high-level project type.
  - Scope Class: internal estimating logic.
  - Job Size / Complexity: expected scope scale and estimating difficulty.

What was intentionally not changed:

- Pricing logic.
- Estimator calculations.
- `src/lib/costEngine.ts`.
- `src/lib/pdfGenerator.ts`.
- Proposal/PDF generation.
- Approval workflow.
- Supabase migrations.
- Database schema.
- Package files.
- Client-facing send behavior.
- Legacy `Small Job` data compatibility.

Manual test checklist:

- Open the app locally at `localhost`.
- Go to `/estimates/new`.
- Confirm the `Project Classification` section is visible.
- Confirm `Project Category`, `Scope Class`, and `Job Size / Complexity` are shown together.
- Confirm `Small Job` is not available as a new selectable Project Category.
- Select values in all three classification fields.
- Save a draft estimate.
- Reopen the saved draft and confirm selected classification values remain visible.
- Open an existing estimate that may contain legacy `Small Job` data and confirm it still loads.
- Confirm no proposal/PDF send action is triggered by changing these fields.

Build/test notes:

- Local baseline before this patch confirmed:
  - `npm install` works.
  - `npm run build` passed.
  - App runs locally at `localhost`.
  - PWA / field app mode opens.
- `npm run lint` still fails because of existing baseline lint errors.
- Lint cleanup was intentionally not included in this patch.

Risk notes:

- This is a low-risk UI/data classification patch.
- Main risk is confusion between new classification fields and the legacy internal `project_type` field.
- `Small Job` must remain supported internally for old estimates, cost library seed records, and historical data.
- Future patches should be careful not to remove legacy compatibility until all old estimate data has been audited.

Recommended next patch:

- Create a small, low-risk lint cleanup patch limited to display/UI files.
- Do not touch pricing, estimator calculations, PDF/proposal logic, approval workflow, Supabase migrations, or client-facing send behavior in that cleanup patch.
