import { supabase } from '@/integrations/supabase/client';

const getUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
};

export type SuggestionSourceType = 'text' | 'voice' | 'photo' | 'merged';
export type SuggestionType = 'line_item' | 'exclusion' | 'allowance' | 'assumption' | 'risk_note' | 'internal_note' | 'site_visit_recommendation' | 'revision_warning' | 'trade_detection' | 'missing_info';
export type DecisionState = 'pending' | 'approved' | 'edited' | 'rejected' | 'applied';
export type SuggestionConfidence = 'High' | 'Medium' | 'Low';
export type SeverityLevel = 'Low' | 'Medium' | 'High';

// Legacy alias
export type SuggestionStatus = DecisionState;

export interface AISuggestion {
  id: string;
  suggestion_id: string;
  estimate_id: string;
  area_id?: string | null;
  estimate_version: string;
  schema_version: string;
  block_name: string;
  suggestion_batch_id: string;
  source_type: SuggestionSourceType;
  suggestion_type: SuggestionType;
  confidence: SuggestionConfidence;
  severity_level: SeverityLevel;
  evidence_summary: string;
  reason_for_suggestion: string;
  suggested_value: string;
  apply_target: string;
  // decision_state is the canonical field; status kept for compat
  status: DecisionState;
  decision_state: DecisionState;
  requires_reapproval_if_applied: boolean;
  supersedes_suggestion_id: string;
  source_refs: string;
  idempotency_key: string;
  priority_level: string;
  queue_group: string;
  reviewer_notes: string;
  approved_by: string;
  approved_at: string | null;
  rejected_at: string | null;
  edited_value: string;
  created_at: string;
  updated_at: string;
}

export interface AIAppliedAudit {
  id: string;
  audit_id: string;
  estimate_id: string;
  area_id?: string | null;
  suggestion_id: string;
  estimate_version: string;
  apply_run_id: string;
  suggestion_batch_id: string;
  original_suggestion: string;
  final_applied_value: string;
  applied_field: string;
  confidence: string;
  approved_by: string;
  approved_at: string | null;
  source_type: string;
  created_at: string;
}

// ─── Row mapper ───
function rowToSuggestion(r: any): AISuggestion {
  const state = r.decision_state || r.status || 'pending';
  return {
    id: r.id,
    suggestion_id: r.suggestion_id || '',
    estimate_id: r.estimate_id,
    area_id: r.area_id || null,
    estimate_version: r.estimate_version || '',
    schema_version: r.schema_version || 'v1',
    block_name: r.block_name || '',
    suggestion_batch_id: r.suggestion_batch_id || '',
    source_type: r.source_type || 'text',
    suggestion_type: r.suggestion_type || 'internal_note',
    confidence: r.confidence || 'Medium',
    severity_level: r.severity_level || 'Medium',
    evidence_summary: r.evidence_summary || '',
    reason_for_suggestion: r.reason_for_suggestion || '',
    suggested_value: r.suggested_value || '',
    apply_target: r.apply_target || '',
    status: state,
    decision_state: state,
    requires_reapproval_if_applied: r.requires_reapproval_if_applied ?? false,
    supersedes_suggestion_id: r.supersedes_suggestion_id || '',
    source_refs: r.source_refs || '',
    idempotency_key: r.idempotency_key || '',
    priority_level: r.priority_level || 'Medium',
    queue_group: r.queue_group || '',
    reviewer_notes: r.reviewer_notes || '',
    approved_by: r.approved_by || '',
    approved_at: r.approved_at || null,
    rejected_at: r.rejected_at || null,
    edited_value: r.edited_value || '',
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// ─── Suggestions Queue ───

export const getSuggestions = async (estimateDbId: string): Promise<AISuggestion[]> => {
  const { data, error } = await supabase
    .from('ai_suggestions_queue')
    .select('*')
    .eq('estimate_id', estimateDbId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToSuggestion);
};

export const getAllSuggestions = async (limit = 500): Promise<AISuggestion[]> => {
  const { data, error } = await supabase
    .from('ai_suggestions_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(rowToSuggestion);
};

export const insertSuggestions = async (items: Omit<AISuggestion, 'id' | 'created_at' | 'updated_at'>[]): Promise<void> => {
  if (items.length === 0) return;
  const userId = await getUserId();
  const rows = items.map(item => ({
    ...item,
    user_id: userId,
  }));
  const { error } = await supabase.from('ai_suggestions_queue').insert(rows as any);
  if (error) throw error;
};

export const updateSuggestionStatus = async (
  id: string,
  newState: DecisionState,
  extras?: { reviewer_notes?: string; edited_value?: string; approved_by?: string }
): Promise<void> => {
  const update: any = {
    status: newState,
    decision_state: newState,
    updated_at: new Date().toISOString(),
  };
  if (newState === 'approved' || newState === 'edited') {
    update.approved_at = new Date().toISOString();
    update.approved_by = extras?.approved_by || 'TVIK';
    update.rejected_at = null;
  }
  if (newState === 'rejected') {
    update.rejected_at = new Date().toISOString();
    update.approved_at = null;
  }
  if (newState === 'pending') {
    update.approved_at = null;
    update.rejected_at = null;
  }
  if (extras?.reviewer_notes !== undefined) update.reviewer_notes = extras.reviewer_notes;
  if (extras?.edited_value !== undefined) update.edited_value = extras.edited_value;
  const { error } = await supabase.from('ai_suggestions_queue').update(update).eq('id', id);
  if (error) throw error;
};

export const deleteSuggestion = async (id: string): Promise<void> => {
  const { error } = await supabase.from('ai_suggestions_queue').delete().eq('id', id);
  if (error) throw error;
};

// ─── Applied Audit ───

export const insertAppliedAudit = async (items: Omit<AIAppliedAudit, 'id' | 'created_at'>[]): Promise<void> => {
  if (items.length === 0) return;
  const userId = await getUserId();
  const rows = items.map(item => ({
    ...item,
    user_id: userId,
  }));
  const { error } = await supabase.from('ai_applied_suggestions_audit').insert(rows as any);
  if (error) throw error;
};

export const getAppliedAudit = async (estimateDbId: string): Promise<AIAppliedAudit[]> => {
  const { data, error } = await supabase
    .from('ai_applied_suggestions_audit')
    .select('*')
    .eq('estimate_id', estimateDbId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as AIAppliedAudit[];
};

// ─── Suggestion Type Labels ───

export const SUGGESTION_TYPE_LABELS: Record<SuggestionType, string> = {
  line_item: 'Line Item',
  exclusion: 'Exclusion',
  allowance: 'Allowance',
  assumption: 'Assumption',
  risk_note: 'Risk Note',
  internal_note: 'Internal Note',
  site_visit_recommendation: 'Site Visit',
  revision_warning: 'Revision Warning',
  trade_detection: 'Trade Detection',
  missing_info: 'Missing Info',
};

export const SUGGESTION_STATUS_COLORS: Record<DecisionState, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-300',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  edited: 'bg-blue-100 text-blue-800 border-blue-300',
  rejected: 'bg-red-100 text-red-800 border-red-300',
  applied: 'bg-slate-100 text-slate-600 border-slate-300',
};

export const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  Low: 'bg-slate-100 text-slate-700 border-slate-300',
  Medium: 'bg-amber-100 text-amber-800 border-amber-300',
  High: 'bg-red-100 text-red-800 border-red-300',
};

export const CONFIDENCE_COLORS: Record<SuggestionConfidence, string> = {
  High: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Medium: 'bg-amber-100 text-amber-800 border-amber-300',
  Low: 'bg-red-100 text-red-800 border-red-300',
};
