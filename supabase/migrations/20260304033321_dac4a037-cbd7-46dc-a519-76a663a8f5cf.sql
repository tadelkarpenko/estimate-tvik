
-- ═══════════════════════════════════════════════════════
-- PHASE 5: Subcontract, Vendor, Schedule, Execution Intelligence
-- ═══════════════════════════════════════════════════════

-- 1. Subcontracts table
CREATE TABLE public.subcontracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subcontract_id TEXT NOT NULL,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  vendor_name TEXT NOT NULL DEFAULT '',
  trade TEXT NOT NULL DEFAULT '',
  committed_cost NUMERIC NOT NULL DEFAULT 0,
  approved_cost NUMERIC NOT NULL DEFAULT 0,
  estimated_trade_budget NUMERIC NOT NULL DEFAULT 0,
  remaining_commitment NUMERIC NOT NULL DEFAULT 0,
  exposure_index NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subcontracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subcontracts" ON public.subcontracts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subcontracts" ON public.subcontracts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subcontracts" ON public.subcontracts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subcontracts" ON public.subcontracts FOR DELETE USING (auth.uid() = user_id);

-- 2. Subcontract Invoices table
CREATE TABLE public.subcontract_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  subcontract_id UUID NOT NULL REFERENCES public.subcontracts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  dispute_flag BOOLEAN NOT NULL DEFAULT false,
  dispute_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subcontract_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subcontract_invoices" ON public.subcontract_invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subcontract_invoices" ON public.subcontract_invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subcontract_invoices" ON public.subcontract_invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subcontract_invoices" ON public.subcontract_invoices FOR DELETE USING (auth.uid() = user_id);

-- 3. Vendor Performance table
CREATE TABLE public.vendor_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vendor_name TEXT NOT NULL,
  contracts_count INTEGER NOT NULL DEFAULT 0,
  avg_trade_variance NUMERIC NOT NULL DEFAULT 0,
  avg_schedule_delay NUMERIC NOT NULL DEFAULT 0,
  invoice_dispute_rate NUMERIC NOT NULL DEFAULT 0,
  retention_issue_rate NUMERIC NOT NULL DEFAULT 0,
  performance_score NUMERIC NOT NULL DEFAULT 0,
  cost_reliability_score NUMERIC NOT NULL DEFAULT 0,
  schedule_reliability_score NUMERIC NOT NULL DEFAULT 0,
  billing_accuracy_score NUMERIC NOT NULL DEFAULT 0,
  change_order_behavior_score NUMERIC NOT NULL DEFAULT 0,
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, vendor_name)
);

ALTER TABLE public.vendor_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own vendor_performance" ON public.vendor_performance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own vendor_performance" ON public.vendor_performance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own vendor_performance" ON public.vendor_performance FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own vendor_performance" ON public.vendor_performance FOR DELETE USING (auth.uid() = user_id);

-- 4. Schedule Phases table (for delay propagation)
CREATE TABLE public.schedule_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  phase_name TEXT NOT NULL DEFAULT '',
  planned_start DATE,
  planned_finish DATE,
  actual_start DATE,
  actual_finish DATE,
  planned_days INTEGER NOT NULL DEFAULT 0,
  actual_days INTEGER NOT NULL DEFAULT 0,
  delay_ratio NUMERIC NOT NULL DEFAULT 1.0,
  depends_on_phase UUID REFERENCES public.schedule_phases(id),
  status TEXT NOT NULL DEFAULT 'Not Started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own schedule_phases" ON public.schedule_phases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own schedule_phases" ON public.schedule_phases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own schedule_phases" ON public.schedule_phases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own schedule_phases" ON public.schedule_phases FOR DELETE USING (auth.uid() = user_id);

-- 5. Execution Events queue (async intelligence layer)
CREATE TABLE public.execution_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'Queued',
  result_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.execution_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own execution_events" ON public.execution_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own execution_events" ON public.execution_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own execution_events" ON public.execution_events FOR UPDATE USING (auth.uid() = user_id);

-- 6. Add Phase 5 fields to contracts table
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS margin_risk_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin_opportunity_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS execution_priority_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_quadrant TEXT NOT NULL DEFAULT 'Stable',
  ADD COLUMN IF NOT EXISTS cost_volatility_index NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pm_scorecard_json TEXT NOT NULL DEFAULT '{}';

-- 7. PM Scorecard snapshots table
CREATE TABLE public.pm_scorecard_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  margin_discipline NUMERIC NOT NULL DEFAULT 0,
  schedule_integrity NUMERIC NOT NULL DEFAULT 0,
  forecast_accuracy NUMERIC NOT NULL DEFAULT 0,
  change_order_quality NUMERIC NOT NULL DEFAULT 0,
  margin_expansion NUMERIC NOT NULL DEFAULT 0,
  composite_score NUMERIC NOT NULL DEFAULT 0,
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_scorecard_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own pm_scorecard_snapshots" ON public.pm_scorecard_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pm_scorecard_snapshots" ON public.pm_scorecard_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
