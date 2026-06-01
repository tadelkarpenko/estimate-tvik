# TVIK Service Classification + Cost Library QA Master v1

Date: 2026-06-01

## 1. Package Purpose

This is the master source file for the **TVIK Service Classification + Cost Library QA Package v1**.

It exists to stop system-wide estimator failures where a narrow job type, such as deck staining or window replacement, falls into broad Full Rehab / multi-trade default rows.

The package is for **ChatGPT project setup, Codex planning, documentation, QA, and future controlled implementation**.

It is not runtime implementation by itself.

## 2. Hard Boundaries

This package does **not** authorize:

- runtime application code edits,
- database schema changes,
- pricing calculation changes,
- proposal/PDF behavior changes,
- approval/status workflow changes,
- direct AI writeback,
- hidden migrations,
- Buildxact copying,
- pricing calibration before service classification and cost-library filtering are stable.

## 3. TVIK Non-Negotiable Rules

- Deterministic pricing comes first.
- AI is advisory only.
- Estimate record is the source of truth.
- Human approval is required before Approved or Sent.
- AI suggestions must go through Review Queue.
- Accepted/edited suggestions must create revisions and audit records.
- AI cannot directly mutate approved estimates, pricing, proposal clauses, totals, or status workflow.
- Preserve versioning and audit trail.
- Do not calibrate pricing before service classification and cost-library filtering are stable.
- Small patches over large rewrites.

## 4. Confirmed Failure Facts

The current known failure pattern is:

```text
Category → legacy project_type fallback → broad Full Rehab rows → wrong trades
```

The target behavior is:

```text
Category → service_slug → allowed assemblies → required inputs → scope health check → human review
```

Confirmed deck-staining failure facts:

- EST-0016 was intended as deck staining / deck refinishing.
- It generated unrelated Full Rehab-style rows: Framing, Drywall, Electrical, Flooring, Demo & Protection, Paint, Plumbing, HVAC.
- The wrong rows were selected by deterministic cost-library matching, not by AI output.
- `250 sf` was propagated broadly because project sqft was applied to cost-library items using sqft quantity rules.
- `Source = CostLibrary` came from cost-engine-generated line items.
- `Phase = Other` indicates weak phase/category mapping.
- Public PDF checkboxes behaved as selected unless explicitly false.
- Existing classification fields include project category, scope class, and job complexity, but they are not enough.
- Missing control layer: `service_slug`, `trade_family`, allowed/blocked trade filtering, service-specific assemblies, and mismatch health checks.

## 5. Buildxact-Inspired Boundary

Buildxact is used only as a public workflow and UI benchmark.

TVIK may adopt ideas such as:

- dashboard cards,
- estimate status filters,
- takeoff/measurement workflow,
- spreadsheet-like costing table,
- trade-specific templates,
- catalog item insertion,
- quote preview,
- reminders,
- schedule/Gantt future path,
- cost summary/markup panels,
- item completion/status controls.

TVIK must not copy Buildxact proprietary UI, branding, code, database schema, private screens, paid-account implementation, or copyrighted assets.

## 6. Service Classification Stack

Every estimate should eventually be classified using:

```text
project_category
service_group
service_slug
scope_class
job_complexity
trade_family
assembly_group
measurement_profile
qa_profile
proposal_profile
```

Example:

```text
Project Category: Windows / Doors
service_group: Openings
service_slug: windows_doors
trade_family: exterior_openings
measurement_profile: each/opening + dimensions + linear_ft + lump_sum
qa_profile: openings_scope_mismatch
proposal_profile: windows_doors_proposal
```

## 7. Minimum v1 Service Taxonomy

The v1 service taxonomy includes:

- `deck_staining` — Deck Staining / Deck Refinishing
- `windows_doors` — Windows / Doors
- `bathroom_remodel` — Bathroom Remodel
- `kitchen_remodel` — Kitchen Remodel
- `flooring` — Flooring
- `interior_painting` — Interior Painting
- `exterior_painting` — Exterior Painting
- `drywall_patch_repair` — Drywall / Patch / Repair
- `electrical` — Electrical
- `plumbing` — Plumbing
- `hvac` — HVAC
- `roofing` — Roofing
- `siding` — Siding
- `framing_carpentry` — Framing / Carpentry
- `trim_finish_carpentry` — Trim / Finish Carpentry
- `punch_list_closeout` — Punch List / Closeout
- `repair_correction` — Repair / Correction
- `diagnostic_site_visit` — Diagnostic / Site Visit
- `full_rehab_multi_trade` — Full Rehab / Multi-Trade
- `insurance_damage_scope` — Insurance / Damage Scope

