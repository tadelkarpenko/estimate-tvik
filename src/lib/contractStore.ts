import { supabase } from '@/integrations/supabase/client';
import type { Contract, ChangeOrder, ContractAuditEntry } from './contractTypes';

const getUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
};

// ─── Contracts ───

export const getContracts = async (): Promise<Contract[]> => {
  const { data, error } = await supabase.from('contracts').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToContract);
};

export const getContract = async (id: string): Promise<Contract | undefined> => {
  const { data, error } = await supabase.from('contracts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToContract(data) : undefined;
};

export const getContractByEstimate = async (estimateId: string): Promise<Contract | undefined> => {
  const { data, error } = await supabase.from('contracts').select('*').eq('estimate_id', estimateId).maybeSingle();
  if (error) throw error;
  return data ? rowToContract(data) : undefined;
};

export const saveContract = async (contract: Contract): Promise<string> => {
  const userId = await getUserId();
  const row = {
    contract_id: contract.contract_id,
    estimate_id: contract.estimate_id,
    user_id: userId,
    contract_status: contract.contract_status,
    baseline_contract_value: contract.baseline_contract_value,
    baseline_margin_pct: contract.baseline_margin_pct,
    baseline_risk_exposure: contract.baseline_risk_exposure,
    signed_date: contract.signed_date,
    locked: contract.locked,
    net_contract_value: contract.net_contract_value,
    earned_revenue: contract.earned_revenue,
    percent_complete: contract.percent_complete,
    projected_final_cost: contract.projected_final_cost,
    projected_final_profit: contract.projected_final_profit,
    margin_current_pct: contract.margin_current_pct,
    profit_fade_flag: contract.profit_fade_flag,
    payment_terms_template: contract.payment_terms_template,
    payment_schedule_json: contract.payment_schedule_json,
    cash_forecast_30: contract.cash_forecast_30,
    cash_forecast_60: contract.cash_forecast_60,
    cash_forecast_90: contract.cash_forecast_90,
  };
  const { data, error } = await supabase.from('contracts').upsert(
    { ...row, ...(contract.id ? { id: contract.id } : {}) },
    { onConflict: 'contract_id,user_id' }
  ).select('id').single();
  if (error) throw error;
  return data.id;
};

export const updateContract = async (id: string, updates: Partial<Contract>): Promise<void> => {
  const { error } = await supabase.from('contracts').update(updates as any).eq('id', id);
  if (error) throw error;
};

// ─── Change Orders ───

export const getChangeOrders = async (contractId: string): Promise<ChangeOrder[]> => {
  const { data, error } = await supabase.from('change_orders').select('*').eq('contract_id', contractId).order('created_at');
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id, change_order_id: r.change_order_id, contract_id: r.contract_id,
    user_id: r.user_id, description: r.description, change_type: r.change_type as any,
    delta_value: Number(r.delta_value), approved: r.approved,
    approved_at: r.approved_at, override_reason: r.override_reason || '', created_at: r.created_at,
  }));
};

export const saveChangeOrder = async (co: ChangeOrder): Promise<string> => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('change_orders').insert({
    change_order_id: co.change_order_id, contract_id: co.contract_id,
    user_id: userId, description: co.description, change_type: co.change_type,
    delta_value: co.delta_value, approved: co.approved,
    approved_at: co.approved_at, override_reason: co.override_reason || '',
  }).select('id').single();
  if (error) throw error;
  return data.id;
};

export const approveChangeOrder = async (coId: string): Promise<void> => {
  const { error } = await supabase.from('change_orders').update({
    approved: true, approved_at: new Date().toISOString(),
  }).eq('id', coId);
  if (error) throw error;
};

// ─── Audit Log ───

export const getAuditLog = async (contractId: string): Promise<ContractAuditEntry[]> => {
  const { data, error } = await supabase.from('contract_audit_log').select('*').eq('contract_id', contractId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id, contract_id: r.contract_id, user_id: r.user_id,
    action_type: r.action_type, old_value: r.old_value, new_value: r.new_value,
    reason: r.reason, created_at: r.created_at,
  }));
};

export const logAuditEntry = async (entry: ContractAuditEntry): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase.from('contract_audit_log').insert({
    contract_id: entry.contract_id, user_id: userId,
    action_type: entry.action_type, old_value: entry.old_value,
    new_value: entry.new_value, reason: entry.reason,
  });
  if (error) throw error;
};

// ─── Update line items WIP fields ───

export const updateLineItemWIP = async (lineItemId: string, updates: {
  wip_status?: string; percent_complete?: number;
  actual_labor_cost_to_date?: number; actual_material_cost_to_date?: number;
  projected_labor_cost?: number; projected_material_cost?: number;
}): Promise<void> => {
  const { error } = await supabase.from('estimate_line_items').update(updates as any).eq('id', lineItemId);
  if (error) throw error;
};

export const linkLineItemsToContract = async (estimateDbId: string, contractDbId: string): Promise<void> => {
  const { error } = await supabase.from('estimate_line_items').update({ contract_id: contractDbId } as any).eq('estimate_id', estimateDbId);
  if (error) throw error;
};

// ─── Trade Drift: fetch completed line items across all contracts ───

export const getCompletedLineItemsForDrift = async (): Promise<Array<{
  phase: string; labor_total: number; material_total: number;
  actual_labor_cost_to_date: number; actual_material_cost_to_date: number;
  wip_status: string;
}>> => {
  const { data, error } = await supabase
    .from('estimate_line_items')
    .select('phase, labor_total, material_total, actual_labor_cost_to_date, actual_material_cost_to_date, wip_status')
    .eq('wip_status', 'Completed')
    .not('contract_id', 'is', null);
  if (error) throw error;
  return (data || []).map(r => ({
    phase: r.phase, labor_total: Number(r.labor_total), material_total: Number(r.material_total),
    actual_labor_cost_to_date: Number(r.actual_labor_cost_to_date),
    actual_material_cost_to_date: Number(r.actual_material_cost_to_date),
    wip_status: r.wip_status,
  }));
};

// ─── Row mapper ───

function rowToContract(r: any): Contract {
  return {
    id: r.id, contract_id: r.contract_id, estimate_id: r.estimate_id, user_id: r.user_id,
    contract_status: r.contract_status, baseline_contract_value: Number(r.baseline_contract_value),
    baseline_margin_pct: Number(r.baseline_margin_pct), baseline_risk_exposure: Number(r.baseline_risk_exposure),
    signed_date: r.signed_date, locked: r.locked,
    net_contract_value: Number(r.net_contract_value), earned_revenue: Number(r.earned_revenue),
    percent_complete: Number(r.percent_complete), projected_final_cost: Number(r.projected_final_cost),
    projected_final_profit: Number(r.projected_final_profit), margin_current_pct: Number(r.margin_current_pct),
    profit_fade_flag: r.profit_fade_flag,
    payment_terms_template: r.payment_terms_template, payment_schedule_json: r.payment_schedule_json,
    cash_forecast_30: Number(r.cash_forecast_30), cash_forecast_60: Number(r.cash_forecast_60),
    cash_forecast_90: Number(r.cash_forecast_90),
    created_at: r.created_at, updated_at: r.updated_at,
  };
}
