
-- ═══════════════════════════════════════════════════
-- Phase 4: Contracts, Change Orders, Audit Log
-- ═══════════════════════════════════════════════════

-- A) Contracts table
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id text NOT NULL,
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  contract_status text NOT NULL DEFAULT 'Active',
  baseline_contract_value numeric NOT NULL DEFAULT 0,
  baseline_margin_pct numeric NOT NULL DEFAULT 0,
  baseline_risk_exposure numeric NOT NULL DEFAULT 0,
  signed_date date NOT NULL DEFAULT CURRENT_DATE,
  locked boolean NOT NULL DEFAULT true,

  -- WIP + Financial
  net_contract_value numeric NOT NULL DEFAULT 0,
  earned_revenue numeric NOT NULL DEFAULT 0,
  percent_complete numeric NOT NULL DEFAULT 0,
  projected_final_cost numeric NOT NULL DEFAULT 0,
  projected_final_profit numeric NOT NULL DEFAULT 0,
  margin_current_pct numeric NOT NULL DEFAULT 0,
  profit_fade_flag boolean NOT NULL DEFAULT false,

  -- Cash Forecast
  payment_terms_template text NOT NULL DEFAULT 'Standard-3Pay',
  payment_schedule_json text NOT NULL DEFAULT '[]',
  cash_forecast_30 numeric NOT NULL DEFAULT 0,
  cash_forecast_60 numeric NOT NULL DEFAULT 0,
  cash_forecast_90 numeric NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(contract_id, user_id)
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contracts" ON public.contracts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contracts" ON public.contracts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contracts" ON public.contracts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contracts" ON public.contracts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- B) Change Orders table
CREATE TABLE public.change_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id text NOT NULL,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  description text NOT NULL DEFAULT '',
  change_type text NOT NULL DEFAULT 'Scope Correction',
  delta_value numeric NOT NULL DEFAULT 0,
  approved boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  override_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(change_order_id, user_id)
);

ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own change_orders" ON public.change_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own change_orders" ON public.change_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own change_orders" ON public.change_orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own change_orders" ON public.change_orders FOR DELETE USING (auth.uid() = user_id);

-- C) Contract Audit Log
CREATE TABLE public.contract_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action_type text NOT NULL DEFAULT '',
  old_value text NOT NULL DEFAULT '',
  new_value text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit_log" ON public.contract_audit_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own audit_log" ON public.contract_audit_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- D) Upgrade estimate_line_items with contract/WIP fields
ALTER TABLE public.estimate_line_items
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wip_status text NOT NULL DEFAULT 'Not Started',
  ADD COLUMN IF NOT EXISTS percent_complete numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_labor_cost_to_date numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_material_cost_to_date numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS projected_labor_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS projected_material_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheduled_start date,
  ADD COLUMN IF NOT EXISTS scheduled_finish date;
