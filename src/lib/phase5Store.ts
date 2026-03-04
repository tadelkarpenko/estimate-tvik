// ─── Phase 5: Data Access Layer ───

import { supabase } from '@/integrations/supabase/client';
import type { Subcontract, SubcontractInvoice, VendorPerformance, SchedulePhase, ExecutionEvent, PMScorecardSnapshot } from './phase5Types';

const getUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
};

// ─── Subcontracts ───

export const getSubcontracts = async (contractId: string): Promise<Subcontract[]> => {
  const { data, error } = await supabase.from('subcontracts').select('*').eq('contract_id', contractId).order('created_at');
  if (error) throw error;
  return (data || []).map(r => ({
    ...r, committed_cost: Number(r.committed_cost), approved_cost: Number(r.approved_cost),
    estimated_trade_budget: Number(r.estimated_trade_budget), remaining_commitment: Number(r.remaining_commitment),
    exposure_index: Number(r.exposure_index),
  }));
};

export const saveSubcontract = async (sub: Subcontract): Promise<string> => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('subcontracts').upsert({
    ...sub, user_id: userId, ...(sub.id ? { id: sub.id } : {}),
  } as any, { onConflict: 'id' }).select('id').single();
  if (error) throw error;
  return data.id;
};

export const deleteSubcontract = async (id: string): Promise<void> => {
  const { error } = await supabase.from('subcontracts').delete().eq('id', id);
  if (error) throw error;
};

// ─── Subcontract Invoices ───

export const getSubcontractInvoices = async (subcontractId: string): Promise<SubcontractInvoice[]> => {
  const { data, error } = await supabase.from('subcontract_invoices').select('*').eq('subcontract_id', subcontractId).order('created_at');
  if (error) throw error;
  return (data || []).map(r => ({
    ...r, amount: Number(r.amount),
  }));
};

export const saveSubcontractInvoice = async (inv: SubcontractInvoice): Promise<string> => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('subcontract_invoices').upsert({
    ...inv, user_id: userId, ...(inv.id ? { id: inv.id } : {}),
  } as any, { onConflict: 'id' }).select('id').single();
  if (error) throw error;
  return data.id;
};

// ─── Vendor Performance ───

export const getVendorPerformance = async (): Promise<VendorPerformance[]> => {
  const { data, error } = await supabase.from('vendor_performance').select('*').order('performance_score', { ascending: false });
  if (error) throw error;
  return (data || []).map(r => ({
    ...r, contracts_count: Number(r.contracts_count), avg_trade_variance: Number(r.avg_trade_variance),
    avg_schedule_delay: Number(r.avg_schedule_delay), invoice_dispute_rate: Number(r.invoice_dispute_rate),
    retention_issue_rate: Number(r.retention_issue_rate), performance_score: Number(r.performance_score),
    cost_reliability_score: Number(r.cost_reliability_score), schedule_reliability_score: Number(r.schedule_reliability_score),
    billing_accuracy_score: Number(r.billing_accuracy_score), change_order_behavior_score: Number(r.change_order_behavior_score),
  }));
};

export const upsertVendorPerformance = async (vendor: VendorPerformance): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase.from('vendor_performance').upsert({
    ...vendor, user_id: userId, last_computed_at: new Date().toISOString(),
  } as any, { onConflict: 'user_id,vendor_name' });
  if (error) throw error;
};

// ─── Schedule Phases ───

export const getSchedulePhases = async (contractId: string): Promise<SchedulePhase[]> => {
  const { data, error } = await supabase.from('schedule_phases').select('*').eq('contract_id', contractId).order('created_at');
  if (error) throw error;
  return (data || []).map(r => ({
    ...r, planned_days: Number(r.planned_days), actual_days: Number(r.actual_days), delay_ratio: Number(r.delay_ratio),
  }));
};

export const saveSchedulePhase = async (phase: SchedulePhase): Promise<string> => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('schedule_phases').upsert({
    ...phase, user_id: userId, ...(phase.id ? { id: phase.id } : {}),
  } as any, { onConflict: 'id' }).select('id').single();
  if (error) throw error;
  return data.id;
};

// ─── Execution Events ───

export const queueExecutionEvent = async (event: Omit<ExecutionEvent, 'id' | 'user_id' | 'created_at' | 'processed_at'>): Promise<string> => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('execution_events').insert({
    ...event, user_id: userId, status: 'Queued',
  } as any).select('id').single();
  if (error) throw error;
  return data.id;
};

export const getExecutionEvents = async (contractId: string): Promise<ExecutionEvent[]> => {
  const { data, error } = await supabase.from('execution_events').select('*').eq('contract_id', contractId).order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data || [];
};

export const getQueuedEventCount = async (): Promise<number> => {
  const { count, error } = await supabase.from('execution_events').select('*', { count: 'exact', head: true }).eq('status', 'Queued');
  if (error) throw error;
  return count || 0;
};

export const getLatestAdvisories = async (contractId: string): Promise<ExecutionEvent[]> => {
  const { data, error } = await supabase
    .from('execution_events')
    .select('*')
    .eq('contract_id', contractId)
    .eq('status', 'Completed')
    .order('processed_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data || []).filter(e => {
    try {
      const r = JSON.parse(e.result_json);
      return !r.debounced && !r.no_transition && !r.daily_limit_reached;
    } catch { return false; }
  });
};

/**
 * Trigger async AI processing by calling the execution-intelligence edge function.
 * Non-blocking: fires and forgets.
 */
export const triggerIntelligenceProcessing = async (): Promise<void> => {
  try {
    await supabase.functions.invoke('execution-intelligence', {
      body: { action: 'process_queue' },
    });
  } catch (e) {
    console.warn('Intelligence processing trigger failed (non-blocking):', e);
  }
};

// ─── PM Scorecard ───

export const savePMScorecard = async (snapshot: PMScorecardSnapshot): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase.from('pm_scorecard_snapshots').insert({
    ...snapshot, user_id: userId,
  } as any);
  if (error) throw error;
};

export const getPMScorecards = async (contractId: string): Promise<PMScorecardSnapshot[]> => {
  const { data, error } = await supabase.from('pm_scorecard_snapshots').select('*').eq('contract_id', contractId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(r => ({
    ...r, margin_discipline: Number(r.margin_discipline), schedule_integrity: Number(r.schedule_integrity),
    forecast_accuracy: Number(r.forecast_accuracy), change_order_quality: Number(r.change_order_quality),
    margin_expansion: Number(r.margin_expansion), composite_score: Number(r.composite_score),
  }));
};
