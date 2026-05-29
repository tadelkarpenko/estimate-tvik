# Buildxact Gap Analysis

## Executive Summary

TVIK Estimator already has several Buildxact-style pieces: client/project setup, estimate creation, deterministic cost and risk engines, cost and risk libraries, line items, AI intake, review queue, PDFs, contracts, jobs, and dashboard reporting.

The main gap is maturity and control depth. Buildxact-like systems usually provide a guided end-to-end estimating and job workflow: takeoff, assemblies, supplier pricing, proposal package control, approvals, scheduling, variation/change-order handling, reporting, and audit trails. TVIK Estimator has early versions of many of these, but several are not yet complete or fully hardened.

Recommended path: stabilize the current estimator first, then add Buildxact-style depth in small steps. Do not expand AI writeback or pricing automation until deterministic pricing, human approval, versioning, and audit controls are tested.

## What Buildxact-like systems normally provide

Buildxact-style systems usually include:

- Client and job setup
- Project details, site address, contact records, and job metadata
- Scope/takeoff tools
- Measurements, quantities, rooms/areas, plans, and takeoff evidence
- Cost library and assembly library
- Labor/material/subcontract splits
- Markup, margin, overhead, profit, and contingency visibility
- Allowances, exclusions, assumptions, and contract clauses
- Proposal and quote documents
- Approval and send workflow
- Change orders, revisions, and variations
- Scheduling and job conversion
- Subcontractor/vendor tracking
- Reporting and pipeline analytics
- Audit trail and version history

## Current TVIK Estimator Capabilities

Current observed capabilities:

- React/Vite app with Supabase backend
- Authentication and protected app shell
- Dashboard
- Estimate list and estimate creation/editing
- Cost library
- Risk library
- Deterministic cost engine
- Deterministic risk engine
- AI scope/audit generation through Supabase Edge Function
- AI intake panel for notes, voice, photos, areas, and suggestions
- Review queue for AI suggestions
- Public and internal PDF generation
- Contracts and contract detail pages
- Job list, job detail, and calendar routes
- Revision logs and audit-oriented tables
- Local docs for workflow, data model, AI rules, and test plan

## Gap Table: Feature / Current State / Risk / Priority / Recommended Direction

| Feature | Current State | Risk | Priority | Recommended Direction |
| --- | --- | --- | --- | --- |
| Client/job setup | Present in estimate form and job pages | Basic workflow may be enough, but CRM-style history is limited | P1 | Add client/job record clarity after estimator controls are stable |
| Takeoff/scoping | Basic sqft, fixture count, labor hours, areas, notes, photos | No full plan takeoff or measurement evidence chain | P1 | Add area/room scoping and measurement source tracking before advanced takeoff |
| Line items | Present as canonical estimate line items | Manual/AI-added line item handling needs stronger review/audit tests | P0 | Test line item generation, recompute, and writeback gates |
| Assemblies | Limited; source type includes Assembly but true assembly workflow appears immature | Estimator may need repeatable grouped scopes | P2 | Add controlled assembly library after cost engine tests |
| Labor/material split | Present in cost engine and line items | Needs deterministic tests | P0 | Add unit tests for labor/material totals and hours |
| Markup/margin visibility | Present via overhead/profit/contingency fields | Editable financial controls can affect client output | P0 | Add margin gate, audit, and proposal tests |
| Allowances | Present as text/suggestion fields | Allowances can create client commitment risk | P1 | Make allowances structured and approval-gated |
| Exclusions/assumptions/clauses | Present as text fields and PDF sections | Needs client/internal separation and output tests | P1 | Add structured proposal section controls |
| Change orders/revisions | Revision logs and contract change orders exist | Status/audit flow needs central rules | P1 | Centralize revisions and change-order audit rules |
| Approval workflow | Human-triggered Sent/Accepted exists; approval gate helper exists | Status naming and AI writeback gates need hardening | P0 | Create status transition map and tests |
| Proposal output | Public/internal PDFs exist | HTML escaping and internal/public boundaries need tests | P0 | Add PDF output safety tests |
| Scheduling/job conversion | Jobs and calendar routes exist | Operational depth likely early | P2 | Improve after estimating workflow is reliable |
| Audit trail | Revision logs, suggestion audit, write execution log exist | Coverage and consistency need tests | P0 | Require audit for material changes |
| Reporting/analytics | Dashboard exists | Buildxact-style reporting is limited | P3 | Add profitability, pipeline, and production reports later |
| AI advisory workflow | Strong concept in docs and review queue | Writeback must be proven safe for approved/sent records | P0 | Lock down AI mutation rules before expanding AI |

## Missing Core Estimator Features

- True takeoff workflow with measurement source and evidence.
- Structured rooms/areas tied directly to quantities.
- Assembly builder for repeatable scopes.
- Supplier/vendor price source management.
- Structured allowances with low/high range, approval state, and proposal language.
- Structured exclusions, assumptions, and clauses.
- Estimate comparison and revision delta view.
- Central status transition engine.
- Proposal review gate before send.

## Missing Project Management Features

- Full job schedule dependencies.
- Crew/vendor assignment workflow.
- Procurement tracking.
- Job budget vs actual cost reporting.
- Subcontractor bid/request workflow.
- Field progress updates tied back to estimate line items.
- Production milestone tracking.

## Missing Client/Proposal Features

- Client-facing proposal review screen.
- Proposal acceptance flow.
- Email/send tracking.
- Proposal version history.
- Client-visible alternates/options.
- Contract clause library.
- Signature workflow.
- Approved-only client output guard.

## Missing Cost Library / Assembly Features

- Structured assemblies with included labor/material/subcontract components.
- Versioned cost library changes.
- Cost library approval workflow.
- Supplier price import/update workflow.
- Historical actual-cost feedback into pricing suggestions.
- Unit productivity assumptions with review history.

## Missing Reporting / Analytics Features

- Estimate win/loss reporting.
- Margin trend reporting.
- Cost drift reporting by trade.
- Estimate accuracy by estimator/project type.
- Pipeline aging and follow-up reporting.
- Job profitability report.
- Change-order impact report.
- AI suggestion acceptance/rejection analytics.

## Recommended MVP Path

### Step 1: Stabilize baseline

- Re-run build and tests outside the restricted environment.
- Record the true baseline.
- Keep runtime code frozen until the baseline is known.

### Step 2: Protect business-critical controls

- Add tests for cost engine, risk engine, status gates, proposal output, and AI writeback.
- Centralize status transition rules.
- Make `Sent` and `Accepted` records protected from AI overwrite.

### Step 3: Improve estimator workflow

- Structure allowances, exclusions, assumptions, and clauses.
- Add proposal review gate.
- Add clear revision delta view.

### Step 4: Add Buildxact-style depth

- Add assembly library.
- Add area/takeoff evidence workflow.
- Add scheduling and procurement improvements.
- Add reporting after core data is reliable.

### Step 5: Expand AI carefully

- AI can suggest missing scope, risks, questions, allowances, exclusions, and draft proposal text.
- AI should never finalize price, approve, send, overwrite approved content, or bypass audit/versioning.