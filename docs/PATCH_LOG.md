# Patch Log

This file records intentional changes made during the Lovable-to-Codex transition.

## Format

Each entry should include date, branch, summary, files changed, whether behavior changed, business-critical areas touched, tests/checks run, and follow-up needed.

## Entries

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
