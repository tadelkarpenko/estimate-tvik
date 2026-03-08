
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS ai_intake_summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS photo_analysis_summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS visible_findings text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS likely_scope_items text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS possible_hidden_risks text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS missing_info_questions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS suggested_allowances text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS suggested_exclusions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS suggested_assumptions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS suggested_line_items text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ai_detected_trades text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS site_visit_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_scope_confidence text NOT NULL DEFAULT 'Medium',
  ADD COLUMN IF NOT EXISTS photo_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS intake_last_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS revision_needed_warning boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_apply_status text NOT NULL DEFAULT 'Not Applied';