## 8. Service-by-Service Classification Matrix

| service_slug           | display_name                     | project_category       | measurement_profile                                         | allowed_trades                                                                                                                                                  | blocked_unless_confirmed                                                                                           |
|:-----------------------|:---------------------------------|:-----------------------|:------------------------------------------------------------|:----------------------------------------------------------------------------------------------------------------------------------------------------------------|:-------------------------------------------------------------------------------------------------------------------|
| deck_staining          | Deck Staining / Deck Refinishing | Exterior               | sqft + linear_ft + step + gallon + lump_sum                 | pressure washing; deck prep; sanding; stain/sealer material; stain/sealer application; protection; cleanup; optional minor deck repairs                         | HVAC; plumbing; drywall; electrical; flooring; full framing; roofing                                               |
| windows_doors          | Windows / Doors                  | Openings               | each + opening + dimensions + linear_ft + lump_sum          | window/door replacement; removal/disposal; flashing; tape; caulk; foam insulation; interior/exterior trim; paint/touch-up allowance; minor rough-opening repair | HVAC; plumbing; flooring; full drywall; full electrical; roofing; full framing package                             |
| bathroom_remodel       | Bathroom Remodel                 | Interior Remodel       | room + each + sqft + linear_ft + allowance                  | demo; plumbing; tile; waterproofing; electrical; drywall; fixtures; vanity; toilet; vent fan; paint; protection; cleanup                                        | roofing; siding; HVAC except bath ventilation/duct scope; exterior windows/doors unless specified                  |
| kitchen_remodel        | Kitchen Remodel                  | Interior Remodel       | linear_ft + each + sqft + allowance                         | demo; cabinets; countertops; backsplash; plumbing; electrical; flooring; drywall/paint; appliance handling; trim; protection; cleanup                           | roofing; siding; HVAC unless duct/hood scope confirmed; structural framing unless wall changes confirmed           |
| flooring               | Flooring                         | Interior Finish        | sqft + linear_ft + transition + lump_sum                    | floor demo; underlayment; flooring install; transitions; base shoe; subfloor repair allowance; furniture moving; disposal                                       | HVAC; plumbing unless fixture removal/access confirmed; electrical unless floor outlets confirmed; roofing; siding |
| interior_painting      | Interior Painting                | Interior Finish        | room + wall_sqft + ceiling_sqft + linear_ft + each + gallon | prep; protection; patch; caulk; primer; paint material; paint labor; trim/door painting; cleanup                                                                | HVAC; plumbing; flooring install; electrical; roofing; siding; full drywall replacement                            |
| exterior_painting      | Exterior Painting                | Exterior               | sqft + linear_ft + each + gallon + lump_sum                 | wash; scrape; sanding; caulk; primer; exterior paint; trim; siding paint; protection; cleanup; ladder/scaffold allowance                                        | HVAC; plumbing; interior flooring; interior drywall; roofing replacement                                           |
| drywall_patch_repair   | Drywall / Patch / Repair         | Interior Repair        | sqft + each + room + lump_sum                               | protection; cut/patch; hang drywall; tape; mud; sand; texture; prime/paint allowance; cleanup                                                                   | HVAC; plumbing; electrical unless access/relocation confirmed; flooring; cabinets                                  |
| electrical             | Electrical                       | Trade                  | each + circuit + panel + fixture + allowance                | devices; fixtures; circuits; panel; troubleshooting; permit; finish patch allowance                                                                             | plumbing; HVAC; flooring; drywall except patch/access; roofing                                                     |
| plumbing               | Plumbing                         | Trade                  | each + fixture + linear_ft + allowance                      | fixtures; valves; supply/drain work; rough-in; repair; access opening; finish patch allowance                                                                   | HVAC; electrical except fixture/device coordination; flooring except access repair; roofing                        |
| hvac                   | HVAC                             | Trade                  | each + ton + btu + vent + allowance                         | equipment; duct; vent; thermostat; startup; refrigerant/line set; permit; electrical coordination allowance                                                     | plumbing; flooring; drywall except access repair; roofing except penetration/flashing coordination                 |
| roofing                | Roofing                          | Exterior               | sqft + square + linear_ft + each + allowance                | tear-off; underlayment; shingles; flashing; vents; drip edge; cleanup; disposal; decking allowance                                                              | plumbing; interior painting; flooring; full drywall; cabinets; HVAC except roof vent/flashing                      |
| siding                 | Siding                           | Exterior               | sqft + linear_ft + each + allowance                         | remove siding; housewrap; siding install; trim; caulk; cleanup; sheathing allowance                                                                             | plumbing; HVAC; flooring; interior drywall; interior paint                                                         |
| framing_carpentry      | Framing / Carpentry              | Structural / Carpentry | linear_ft + sqft + each + opening + allowance               | framing; blocking; subfloor/deck board repair; rough opening repair; minor structural carpentry; hardware                                                       | plumbing; HVAC; electrical except coordination; finish flooring; painting unless included                          |
| trim_finish_carpentry  | Trim / Finish Carpentry          | Interior Finish        | linear_ft + each + room + lump_sum                          | baseboard; casing; crown; shoe molding; doors; caulk; nail holes; paint-ready prep                                                                              | plumbing; HVAC; electrical; flooring install except transitions; drywall install                                   |
| punch_list_closeout    | Punch List / Closeout            | Repair / Closeout      | each + hour + lump_sum + allowance                          | small patches; caulk; adjustment; touch-up; minor hardware; final cleanup; small carpentry                                                                      | large HVAC; major plumbing; major electrical; roofing; full remodel packages                                       |
| repair_correction      | Repair / Correction              | Repair / Correction    | each + sqft + linear_ft + allowance                         | diagnosis; small demolition; repair; replacement part; patch/finish; cleanup                                                                                    | unrelated full remodel trades; major MEP unless confirmed; structural work unless inspected                        |
| diagnostic_site_visit  | Diagnostic / Site Visit          | Diagnostic             | visit + hour + report + allowance                           | site visit; diagnostic inspection; photos; measurements; written report; estimate preparation allowance                                                         | installation labor; material purchases; full trade scopes                                                          |
| full_rehab_multi_trade | Full Rehab / Multi-Trade         | Multi-Trade            | sqft + room + each + linear_ft + allowance                  | demo; framing; drywall; MEP; finishes; flooring; paint; fixtures; protection; cleanup                                                                           | none by default, but every trade needs phase clarity and required inputs                                           |
| insurance_damage_scope | Insurance / Damage Scope         | Insurance / Damage     | room + sqft + each + allowance + report                     | documentation; demolition; drying/mitigation coordination; repair estimate; finish restoration; photos; line-item report                                        | unrelated upgrades; non-damage remodeling; major MEP unless damage related                                         |

