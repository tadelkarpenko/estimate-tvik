

## Problem

The Dashboard's Action Queue shows audit items for estimates that no longer exist (EST-0001 through EST-0006). The `cost_audits` table stores `estimate_id` as plain text with no foreign key cascade, so deleting an estimate leaves orphaned audit rows behind.

## Root Cause

Two issues:
1. **No cascade delete**: When estimates are deleted via `deleteEstimate()`, related `cost_audits` rows are not cleaned up.
2. **No filtering on Dashboard**: The Dashboard blindly displays all open audits without checking if the referenced estimate still exists.

## Fix Plan

### 1. Filter orphaned audits on Dashboard (immediate fix)
In `Dashboard.tsx`, after loading estimates and audits, filter out audits whose `estimate_id` doesn't match any existing estimate:

```ts
const existingEstIds = new Set(estimates.map(e => e.estimate_id));
const openAudits = audits.filter(a => a.status === 'Open' && existingEstIds.has(a.estimate_id));
```

Apply the same filter to the `actions` loop that creates Audit action items (line 105-107).

### 2. Clean up orphaned records on estimate delete (preventive fix)
In `src/lib/store.ts` `deleteEstimate()`, add cleanup calls to delete related `cost_audits` rows when an estimate is deleted. This prevents future orphans.

### 3. One-time data cleanup (optional)
Delete the 7 orphaned `cost_audits` rows for EST-0001 through EST-0006 via a migration or manual action, so they don't linger in the database.

## Files Changed
- `src/pages/Dashboard.tsx` — filter audits against existing estimate IDs
- `src/lib/store.ts` — cascade-delete cost_audits in `deleteEstimate()`

## Safety
- No existing behavior is broken
- No schema changes required
- Additive filter logic only

