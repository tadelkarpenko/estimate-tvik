export type ProjectType = 'Bath' | 'Full Rehab';
export type EstimateStatus = 'Draft' | 'Ready' | 'Sent' | 'Accepted' | 'Rejected';
export type FinishLevel = 'Basic' | 'Mid' | 'High' | 'Luxury';
export type QtyRule = 'sqft' | 'fixture' | 'lump_sum' | 'each' | 'lf';
export type RiskLevel = 'Low' | 'Medium' | 'High';
export type AuditStatus = 'Open' | 'Accepted' | 'Ignored';

export interface Estimate {
  estimate_id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  status: EstimateStatus;
  client_name: string;
  client_email: string;
  client_phone: string;
  project_address: string;
  city: string;
  state: string;
  zip: string;
  project_name: string;
  project_type: ProjectType;
  sqft: number;
  fixture_count: number;
  finish_level: FinishLevel;
  finish_materials_included: boolean;
  labor_subtotal: number;
  material_subtotal: number;
  subtotal: number;
  cost_structure_json: string;
  line_items_json: string;
  risk_cost_low: number;
  risk_cost_high: number;
  overall_risk_level: RiskLevel;
  risk_table_json: string;
  overhead_pct: number;
  profit_pct: number;
  contingency_pct: number;
  total_low: number;
  total_high: number;
  assumptions_rich: string;
  timeline_rich: string;
  ai_scope: string;
  ai_price_audit_summary: string;
  public_pdf_url: string;
  internal_pdf_url: string;
  version: string;
  last_revision_summary: string;
}

export interface CostLibraryItem {
  id: string;
  project_type: ProjectType;
  trade: string;
  description: string;
  qty_rule: QtyRule;
  default_included: boolean;
  labor_unit_cost: number;
  material_unit_cost: number;
  unit_label: string;
  notes: string;
  last_updated: string;
}

export interface RiskLibraryItem {
  id: string;
  project_type: ProjectType;
  risk_name: string;
  default_level: RiskLevel;
  exposure_low_pct: number;
  exposure_high_pct: number;
  mitigation_note: string;
  default_included: boolean;
}

export interface EstimateRevisionLog {
  id: string;
  estimate_id: string;
  created_at: string;
  version: string;
  change_summary: string;
  snapshot_json: string;
  delta_low: number;
  delta_high: number;
}

export interface CostAudit {
  id: string;
  estimate_id: string;
  created_at: string;
  findings_json: string;
  recommended_actions: string;
  status: AuditStatus;
}

export interface LineItem {
  trade: string;
  description: string;
  qty: number;
  unit: string;
  labor: number;
  material: number;
  total: number;
}

export interface CostStructureItem {
  trade: string;
  labor: number;
  material: number;
  dollars: number;
  percent: number;
}

export interface RiskTableItem {
  risk_name: string;
  level: RiskLevel;
  exposure_low: number;
  exposure_high: number;
  mitigation_note: string;
}
