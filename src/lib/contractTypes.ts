// ─── Phase 4: Contract Financial Types ───

export type ContractStatus = 'Active' | 'Paused' | 'Completed';
export type ChangeOrderType = 'Client Upgrade' | 'Hidden Condition' | 'Design Change' | 'Scope Correction';
export type PaymentTemplate = 'Standard-3Pay' | 'Deposit+Milestones' | 'Custom';
export type WipStatus = 'Not Started' | 'In Progress' | 'Completed';

export interface Contract {
  id?: string;
  contract_id: string;
  estimate_id: string;
  user_id?: string;
  contract_status: ContractStatus;
  baseline_contract_value: number;
  baseline_margin_pct: number;
  baseline_risk_exposure: number;
  signed_date: string;
  locked: boolean;
  // WIP + Financial
  net_contract_value: number;
  earned_revenue: number;
  percent_complete: number;
  projected_final_cost: number;
  projected_final_profit: number;
  margin_current_pct: number;
  profit_fade_flag: boolean;
  // Cash Forecast
  payment_terms_template: PaymentTemplate;
  payment_schedule_json: string;
  cash_forecast_30: number;
  cash_forecast_60: number;
  cash_forecast_90: number;
  created_at?: string;
  updated_at?: string;
}

export interface ChangeOrder {
  id?: string;
  change_order_id: string;
  contract_id: string;
  user_id?: string;
  description: string;
  change_type: ChangeOrderType;
  delta_value: number;
  approved: boolean;
  approved_at?: string | null;
  override_reason: string;
  created_at?: string;
}

export interface ContractAuditEntry {
  id?: string;
  contract_id: string;
  user_id?: string;
  action_type: string;
  old_value: string;
  new_value: string;
  reason: string;
  created_at?: string;
}

export interface PaymentMilestone {
  label: string;
  percent: number;
  trigger_type: 'completion' | 'date';
  trigger_value: number | string; // percent_complete threshold or date string
  amount?: number;
  paid?: boolean;
}

// Default payment templates
export const PAYMENT_TEMPLATES: Record<PaymentTemplate, PaymentMilestone[]> = {
  'Standard-3Pay': [
    { label: 'Deposit', percent: 30, trigger_type: 'completion', trigger_value: 0 },
    { label: 'Mid-project', percent: 40, trigger_type: 'completion', trigger_value: 50 },
    { label: 'Final', percent: 30, trigger_type: 'completion', trigger_value: 95 },
  ],
  'Deposit+Milestones': [
    { label: 'Deposit', percent: 20, trigger_type: 'completion', trigger_value: 0 },
    { label: 'Rough-in', percent: 30, trigger_type: 'completion', trigger_value: 30 },
    { label: 'Drywall', percent: 20, trigger_type: 'completion', trigger_value: 60 },
    { label: 'Final', percent: 30, trigger_type: 'completion', trigger_value: 95 },
  ],
  'Custom': [],
};

export const MARGIN_FIREWALL_THRESHOLD = 0.16; // 16%
export const PROFIT_FADE_THRESHOLD = 0.05; // 5 percentage points
