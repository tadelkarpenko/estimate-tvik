
ALTER TABLE public.estimate_areas
  ADD COLUMN IF NOT EXISTS voice_transcript_source text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS voice_last_updated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS voice_capture_status text NOT NULL DEFAULT 'Not Started',
  ADD COLUMN IF NOT EXISTS voice_analysis_status text NOT NULL DEFAULT 'Not Run',
  ADD COLUMN IF NOT EXISTS latest_voice_batch_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS low_confidence_warning boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS site_visit_reason text NOT NULL DEFAULT '';
