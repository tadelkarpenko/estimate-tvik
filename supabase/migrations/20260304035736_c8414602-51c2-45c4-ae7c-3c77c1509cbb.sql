
-- Add estimate reliability fields
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS validity_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS material_volatility_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS volatility_reviewed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completeness_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calc_status text NOT NULL DEFAULT 'Stale';

-- Add contract data quality score
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS data_completeness_score numeric NOT NULL DEFAULT 0;