## 9. Required Input Rule

Every service must ask for its required inputs before it generates a client-facing estimate.

A narrow service without required inputs should remain `Needs Inputs` or `Ready for Review`, not Approved or Sent.

## 10. Measurement and Unit Rules

Use these unit rules:

- `sqft` = surfaces only.
- `linear_ft` = trim, railings, siding trim, baseboards, casing.
- `each` = fixtures, windows, doors, outlets, fans, devices.
- `step` = stair count.
- `opening` = window/door opening.
- `room` = room-level minimum.
- `lump_sum` = mobilization, protection, setup, cleanup.
- `allowance` = uncertain material or repair budget.
- `gallon` = paint/stain material.
- `day` = labor day rate only when manually approved.
- `square` = roofing square only.

Critical rule:

```text
Never apply project sqft to all cost-library rows unless the row's measurement_profile explicitly allows sqft.
```

## 11. Cost Library QA Field Requirements

Every cost-library item should eventually support or map to the following fields.

| field                 | priority              | purpose                                       | qa_note                                                       |
|:----------------------|:----------------------|:----------------------------------------------|:--------------------------------------------------------------|
| item_name             | Required              | Human-readable item name                      | Avoid vague names like Misc work; use service-specific names. |
| category              | Required              | Broad category/trade                          | Should not be the only classifier.                            |
| service_slug          | Required future field | Primary service classifier                    | Prevents Full Rehab fallback misuse.                          |
| trade_family          | Required future field | Trade grouping for scope mismatch checks      | Used for allowed/blocked trade matrix.                        |
| allowed_service_slugs | Required future field | Services where item can auto-appear           | Required before default_included=true.                        |
| blocked_service_slugs | Recommended           | Services where item should warn/block         | Supports health checks.                                       |
| unit                  | Required              | Unit of measure                               | Must match measurement_profile.                               |
| qty_rule              | Required future field | How quantity is derived                       | Never apply project sqft globally.                            |
| measurement_source    | Required future field | manual/input/takeoff/photo/assembly/allowance | Controls auditability.                                        |
| phase                 | Required future field | Proposal/costing phase                        | Avoid Phase=Other for generated lines.                        |
| labor_rate            | Recommended           | Labor cost component                          | Separate labor/material for TVIK.                             |
| material_rate         | Recommended           | Material cost component                       | Separate labor/material for TVIK.                             |
| equipment_rate        | Optional              | Equipment/consumables component               | Useful for power washing, scaffolding, rentals.               |
| default_markup        | Recommended           | Markup applied by deterministic engine        | Human-controlled, not AI-set.                                 |
| minimum_charge        | Recommended           | Minimum mobilization/charge protection        | Prevents small jobs being underpriced.                        |
| default_included      | High-risk             | Whether item is auto-generated                | Must be service-filtered.                                     |
| pdf_default           | High-risk             | Whether line appears in client PDF            | Mismatched or unreviewed lines should default false.          |
| requires_human_review | Recommended           | Flags exceptions/high-risk items              | Used for blocked-unless-confirmed trades.                     |
| requires_input_fields | Recommended           | Inputs needed before item can price           | Prevents placeholder quantities.                              |
| confidence_policy     | Recommended           | When AI suggests this item                    | AI suggestion must go to review queue.                        |
| version               | Recommended           | Item version                                  | Do not silently overwrite old pricing history.                |
| notes                 | Optional              | Estimator/vendor notes                        | Internal only unless converted to proposal language.          |

