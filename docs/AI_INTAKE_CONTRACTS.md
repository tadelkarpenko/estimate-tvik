# AI Intake Contracts

## Purpose

This document defines what AI is allowed to do in TVIK Estimator and what must remain under deterministic logic and human control.

AI is advisory. Deterministic numbers and human approval are authoritative.

## Allowed AI Actions

AI may draft scope text, classify project notes, summarize photos/voice/typed descriptions, detect visible risks, suggest missing information questions, suggest exclusions, suggest allowances, suggest assumptions, suggest line items for human review, create review-queue items, draft proposal/email text for human review, and summarize estimate health.

## Prohibited AI Actions

AI may not approve estimates, finalize pricing, finalize margin, send proposals, overwrite approved content, invent measurements, change accepted contracts without review, bypass versioning/audit records, or merge internal financial controls into client-facing outputs.

## Sensitive Fields

Any AI-assisted feature touching these areas must be reviewable, approval-gated, auditable, and version-aware:

- Totals
- Line item prices
- Quantities and measurements
- Exclusions
- Allowances
- Risk notes
- Approval status
- Sent proposals
- Revisions
- Client-facing commitments
- Contract values
- Margins

## Current AI Touchpoints

### Scope And Audit Generation

File: `src/lib/generators.ts`

The app calls Supabase Edge Function `estimate-ai` for scope generation and audit generation. AI may draft narrative and advisory analysis, but deterministic subtotal, risk, and total values must come from the engines and saved records.

### Estimate Page AI And Photo Analysis

File: `src/pages/NewEstimate.tsx`

The page includes photo analysis, chat assistant, suggested changes parsing, and manual review/application flows. AI suggestions should remain pending until a human reviews and applies them.

### AI Intake Panel

File: `src/components/AIIntakePanel.tsx`

The panel handles initial intake analysis, area notes, voice capture, photo/merged analysis, suggestion creation, write plans, and post-write rechecks. Intake results are advisory.

### Review Queue

File: `src/pages/ReviewQueuePage.tsx`

The review queue is the human decision layer for AI suggestions. Approval of a suggestion is not the same as sending a proposal.

## Suggested AI Response Shape

```json
{
  "summary": "Short human-readable summary",
  "confidence": "High | Medium | Low",
  "evidence_sources": ["photo", "voice", "typed notes", "cost library gap"],
  "suggestions": [
    {
      "type": "line_item | exclusion | allowance | risk_note | assumption | missing_info | internal_note",
      "suggested_value": "Human-readable suggestion",
      "apply_target": "field or section name",
      "requires_human_approval": true,
      "requires_reapproval_if_applied": true,
      "confidence": "High | Medium | Low",
      "evidence_summary": "Why AI suggested this",
      "measurement_basis": "Provided by user | visible in photo | unknown",
      "may_affect_client_commitment": true
    }
  ]
}
```

## Measurement Rule

AI must not invent measurements. Accepted sources are user-entered dimensions, existing estimate fields, human-confirmed site notes, and explicitly labeled plan/drawing measurements. Photo-only observations may ask questions or create review items, but must not finalize quantities.

## Approval Rule

No client-facing estimate may be sent without human approval.

## Versioning Rule

When approved content changes after review, the app should record what changed, who approved it, when it changed, why it changed, previous value, new value, and estimate version affected.
