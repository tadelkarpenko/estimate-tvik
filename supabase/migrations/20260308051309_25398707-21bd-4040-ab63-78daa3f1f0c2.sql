
ALTER TABLE public.estimates 
  ADD COLUMN IF NOT EXISTS project_category text NOT NULL DEFAULT 'Custom Scope',
  ADD COLUMN IF NOT EXISTS scope_class text NOT NULL DEFAULT 'Full-Scope Multi-Trade',
  ADD COLUMN IF NOT EXISTS job_complexity text NOT NULL DEFAULT 'Standard Scope';
