
-- Estimates table
CREATE TABLE public.estimates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estimate_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL DEFAULT 'TVIK',
  status TEXT NOT NULL DEFAULT 'Draft',
  client_name TEXT NOT NULL DEFAULT '',
  client_email TEXT NOT NULL DEFAULT '',
  client_phone TEXT NOT NULL DEFAULT '',
  project_address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'IL',
  zip TEXT NOT NULL DEFAULT '',
  project_name TEXT NOT NULL DEFAULT '',
  project_type TEXT NOT NULL DEFAULT 'Full Rehab',
  sqft NUMERIC NOT NULL DEFAULT 0,
  fixture_count NUMERIC NOT NULL DEFAULT 0,
  labor_hours NUMERIC NOT NULL DEFAULT 0,
  finish_level TEXT NOT NULL DEFAULT 'Basic',
  finish_materials_included BOOLEAN NOT NULL DEFAULT false,
  labor_subtotal NUMERIC NOT NULL DEFAULT 0,
  material_subtotal NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  cost_structure_json TEXT NOT NULL DEFAULT '[]',
  line_items_json TEXT NOT NULL DEFAULT '[]',
  risk_cost_low NUMERIC NOT NULL DEFAULT 0,
  risk_cost_high NUMERIC NOT NULL DEFAULT 0,
  overall_risk_level TEXT NOT NULL DEFAULT 'Low',
  risk_table_json TEXT NOT NULL DEFAULT '[]',
  overhead_pct NUMERIC NOT NULL DEFAULT 0.10,
  profit_pct NUMERIC NOT NULL DEFAULT 0.20,
  contingency_pct NUMERIC NOT NULL DEFAULT 0.10,
  total_low NUMERIC NOT NULL DEFAULT 0,
  total_high NUMERIC NOT NULL DEFAULT 0,
  assumptions_rich TEXT NOT NULL DEFAULT '',
  timeline_rich TEXT NOT NULL DEFAULT '',
  ai_scope TEXT NOT NULL DEFAULT '',
  ai_price_audit_summary TEXT NOT NULL DEFAULT '',
  public_pdf_url TEXT NOT NULL DEFAULT '',
  internal_pdf_url TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT 'v1.0',
  last_revision_summary TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX idx_estimates_user_estimate_id ON public.estimates(user_id, estimate_id);

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own estimates" ON public.estimates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own estimates" ON public.estimates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own estimates" ON public.estimates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own estimates" ON public.estimates FOR DELETE USING (auth.uid() = user_id);

-- Cost Library table
CREATE TABLE public.cost_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_type TEXT NOT NULL,
  trade TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  qty_rule TEXT NOT NULL DEFAULT 'lump_sum',
  default_included BOOLEAN NOT NULL DEFAULT true,
  labor_unit_cost NUMERIC NOT NULL DEFAULT 0,
  material_unit_cost NUMERIC NOT NULL DEFAULT 0,
  unit_label TEXT NOT NULL DEFAULT 'ls',
  notes TEXT NOT NULL DEFAULT '',
  last_updated TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cost_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cost_library" ON public.cost_library FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cost_library" ON public.cost_library FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cost_library" ON public.cost_library FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cost_library" ON public.cost_library FOR DELETE USING (auth.uid() = user_id);

-- Risk Library table
CREATE TABLE public.risk_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_type TEXT NOT NULL,
  risk_name TEXT NOT NULL,
  default_level TEXT NOT NULL DEFAULT 'Low',
  exposure_low_pct NUMERIC NOT NULL DEFAULT 0,
  exposure_high_pct NUMERIC NOT NULL DEFAULT 0,
  mitigation_note TEXT NOT NULL DEFAULT '',
  default_included BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own risk_library" ON public.risk_library FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own risk_library" ON public.risk_library FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own risk_library" ON public.risk_library FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own risk_library" ON public.risk_library FOR DELETE USING (auth.uid() = user_id);

-- Revision Logs table
CREATE TABLE public.revision_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estimate_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version TEXT NOT NULL DEFAULT 'v1.0',
  change_summary TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  delta_low NUMERIC NOT NULL DEFAULT 0,
  delta_high NUMERIC NOT NULL DEFAULT 0
);

ALTER TABLE public.revision_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own revision_logs" ON public.revision_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own revision_logs" ON public.revision_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own revision_logs" ON public.revision_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own revision_logs" ON public.revision_logs FOR DELETE USING (auth.uid() = user_id);

-- Cost Audits table
CREATE TABLE public.cost_audits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estimate_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  findings_json TEXT NOT NULL DEFAULT '[]',
  recommended_actions TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open'
);

ALTER TABLE public.cost_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cost_audits" ON public.cost_audits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cost_audits" ON public.cost_audits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cost_audits" ON public.cost_audits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cost_audits" ON public.cost_audits FOR DELETE USING (auth.uid() = user_id);

-- Estimate ID counter table
CREATE TABLE public.estimate_counter (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  counter INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.estimate_counter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own counter" ON public.estimate_counter FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own counter" ON public.estimate_counter FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own counter" ON public.estimate_counter FOR UPDATE USING (auth.uid() = user_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
