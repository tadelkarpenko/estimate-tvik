
CREATE TABLE IF NOT EXISTS public.estimate_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  health_check_id text NOT NULL DEFAULT (gen_random_uuid())::text,
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  estimate_version text NOT NULL DEFAULT '',
  block_source text NOT NULL DEFAULT 'completeness_check',
  warning_level text NOT NULL DEFAULT 'Low',
  block_approval boolean NOT NULL DEFAULT false,
  completeness_score numeric NOT NULL DEFAULT 0,
  mismatch_summary text NOT NULL DEFAULT '',
  site_visit_recommended boolean NOT NULL DEFAULT false,
  confidence_rollup text NOT NULL DEFAULT 'Medium',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.estimate_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own estimate_health_checks"
  ON public.estimate_health_checks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own estimate_health_checks"
  ON public.estimate_health_checks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own estimate_health_checks"
  ON public.estimate_health_checks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own estimate_health_checks"
  ON public.estimate_health_checks FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE public.ai_suggestions_queue
  ADD COLUMN IF NOT EXISTS estimate_version text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS schema_version text NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS block_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS severity_level text NOT NULL DEFAULT 'Medium',
  ADD COLUMN IF NOT EXISTS decision_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS requires_reapproval_if_applied boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supersedes_suggestion_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_refs text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS idempotency_key text NOT NULL DEFAULT '';

ALTER TABLE public.ai_applied_suggestions_audit
  ADD COLUMN IF NOT EXISTS estimate_version text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS apply_run_id text NOT NULL DEFAULT '';
