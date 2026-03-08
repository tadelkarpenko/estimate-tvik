

## Bug: Photos uploaded via Capture tab show "0 uploaded"

### Root Cause

The AI Intake Panel has two places where photos can be uploaded:

1. **Photos tab** (line ~2091): The `MediaUploader`'s `onUploaded` callback inserts an `estimate_media` record into the database, then calls `onMediaChange()` to re-fetch. This works correctly.

2. **Capture tab** (line ~1914): The `MediaUploader`'s `onUploaded` callback only calls `onMediaChange()` and increments the local `uploaded_photo_count` — but **never inserts an `estimate_media` record**. Since `onMediaChange()` re-fetches from the `estimate_media` table, it finds nothing new, so `media.length` stays at 0.

The toast "5 photo(s) uploaded" comes from the `MediaUploader` component itself (confirming files went to storage), but the count display reads from `media.length` which queries the database.

### Fix

**File: `src/components/AIIntakePanel.tsx`** — Update the Capture tab's `MediaUploader` `onUploaded` callback (~line 1914) to mirror the Photos tab pattern: insert an `estimate_media` record before calling `onMediaChange()`.

Specifically, replace the inline callback:
```ts
async () => { onMediaChange(); updateArea('uploaded_photo_count', selectedArea.uploaded_photo_count + 1); }
```

With:
```ts
async (url: string, caption: string) => {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: { user } } = await supabase.auth.getUser();
  if (user && estimateDbId) {
    await supabase.from('estimate_media').insert({
      estimate_id: estimateDbId,
      user_id: user.id,
      media_id: crypto.randomUUID(),
      file_url: url,
      caption: caption || '',
      include_in_internal_pdf: true,
      include_in_public_pdf: false,
    } as any);
  }
  onMediaChange();
  if (selectedArea) updateArea('uploaded_photo_count', selectedArea.uploaded_photo_count + 1);
}
```

This is a single-line fix in one file. No other changes needed.

