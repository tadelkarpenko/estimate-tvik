// ─── Phase 5: Subcontract, Vendor, Schedule, Execution Intelligence Types ───

export interface Subcontract {
  id?: string;
  subcontract_id: string;
  contract_id: string;
  user_id?: string;
  vendor_name: string;
  trade: string;
  committed_cost: number;
  approved_cost: number;
  estimated_trade_budget: number;
  remaining_commitment: number;
  exposure_index: number;
  status: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface SubcontractInvoice {
  id?: string;
  invoice_id: string;
  subcontract_id: string;
  user_id?: string;
  amount: number;
  status: string; // Pending | Approved | Paid | Disputed
  submitted_at?: string;
  paid_at?: string | null;
  dispute_flag: boolean;
  dispute_reason: string;
  created_at?: string;
}

export interface VendorPerformance {
  id?: string;
  user_id?: string;
  vendor_name: string;
  contracts_count: number;
  avg_trade_variance: number;
  avg_schedule_delay: number;
  invoice_dispute_rate: number;
  retention_issue_rate: number;
  performance_score: number;
  cost_reliability_score: number;
  schedule_reliability_score: number;
  billing_accuracy_score: number;
  change_order_behavior_score: number;
  last_computed_at?: string;
  created_at?: string;
}

export interface SchedulePhase {
  id?: string;
  contract_id: string;
  user_id?: string;
  phase_name: string;
  planned_start?: string | null;
  planned_finish?: string | null;
  actual_start?: string | null;
  actual_finish?: string | null;
  planned_days: number;
  actual_days: number;
  delay_ratio: number;
  depends_on_phase?: string | null;
  status: string;
  created_at?: string;
}

export interface ExecutionEvent {
  id?: string;
  user_id?: string;
  contract_id: string;
  event_type: string;
  payload_json: string;
  status: string; // Queued | Processing | Completed | Failed
  result_json: string;
  created_at?: string;
  processed_at?: string | null;
}

export interface PMScorecardSnapshot {
  id?: string;
  user_id?: string;
  contract_id: string;
  margin_discipline: number;
  schedule_integrity: number;
  forecast_accuracy: number;
  change_order_quality: number;
  margin_expansion: number;
  composite_score: number;
  snapshot_json: string;
  created_at?: string;
}

export type RiskQuadrant = 'High Risk / High Opportunity' | 'High Risk / Low Opportunity' | 'Low Risk / High Opportunity' | 'Stable';

// Scorecard weights
export const PM_SCORECARD_WEIGHTS = {
  margin_discipline: 0.30,
  schedule_integrity: 0.20,
  forecast_accuracy: 0.15,
  change_order_quality: 0.15,
  margin_expansion: 0.20,
};
