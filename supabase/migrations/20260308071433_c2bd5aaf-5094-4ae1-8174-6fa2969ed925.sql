
-- Add missing fields to estimate_health_checks for Patch 8
ALTER TABLE public.estimate_health_checks
  ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.estimate_areas(id) ON DELETE SET NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS blocking_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS human_fix_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_allowed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS override_reason_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS missing_scope_categories text NOT NULL DEFAULT '';

-- Add missing fields to estimates for Patch 8
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS review_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_block_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS override_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_reason text NOT NULL DEFAULT '';
