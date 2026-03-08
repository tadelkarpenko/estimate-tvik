import { supabase } from '@/integrations/supabase/client';

const getUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
};

export type ApplyStatus = 'staged' | 'applied' | 'failed';

export interface WritePlan {
  id?: string;
  write_plan_id: string;
  estimate_id: string;
  estimate_version: string;
  approved_by: string;
  fields_to_update: string; // JSON
  line_items_to_add_or_edit: string; // JSON
  inclusions_to_append: string; // JSON
  exclusions_to_append: string; // JSON
  allowances_to_append: string; // JSON
  assumptions_to_append: string; // JSON
  risk_notes_to_append: string; // JSON
  audit_entries_to_create: string; // JSON
  requires_reapproval: boolean;
  summary: string;
  apply_status: ApplyStatus;
  apply_run_id: string;
  created_at?: string;
}

export interface WritePlanLineItem {
  action: 'add' | 'edit';
  line_item_id?: string | null;
  phase?: string | null;
  description: string;
  unit?: string | null;
  qty?: number | null;
  labor_unit_cost?: number | null;
  material_unit_cost?: number | null;
  notes?: string | null;
}

export interface WritePlanAuditEntry {
  suggestion_id: string;
  applied_field: string;
  final_applied_value: string;
  approved_by: string;
  original_suggestion: string;
  confidence: string;
  source_type: string;
  area_id?: string | null;
  suggestion_batch_id: string;
}

export interface WritePlanFieldUpdate {
  field: string;
  action: 'append' | 'set';
  value: string;
}

// Material suggestion types that require reapproval
const MATERIAL_TYPES = new Set([
  'line_item', 'exclusion', 'allowance', 'assumption', 'risk_note',
]);

const NON_MATERIAL_TYPES = new Set([
  'internal_note', 'missing_info', 'site_visit_recommendation',
  'revision_warning', 'trade_detection',
]);

/**
 * Deterministic transformation: approved queue items → explicit write plan.
 * No AI calls. No new suggestions invented. No evidence reinterpretation.
 */
