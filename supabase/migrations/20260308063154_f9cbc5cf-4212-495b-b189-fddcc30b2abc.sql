
ALTER TABLE public.estimate_areas
  ADD COLUMN IF NOT EXISTS latest_photo_batch_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS photo_analysis_status text NOT NULL DEFAULT 'Not Run',
  ADD COLUMN IF NOT EXISTS photo_analysis_summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS missing_visual_information text NOT NULL DEFAULT '';
