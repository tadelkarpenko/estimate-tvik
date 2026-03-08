
-- Patch 9: Create estimate_write_plans staging table
CREATE TABLE public.estimate_write_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  write_plan_id text NOT NULL DEFAULT (gen_random_uuid())::text,
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  estimate_version text NOT NULL DEFAULT '',
  approved_by text NOT NULL DEFAULT 'TVIK',
  fields_to_update text NOT NULL DEFAULT '[]',
  line_items_to_add_or_edit text NOT NULL DEFAULT '[]',
  inclusions_to_append text NOT NULL DEFAULT '[]',
  exclusions_to_append text NOT NULL DEFAULT '[]',
  allowances_to_append text NOT NULL DEFAULT '[]',
  assumptions_to_append text NOT NULL DEFAULT '[]',
  risk_notes_to_append text NOT NULL DEFAULT '[]',
  audit_entries_to_create text NOT NULL DEFAULT '[]',
  requires_reapproval boolean NOT NULL DEFAULT false,
  summary text NOT NULL DEFAULT '',
  apply_status text NOT NULL DEFAULT 'staged',
  apply_run_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL
);

ALTER TABLE public.estimate_write_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own estimate_write_plans" ON public.estimate_write_plans
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own estimate_write_plans" ON public.estimate_write_plans
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own estimate_write_plans" ON public.estimate_write_plans
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own estimate_write_plans" ON public.estimate_write_plans
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
