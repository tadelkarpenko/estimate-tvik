# Estimate Health Check Scope Mismatch Rules

## Purpose

This document defines health-check rules that should catch deck-staining scope contamination before an estimate becomes client-facing. It is documentation only and does not change the current approval/status workflow.

## Required Health Check Types

### Scope Mismatch Check

Detect line items inconsistent with the service classification.

For `service_slug = deck_staining`, the check should flag:

- HVAC
- Plumbing
- Drywall
- Electrical
- Interior flooring
- Generic framing
- Tile
- Cabinets

### Required Scope Completeness Check

Detect missing deck-staining scope inputs:

- Deck size
- Surface condition
- Prep level
- Power washing included or explicitly excluded
- Stain/sealer material
- Stain/sealer application labor
- Coat count
- Railings/stairs questions when unknown

### Measurement Completeness Check

Detect missing measurements:

- Deck floor square feet
- Railing linear feet when railings exist
- Stair count when stairs exist
- Spindle count when detailed railing staining is included

### Proposal Safety Check

Detect whether questionable or unreviewed lines are checked for public PDF output.

### Phase/Category Quality Check

Detect all lines assigned to `Other`, or obvious deck-staining rows that have generic/interior phases.

## Deck Staining Blocked Trades

High-severity mismatch if any appear without human override:

- HVAC
- Plumbing
- Drywall
- Electrical
- Interior flooring
- Generic framing
- Tile
- Cabinets

## Status Gate Rules For Future Patch

The estimate should not move to Approved or Sent when:

- High-severity scope mismatch exists.
- Required deck-staining inputs are missing.
- Totals do not match line items.
- Required clauses are absent.
- Unreviewed AI/cost-library suggestions are included in PDF.
- Blocked trades are included without human override.

Implementation caution: do not implement hard status blocking until the current status workflow is reviewed and an approval/status patch is explicitly approved.

## Suggested Health Check Record

```json
{
  "estimate_id": "EST-0016",
  "check_type": "scope_mismatch",
  "passed": false,
  "severity": "high",
  "service_slug": "deck_staining",
  "details": "Deck staining estimate includes Drywall, Electrical, Plumbing, and HVAC. These are blocked unless manually approved.",
  "recommended_action": "Remove mismatched lines or add human override reason."
}
```

## User-Facing Warning

```text
Scope Mismatch: This estimate looks like Deck Staining, but it includes HVAC, Plumbing, Drywall, Electrical, or Interior Flooring. Review and remove unrelated lines before approval or PDF delivery.
```

## Current Repo Gap

The repo already has health-check storage and post-write recheck concepts, but current deterministic completeness scoring is based on legacy `project_type`. For `Full Rehab`, the unrelated trades are treated as expected rows rather than deck-staining mismatches.

