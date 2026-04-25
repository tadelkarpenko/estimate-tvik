# Lovable To Codex Migration

## Goal

Move TVIK Estimator from prototype-driven Lovable development into a controlled GitHub/Codex engineering workflow without breaking working app behavior.

Lovable is useful for fast feature creation. Codex/GitHub should become the control layer for source-controlled implementation, review, tests, and release discipline.

## Current Prototype Characteristics

The app already includes React/Vite, Supabase Auth and database tables, estimate creation, cost and risk libraries, deterministic cost and risk engines, AI intake, review queue behavior, contracts, jobs, and PDF/proposal generation.

The main risk is that important workflows are concentrated in large files, especially `src/pages/NewEstimate.tsx` and `src/components/AIIntakePanel.tsx`.

## Target Workflow

1. Work from GitHub branches.
2. Keep patches small.
3. Document intended behavior before changing business logic.
4. Add tests around deterministic calculations before refactoring.
5. Use pull requests for review.
6. Keep AI-generated changes behind human approval.
7. Treat estimate and proposal records as business-critical.

## Codex Should Do

- Inspect and document the repo.
- Add tests.
- Refactor small sections after tests exist.
- Add guardrails around approval-sensitive flows.
- Fix narrow bugs.
- Create migration notes and patch logs.
- Prepare pull requests.

## Codex Should Not Do

- Rewrite the app broadly.
- Change pricing formulas without explicit approval.
- Change proposal wording that creates legal or financial commitments without human review.
- Merge internal financial details into client-facing documents.
- Remove working Lovable functionality simply because the code is large.

## Recommended Migration Phases

### Phase 1: Inventory And Guardrails

Create docs in `docs/`, add `AGENTS.md`, add `.env.example`, and document data model, AI contracts, workflows, and tests.

### Phase 2: Safety Tests

Add focused tests for cost engine totals, risk engine totals, estimate status transitions, public/internal PDF boundaries, and AI suggestion approval flow.

### Phase 3: Approval Gates

Verify gates for sending proposals, accepting estimates, applying AI suggestions, and updating exclusions, allowances, risk notes, or client-facing commitments.

### Phase 4: Small Refactors

After tests exist, split `src/pages/NewEstimate.tsx`, split `src/components/AIIntakePanel.tsx`, centralize Supabase Edge Function calls, and centralize proposal output escaping.

### Phase 5: Release Discipline

Use GitHub pull requests, keep `docs/PATCH_LOG.md` current, require test results in PR notes, and require owner review for pricing, approval, contract, and client-facing changes.

## Branch Strategy

- `main`: stable working app.
- `codex-transition`: migration and stabilization branch.
- `codex/<short-task-name>`: small focused implementation branches.
