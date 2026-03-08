
-- 1. Create estimate_areas table
CREATE TABLE public.estimate_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id text NOT NULL DEFAULT (gen_random_uuid())::text,
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  area_name text NOT NULL DEFAULT '',
  area_type text NOT NULL DEFAULT 'Other',
  area_sequence integer NOT NULL DEFAULT 0,
  notes_text text NOT NULL DEFAULT '',
  voice_transcript_raw text NOT NULL DEFAULT '',
  voice_transcript_cleaned text NOT NULL DEFAULT '',
  uploaded_photo_count integer NOT NULL DEFAULT 0,
  quick_tags text NOT NULL DEFAULT '',
  visible_findings text NOT NULL DEFAULT '',
  likely_scope_items text NOT NULL DEFAULT '',
  possible_hidden_risks text NOT NULL DEFAULT '',
  ai_detected_trades text NOT NULL DEFAULT '',
  suggested_allowances text NOT NULL DEFAULT '',
  suggested_exclusions text NOT NULL DEFAULT '',
  suggested_assumptions text NOT NULL DEFAULT '',
  missing_info_questions text NOT NULL DEFAULT '',
  confidence text NOT NULL DEFAULT 'Medium',
  site_visit_flag boolean NOT NULL DEFAULT false,
  revision_status text NOT NULL DEFAULT 'Original',
  latest_ai_summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.estimate_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own estimate_areas" ON public.estimate_areas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own estimate_areas" ON public.estimate_areas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own estimate_areas" ON public.estimate_areas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own estimate_areas" ON public.estimate_areas FOR DELETE USING (auth.uid() = user_id);

-- 2. Extend estimates with rollup fields
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS area_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_pending_suggestions_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_estimate_health_status text NOT NULL DEFAULT 'Good',
  ADD COLUMN IF NOT EXISTS ai_estimate_rollup_summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ai_revision_review_status text NOT NULL DEFAULT 'No Review Needed',
  ADD COLUMN IF NOT EXISTS estimate_site_visit_recommended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimate_confidence_rollup text NOT NULL DEFAULT 'Medium';

-- 3. Extend ai_suggestions_queue with area/batch/priority fields
ALTER TABLE public.ai_suggestions_queue
  ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.estimate_areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suggestion_batch_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS priority_level text NOT NULL DEFAULT 'Medium',
  ADD COLUMN IF NOT EXISTS queue_group text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_timestamp timestamptz;

-- 4. Extend ai_applied_suggestions_audit with area/batch fields
ALTER TABLE public.ai_applied_suggestions_audit
  ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.estimate_areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suggestion_batch_id text NOT NULL DEFAULT '';
