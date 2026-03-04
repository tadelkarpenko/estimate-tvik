export type ProjectType = 'Bath' | 'Full Rehab' | 'Kitchen' | 'Small Job';
export type EstimateStatus = 'Draft' | 'Ready' | 'Sent' | 'Accepted' | 'Rejected';
export type FinishLevel = 'Basic' | 'Mid' | 'High' | 'Luxury';
export type QtyRule = 'sqft' | 'fixture' | 'lump_sum' | 'each' | 'lf' | 'hour';
export type RiskLevel = 'Low' | 'Medium' | 'High';
export type AuditStatus = 'Open' | 'Accepted' | 'Ignored';
export type Phase = 'Demo' | 'Protection' | 'Framing' | 'Drywall' | 'Paint' | 'Flooring' | 'Electrical' | 'Plumbing' | 'HVAC' | 'Kitchen' | 'Bath' | 'Exterior' | 'Roofing' | 'Permits' | 'Cleaning' | 'Other';
export type LineItemUnit = 'ea' | 'sf' | 'lf' | 'fixture' | 'hr' | 'day' | 'lump_sum';
export type LineItemSource = 'CostLibrary' | 'Assembly' | 'Manual' | 'AI_Suggestion' | 'AI Draft' | 'PhotoAI';
export type CrewTrade = 'Demo' | 'Framing' | 'Drywall' | 'Paint' | 'Flooring' | 'Electrical' | 'Plumbing' | 'HVAC' | 'General' | 'Exterior' | 'Roofing';
export type ChatRole = 'user' | 'assistant' | 'system';
export type AIConfidence = 'Low' | 'Medium' | 'High';

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
  labor_hours: number;
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
  crew_size: number;
  hours_per_day: number;
  subtotal_labor_hours: number;
  estimated_duration_days: number;
  internal_notes: string;
  public_notes: string;
  // Phase 3
  clarification_answers_json: string;
  ai_suggestions_last_json: string;
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
  labor_hours_per_unit: number;
  crew_trade: CrewTrade;
  productivity_note: string;
  active: boolean;
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

// ─── Line Items ───

export interface EstimateLineItem {
  id?: string;
  line_id: string;
  estimate_id: string;
  user_id?: string;
  phase: Phase;
  description: string;
  unit: LineItemUnit;
  qty: number;
  labor_unit_cost: number;
  material_unit_cost: number;
  labor_hours_per_unit: number;
  labor_hours_total: number;
  labor_total: number;
  material_total: number;
  line_total: number;
  source: LineItemSource;
  locked: boolean;
  pending_confirmation: boolean;
  confidence: AIConfidence;
  evidence_source: string;
  notes: string;
  created_at?: string;
}

// ─── Media ───

export interface EstimateMedia {
  id?: string;
  media_id: string;
  estimate_id: string;
  user_id?: string;
  file_url: string;
  caption: string;
  include_in_internal_pdf: boolean;
  include_in_public_pdf: boolean;
  created_at?: string;
}

export interface EstimateMediaAnalysis {
  id?: string;
  analysis_id: string;
  media_id: string;
  user_id?: string;
  observed_conditions: string;
  suggested_scope_impacts: string;
  risk_flags: string;
  recommended_allowance_range: string;
  ai_confidence: AIConfidence;
  questions_needed_json: string;
  created_at?: string;
}

// ─── Chat ───

export interface EstimateChatThread {
  id?: string;
  thread_id: string;
  estimate_id: string;
  user_id?: string;
  title: string;
  created_at?: string;
}

export interface EstimateChatMessage {
  id?: string;
  message_id: string;
  thread_id: string;
  user_id?: string;
  role: ChatRole;
  content: string;
  suggested_changes_json: string;
  created_at?: string;
}

// ─── AI Suggestion Types ───

export interface SuggestedAction {
  type: 'ADD_LINE_ITEM' | 'MODIFY_QTY' | 'MODIFY_UNIT_COST' | 'ADD_RISK' | 'ADD_ALLOWANCE' | 'SCOPE_CLARIFICATION';
  trade: string;
  description: string;
  unit: LineItemUnit;
  qty: number;
  labor_unit_cost: number | null;
  material_unit_cost: number | null;
  allowance_low: number | null;
  allowance_high: number | null;
  requires_confirmation: boolean;
  pending_confirmation: boolean;
  confidence: AIConfidence;
  evidence_source: 'Chat' | 'Photo' | 'CostLibraryGap';
  rationale: string;
}

export interface SuggestedChanges {
  meta: {
    confidence: AIConfidence;
    evidence_sources: string[];
    notes: string;
  };
  conditional_questions: {
    question: string;
    why_it_matters: string;
    answer_type: 'YesNo' | 'Number' | 'Picklist' | 'Text';
  }[];
  actions: SuggestedAction[];
}
