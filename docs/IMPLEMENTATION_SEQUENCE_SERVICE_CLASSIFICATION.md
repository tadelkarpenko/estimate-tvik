# Implementation Sequence — Service Classification + Cost Library QA v1

## Purpose

Define the safe order for improving TVIK Estimator without breaking pricing, approval, proposal, database, or AI boundaries.

## P0 — Source Package

Generate and commit documentation/source artifacts only.

Allowed:
- Markdown docs
- CSV QA matrices
- Codex prompts

Not allowed:
- runtime code
- migrations
- pricing changes
- approval/status changes

## P1 — Report-Only Audit

Codex inspects:
- current project category dropdowns,
- scope class options,
- cost library seed data,
- default included cost rows,
- `qty_rule`,
- phase/source/PDF defaults,
- health check structure,
- New Estimate and estimate detail rendering.

No edits.

## P2 — Warning-Only Scope Mismatch Health Check

Add warning-only detection first.

Example:
- `windows_doors` + HVAC row = high warning.
- `deck_staining` + plumbing row = high warning.

No blocking yet.

## P3 — service_slug Classification Map

Add safe mapping:
- project_category + service type → service_slug.
- do not change database unless approved.
- if needed, derive transient service_slug in runtime first.

## P4 — Cost-Library Filtering

Prevent narrow services from auto-generating Full Rehab rows.

## P5 — Required Input Checklists

Show service-specific missing-info questions before line generation.

## P6 — Service-Specific Assemblies

Add deck, windows/doors, painting, flooring, bathroom, and kitchen assemblies.

## P7 — Golden Tests

Add regression tests proving services do not pull wrong trades.

## P8 — PDF Safety

Mismatched/unreviewed blocked trades default out of public PDF.

## P9 — Approval/Status Blocking

Only after tests: block Approved/Sent if high-risk checks fail.

## P10 — Pricing Calibration

Only after classification, filtering, and assemblies are stable.

## P11 — UI/Mobile Polish

Improve New Estimate and mobile field capture around service-specific intake.
