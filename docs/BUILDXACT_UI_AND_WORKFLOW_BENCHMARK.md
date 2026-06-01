# Buildxact UI and Workflow Benchmark — TVIK-Owned Requirements v1

## Purpose

Translate Buildxact-inspired public workflow patterns into TVIK-owned requirements.

This file is not a Buildxact clone specification. It is a benchmark map.

## Legal / Proprietary Boundary

Do not copy Buildxact proprietary UI, branding, code, database schema, private screens, paid-account implementation, or copyrighted assets.

## Core Lessons

Buildxact-style professional estimating software is not just a form. It combines:

- dashboard,
- estimate status list,
- takeoff/measurements,
- costing table,
- cost catalog,
- AI support inside workflow,
- quote/proposal preview,
- RFQ/PO future flow,
- schedule/job management,
- reminders,
- cost summary,
- item status controls.

## TVIK Translation

TVIK should implement these as TVIK-owned modules:

- Dashboard: review queue, estimates waiting, site visits, reminders, job schedule.
- Estimate workspace: Intake, Scope Builder, Costings, Assemblies, Takeoff/Photos, Health Checks, Proposal, Change Orders, Audit Log.
- Costings table: phase, description, qty, unit, labor, material, total, source, PDF, status.
- AI assistant: suggestions only, with confidence/evidence/review controls.
- Quote preview: human-reviewed only.
- Future job flow: schedule, RFQ, PO, change orders, job costing.

## Reference Action Matrix

| Interface View                                         | Module            | Observed Pattern                                                                                     | TVIK Action                                                                                                              | Risk / Note                                                                    |
|:-------------------------------------------------------|:------------------|:-----------------------------------------------------------------------------------------------------|:-------------------------------------------------------------------------------------------------------------------------|:-------------------------------------------------------------------------------|
| Estimates Dashboard / Status Filters                   | Estimates         | List of estimates with status filters like All, Draft, In Progress, Not Sent, Final, Sent, Accepted. | Build status pipeline directly into TVIK. Add Draft, Needs Inputs, Ready for Review, Approved, Sent, Accepted, Declined. | Do not copy visual styling exactly; use as workflow reference only.            |
| Main Dashboard / Reminders + Job Schedule              | Dashboard         | Shows reminders, recent items, and job schedule cards in one workspace.                              | TVIK dashboard should show pending review queue, site visits, estimates waiting, and today's job schedule.               | Dashboard must not become crowded; use priority cards.                         |
| Plans & Takeoffs Empty State                           | Takeoff           | Empty takeoff screen prompts user to upload plan and add measurements.                               | TVIK should have empty-state instructions for photos/plans: Upload photo, assign room, run AI intake.                    | Avoid blank screens in Lovable app.                                            |
| Digital Floor Plan Takeoff Overlay                     | Takeoff           | Floor plan with highlighted areas showing digital measurement workflow.                              | TVIK future feature: plan upload + highlighted measurements, but keep V1 focused on photo/voice intake.                  | Do not overbuild takeoff before estimator core is stable.                      |
| Construction Takeoff / Costing Table                   | Takeoff + Costing | Line items connect takeoff quantities to unit costs and totals.                                      | TVIK must connect AI/photo findings to review queue first, then line items after approval.                               | Buildxact likely uses more advanced takeoff; TVIK should stage this gradually. |
| Estimate Costings Main Table                           | Estimating        | Table includes description, type, quantity, UOM, unit cost, total, markup, tax, quote total.         | TVIK line-item workspace should match this logic: phase, description, unit, qty, labor, material, total, source, locked. | Use deterministic totals; AI advisory only.                                    |
| AI Estimator Prompt Panel                              | AI Estimating     | AI prompt box with generate button and suggestion chips tied to a line item.                         | TVIK AI Intake should process typed/voice/photo and send suggestions to queue, not write directly.                       | Add confidence, evidence, target field, approve/edit/reject controls.          |
| AI Estimator in Costings Screen                        | AI Estimating     | AI assistant appears inside the estimate costings flow.                                              | Place TVIK AI assistant inside New Estimate, not as separate app. Use room-by-room panel.                                | Keep AI output structured with schemas.                                        |
| Roofing Estimate Line Items                            | Trade Template    | Roofing-specific estimating table with material choices and unit costs.                              | TVIK should use project category templates: Bathroom, Kitchen, Electrical, Roofing/Siding/Gutters, Windows/Doors.        | Avoid generic 'Small Job'; use professional categories.                        |
| Painting Estimate Line Items                           | Trade Template    | Painting estimate table with labor/material rows and UOM.                                            | TVIK cost library should support trade-specific templates and completeness checks.                                       | Line items need phase/source/locked fields.                                    |
| Remodeling Doors Catalog Dropdown                      | Catalog           | Dropdown list shows selectable standard builder items with prices.                                   | TVIK should build CostLibrary + Assemblies with searchable insert controls.                                              | Do not rely on AI to invent catalog prices.                                    |
| Quote Layout Editor                                    | Quoting           | Quote letter layout editor with section toggles and branded preview.                                 | TVIK proposal generator should have section toggles: cover, scope, exclusions, allowances, terms, approval.              | Separate internal notes from client-facing proposal content.                   |
| Quote Preview / Proposal Document                      | Quoting           | Branded proposal preview with client address, estimate total, and letter.                            | TVIK should generate client-ready PDF body and email draft after approval only.                                          | No send without human approval.                                                |
| Quote Confirmation Email Preview                       | Communication     | Email preview confirms quote request and displays itemized costs.                                    | TVIK should include email preview/draft before sending estimate.                                                         | Email drafts are not final communications until approved.                      |
| RFQ Recipient + Message Flow                           | RFQ               | Request-for-quote workflow with recipients, attached docs, message, and send button.                 | TVIK future module: subcontractor/vendor quote requests tied to estimate line items.                                     | Do after core estimator and cost library work.                                 |
| Reminder Details Modal                                 | Scheduling        | Reminder modal with message, due date/time, SMS/email recipient fields.                              | TVIK should create follow-ups and job/site visit reminders from estimate status changes.                                 | Reminders need owner, due date, channel, status.                               |
| Job Schedule / Gantt Overview                          | Scheduling        | Job schedule shows tasks, start dates, durations, assignees, and timeline bars.                      | TVIK should add schedule later: site visit, estimate tasks, job tasks, crew assignments.                                 | Do not mix estimating and job execution too early.                             |
| Job Management Schedule                                | Jobs              | Job progress and schedule with task names, dates, and durations.                                     | TVIK can convert accepted estimate to job with schedule phases.                                                          | Create job only after estimate accepted.                                       |
| Cost Summary / Markup Panel                            | Financial Control | Quote total, markup, tax, subtotal, and item-level cost fields visible in estimating.                | TVIK must show labor subtotal, material subtotal, markup, contingency, grand total, margin risk.                         | Keep internal margin panel collapsed/permissioned.                             |
| Status Buttons: Complete / Not Complete / Not Required | Scope Control     | Trade template screens include per-item completion status buttons.                                   | TVIK should use line item statuses: Suggested, Approved, Excluded, Optional, Change Order.                               | Completion status is not same as approval status.                              |
