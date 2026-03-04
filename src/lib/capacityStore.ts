// ─── Phase 7: Capacity Data Access Layer ───

import { supabase } from '@/integrations/supabase/client';
import type { CrewCapacity } from './capacityEngine';

const getUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
};

export const getCrewCapacities = async (): Promise<CrewCapacity[]> => {
  const { data, error } = await supabase
    .from('crew_capacity')
    .select('*')
    .order('trade');
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id,
    user_id: r.user_id,
    trade: r.trade,
    crew_size: Number(r.crew_size),
    hours_per_day: Number(r.hours_per_day),
    work_days_per_week: Number(r.work_days_per_week),
    effective_from: r.effective_from,
    effective_to: r.effective_to,
    overtime_allowed: r.overtime_allowed,
    overtime_multiplier: Number(r.overtime_multiplier),
    max_safe_utilization_pct: Number(r.max_safe_utilization_pct),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
};

export const saveCrewCapacity = async (cap: CrewCapacity): Promise<string> => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('crew_capacity')
    .upsert({
      ...cap,
      user_id: userId,
      ...(cap.id ? { id: cap.id } : {}),
    } as any, { onConflict: 'id' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
};

export const deleteCrewCapacity = async (id: string): Promise<void> => {
  const { error } = await supabase.from('crew_capacity').delete().eq('id', id);
  if (error) throw error;
};

// Get all active line items across all contracts for capacity calculation
export const getAllActiveContractLineItems = async (): Promise<Array<{
  phase: string;
  labor_hours_per_unit: number;
  qty: number;
  percent_complete: number;
  scheduled_start: string | null;
  scheduled_finish: string | null;
  contract_id: string | null;
}>> => {
  const { data, error } = await supabase
    .from('estimate_line_items')
    .select('phase, labor_hours_per_unit, qty, percent_complete, scheduled_start, scheduled_finish, contract_id')
    .not('contract_id', 'is', null)
    .lt('percent_complete', 100);
  if (error) throw error;
  return (data || []).map(r => ({
    phase: r.phase,
    labor_hours_per_unit: Number(r.labor_hours_per_unit),
    qty: Number(r.qty),
    percent_complete: Number(r.percent_complete),
    scheduled_start: r.scheduled_start,
    scheduled_finish: r.scheduled_finish,
    contract_id: r.contract_id,
  }));
};
