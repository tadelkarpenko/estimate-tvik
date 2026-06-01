# Codex Prompts — TVIK Service Classification + Cost Library QA v1

## Prompt A — Report-Only Audit

```text
You are working inside:

C:\Users\tad1k\Projects\estimate-tvik

Branch:
codex-transition

Attached/source package:
TVIK_Service_Classification_Cost_Library_QA_Package_v1.zip

Task mode:
REPORT-ONLY AUDIT.

Do not edit files.
Do not stage.
Do not commit.
Do not refactor.
Do not patch pricing.

First run:
git status --short

If not clean, stop and report changed files.

Use TVIK_SERVICE_CLASSIFICATION_COST_LIBRARY_QA_MASTER_v1.md as source of truth.

Inspect only as needed:
- current project category dropdowns
- scope class options
- cost library seed/data
- estimate generation path
- qty_rule handling
- source/phase/PDF defaults
- health check code
- New Estimate and Estimate Detail pages

Answer:
1. Where are current categories and scope classes defined?
2. Which categories can currently fall into broad Full Rehab rows?
3. Where is sqft applied to line items?
4. Where are Source, Phase, and PDF defaults assigned?
5. Does the repo have service_slug/trade_family support?
6. What is the smallest safe warning-only P0 runtime patch?
7. What tests should be added first?

Return only:
- git status
- files inspected
- root-cause map
- risk analysis
- first safe patch plan
- tests
- rollback plan
```

## Prompt B — Docs-Only Integration

```text
Use attached TVIK Service Classification + Cost Library QA Package v1.

Task mode:
DOCS ONLY.

Create/update only:
- docs/TVIK_SERVICE_CLASSIFICATION_COST_LIBRARY_QA_MASTER_v1.md
- docs/BUILDXACT_UI_AND_WORKFLOW_BENCHMARK.md
- docs/IMPLEMENTATION_SEQUENCE_SERVICE_CLASSIFICATION.md
- docs/PATCH_LOG.md

Do not edit runtime code, database, pricing, proposal/PDF, approval/status, AI runtime, migrations, auth/security.

After writing docs, run:
git status --short

Do not stage or commit.
```

## Prompt C — First Warning-Only Patch

```text
Apply only the approved warning-only scope mismatch patch.

Rules:
- Edit only the approved named files.
- Do not change pricing formulas.
- Do not change database schema.
- Do not change PDF generation.
- Do not change approval/status workflow.
- Do not stage or commit.

Goal:
If a narrow service has blocked trade rows, show a warning only.

Do not block approval yet.

After changes run:
npm.cmd test
npm.cmd run build

Return:
- files changed
- summary
- tests/build result
- risks
- rollback command
```

## Prompt D — service_slug Classification Patch

```text
Apply only the approved service_slug classification map patch.

Goal:
Derive service_slug from existing project category/service selection without database migration unless explicitly approved.

Do not change pricing.

Run:
npm.cmd test
npm.cmd run build
```

## Prompt E — Cost-Library QA Audit

```text
Audit current cost-library rows against COST_LIBRARY_QA_CHECKLIST.csv and SERVICE_CLASSIFICATION_MATRIX.csv.

Do not edit.

Return:
- rows missing service_slug/trade_family
- rows with unsafe default_included behavior
- rows using sqft too broadly
- rows likely to contaminate narrow services
- recommended CSV/data cleanup order
```

## Prompt F — Code Review Before Commit

```text
Review only the current diff.

Check for:
- runtime files changed outside approved scope
- pricing logic changes
- approval/status changes
- proposal/PDF behavior changes
- migration/database changes
- AI direct writeback risks
- test gaps

Do not edit.
Return keep/adjust/revert recommendation.
```
