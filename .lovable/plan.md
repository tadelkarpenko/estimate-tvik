

## Plan: AI Intake Assistant as Persistent Right Panel

### Problem
Currently the AI Intake Assistant opens as a slide-over Sheet that covers the estimate form. You want to work on both simultaneously — filling fields manually while using AI voice/text to populate data in parallel.

### Approach: Split-Panel Layout

Change the New Estimate page from a single full-width layout to a **two-column split layout**:

```text
┌──────────────────────────────┬─────────────────────┐
│   Estimate Form (left)       │  AI Intake Panel     │
│   - Project Classification   │  (always visible)    │
│   - Client Info              │  - Voice commands    │
│   - Notes                    │  - Photo upload      │
│   - Line Items               │  - Text intake       │
│   - Advanced Margins         │  - Suggestions queue │
│   - Action Buttons           │  - Review & apply    │
│                              │                      │
└──────────────────────────────┴─────────────────────┘
```

### Technical Changes

**File: `src/pages/NewEstimate.tsx`**

1. **Remove the Sheet wrapper** — the AI panel will no longer be a slide-over overlay
2. **Remove the "AI Intake Assistant" button** from the action bar (it's always visible now)
3. **Wrap the page in a two-column flex layout**:
   - Left column (~60%): scrollable estimate form (all existing content)
   - Right column (~40%): sticky `AIIntakePanel`, always mounted and visible
4. **On mobile** (below `lg` breakpoint): stack vertically — form on top, AI panel below, with a collapsible toggle so it doesn't overwhelm the screen
5. **`intakeOpen` state removal** — no longer needed since the panel is always present
6. **Keep the `AIIntakePanel` props unchanged** — `estimate`, `estimateDbId`, `media`, `onUpdate`, `onSave`, `onMediaChange` all stay the same

### Layout Detail

```tsx
// Outer wrapper
<div className="flex flex-col lg:flex-row gap-6">
  {/* Left: Estimate Form */}
  <div className="flex-1 min-w-0 space-y-6">
    {/* All existing form cards, notes, advanced, action buttons */}
  </div>
  
  {/* Right: AI Intake Panel - sticky */}
  <div className="w-full lg:w-[420px] lg:shrink-0">
    <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <AIIntakePanel ... />
    </div>
  </div>
</div>
```

### Mobile Behavior
- Below `lg` (1024px): the AI panel renders below the form with a collapsible header "AI Intake Assistant" so it can be expanded/collapsed
- Above `lg`: always visible side-by-side, sticky so it scrolls with you

### What stays the same
- All estimate form fields, calculations, pricing logic
- `AIIntakePanel` component internals (3200 lines) — untouched
- All props and data flow between form and AI panel
- Save/Generate/PDF buttons remain in the left column

### Scope
- 1 file changed: `src/pages/NewEstimate.tsx`
- No new components, no database changes, no new dependencies

