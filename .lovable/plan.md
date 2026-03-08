

## Problem

When you type a project description and click "Analyze Initial Intake", the system shows a red "Save estimate first" error. This is because the estimate must be saved to the database before AI analysis can run — but the current UI does not make this obvious or handle it automatically.

## Solution

Auto-save the estimate when the user clicks "Analyze Initial Intake" (and other AI actions) if it hasn't been saved yet, instead of just showing an error. This removes the friction of needing to manually save first.

### Changes (single file: `src/components/AIIntakePanel.tsx`)

1. **Accept an `onSave` callback prop** from the parent `NewEstimate` page — this will trigger the existing save logic and return the new `estimateDbId`.

2. **In `analyzeInitialIntake`** (and optionally other gated functions): if `estimateDbId` is not set, call `onSave()` first, then proceed with the analysis using the returned ID — instead of showing the "Save estimate first" toast and returning.

### Changes (`src/pages/NewEstimate.tsx`)

3. **Pass an `onAutoSave` prop** to `AIIntakePanel` that wraps the existing `saveDraft` logic and returns the resulting `estimateDbId`.

### User experience after patch

- User fills in project description and clicks "Analyze Initial Intake"
- System auto-saves the draft (shows "Draft saved" toast)
- Analysis begins immediately — no manual save step required
- If auto-save fails for some reason, a clear error is shown

