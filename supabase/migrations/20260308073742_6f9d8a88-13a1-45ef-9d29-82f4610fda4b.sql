
ALTER TABLE public.estimate_health_checks
  ADD COLUMN IF NOT EXISTS resolution_summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS prior_health_check_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS related_execution_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS related_write_plan_id TEXT NOT NULL DEFAULT '';
