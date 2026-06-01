# Cost Library Restructure Plan - Deck Staining And Service-Specific Assemblies

## Purpose

This document describes the cost-library gaps exposed by EST-0016 and the future structure needed for service-specific deck-staining pricing. It is documentation only and does not change schema, seed data, pricing logic, or migrations.

## Problem

The current cost library is filtered by broad legacy `project_type`. Deck staining does not have its own service identifier, so a narrow exterior wood-finishing scope can inherit `Full Rehab` rows.

Failure pattern:

```text
project_type = Full Rehab
sqft = 250
default included Full Rehab rows selected
250 sf applied to each sqft row
```

This produces unrelated trades such as framing, drywall, electrical, plumbing, HVAC, flooring, and generic paint.

## Proposed Category Hierarchy

```text
Exterior
  Deck
    Wood Finishing
      Deck Staining
      Deck Sealing
      Deck Refinishing
    Surface Prep
      Power Washing
      Light Sanding
      Heavy Sanding
      Stripping
    Railings and Stairs
      Railing Stain
      Spindle Stain
      Stair Stain
    Minor Repairs
      Board Replacement Allowance
      Railing Repair Allowance
```

## Future Cost Item Fields

Each future cost-library item should support:

```text
id
category
subcategory
service_slug
trade_family
item_name
description
unit
base_labor_rate
base_material_rate
default_markup
minimum_charge
phase
pdf_default
requires_measurement
allowed_project_categories
blocked_project_categories
is_addon
requires_human_review
notes
```

Current schema does not support this full structure. Additive schema design should be planned separately and reviewed before any migration.

## Required Deck Staining Cost Items

Base items:

- Deck staining mobilization/setup - lump sum
- Protect adjacent surfaces - lump sum
- Power wash deck - square foot
- Light sanding / prep - square foot
- Apply stain/sealer to deck floor - square foot
- Stain/sealer material allowance - gallon or allowance
- Cleanup - lump sum

Optional items:

- Heavy sanding / stripping - square foot
- Second coat application - square foot
- Railings stain - linear foot
- Spindles stain - each or linear foot
- Stairs stain - step
- Furniture moving - lump sum
- Minor board repair allowance - allowance
- Premium stain upcharge - allowance

## Pricing Structure Principles

- Do not apply one `250 sf` quantity to unrelated generic trades.
- Support a minimum charge for small jobs.
- Separate labor and material.
- Use condition-based pricing for prep level.
- Version assemblies instead of silently overwriting old ones.
- Keep existing estimates reproducible.
- Keep AI advisory and review-gated.

## Migration Caution

Do not delete existing cost-library items immediately.

Safer sequence:

1. Document deck-staining rules.
2. Add warning/report health checks.
3. Add service tags or service-specific routing.
4. Add new deck-specific rows.
5. Add tests.
6. Calibrate pricing.
7. Polish proposal/PDF language.

Existing broad rows should remain available for legacy estimates until compatibility and migration plans are reviewed.

