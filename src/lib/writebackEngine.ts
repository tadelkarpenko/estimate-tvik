import { supabase } from '@/integrations/supabase/client';
import type { WritePlan, WritePlanFieldUpdate, WritePlanLineItem, WritePlanAuditEntry } from './writePlanStore';

// ─── Types ───

export interface ExecutionResult {
  execution_id: string;
  execution_status: 'success' | 'partial_success' | 'blocked' | 'failed';
  version_check_passed: boolean;
  idempotency_check_passed: boolean;
  applied_fields: AppliedField[];
  applied_line_items: AppliedLineItem[];
  created_audit_entries: string[];
  status_updates: StatusUpdate[];
  requires_reapproval_applied: boolean;
  errors: string[];
  summary: string;
}

export interface AppliedField {
  field: string;
  action: string;
  value: string;
  result: 'applied' | 'skipped_duplicate' | 'failed';
}

export interface AppliedLineItem {
  description: string;
  action: string;
  result: 'applied' | 'skipped_duplicate' | 'failed';
  line_item_id?: string;
}

export interface StatusUpdate {
  field: string;
  old_value: string;
  new_value: string;
}

const getUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
};

// ─── Pre-execution checks ───

async function checkIdempotency(executionId: string): Promise<{ alreadyRun: boolean }> {
  const { data } = await supabase
    .from('estimate_write_execution_log')
    .select('id, execution_status')
    .eq('execution_id', executionId)
    .in('execution_status', ['success', 'partial_success'])
    .limit(1);
  return { alreadyRun: (data && data.length > 0) };
}

function checkVersion(plan: WritePlan, currentVersion: string): boolean {
  return plan.estimate_version === currentVersion;
}

async function getExistingAuditIds(estimateDbId: string, applyRunId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('ai_applied_suggestions_audit')
    .select('suggestion_id')
    .eq('estimate_id', estimateDbId)
    .eq('apply_run_id', applyRunId);
  return new Set((data || []).map(r => r.suggestion_id));
}

// ─── Main execution ───

