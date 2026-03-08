
I analyzed your screenshot and the current code. This is a real regression, and it is most visible on mobile.

## What is happening

- The red toast shows only “Save estimate first” on mobile because the toast sits under the iPhone status bar/notch, so the toast title is effectively hidden.
- The underlying failure is in AI Intake logic after autosave: several AI actions call `ensureSaved()` but still use the old `estimateDbId` prop (which can still be `undefined` in that same click cycle) when writing queue/health records.

## Root cause (code-level)

In `src/components/AIIntakePanel.tsx`:
- `analyzeInitialIntake`, `analyzeMerge`, `generateMissingInfoQuestions`, and `runCompletenessCheck` correctly call:
  - `const dbId = await ensureSaved();`
- But inside those same functions, some writes still use:
  - `estimate_id: estimateDbId`
  - `getSuggestions(estimateDbId)`
  - idempotency keys with `estimateDbId`
  - `saveHealthCheck({ estimate_id: estimateDbId, ... })`
- On first run (new unsaved estimate), `dbId` exists, but `estimateDbId` can still be stale/undefined until next render, causing downstream failure.

## Implementation plan

1. Normalize to a resolved estimate ID in each autosaved AI action
- In each function that starts with `const dbId = await ensureSaved()`, replace all downstream usage of `estimateDbId` with `dbId` for:
  - queue inserts (`estimate_id`)
  - `getSuggestions(...)` refresh calls
  - idempotency key construction
  - health-check writes

2. Add a small “resolved ID” guard to prevent stale-state reuse
- Keep `ensureSaved()` as source of truth and ensure all side effects within the same function use the returned `dbId` only.
- This prevents first-click failures on mobile and desktop.

3. Fix mobile toast safe-area overlap
- In `src/components/ui/toast.tsx`, update `ToastViewport` top spacing to respect safe area inset so title/description are fully visible on iPhone/PWA.
- Result: users will see full error context instead of only partial text.

4. Keep scope tight (no data model changes)
- No backend schema/policy changes needed.
- No estimator pricing logic changes.
- This is a UI/runtime patch only.

## Files to update

- `src/components/AIIntakePanel.tsx`
  - Replace stale `estimateDbId` references with resolved `dbId` inside autosaved AI actions.
- `src/components/ui/toast.tsx`
  - Add safe-area top padding for mobile/PWA toast viewport.

## Validation checklist (mobile-first)

1. Open `/estimates/new` on phone-sized viewport.
2. Enter Project Description only (do not manually save).
3. Tap “Analyze Initial Intake”.
4. Confirm:
   - Draft auto-saves.
   - Analysis completes.
   - No “save first” failure.
   - Suggestions queue refreshes successfully.
5. Repeat same first-run flow for:
   - Merge
   - Questions
   - Completeness
6. Confirm toast content is fully readable below the notch/status bar.

## Technical details (for implementation)

- Pattern to enforce:
  - `const dbId = await ensureSaved(); if (!dbId) return;`
  - Use `dbId` for all subsequent writes/reads in that handler.
- Do not rely on `estimateDbId` prop inside the same async cycle immediately after autosave.
- Keep current `onSave` contract from `NewEstimate` (`Promise<string | undefined>`) unchanged.
