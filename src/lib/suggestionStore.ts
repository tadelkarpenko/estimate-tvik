import { supabase } from '@/integrations/supabase/client';

const getUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
};

export type SuggestionSourceType = 'text' | 'voice' | 'photo' | 'merged';
export type SuggestionType = 'line_item' | 'exclusion' | 'allowance' | 'assumption' | 'risk_note' | 'internal_note' | 'site_visit_recommendation' | 'revision_warning' | 'trade_detection' | 'missing_info';
export type SuggestionStatus = 'pending' | 'approved' | 'edited' | 'rejected' | 'applied';
export type SuggestionConfidence = 'High' | 'Medium' | 'Low';

export interface AISuggestion {
  id: string;
  suggestion_id: string;
  estimate_id: string;
  source_type: SuggestionSourceType;
  suggestion_type: SuggestionType;
  confidence: SuggestionConfidence;
  evidence_summary: string;
  reason_for_suggestion: string;
  suggested_value: string;
  apply_target: string;
  status: SuggestionStatus;
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
  suggestion_id: string;
  original_suggestion: string;
  final_applied_value: string;
  applied_field: string;
  confidence: string;
  approved_by: string;
  approved_at: string | null;
  source_type: string;
  created_at: string;
}

// ─── Suggestions Queue ───

export const getSuggestions = async (estimateDbId: string): Promise<AISuggestion[]> => {
  const { data, error } = await supabase
    .from('ai_suggestions_queue')
    .select('*')
    .eq('estimate_id', estimateDbId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as AISuggestion[];
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
  status: SuggestionStatus,
  extras?: { reviewer_notes?: string; edited_value?: string; approved_by?: string }
): Promise<void> => {
  const update: any = { status, updated_at: new Date().toISOString() };
  if (status === 'approved' || status === 'edited') {
    update.approved_at = new Date().toISOString();
    update.approved_by = extras?.approved_by || 'TVIK';
  }
  if (status === 'rejected') {
    update.rejected_at = new Date().toISOString();
  }
  if (extras?.reviewer_notes) update.reviewer_notes = extras.reviewer_notes;
  if (extras?.edited_value) update.edited_value = extras.edited_value;
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

export const SUGGESTION_STATUS_COLORS: Record<SuggestionStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-300',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  edited: 'bg-blue-100 text-blue-800 border-blue-300',
  rejected: 'bg-red-100 text-red-800 border-red-300',
  applied: 'bg-slate-100 text-slate-600 border-slate-300',
};
