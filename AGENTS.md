# AGENTS.md

## Purpose

This file gives future Codex agents the operating rules for TVIK Estimator.

TVIK Estimator is a business-critical construction estimating application. Treat estimate records, pricing, approvals, proposals, contracts, and revisions with care.

## Prime Directives

- Deterministic numbers come first; AI is advisory.
- Internal financial controls must stay separate from client-facing outputs.
- No client-facing estimate may be sent without human approval.
- Estimates are business-critical records.
- Preserve existing Lovable functionality unless a change is explicitly required.
- Prefer small patches over rewrites.

## AI Permission Boundary

AI may draft text, classify scope, summarize notes/photos/voice input, detect visible risks, suggest exclusions, suggest allowances, suggest review-queue items, and draft proposal/email text for human review.

AI may not approve estimates, finalize pricing, finalize margin, send proposals, overwrite approved content, invent measurements, bypass audit/version records, or mix internal financial controls into client-facing output.

## High-Risk Areas

- `src/pages/NewEstimate.tsx`
- `src/lib/costEngine.ts`
- `src/lib/riskEngine.ts`
- `src/lib/store.ts`
- `src/lib/pdfGenerator.ts`
- `src/components/AIIntakePanel.tsx`
- `src/pages/ReviewQueuePage.tsx`
- `src/lib/contractStore.ts`
- `src/lib/jobStore.ts`

## Review-Gated Areas

Any change touching these must be reviewable, approval-gated, auditable, and version-aware:

- Totals
- Exclusions
- Allowances
- Risk notes
- Approval status
- Sent proposals
- Revisions
- Client-facing commitments
- Contract values
- Margin calculations

## Documentation Expectations

When changing behavior, update relevant docs in `docs/`.

Always update `docs/PATCH_LOG.md` for intentional patches.

## Testing Expectations

Before changing business logic, add or update tests when practical. Priority tests cover the cost engine, risk engine, estimate generation, approval/status transitions, AI suggestion review flow, and public vs internal proposal output.

If tests are not run, say so clearly in the final response.

## Patch Style

- Keep changes small and easy to review.
- Do not combine unrelated fixes.
- Do not refactor large files only for style.
- Do not remove working Lovable behavior unless the owner explicitly asks.
- Prefer documentation and tests before structural refactors.

## Environment Notes

The frontend expects Supabase environment variables. See `.env.example`.

Never commit real Supabase keys, service role keys, customer data, proposal data, or secrets.
