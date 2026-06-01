# Deck Staining Golden Test Cases

## Purpose

These golden tests define correct deck-staining behavior before any pricing patch. They should be used to prevent regressions after service classification, health checks, cost-library rows, pricing calibration, and proposal/PDF behavior are added.

## Test Case 1 - Basic 250 SF Deck, Wash And Stain

Input:

```text
Need estimate to power wash and stain a 250 sq ft deck. No railings, no stairs. Light prep only.
```

Expected lines:

- Mobilization/setup
- Protect adjacent surfaces
- Power wash deck
- Dry-time / return-trip note
- Apply stain/sealer to deck floor
- Stain/sealer material allowance
- Cleanup

Must not include:

- Framing
- Drywall
- Electrical
- Plumbing
- HVAC
- Flooring Labor
- Flooring Underlayment/Consumables

## Test Case 2 - 250 SF Deck With Railings And Stairs

Input:

```text
Stain 250 sq ft deck with 40 linear ft railing and 5 steps. Power wash and light sand first.
```

Expected additional lines:

- Railing stain
- Stair staining
- Light sanding/prep

The deck floor, railing, and stair quantities should use their own measurement bases.

## Test Case 3 - Peeling Old Stain / Heavy Prep

Expected behavior:

- Classify as deck staining.
- Ask for deck size if missing.
- Ask for railings and stairs.
- Add risk note that heavy prep/stripping may be required.
- Include heavy prep only as a reviewed/conditional item.
- Require human review before approval.

## Test Case 4 - Ambiguous Deck Request

Input:

```text
Need deck stained.
```

Expected missing-info questions:

- What is the deck square footage?
- Are there railings?
- Are there stairs?
- What is the current surface condition?
- Is power washing included?
- Is sanding or stripping needed?
- One coat or two coats?
- Who supplies stain?
- Any repairs needed?

Expected status behavior:

- Estimate remains in an input/review state.
- No Approved or Sent status is allowed until required inputs and review are complete.

## Test Case 5 - Bad Generic Trade Regression

Input:

```text
Power wash and stain 250 sf deck.
```

Reject any generated estimate containing:

- HVAC
- Plumbing
- Drywall
- Electrical
- Flooring underlayment
- Interior flooring labor
- Generic framing

## Test Case 6 - PDF Safety

Expected behavior:

- Blocked/mismatched lines should not be public-PDF-ready by default.
- Warning should be visible.
- Approval should be blocked unless human override exists.
- Override reason should be required and auditable.

## Test Case 7 - Manual Override

Input:

```text
Power wash and stain 250 sf deck. Replace two damaged boards if needed.
```

Expected behavior:

- Keep staining assembly clean.
- Add minor carpentry only as a reviewed allowance or line.
- Record human override/reason.
- Keep audit/revision trail intact.

## Acceptance Criteria

A deck-staining estimate passes when:

- Service classification is correct.
- Unrelated trades are absent or flagged.
- Required inputs exist or questions are generated.
- Deck-specific assembly lines are used.
- Labor/material split is clear.
- Estimate cannot be approved/sent with high-risk mismatch.
- Client-facing PDF only includes reviewed relevant scope.