## 12. Assembly / Recipe Model

Assemblies should be versioned and service-specific.

Assembly types:

- base assembly,
- optional add-on,
- condition-based add-on,
- human-confirmed exception,
- allowance assembly,
- diagnostic/site-visit assembly.

Each assembly should define:

- `assembly_name`,
- `assembly_version`,
- `service_slug`,
- `allowed_project_categories`,
- `required_inputs`,
- `line_items`,
- `unit_rules`,
- `measurement_source`,
- `blocked_if_missing_inputs`,
- `pdf_default_behavior`,
- `health_checks`,
- `proposal_clauses`.

Example assemblies:

- `deck_staining_standard_v1`
- `windows_doors_basic_replacement_v1`
- `bathroom_tub_to_shower_budget_v1`
- `flooring_lvp_install_v1`
- `painting_room_repaint_v1`
- `drywall_patch_small_v1`
- `diagnostic_site_visit_v1`
- `full_rehab_budget_flip_v1`

## 13. Scope Mismatch Health Check Severity Model

| Severity | Meaning | Recommended behavior |
|---|---|---|
| Info | Helpful note | Show to estimator |
| Low | Review suggested | Warning only |
| Medium | Needs estimator review | Keep estimate out of Approved until reviewed |
| High | Likely wrong scope | Future block approval after workflow tests |
| Critical | Client/proposal danger | Future block proposal send after tests |

Example:

```json
{
  "check_type": "scope_mismatch",
  "service_slug": "windows_doors",
  "line_item_trade_family": "hvac",
  "severity": "high",
  "message": "Windows / Doors estimate includes HVAC. Confirm reason or remove before approval."
}
```

## 14. PDF / Proposal Safety Rules

- Do not include blocked or mismatched line items in public PDF by default.
- Do not include unreviewed AI suggestions in PDF.
- Do not include internal risk notes unless converted to client-facing language.
- Do not show confidence scores or internal AI reasoning to the client.
- Include assumptions, exclusions, allowances, and change-order language.
- Proposal/PDF must reflect the approved estimate revision.
- Human must initiate proposal send.

## 15. AI Boundary Rules

AI may:

- classify service type,
- suggest scope,
- summarize evidence,
- ask missing-info questions,
- flag mismatch,
- draft proposal-safe language,
- identify likely omissions.

AI may not:

- approve estimates,
- send proposals,
- set final prices,
- remove risk clauses,
- mutate approved estimates,
- bypass review queue,
- overwrite audit trail,
- silently change status workflow.

All AI suggestions must preserve:

- confidence,
- evidence,
- source type,
- suggested value,
- decision state,
- idempotency key,
- human accept/edit/reject/ignore workflow.

## 16. Golden Regression Test Cases

