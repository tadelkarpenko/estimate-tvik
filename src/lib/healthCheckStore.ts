import { supabase } from '@/integrations/supabase/client';

const getUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
};

export type BlockSource = 'completeness_check' | 'revision_compare' | 'post_apply_check' | 'manual_review';
export type WarningLevel = 'Low' | 'Medium' | 'High';
export type ConfidenceRollup = 'High' | 'Medium' | 'Low';

export interface EstimateHealthCheck {
  id?: string;
  health_check_id: string;
  estimate_id: string;
  user_id?: string;
  area_id?: string | null;
  estimate_version: string;
  block_source: BlockSource;
  warning_level: WarningLevel;
  block_approval: boolean;
  blocking_reason: string;
  human_fix_required: boolean;
  override_allowed: boolean;
  override_reason_required: boolean;
  completeness_score: number;
  missing_scope_categories: string;
  mismatch_summary: string;
  site_visit_recommended: boolean;
  confidence_rollup: ConfidenceRollup;
  created_at?: string;
}

export const getHealthChecks = async (estimateDbId: string): Promise<EstimateHealthCheck[]> => {
  const { data, error } = await supabase
    .from('estimate_health_checks')
    .select('*')
    .eq('estimate_id', estimateDbId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToHealthCheck);
};

export const saveHealthCheck = async (check: Omit<EstimateHealthCheck, 'id' | 'user_id' | 'created_at'>): Promise<string> => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('estimate_health_checks')
    .insert({ ...check, user_id: userId } as any)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
};

function rowToHealthCheck(r: any): EstimateHealthCheck {
  return {
    id: r.id,
    health_check_id: r.health_check_id || '',
    estimate_id: r.estimate_id,
    user_id: r.user_id,
    area_id: r.area_id || null,
    estimate_version: r.estimate_version || '',
    block_source: (r.block_source || 'completeness_check') as BlockSource,
    warning_level: (r.warning_level || 'Low') as WarningLevel,
    block_approval: r.block_approval ?? false,
    blocking_reason: r.blocking_reason || '',
    human_fix_required: r.human_fix_required ?? false,
    override_allowed: r.override_allowed ?? true,
    override_reason_required: r.override_reason_required ?? false,
    completeness_score: Number(r.completeness_score || 0),
    missing_scope_categories: r.missing_scope_categories || '',
    mismatch_summary: r.mismatch_summary || '',
    site_visit_recommended: r.site_visit_recommended ?? false,
    confidence_rollup: (r.confidence_rollup || 'Medium') as ConfidenceRollup,
    created_at: r.created_at,
  };
}
