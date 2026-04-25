# Data Model

## Storage Layer

The app uses Supabase, not local-only browser state.

Important files:

- Supabase client: `src/integrations/supabase/client.ts`
- Generated Supabase types: `src/integrations/supabase/types.ts`
- Estimate/cost/risk storage: `src/lib/store.ts`
- Contract storage: `src/lib/contractStore.ts`
- Job storage: `src/lib/jobStore.ts`

## Main Tables

### `estimates`

Business-critical estimate records.

Used by `src/lib/store.ts`, `src/pages/NewEstimate.tsx`, `src/pages/EstimatesList.tsx`, and `src/pages/Dashboard.tsx`.

Important fields include client details, project details, classification, measurements, deterministic totals, status, version, AI summaries, and proposal-related text.

Control note: changes to totals, status, approvals, risk, exclusions, allowances, and client-facing commitments must be reviewable, approval-gated, auditable, and version-aware.

### `estimate_line_items`

Canonical estimate line items.

Used by `src/lib/store.ts`, `src/lib/costEngine.ts`, `src/pages/NewEstimate.tsx`, and `src/lib/pdfGenerator.ts`.

Important fields include phase, description, unit, quantity, labor cost, material cost, totals, source, lock status, pending confirmation, confidence, evidence source, and public/internal PDF flags.

Control note: AI may suggest line items, but must not finalize pricing or invent measurements.

### `cost_library`

Pricing source library for deterministic estimate generation.

Used by `src/lib/store.ts`, `src/lib/costEngine.ts`, and `src/pages/CostLibraryPage.tsx`.

Cost library rows affect deterministic totals and should be treated as pricing controls.

### `risk_library`

Risk exposure source library.

Used by `src/lib/store.ts`, `src/lib/riskEngine.ts`, and `src/pages/RiskLibraryPage.tsx`.

### `revision_logs`

Estimate revision history.

Used by `src/lib/store.ts` and `src/pages/NewEstimate.tsx`.

### `cost_audits`

AI or system-generated pricing/audit findings.

Used by `src/lib/store.ts`, `src/lib/generators.ts`, and `src/pages/Dashboard.tsx`.

### `estimate_media`

Photos/media attached to an estimate.

Used by `src/lib/store.ts`, `src/pages/NewEstimate.tsx`, and `src/components/MediaUploader.tsx`.

### `estimate_chat_threads` and `estimate_chat_messages`

Estimator assistant conversation records.

Used by `src/lib/store.ts` and `src/pages/NewEstimate.tsx`.

### `ai_suggestions_queue`

AI-created suggestions awaiting human review.

Used by `src/pages/ReviewQueuePage.tsx`, `src/components/AIIntakePanel.tsx`, and related helpers such as `src/lib/suggestionStore.ts`.

Control note: this table should remain the gate between AI advice and business records.

### `contracts`, `change_orders`, `contract_audit_log`

Contract records, change orders, and contract audit history.

Used by `src/lib/contractStore.ts` and contract pages.

### `jobs`

Job/scheduling records.

Used by `src/lib/jobStore.ts` and job pages.

## Deterministic Estimate Flow

1. Estimate form gathers inputs in `src/pages/NewEstimate.tsx`.
2. Cost library rows load from Supabase through `src/lib/store.ts`.
3. `runCostEngine` in `src/lib/costEngine.ts` produces line items and cost totals.
4. Risk library rows load from Supabase through `src/lib/store.ts`.
5. `runRiskEngine` in `src/lib/riskEngine.ts` produces risk totals.
6. Estimate record saves to `estimates`.
7. Canonical line items save to `estimate_line_items`.

## Public vs Internal Data

Client-facing outputs should use only approved public content. Internal-only data includes margin assumptions, profit fade, internal audits, internal notes, contract financial controls, and internal risk scoring.
