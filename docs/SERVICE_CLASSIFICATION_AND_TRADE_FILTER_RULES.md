# Service Classification And Trade Filter Rules

## Purpose

This document defines future service-classification and trade-filter rules needed to prevent narrow services like deck staining from inheriting broad remodel trades. It does not change runtime behavior.

## Target Classification Shape

Future estimates should support enough classification detail to route pricing safely:

```text
project_type
project_category
scope_class
trade_family
service_slug
complexity_level
```

For deck staining:

```json
{
  "project_type": "exterior",
  "project_category": "deck",
  "scope_class": "wood_finishing",
  "trade_family": "exterior_finishes",
  "service_slug": "deck_staining",
  "complexity_level": "basic|standard|heavy_prep|unknown"
}
```

## Current Repo Gap

The app currently has:

- `project_type`
- `project_category`
- `scope_class`
- `job_complexity`

The app does not yet have:

- `service_slug`
- `trade_family`
- deck-staining-specific routing
- allowed/blocked trade filters
- service-specific cost-library rows

Because of this, deck-staining work can fall back to `Full Rehab` cost-library rows.

## Deck Staining Allowed Trade Families

Allowed by default:

- exterior_finishes
- exterior_surface_prep
- pressure_washing
- sanding
- staining_sealing
- protection_cleanup
- mobilization

Allowed only with explicit human confirmation:

- minor_deck_repairs_allowance
- carpentry_minor
- board_replacement
- railing_repair
- stripping_chemical
- equipment_rental

Blocked by default:

- drywall
- interior_flooring
- HVAC
- plumbing
- electrical
- framing_general
- roofing
- insulation
- cabinets
- interior_painting
- tile

## Filter Behavior

At estimate generation:

```text
If service_slug = deck_staining:
  include rows only when trade_family is allowed
  exclude rows when trade_family is blocked
  flag rows when trade_family requires human confirmation
```

At assembly expansion:

- Assemblies should declare service slug.
- Assemblies should declare allowed project categories.
- Assemblies should declare trade family.
- Assemblies should declare required inputs.
- Assemblies should declare optional inputs.
- Assemblies should say whether missing inputs block expansion.

At AI suggestion layer:

- AI may suggest an exception.
- Exception suggestions must enter the review queue as a question, risk note, or reviewed line.
- AI must not directly add blocked-trade exceptions to approved scope.

At manual line add:

- A human may add blocked trades manually.
- The app should warn and require a reason.
- The reason should be audit-visible before approval or client-facing output.

## Mismatch Severity

| Condition | Severity | Action |
|---|---|---|
| Deck staining includes HVAC/plumbing/drywall | High | Block approval in a future approved status-gate patch |
| Deck staining includes electrical or interior flooring | High | Block approval in a future approved status-gate patch |
| Deck staining includes generic framing | High | Require human confirmation or removal |
| Deck staining missing stain/sealer material | High | Needs input |
| Deck staining missing prep level | High | Needs input |
| Deck staining missing deck size | High | Needs input |
| Railings present but no railing measurement | Medium | Ask question |
| Heavy prep/stripping selected | Medium/High | Require human review |
| Generic paint material instead of stain material | Medium | Warning |
| Phase = Other for all lines | Medium | Warning |

## Health Check Output Example

```json
{
  "check_type": "scope_mismatch",
  "passed": false,
  "severity": "high",
  "details": "Deck staining estimate includes HVAC, Plumbing, and Drywall lines. These are blocked trades for service_slug=deck_staining unless manually approved."
}
```

