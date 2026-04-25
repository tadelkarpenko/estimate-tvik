# Why your estimate has trades you never asked for

## What I found in EST-0014 (KASHIF)

I pulled the actual data for this estimate. Here is exactly what happened:

- `project_type` = **Full Rehab**
- `sqft` = **2000**
- `ai_intake_summary` = *"...quote for structural framing only for a 2,000 sq. ft. full rehab project... scope is limited to the building's skeleton rather than a full interior build-out."*

But the line items table contains 10 rows, all created at the **exact same timestamp** (`2026-04-24 19:08:43`), all with `source = 'CostLibrary'`:

Demo, Drywall, Electrical, Flooring Labor, Flooring Underlayment, Framing, HVAC, Paint Labor, Paint Materials, Plumbing.

None of them came from the AI. None of them came from your typed instructions. They came from the **deterministic cost engine** (`src/lib/costEngine.ts` → `runCostEngine`).

## The root cause

When you press **Generate** on an estimate, this code runs (`src/pages/NewEstimate.tsx`, line 234):

```text
runCostEngine({ project_type: 'Full Rehab', sqft: 2000, ... })
   └─ filters CostLibrary by:  project_type === 'Full Rehab'  AND  default_included === true
        └─ returns EVERY trade marked as "default included" for Full Rehab
             └─ Demo, Framing, Drywall, Electrical, Plumbing, HVAC, Paint, Flooring …
```

The engine has **no awareness** of:
- the AI intake summary ("framing only")
- the merged scope summary
- the AI-detected trades
- anything you typed into the assistant

So whenever the project type is "Full Rehab", the engine assumes the full Full-Rehab assembly and stamps all of those trades onto the estimate at qty = 2,000 sf. That is why you see Demo, Drywall, Electrical, HVAC, Paint, Plumbing, Flooring — they are the Full-Rehab default kit, not anything we discussed.

The recent fix that re-categorized phases (Framing vs Other, etc.) made the labels correct, but it did **not** change *which* rows get inserted. The over-inclusion bug is upstream of phase resolution.

## The fix (small, additive, safe)

We need to teach the cost engine to respect a "scope filter" — the list of trades the user actually wants — and feed it the AI/user signal that already exists on the estimate.

### Plan

1. **Add an optional `included_trades` filter on `runCostEngine`** (`src/lib/costEngine.ts`)
   - New optional input: `included_trades?: Phase[]`
   - If provided and non-empty, the engine filters CostLibrary rows so only rows whose resolved phase is in that list are emitted.
   - If omitted/empty → current behavior (full default kit). No regression for existing flows.

2. **Persist the user's trade scope on the estimate** (additive column)
   - New column `estimates.included_trades text[]` (nullable; default null = "all defaults" = today's behavior).
   - Populated from either:
     - the AI intake (`ai_detected_trades` / `merged_trade_detection`), or
     - a new manual multi-select on the estimate form (see step 3).

3. **Add a "Trades to include" multi-select on the New Estimate page** (`src/pages/NewEstimate.tsx`)
   - Chips for the canonical phases: Demo, Framing, Drywall, Electrical, Plumbing, HVAC, Paint, Flooring, Tile, Cabinets, Countertops, Roofing, Exterior, Other.
   - Defaults to "All trades" (current behavior) so nothing breaks for existing estimates.
   - When the AI intake says "framing only", we pre-check the matching chips and surface a small banner: *"AI detected scope: Framing only. Generate will include only Framing line items."*
   - User can override at any time before Generate.

4. **Wire the filter into Generate**
   - At the `runCostEngine({...})` call site (line 234), pass `included_trades: form.included_trades ?? undefined`.
   - Pre-existing Manual and AI line items are already preserved (we only delete CostLibrary rows before regen — see `deleteCostLibraryLineItems`), so framing-only Generate will:
     - keep your manual Framing additions,
     - replace CostLibrary rows with Framing-only rows,
     - leave everything else untouched.

5. **Backfill EST-0014 (one-time, safe)**
   - Soft-delete (or just remove) the 9 phantom CostLibrary rows on EST-0014, leaving only Framing.
   - Recalculate subtotal, risk, and totals.
   - Bump revision with note: *"Scope corrected to structural framing only per intake."*
   - I will confirm with you before running this delete.

### What this does NOT change

- No change to risk engine, margin logic, PDF rendering, or revision system.
- No change to estimates that don't set `included_trades` — they keep today's behavior exactly.
- No rename or removal of any existing field, status, or page.
- AI remains advisory: it pre-suggests trade chips, the user (or the project's defaults) decide.

## Files that will be touched

- `src/lib/costEngine.ts` — add `included_trades` filter (≈10 lines).
- `src/pages/NewEstimate.tsx` — multi-select UI + pass-through to `runCostEngine` (≈40 lines, isolated section).
- `src/lib/types.ts` — add `included_trades?: Phase[]` to `Estimate`.
- New migration — add `included_trades text[]` column on `estimates`.
- One-time data fix for EST-0014 (only after you approve).

## Open question for you

When the AI intake clearly says "framing only" (or any single-trade scope), do you want:

- **A. Auto-apply** — pre-select only those trades, so Generate produces a framing-only estimate by default, with a banner the user can override.
- **B. Suggest only** — show the chips pre-checked, but require the user to click "Apply AI scope" before Generate honors it.

A is faster in the field; B is more conservative. Both are easy — pick one and I'll implement it that way.