export async function executeWriteback(
  plan: WritePlan,
  estimate: any,
  estimateDbId: string,
): Promise<ExecutionResult> {
  const executionId = crypto.randomUUID();
  const userId = await getUserId();
  const currentVersion = estimate.version || 'v1.0';

  const result: ExecutionResult = {
    execution_id: executionId,
    execution_status: 'success',
    version_check_passed: true,
    idempotency_check_passed: true,
    applied_fields: [],
    applied_line_items: [],
    created_audit_entries: [],
    status_updates: [],
    requires_reapproval_applied: false,
    errors: [],
    summary: '',
  };

  try {
    // 1. Version check
    const versionOk = checkVersion(plan, currentVersion);
    result.version_check_passed = versionOk;
    if (!versionOk) {
      result.execution_status = 'blocked';
      result.summary = `Version mismatch: plan expects ${plan.estimate_version}, estimate is ${currentVersion}. Execution blocked.`;
      await saveExecutionLog(result, estimateDbId, plan, userId);
      return result;
    }

    // 2. Idempotency check on apply_run_id
    const { alreadyRun } = await checkIdempotency(plan.apply_run_id);
    if (alreadyRun) {
      result.idempotency_check_passed = true;
      result.execution_status = 'blocked';
      result.summary = 'This write plan was already successfully executed. Duplicate execution blocked.';
      await saveExecutionLog(result, estimateDbId, plan, userId);
      return result;
    }

    // 3. Parse plan sections
    const fieldsToUpdate: WritePlanFieldUpdate[] = safeJsonParse(plan.fields_to_update, []);
    const lineItems: WritePlanLineItem[] = safeJsonParse(plan.line_items_to_add_or_edit, []);
    const auditEntries: WritePlanAuditEntry[] = safeJsonParse(plan.audit_entries_to_create, []);

    // 4. Get existing audit IDs to prevent duplicates
    const existingAuditIds = await getExistingAuditIds(estimateDbId, plan.apply_run_id);

    // 5. Apply field updates
    const estimateUpdates: Record<string, any> = {};
    for (const f of fieldsToUpdate) {
      try {
        if (f.action === 'append') {
          const existing = (estimate as any)[f.field] || '';
          const normalized = f.value.toLowerCase().trim();
          if (existing.toLowerCase().includes(normalized)) {
            result.applied_fields.push({ field: f.field, action: f.action, value: f.value, result: 'skipped_duplicate' });
            continue;
          }
          estimateUpdates[f.field] = existing ? `${existing}\n• ${f.value}` : `• ${f.value}`;
        } else if (f.action === 'set') {
          if (f.field === 'site_visit_required') {
            estimateUpdates[f.field] = f.value === 'true';
          } else {
            estimateUpdates[f.field] = f.value;
          }
        }
        result.applied_fields.push({ field: f.field, action: f.action, value: f.value, result: 'applied' });
      } catch (e: any) {
        result.applied_fields.push({ field: f.field, action: f.action, value: f.value, result: 'failed' });
        result.errors.push(`Field ${f.field}: ${e.message}`);
      }
    }

    // 6. Apply line items
    for (const li of lineItems) {
      try {
        if (li.action === 'add') {
          const lineId = crypto.randomUUID();
          const { error } = await supabase.from('estimate_line_items').insert({
            estimate_id: estimateDbId,
            user_id: userId,
            line_id: lineId,
            description: li.description,
            phase: li.phase || 'Other',
            unit: li.unit || 'ea',
            qty: li.qty || 0,
            labor_unit_cost: li.labor_unit_cost || 0,
            material_unit_cost: li.material_unit_cost || 0,
            notes: li.notes || '',
            source: 'AI Draft',
            created_by: 'AI',
            evidence_source: 'WritePlan',
            pending_confirmation: true,
          } as any);
          if (error) throw error;
          result.applied_line_items.push({ description: li.description, action: 'add', result: 'applied', line_item_id: lineId });
        } else if (li.action === 'edit') {
          if (!li.line_item_id) {
            result.applied_line_items.push({ description: li.description, action: 'edit', result: 'failed' });
            result.errors.push(`Edit blocked: no line_item_id for "${li.description}"`);
            continue;
          }
          const updatePayload: Record<string, any> = {};
          if (li.description) updatePayload.description = li.description;
          if (li.phase) updatePayload.phase = li.phase;
          if (li.unit) updatePayload.unit = li.unit;
          if (li.qty != null) updatePayload.qty = li.qty;
          if (li.labor_unit_cost != null) updatePayload.labor_unit_cost = li.labor_unit_cost;
          if (li.material_unit_cost != null) updatePayload.material_unit_cost = li.material_unit_cost;
          if (li.notes) updatePayload.notes = li.notes;

          const { error } = await supabase
            .from('estimate_line_items')
            .update(updatePayload)
            .eq('id', li.line_item_id);
          if (error) throw error;
          result.applied_line_items.push({ description: li.description, action: 'edit', result: 'applied', line_item_id: li.line_item_id });
        }
      } catch (e: any) {
        result.applied_line_items.push({ description: li.description, action: li.action, result: 'failed' });
        result.errors.push(`Line item "${li.description}": ${e.message}`);
      }
    }

    // 7. Create audit entries (skip duplicates)
    const newAuditRows: any[] = [];
    for (const a of auditEntries) {
      if (existingAuditIds.has(a.suggestion_id)) {
        continue; // skip duplicate
      }
      newAuditRows.push({
        audit_id: crypto.randomUUID(),
        estimate_id: estimateDbId,
        suggestion_id: a.suggestion_id,
        original_suggestion: a.original_suggestion,
        final_applied_value: a.final_applied_value,
        applied_field: a.applied_field,
        confidence: a.confidence,
        approved_by: a.approved_by,
        approved_at: new Date().toISOString(),
        source_type: a.source_type,
        area_id: a.area_id || null,
        suggestion_batch_id: a.suggestion_batch_id || '',
        apply_run_id: plan.apply_run_id,
        estimate_version: plan.estimate_version,
        user_id: userId,
      });
    }
    if (newAuditRows.length > 0) {
      const { error } = await supabase.from('ai_applied_suggestions_audit').insert(newAuditRows);
      if (error) {
        result.errors.push(`Audit insert: ${error.message}`);
      } else {
        result.created_audit_entries = newAuditRows.map(r => r.suggestion_id);
      }
    }

    // 8. Reapproval / status handling
    if (plan.requires_reapproval) {
      result.requires_reapproval_applied = true;
      const oldStatus = estimate.status || 'Draft';
      if (['Approved', 'Sent'].includes(oldStatus)) {
        estimateUpdates.status = 'Ready for Review';
        result.status_updates.push({ field: 'status', old_value: oldStatus, new_value: 'Ready for Review' });
      }
    }
    estimateUpdates.ai_apply_status = 'Applied';

    // 9. Write estimate updates
    if (Object.keys(estimateUpdates).length > 0) {
      const { error } = await supabase
        .from('estimates')
        .update(estimateUpdates)
        .eq('id', estimateDbId);
      if (error) {
        result.errors.push(`Estimate update: ${error.message}`);
      }
    }

    // 10. Mark suggestions as applied
    const approvedSuggestionIds = auditEntries.map(a => a.suggestion_id);
    if (approvedSuggestionIds.length > 0) {
      for (const sid of approvedSuggestionIds) {
        await supabase
          .from('ai_suggestions_queue')
          .update({ status: 'applied', approved_by: 'TVIK' })
          .eq('id', sid)
          .catch(() => {}); // non-critical
      }
    }

    // 11. Update write plan status
    if (plan.id) {
      await supabase
        .from('estimate_write_plans')
        .update({ apply_status: 'applied' })
        .eq('id', plan.id)
        .catch(() => {});
    }

    // Final status
    const hasErrors = result.errors.length > 0;
    const hasApplied = result.applied_fields.some(f => f.result === 'applied') ||
                       result.applied_line_items.some(l => l.result === 'applied') ||
                       result.created_audit_entries.length > 0;

    if (hasErrors && hasApplied) {
      result.execution_status = 'partial_success';
    } else if (hasErrors && !hasApplied) {
      result.execution_status = 'failed';
    } else {
      result.execution_status = 'success';
    }

    // Build summary
    const parts: string[] = [];
    const appliedFields = result.applied_fields.filter(f => f.result === 'applied').length;
    const skippedFields = result.applied_fields.filter(f => f.result === 'skipped_duplicate').length;
    const appliedLI = result.applied_line_items.filter(l => l.result === 'applied').length;
    if (appliedFields > 0) parts.push(`${appliedFields} field(s) updated`);
    if (skippedFields > 0) parts.push(`${skippedFields} field(s) skipped (duplicate)`);
    if (appliedLI > 0) parts.push(`${appliedLI} line item(s) created`);
    if (result.created_audit_entries.length > 0) parts.push(`${result.created_audit_entries.length} audit entries`);
    if (result.requires_reapproval_applied) parts.push('reapproval triggered');
    if (result.errors.length > 0) parts.push(`${result.errors.length} error(s)`);
    result.summary = parts.length > 0 ? `Execution ${result.execution_status}: ${parts.join(', ')}.` : 'No changes applied.';

    await saveExecutionLog(result, estimateDbId, plan, userId);
    return result;

  } catch (e: any) {
    result.execution_status = 'failed';
    result.errors.push(e.message);
    result.summary = `Execution failed: ${e.message}`;
    try { await saveExecutionLog(result, estimateDbId, plan, userId); } catch {}
    return result;
  }
}

async function saveExecutionLog(
  result: ExecutionResult,
  estimateDbId: string,
  plan: WritePlan,
  userId: string,
) {
  await supabase.from('estimate_write_execution_log').insert({
    execution_id: plan.apply_run_id,
    estimate_id: estimateDbId,
    estimate_version: plan.estimate_version,
    write_plan_id: plan.write_plan_id,
    execution_status: result.execution_status,
    version_check_passed: result.version_check_passed,
    idempotency_check_passed: result.idempotency_check_passed,
    applied_fields: JSON.stringify(result.applied_fields),
    applied_line_items: JSON.stringify(result.applied_line_items),
    created_audit_entries: JSON.stringify(result.created_audit_entries),
    status_updates: JSON.stringify(result.status_updates),
    requires_reapproval_applied: result.requires_reapproval_applied,
    errors: JSON.stringify(result.errors),
    summary: result.summary,
    user_id: userId,
  } as any);
}

function safeJsonParse<T>(json: string | undefined | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json); } catch { return fallback; }
}
