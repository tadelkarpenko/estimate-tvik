# ChatGPT Source Memory — TVIK Estimator Buildxact Mode + Service Classification v1

## Project Context

TVIK Estimator is an internal TVIK LLC estimating system. It must produce accurate, consistent, reviewable estimates while protecting margin, scope clarity, change-order control, auditability, and proposal safety.

## Buildxact Usage

Buildxact is a public workflow/UI benchmark only. TVIK should adopt professional estimating concepts, not copy proprietary implementation.

## Known Classification Failure

The current problem is system-wide:

```text
Category → legacy project_type fallback → broad Full Rehab rows → wrong trades
```

Target:

```text
Category → service_slug → allowed assemblies → required inputs → scope health check → human review
```

Deck staining proved the issue:
- Full Rehab cost-library rows appeared in a narrow deck-staining estimate.
- 250 sf was applied too broadly.
- Service-specific filters and mismatch health checks were missing.

## First Fix Order

1. Source package.
2. Report-only audit of current categories/cost library.
3. Warning-only scope mismatch checker.
4. service_slug map.
5. Required input checklists.
6. Service-specific cost-library filters.
7. Assemblies.
8. Golden tests.
9. PDF safety.
10. Approval/status blocking after tests.
11. Pricing calibration.

## Core Service Slugs

- deck_staining
- windows_doors
- bathroom_remodel
- kitchen_remodel
- flooring
- interior_painting
- exterior_painting
- drywall_patch_repair
- electrical
- plumbing
- hvac
- roofing
- siding
- framing_carpentry
- trim_finish_carpentry
- punch_list_closeout
- repair_correction
- diagnostic_site_visit
- full_rehab_multi_trade
- insurance_damage_scope

## Measurement Rule

Never apply project sqft to all cost-library rows unless the row's measurement_profile explicitly allows sqft.

## AI Rule

AI can suggest and classify. AI cannot approve, send, set final price, overwrite approved records, or bypass the Review Queue.
