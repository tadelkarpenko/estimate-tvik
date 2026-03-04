
-- Phase 7: Crew Capacity & Utilization Intelligence
CREATE TABLE public.crew_capacity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trade text NOT NULL DEFAULT '',
  crew_size integer NOT NULL DEFAULT 2,
  hours_per_day numeric NOT NULL DEFAULT 8,
  work_days_per_week integer NOT NULL DEFAULT 5,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  overtime_allowed boolean NOT NULL DEFAULT false,
  overtime_multiplier numeric NOT NULL DEFAULT 1.5,
  max_safe_utilization_pct numeric NOT NULL DEFAULT 85,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crew_capacity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own crew_capacity" ON public.crew_capacity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own crew_capacity" ON public.crew_capacity FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own crew_capacity" ON public.crew_capacity FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own crew_capacity" ON public.crew_capacity FOR DELETE USING (auth.uid() = user_id);
