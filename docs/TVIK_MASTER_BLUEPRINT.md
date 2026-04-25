# TVIK Estimator Master Blueprint

## Purpose

TVIK Estimator is a business-critical estimating, proposal, contract, and job workflow application for construction work. It began with Lovable prototype speed and is now moving toward a controlled GitHub/Codex engineering workflow.

## Core Rule

Deterministic numbers come first. AI is advisory.

AI may help draft, classify, summarize, and organize work, but pricing and approval decisions must remain explainable, reviewable, and human-controlled.

## Product Areas

- Estimates: create and edit project estimates, client details, scope, notes, risks, photos, totals, and status. Main file: `src/pages/NewEstimate.tsx`.
- Cost Library: pricing source rows used by the deterministic cost engine. Files: `src/pages/CostLibraryPage.tsx`, `src/lib/store.ts`, `src/lib/costEngine.ts`.
- Risk Library: risk exposure source rows used by the deterministic risk engine. Files: `src/pages/RiskLibraryPage.tsx`, `src/lib/riskEngine.ts`.
- AI Intake: advisory intake from typed notes, voice, photos, and area observations. File: `src/components/AIIntakePanel.tsx`.
- Review Queue: human review of AI-created suggestions. File: `src/pages/ReviewQueuePage.tsx`.
- Proposals/PDFs: client-facing and internal print outputs. File: `src/lib/pdfGenerator.ts`.
- Contracts and Jobs: accepted estimates can become contracts and jobs. Files: `src/lib/contractStore.ts`, `src/lib/jobStore.ts`.

## Operating Rules

- Deterministic numbers come first; AI is advisory.
- Internal financial controls must stay separate from client-facing outputs.
- No client-facing estimate may be sent without human approval.
- Estimates are business-critical records.
- AI may draft, classify, summarize, detect risks, suggest exclusions, suggest allowances, create review-queue items, and draft proposal/email text.
- AI may not approve estimates, finalize pricing, finalize margin, send proposals, overwrite approved content, or invent measurements.
- Any feature touching totals, exclusions, allowances, risk notes, approval status, sent proposals, revisions, or client-facing commitments must be reviewable, approval-gated, auditable, and version-aware.
- Preserve existing Lovable functionality unless a change is explicitly required.
- Prefer small patches over rewrites.

## Current Technical Shape

- Frontend: React, TypeScript, Vite.
- Routing: `src/App.tsx`.
- UI: Tailwind, shadcn-style components, Radix UI, lucide icons.
- Backend/data: Supabase Auth, Supabase tables, Supabase Edge Functions.
- Core storage helpers: `src/lib/store.ts`, `src/lib/contractStore.ts`, `src/lib/jobStore.ts`.
- Deterministic estimate logic: `src/lib/costEngine.ts`, `src/lib/riskEngine.ts`.
- Main estimate workflow: `src/pages/NewEstimate.tsx`.
- AI intake workflow: `src/components/AIIntakePanel.tsx`.
- Proposal/PDF output: `src/lib/pdfGenerator.ts`.

## Engineering Direction

The migration should be controlled stabilization, not a rewrite:

1. Document current behavior.
2. Add tests around deterministic business rules.
3. Add guardrails around AI writes and approval-sensitive fields.
4. Split large modules only after tests exist.
5. Keep every patch small, reviewable, and reversible.

## Definition Of Safe Progress

A patch is safe when it has a narrow purpose, preserves current behavior unless explicitly changing it, does not mix UI redesign with business-rule changes, keeps AI behind human approval, separates internal and public outputs, and includes tests or documentation for business-critical changes.
