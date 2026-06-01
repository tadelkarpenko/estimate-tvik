# Deck Staining Scope And Assembly Specification

## Purpose

This document defines the intended TVIK deck-staining scope model. It is documentation only and does not add assemblies, cost-library rows, pricing logic, proposal text, migrations, or runtime behavior.

## Canonical Service Classification

Canonical service path:

```text
Exterior > Deck > Wood Finishing > Stain/Seal
```

Future service identifier:

```text
service_slug = deck_staining
```

Accepted aliases:

- deck staining
- stain deck
- deck sealing
- deck refinishing
- deck wash and stain
- stain railings
- exterior wood stain
- porch/deck stain
- pressure wash and stain deck

## Required Inputs

| Input | Required | Type | Notes |
|---|---|---|---|
| `deck_floor_sqft` | Yes | number | Main deck walking surface area |
| `surface_condition` | Yes | enum | new, weathered, peeling, painted, unknown |
| `prep_level` | Yes | enum | wash_only, light_sanding, heavy_sanding, stripping |
| `coats` | Yes | enum | 1, 2 |
| `stain_type` | Yes | enum | transparent, semi_transparent, solid, sealer_only, unknown |
| `railings_linear_ft` | Conditional | number | Required if railings exist |
| `spindle_count` | Conditional | number | Required if detailed railing staining is included |
| `stair_count` | Conditional | number | Required if stairs exist |
| `furniture_removal` | Optional | enum | client_clears, tvik_moves, none |
| `access_complexity` | Optional | enum | easy, moderate, difficult |
| `minor_repairs_needed` | Optional | boolean | Boards, rails, or fasteners |
| `product_by` | Optional | enum | TVIK, client, allowance |

## Base Assembly: Wash And One Coat

Required lines:

- Mobilization and setup - lump sum labor
- Protect adjacent surfaces - lump sum or square foot labor/material
- Power wash deck surface - square foot labor/equipment
- Dry-time / return trip note - non-price note or reviewed allowance
- Apply stain/sealer to deck floor - square foot labor
- Stain/sealer material allowance - gallon or allowance material
- Cleanup - lump sum labor

## Standard Assembly: Wash, Light Sand, One Or Two Coats

Adds:

- Light sanding / surface prep - square foot
- Optional second coat - square foot

## Heavy Prep / Stripping Assembly

Use only after human review:

- Heavy sanding / stripping - square foot
- Extra cleanup/disposal - lump sum
- Extra material/chemical allowance - allowance

## Railings And Spindles Add-On

Use when railings exist and measurements are confirmed:

- Stain railings - linear foot
- Stain spindles/balusters - each or linear foot
- Mask/protect railing-adjacent areas - lump sum

## Stairs Add-On

Use when stairs exist and count is confirmed:

- Stain deck stairs - step
- Sand/prep stair treads - step

## Optional Adders

- Furniture moving
- Tight access or elevated deck
- Second coat
- Premium stain product
- Small board repair allowance
- Railing/spindle complexity
- Weather return-trip allowance
- Pressure-washer rental/equipment charge
- Masking adjacent siding, doors, or windows

## Standard Exclusions

Exclude unless explicitly included and reviewed:

- Structural repairs
- Board replacement
- Railing reconstruction
- Rot remediation
- Full paint stripping
- Hidden damage
- Code upgrades
- Permit work
- Electrical, plumbing, or HVAC
- Waterproof membrane systems
- Furniture storage
- Landscaping repair
- Weather delays

## Proposal-Safe Language

Included scope:

```text
TVIK LLC will prepare and stain/seal the existing deck surfaces listed in this estimate. Scope includes setup, basic protection, power washing, required drying time, selected sanding/prep level, stain/sealer application, and cleanup as itemized.
```

Assumptions:

```text
Estimate assumes the deck is structurally sound and ready for surface refinishing. Any hidden rot, loose boards, failed fasteners, or coating removal beyond the selected prep level will be handled by approved change order.
```

Weather note:

```text
Exterior staining is weather-dependent. Work may be delayed by rain, high humidity, low temperatures, or insufficient dry time after washing.
```

Change order language:

```text
Any work not listed in the approved scope, including board replacement, structural repairs, heavy stripping, railing repair, or additional coats, requires written approval before work proceeds.
```