| service_slug           | input_prompt                                              | must_not_include                                                                        | expected_health_check                                                                |
|:-----------------------|:----------------------------------------------------------|:----------------------------------------------------------------------------------------|:-------------------------------------------------------------------------------------|
| deck_staining          | Power wash and stain 250 sf deck                          | drywall; electrical; plumbing; HVAC; flooring; full framing                             | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| windows_doors          | Install 4 replacement windows                             | HVAC; plumbing; flooring; full drywall; full electrical; roofing; broad full rehab rows | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| bathroom_remodel       | Replace bathtub with tiled shower, new toilet, and vanity | roofing; siding; full HVAC unless ventilation scope confirmed                           | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| kitchen_remodel        | Replace kitchen cabinets and backsplash                   | roofing; siding; HVAC unless confirmed; broad exterior rows                             | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| flooring               | Install 600 sf LVP flooring                               | HVAC; plumbing; full electrical; roofing; siding                                        | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| interior_painting      | Paint one bedroom walls and trim                          | flooring; HVAC; plumbing; full electrical                                               | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| exterior_painting      | Paint exterior trim and siding on one-story home          | HVAC; plumbing; interior flooring; interior drywall                                     | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| drywall_patch_repair   | Patch 4 drywall holes after TV mount removal              | full rehab drywall package; HVAC; plumbing; flooring                                    | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| electrical             | Replace 10 outlets and 2 light fixtures                   | plumbing; HVAC; flooring; full drywall package                                          | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| plumbing               | Replace vanity faucet and toilet                          | HVAC; flooring unless access confirmed; roofing                                         | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| hvac                   | Replace furnace and AC coil                               | plumbing; flooring; unrelated interior remodel rows                                     | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| roofing                | Replace 15 square asphalt shingle roof                    | interior remodel rows; plumbing; flooring; cabinets                                     | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| siding                 | Replace siding on detached garage                         | interior trades unless damage confirmed                                                 | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| framing_carpentry      | Repair damaged rough opening before window install        | broad MEP rows unless confirmed                                                         | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| trim_finish_carpentry  | Install baseboards in two rooms                           | MEP rows; full drywall/flooring rows unless confirmed                                   | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| punch_list_closeout    | Fix threshold, touch up cabinets, patch baseboard         | full trade packages unless confirmed                                                    | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| repair_correction      | Repair water damaged window trim                          | unrelated full rehab rows                                                               | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| diagnostic_site_visit  | Site visit to inspect sagging floor                       | automatic repair/install rows                                                           | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| full_rehab_multi_trade | Full rehab 1200 sf house                                  | multi-trade allowed but requires phase clarity and health checks                        | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |
| insurance_damage_scope | Prepare repair scope for water damaged bathroom ceiling   | unrelated upgrade rows                                                                  | warning-only pass if only allowed trades; high warning if blocked trades auto-appear |

## 17. New Estimate UI / UX Requirements

The New Estimate screen must not stop at:

```text
Project Category
Scope Class
Job Size / Complexity
```

Target intake stack:

```text
Project Category → Service Type → Scope Class → Required Inputs → Allowed Assemblies → Scope Health Check
```

For example, Windows / Doors should show service types:

- window replacement,
- exterior door replacement,
- interior door replacement,
- sliding/patio door,
- trim-only,
- repair/adjustment.

Then it should show only relevant questions.

## 18. Buildxact-Inspired UI / Workflow Benchmark

Use the following public benchmark patterns as TVIK-owned requirements.

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

## 19. Implementation Sequence

Use this order. Do not skip ahead.

```text
P0 — Documentation/source package
P1 — Report-only audit of current categories and cost-library rows
P2 — Warning-only scope mismatch health checks
P3 — Add service_slug classification map
P4 — Add service-specific cost-library filters
P5 — Add service-specific required-input checklists
P6 — Add service-specific assemblies
P7 — Add golden tests
P8 — Add PDF safety behavior
P9 — Add approval/status blocking after tests
P10 — Pricing calibration
P11 — UI polish and mobile service-specific intake
```

## 20. Definition of Done

The system is not considered professionally functional until:

- A narrow service never auto-generates unrelated Full Rehab rows.
- Every estimate has a service_slug or explicit multi-trade classification.
- Every service has required-input questions.
- Every generated line item has an allowed service/trade relationship.
- Blocked trades trigger warning/health check.
- Public PDF does not include mismatched lines by default.
- Human can override with reason.
- Golden tests prove deck staining, windows/doors, painting, flooring, bathroom, kitchen, trades, and full rehab behavior.
- Pricing remains deterministic.
- AI remains advisory.
- Approval/sending remains human-gated.
- Patch log records major source/package, docs, and runtime changes.
