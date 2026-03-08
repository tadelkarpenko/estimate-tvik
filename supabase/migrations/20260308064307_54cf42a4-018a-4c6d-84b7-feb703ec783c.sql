
-- Patch 6: Add merge analysis fields to estimate_areas
ALTER TABLE public.estimate_areas
  ADD COLUMN IF NOT EXISTS merged_scope_summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS merged_visible_facts text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS merged_inferences text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS merged_needs_verification text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS merged_risks text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS merged_trade_detection text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS merged_missing_questions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS merged_confidence text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS merged_last_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_analysis_status text NOT NULL DEFAULT 'Not Run',
  ADD COLUMN IF NOT EXISTS latest_merge_batch_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS conflict_summary text NOT NULL DEFAULT '';

-- Patch 6: Add merge analysis fields to estimates
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS merged_scope_summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS merged_visible_facts text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS merged_inferences text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS merged_needs_verification text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS merged_risks text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS merged_trade_detection text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS merged_missing_questions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS merged_confidence text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS merged_last_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_analysis_status text NOT NULL DEFAULT 'Not Run',
  ADD COLUMN IF NOT EXISTS latest_merge_batch_id text NOT NULL DEFAULT '';