export function generateWritePlan(
  approvedItems: any[],
  estimate: any,
  estimateDbId: string,
): Omit<WritePlan, 'id' | 'created_at'> {
  const applyRunId = crypto.randomUUID();
  const fieldsToUpdate: WritePlanFieldUpdate[] = [];
  const lineItems: WritePlanLineItem[] = [];
  const inclusions: string[] = [];
  const exclusions: string[] = [];
  const allowances: string[] = [];
  const assumptions: string[] = [];
  const riskNotes: string[] = [];
  const auditEntries: WritePlanAuditEntry[] = [];
  let hasMaterialChange = false;

  for (const s of approvedItems) {
    const value = (s.status === 'edited' && s.edited_value) ? s.edited_value : s.suggested_value;
    const target = s.apply_target || '';
    const type = s.suggestion_type || '';

    // Determine materiality
    if (MATERIAL_TYPES.has(type)) hasMaterialChange = true;

    // Map suggestion type to write plan action
    switch (type) {
      case 'line_item':
        lineItems.push({
          action: 'add',
          description: value,
          phase: target || null,
          unit: null,
          qty: null,
          labor_unit_cost: null,
          material_unit_cost: null,
          notes: s.evidence_summary || null,
        });
        break;

      case 'exclusion':
        exclusions.push(value);
        if (!isDuplicate(estimate.suggested_exclusions, value)) {
          fieldsToUpdate.push({ field: 'suggested_exclusions', action: 'append', value });
        }
        break;

      case 'allowance':
        allowances.push(value);
        if (!isDuplicate(estimate.suggested_allowances, value)) {
          fieldsToUpdate.push({ field: 'suggested_allowances', action: 'append', value });
        }
        break;

      case 'assumption':
        assumptions.push(value);
        if (!isDuplicate(estimate.suggested_assumptions, value)) {
          fieldsToUpdate.push({ field: 'suggested_assumptions', action: 'append', value });
        }
        break;

      case 'risk_note':
        riskNotes.push(value);
        if (!isDuplicate(estimate.possible_hidden_risks, value)) {
          fieldsToUpdate.push({ field: 'possible_hidden_risks', action: 'append', value });
        }
        break;

      case 'missing_info':
        if (!isDuplicate(estimate.missing_info_questions, value)) {
          fieldsToUpdate.push({ field: 'missing_info_questions', action: 'append', value });
        }
        break;

      case 'site_visit_recommendation':
        fieldsToUpdate.push({ field: 'site_visit_required', action: 'set', value: 'true' });
        break;

      case 'internal_note':
        fieldsToUpdate.push({ field: 'internal_notes', action: 'append', value: `[AI] ${value}` });
        break;

      case 'trade_detection':
        if (!isDuplicate(estimate.ai_detected_trades, value)) {
          fieldsToUpdate.push({ field: 'ai_detected_trades', action: 'append', value });
        }
        break;

      default:
        // Safe fallback: append to internal notes
        fieldsToUpdate.push({ field: 'internal_notes', action: 'append', value: `[AI/${type}] ${value}` });
        break;
    }

    // Always create audit entry
    auditEntries.push({
      suggestion_id: s.id,
      applied_field: target || type,
      final_applied_value: value,
      approved_by: 'TVIK',
      original_suggestion: s.suggested_value,
      confidence: s.confidence || 'Medium',
      source_type: s.source_type || 'text',
      area_id: s.area_id || null,
      suggestion_batch_id: s.suggestion_batch_id || '',
    });
  }

  // Determine reapproval
  const requiresReapproval = hasMaterialChange;

  // Build summary
  const parts: string[] = [];
  if (lineItems.length > 0) parts.push(`${lineItems.length} line item(s) to add`);
  if (exclusions.length > 0) parts.push(`${exclusions.length} exclusion(s)`);
  if (allowances.length > 0) parts.push(`${allowances.length} allowance(s)`);
  if (assumptions.length > 0) parts.push(`${assumptions.length} assumption(s)`);
  if (riskNotes.length > 0) parts.push(`${riskNotes.length} risk note(s)`);
  if (fieldsToUpdate.length > 0) parts.push(`${fieldsToUpdate.length} field update(s)`);
  const summary = parts.length > 0
    ? `Write plan: ${parts.join(', ')}. ${requiresReapproval ? 'Requires reapproval.' : 'No reapproval needed.'}`
    : 'No changes to apply — all approved items result in no-ops or duplicates.';

  return {
    write_plan_id: crypto.randomUUID(),
    estimate_id: estimateDbId,
    estimate_version: estimate.version || 'v1.0',
    approved_by: 'TVIK',
    fields_to_update: JSON.stringify(fieldsToUpdate),
    line_items_to_add_or_edit: JSON.stringify(lineItems),
    inclusions_to_append: JSON.stringify(inclusions),
    exclusions_to_append: JSON.stringify(exclusions),
    allowances_to_append: JSON.stringify(allowances),
    assumptions_to_append: JSON.stringify(assumptions),
    risk_notes_to_append: JSON.stringify(riskNotes),
    audit_entries_to_create: JSON.stringify(auditEntries),
    requires_reapproval: requiresReapproval,
    summary,
    apply_status: 'staged',
    apply_run_id: applyRunId,
  };
}

function isDuplicate(existing: string | undefined | null, value: string): boolean {
  if (!existing) return false;
  // Normalize and check if the value already appears in existing text
  const normalized = value.toLowerCase().trim();
  return existing.toLowerCase().includes(normalized);
}

// ─── DB operations ───

export const saveWritePlan = async (plan: Omit<WritePlan, 'id' | 'created_at'>): Promise<string> => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('estimate_write_plans')
    .insert({ ...plan, user_id: userId } as any)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
};

export const getWritePlans = async (estimateDbId: string): Promise<WritePlan[]> => {
  const { data, error } = await supabase
    .from('estimate_write_plans')
    .select('*')
    .eq('estimate_id', estimateDbId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as WritePlan[];
};

export const updateWritePlanStatus = async (id: string, status: ApplyStatus): Promise<void> => {
  const { error } = await supabase
    .from('estimate_write_plans')
    .update({ apply_status: status })
    .eq('id', id);
  if (error) throw error;
};
