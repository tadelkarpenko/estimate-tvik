import { supabase } from '@/integrations/supabase/client';
import type {
  Estimate, CostLibraryItem, RiskLibraryItem, EstimateRevisionLog, CostAudit,
  EstimateLineItem, EstimateMedia, EstimateChatThread, EstimateChatMessage,
} from './types';

// ─── Helpers ───
const getUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
};

export const uid = () => crypto.randomUUID();

// ─── Estimates ───
export const getEstimates = async (): Promise<Estimate[]> => {
  const { data, error } = await supabase.from('estimates').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToEstimate);
};

export const getEstimate = async (estimateId: string): Promise<Estimate | undefined> => {
  const { data, error } = await supabase.from('estimates').select('*').eq('estimate_id', estimateId).maybeSingle();
  if (error) throw error;
  return data ? rowToEstimate(data) : undefined;
};

/** Get the DB uuid (id column) for an estimate by estimate_id */
export const getEstimateDbId = async (estimateId: string): Promise<string | undefined> => {
  const { data } = await supabase.from('estimates').select('id').eq('estimate_id', estimateId).maybeSingle();
  return data?.id;
};

export const saveEstimate = async (est: Estimate): Promise<void> => {
  const userId = await getUserId();
  const row = estimateToRow(est, userId);
  const { error } = await supabase.from('estimates').upsert(row, { onConflict: 'user_id,estimate_id' });
  if (error) throw error;
};

export const deleteEstimate = async (estimateId: string): Promise<void> => {
  const { error } = await supabase.from('estimates').delete().eq('estimate_id', estimateId);
  if (error) throw error;
};

export const updateEstimateStatus = async (estimateId: string, status: string): Promise<void> => {
  const { error } = await supabase.from('estimates').update({ status, updated_at: new Date().toISOString() }).eq('estimate_id', estimateId);
  if (error) throw error;
};

// ─── Cost Library ───
export const getCostLibrary = async (): Promise<CostLibraryItem[]> => {
  const { data, error } = await supabase.from('cost_library').select('*').order('project_type').order('trade');
  if (error) throw error;
  return (data || []).map(rowToCostItem);
};

export const saveCostLibraryItem = async (item: CostLibraryItem): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase.from('cost_library').upsert({
    id: item.id, user_id: userId, project_type: item.project_type, trade: item.trade,
    description: item.description, qty_rule: item.qty_rule, default_included: item.default_included,
    labor_unit_cost: item.labor_unit_cost, material_unit_cost: item.material_unit_cost,
    unit_label: item.unit_label, notes: item.notes, last_updated: item.last_updated,
    labor_hours_per_unit: item.labor_hours_per_unit || 0,
    crew_trade: item.crew_trade || 'General',
    productivity_note: item.productivity_note || '',
    active: item.active !== false,
  });
  if (error) throw error;
};

export const deleteCostLibraryItem = async (id: string): Promise<void> => {
  const { error } = await supabase.from('cost_library').delete().eq('id', id);
  if (error) throw error;
};

// ─── Risk Library ───
export const getRiskLibrary = async (): Promise<RiskLibraryItem[]> => {
  const { data, error } = await supabase.from('risk_library').select('*').order('project_type').order('risk_name');
  if (error) throw error;
  return (data || []).map(rowToRiskItem);
};

export const saveRiskLibraryItem = async (item: RiskLibraryItem): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase.from('risk_library').upsert({
    id: item.id, user_id: userId, project_type: item.project_type, risk_name: item.risk_name,
    default_level: item.default_level, exposure_low_pct: item.exposure_low_pct,
    exposure_high_pct: item.exposure_high_pct, mitigation_note: item.mitigation_note,
    default_included: item.default_included,
  });
  if (error) throw error;
};

export const deleteRiskLibraryItem = async (id: string): Promise<void> => {
  const { error } = await supabase.from('risk_library').delete().eq('id', id);
  if (error) throw error;
};

// ─── Estimate Line Items (new table) ───
export const getEstimateLineItems = async (estimateDbId: string): Promise<EstimateLineItem[]> => {
  const { data, error } = await supabase.from('estimate_line_items').select('*').eq('estimate_id', estimateDbId).order('created_at');
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id, line_id: r.line_id, estimate_id: r.estimate_id, user_id: r.user_id,
    phase: r.phase as any, description: r.description, unit: r.unit as any, qty: Number(r.qty),
    labor_unit_cost: Number(r.labor_unit_cost), material_unit_cost: Number(r.material_unit_cost),
    labor_hours_per_unit: Number(r.labor_hours_per_unit), labor_hours_total: Number(r.labor_hours_total),
    labor_total: Number(r.labor_total), material_total: Number(r.material_total),
    line_total: Number(r.line_total), source: r.source as any, locked: r.locked, created_at: r.created_at,
    pending_confirmation: r.pending_confirmation ?? false,
    confidence: (r.confidence || 'Medium') as any,
    evidence_source: r.evidence_source || 'CostLibrary',
    notes: r.notes || '',
    include_in_public_pdf: (r as any).include_in_public_pdf !== false,
    include_in_internal_pdf: (r as any).include_in_internal_pdf !== false,
    created_by: (r as any).created_by || 'Manual',
  } as any));
};

export const upsertEstimateLineItems = async (items: EstimateLineItem[]): Promise<void> => {
  if (items.length === 0) return;
  const userId = await getUserId();
  const rows = items.map(li => ({
    line_id: li.line_id, estimate_id: li.estimate_id, user_id: userId,
    phase: li.phase, description: li.description, unit: li.unit, qty: li.qty,
    labor_unit_cost: li.labor_unit_cost, material_unit_cost: li.material_unit_cost,
    labor_hours_per_unit: li.labor_hours_per_unit, labor_hours_total: li.labor_hours_total,
    labor_total: li.labor_total, material_total: li.material_total, line_total: li.line_total,
    source: li.source, locked: li.locked,
    pending_confirmation: li.pending_confirmation ?? false,
    confidence: li.confidence || 'Medium',
    evidence_source: li.evidence_source || 'CostLibrary',
    notes: li.notes || '',
    include_in_public_pdf: (li as any).include_in_public_pdf !== false,
    include_in_internal_pdf: (li as any).include_in_internal_pdf !== false,
    created_by: (li as any).created_by || 'Manual',
  }));
  const { error } = await supabase.from('estimate_line_items').upsert(rows, { onConflict: 'line_id' });
  if (error) throw error;
};

export const deleteCostLibraryLineItems = async (estimateDbId: string): Promise<void> => {
  const { error } = await supabase.from('estimate_line_items').delete()
    .eq('estimate_id', estimateDbId).eq('source', 'CostLibrary');
  if (error) throw error;
};

// ─── Estimate Media ───
export const getEstimateMedia = async (estimateDbId: string): Promise<EstimateMedia[]> => {
  const { data, error } = await supabase.from('estimate_media').select('*').eq('estimate_id', estimateDbId).order('created_at');
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id, media_id: r.media_id, estimate_id: r.estimate_id, user_id: r.user_id,
    file_url: r.file_url, caption: r.caption, include_in_internal_pdf: r.include_in_internal_pdf,
    include_in_public_pdf: r.include_in_public_pdf, created_at: r.created_at,
  }));
};

export const saveEstimateMedia = async (media: EstimateMedia): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase.from('estimate_media').upsert({
    media_id: media.media_id, estimate_id: media.estimate_id, user_id: userId,
    file_url: media.file_url, caption: media.caption,
    include_in_internal_pdf: media.include_in_internal_pdf,
    include_in_public_pdf: media.include_in_public_pdf,
  }, { onConflict: 'media_id' });
  if (error) throw error;
};

export const deleteEstimateMedia = async (mediaId: string): Promise<void> => {
  const { error } = await supabase.from('estimate_media').delete().eq('media_id', mediaId);
  if (error) throw error;
};

// ─── Chat Threads & Messages ───
export const getChatThreads = async (estimateDbId: string): Promise<EstimateChatThread[]> => {
  const { data, error } = await supabase.from('estimate_chat_threads').select('*').eq('estimate_id', estimateDbId).order('created_at');
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id, thread_id: r.thread_id, estimate_id: r.estimate_id,
    user_id: r.user_id, title: r.title, created_at: r.created_at,
  }));
};

export const createChatThread = async (thread: EstimateChatThread): Promise<string> => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('estimate_chat_threads').insert({
    thread_id: thread.thread_id, estimate_id: thread.estimate_id,
    user_id: userId, title: thread.title,
  }).select('id').single();
  if (error) throw error;
  return data.id;
};

export const getChatMessages = async (threadDbId: string): Promise<EstimateChatMessage[]> => {
  const { data, error } = await supabase.from('estimate_chat_messages').select('*').eq('thread_id', threadDbId).order('created_at');
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id, message_id: r.message_id, thread_id: r.thread_id,
    user_id: r.user_id, role: r.role as any, content: r.content,
    suggested_changes_json: r.suggested_changes_json || '',
    created_at: r.created_at,
  }));
};

export const saveChatMessage = async (msg: EstimateChatMessage): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase.from('estimate_chat_messages').insert({
    message_id: msg.message_id, thread_id: msg.thread_id,
    user_id: userId, role: msg.role, content: msg.content,
    suggested_changes_json: msg.suggested_changes_json || '',
  });
  if (error) throw error;
};

// ─── Revision Logs ───
export const getRevisionLogs = async (estimateId?: string): Promise<EstimateRevisionLog[]> => {
  let q = supabase.from('revision_logs').select('*').order('created_at', { ascending: false });
  if (estimateId) q = q.eq('estimate_id', estimateId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id, estimate_id: r.estimate_id, created_at: r.created_at,
    version: r.version, change_summary: r.change_summary,
    snapshot_json: r.snapshot_json, delta_low: Number(r.delta_low), delta_high: Number(r.delta_high),
  }));
};

export const saveRevisionLog = async (log: EstimateRevisionLog): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase.from('revision_logs').insert({
    id: log.id, user_id: userId, estimate_id: log.estimate_id,
    version: log.version, change_summary: log.change_summary,
    snapshot_json: log.snapshot_json, delta_low: log.delta_low, delta_high: log.delta_high,
  });
  if (error) throw error;
};

// ─── Cost Audits ───
export const getCostAudits = async (estimateId?: string): Promise<CostAudit[]> => {
  let q = supabase.from('cost_audits').select('*').order('created_at', { ascending: false });
  if (estimateId) q = q.eq('estimate_id', estimateId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id, estimate_id: r.estimate_id, created_at: r.created_at,
    findings_json: r.findings_json, recommended_actions: r.recommended_actions, status: r.status as any,
  }));
};

export const saveCostAudit = async (audit: CostAudit): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase.from('cost_audits').upsert({
    id: audit.id, user_id: userId, estimate_id: audit.estimate_id,
    findings_json: audit.findings_json, recommended_actions: audit.recommended_actions, status: audit.status,
  });
  if (error) throw error;
};

// ─── Estimate Counter ───
export const nextEstimateId = async (): Promise<string> => {
  const userId = await getUserId();
  const { data: existing } = await supabase.from('estimate_counter').select('counter').eq('user_id', userId).maybeSingle();
  const newCounter = (existing?.counter || 0) + 1;
  await supabase.from('estimate_counter').upsert({ user_id: userId, counter: newCounter }, { onConflict: 'user_id' });
  return `EST-${String(newCounter).padStart(4, '0')}`;
};

// ─── Seed data ───
const SEED_COST_LIBRARY: Omit<CostLibraryItem, 'id'>[] = [
  { project_type: 'Bath', trade: 'Demo & Prep', description: 'Protect, demo, haul', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 650, material_unit_cost: 75, unit_label: 'ls', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Demo', productivity_note: '', active: true },
  { project_type: 'Bath', trade: 'Plumbing', description: 'Rough + trim (allowance)', qty_rule: 'fixture', default_included: true, labor_unit_cost: 380, material_unit_cost: 140, unit_label: 'fixture', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Plumbing', productivity_note: '', active: true },
  { project_type: 'Bath', trade: 'Electrical', description: 'Bath circuits/fixtures allowance', qty_rule: 'fixture', default_included: true, labor_unit_cost: 220, material_unit_cost: 90, unit_label: 'fixture', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Electrical', productivity_note: '', active: true },
  { project_type: 'Bath', trade: 'Drywall', description: 'Hang/tape/finish patch areas', qty_rule: 'sqft', default_included: true, labor_unit_cost: 3.25, material_unit_cost: 1.15, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Drywall', productivity_note: '', active: true },
  { project_type: 'Bath', trade: 'Tile Setting Materials', description: 'Thinset/grout/consumables', qty_rule: 'sqft', default_included: true, labor_unit_cost: 0, material_unit_cost: 1.75, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'General', productivity_note: '', active: true },
  { project_type: 'Bath', trade: 'Tile Labor', description: 'Tile install labor', qty_rule: 'sqft', default_included: true, labor_unit_cost: 9.50, material_unit_cost: 0, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'General', productivity_note: '', active: true },
  { project_type: 'Bath', trade: 'Paint Materials', description: 'Primer/paint supplies', qty_rule: 'sqft', default_included: true, labor_unit_cost: 0, material_unit_cost: 0.55, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Paint', productivity_note: '', active: true },
  { project_type: 'Bath', trade: 'Paint Labor', description: 'Paint labor', qty_rule: 'sqft', default_included: true, labor_unit_cost: 1.90, material_unit_cost: 0, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Paint', productivity_note: '', active: true },
  { project_type: 'Bath', trade: 'Decorative Fixtures', description: 'Mirror/vanity light allowance', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 0, material_unit_cost: 250, unit_label: 'ls', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'General', productivity_note: '', active: true },
  { project_type: 'Full Rehab', trade: 'Demo & Protection', description: 'Selective demo + protect', qty_rule: 'sqft', default_included: true, labor_unit_cost: 1.10, material_unit_cost: 0.20, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Demo', productivity_note: '', active: true },
  { project_type: 'Full Rehab', trade: 'Framing', description: 'Repairs allowance', qty_rule: 'sqft', default_included: true, labor_unit_cost: 1.40, material_unit_cost: 0.60, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Framing', productivity_note: '', active: true },
  { project_type: 'Full Rehab', trade: 'Electrical', description: 'Rehab allowance', qty_rule: 'sqft', default_included: true, labor_unit_cost: 1.85, material_unit_cost: 0.65, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Electrical', productivity_note: '', active: true },
  { project_type: 'Full Rehab', trade: 'Plumbing', description: 'Rehab allowance', qty_rule: 'sqft', default_included: true, labor_unit_cost: 1.60, material_unit_cost: 0.70, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Plumbing', productivity_note: '', active: true },
  { project_type: 'Full Rehab', trade: 'HVAC', description: 'Allowance', qty_rule: 'sqft', default_included: true, labor_unit_cost: 0.85, material_unit_cost: 0.65, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'HVAC', productivity_note: '', active: true },
  { project_type: 'Full Rehab', trade: 'Drywall', description: 'Hang/tape/finish', qty_rule: 'sqft', default_included: true, labor_unit_cost: 2.95, material_unit_cost: 1.05, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Drywall', productivity_note: '', active: true },
  { project_type: 'Full Rehab', trade: 'Flooring Underlayment/Consumables', description: 'Underlayment + consumables', qty_rule: 'sqft', default_included: true, labor_unit_cost: 0, material_unit_cost: 0.55, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Flooring', productivity_note: '', active: true },
  { project_type: 'Full Rehab', trade: 'Flooring Labor', description: 'Install labor', qty_rule: 'sqft', default_included: true, labor_unit_cost: 2.75, material_unit_cost: 0, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Flooring', productivity_note: '', active: true },
  { project_type: 'Full Rehab', trade: 'Paint Materials', description: 'Primer/paint supplies', qty_rule: 'sqft', default_included: true, labor_unit_cost: 0, material_unit_cost: 0.45, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Paint', productivity_note: '', active: true },
  { project_type: 'Full Rehab', trade: 'Paint Labor', description: 'Paint labor', qty_rule: 'sqft', default_included: true, labor_unit_cost: 1.35, material_unit_cost: 0, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Paint', productivity_note: '', active: true },
  { project_type: 'Kitchen', trade: 'Demo & Prep', description: 'Protect, demo cabinets/counters, haul', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 950, material_unit_cost: 120, unit_label: 'ls', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Demo', productivity_note: '', active: true },
  { project_type: 'Kitchen', trade: 'Plumbing', description: 'Rough + trim (sink, dishwasher, gas)', qty_rule: 'fixture', default_included: true, labor_unit_cost: 420, material_unit_cost: 160, unit_label: 'fixture', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Plumbing', productivity_note: '', active: true },
  { project_type: 'Kitchen', trade: 'Electrical', description: 'Circuits, outlets, lighting allowance', qty_rule: 'fixture', default_included: true, labor_unit_cost: 280, material_unit_cost: 110, unit_label: 'fixture', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Electrical', productivity_note: '', active: true },
  { project_type: 'Kitchen', trade: 'Drywall', description: 'Patch & finish after demo', qty_rule: 'sqft', default_included: true, labor_unit_cost: 3.00, material_unit_cost: 1.10, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Drywall', productivity_note: '', active: true },
  { project_type: 'Kitchen', trade: 'Cabinets', description: 'Cabinet install labor', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 1800, material_unit_cost: 0, unit_label: 'ls', notes: 'Owner-supplied cabinets assumed', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'General', productivity_note: '', active: true },
  { project_type: 'Kitchen', trade: 'Countertops', description: 'Countertop template & install', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 650, material_unit_cost: 0, unit_label: 'ls', notes: 'Owner-supplied countertop assumed', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'General', productivity_note: '', active: true },
  { project_type: 'Kitchen', trade: 'Tile Setting Materials', description: 'Backsplash thinset/grout/consumables', qty_rule: 'sqft', default_included: true, labor_unit_cost: 0, material_unit_cost: 1.85, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'General', productivity_note: '', active: true },
  { project_type: 'Kitchen', trade: 'Tile Labor', description: 'Backsplash tile install', qty_rule: 'sqft', default_included: true, labor_unit_cost: 10.00, material_unit_cost: 0, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'General', productivity_note: '', active: true },
  { project_type: 'Kitchen', trade: 'Flooring Underlayment/Consumables', description: 'Underlayment + consumables', qty_rule: 'sqft', default_included: true, labor_unit_cost: 0, material_unit_cost: 0.55, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Flooring', productivity_note: '', active: true },
  { project_type: 'Kitchen', trade: 'Flooring Labor', description: 'Flooring install labor', qty_rule: 'sqft', default_included: true, labor_unit_cost: 2.85, material_unit_cost: 0, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Flooring', productivity_note: '', active: true },
  { project_type: 'Kitchen', trade: 'Paint Materials', description: 'Primer/paint supplies', qty_rule: 'sqft', default_included: true, labor_unit_cost: 0, material_unit_cost: 0.50, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Paint', productivity_note: '', active: true },
  { project_type: 'Kitchen', trade: 'Paint Labor', description: 'Paint labor', qty_rule: 'sqft', default_included: true, labor_unit_cost: 1.75, material_unit_cost: 0, unit_label: 'sf', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Paint', productivity_note: '', active: true },
  { project_type: 'Kitchen', trade: 'Appliance Hookup', description: 'Gas/electric appliance connections', qty_rule: 'fixture', default_included: true, labor_unit_cost: 175, material_unit_cost: 35, unit_label: 'fixture', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'General', productivity_note: '', active: true },
  { project_type: 'Kitchen', trade: 'Decorative Fixtures', description: 'Hardware, lighting allowance', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 0, material_unit_cost: 350, unit_label: 'ls', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'General', productivity_note: '', active: true },
  { project_type: 'Small Job', trade: 'General Labor', description: 'Handyman labor (hourly)', qty_rule: 'hour', default_included: true, labor_unit_cost: 75, material_unit_cost: 0, unit_label: 'hr', notes: 'Mixed trades', last_updated: '2025-01-01', labor_hours_per_unit: 1, crew_trade: 'General', productivity_note: '', active: true },
  { project_type: 'Small Job', trade: 'Drywall Patch', description: 'Drywall patch & repair materials', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 0, material_unit_cost: 85, unit_label: 'ls', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Drywall', productivity_note: '', active: true },
  { project_type: 'Small Job', trade: 'Paint Materials', description: 'Touch-up paint supplies', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 0, material_unit_cost: 65, unit_label: 'ls', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Paint', productivity_note: '', active: true },
  { project_type: 'Small Job', trade: 'Minor Plumbing', description: 'Fixture swap / repair materials', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 0, material_unit_cost: 95, unit_label: 'ls', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Plumbing', productivity_note: '', active: true },
  { project_type: 'Small Job', trade: 'Minor Electrical', description: 'Outlet/switch/fixture materials', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 0, material_unit_cost: 75, unit_label: 'ls', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'Electrical', productivity_note: '', active: true },
  { project_type: 'Small Job', trade: 'Caulking & Sealant', description: 'Caulk and sealant supplies', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 0, material_unit_cost: 35, unit_label: 'ls', notes: '', last_updated: '2025-01-01', labor_hours_per_unit: 0, crew_trade: 'General', productivity_note: '', active: true },
];

const SEED_RISK_LIBRARY: Omit<RiskLibraryItem, 'id'>[] = [
  { project_type: 'Bath', risk_name: 'Hidden plumbing/electrical', default_level: 'Medium', exposure_low_pct: 0.02, exposure_high_pct: 0.06, mitigation_note: 'Field verify + allowance; CO if discovered', default_included: true },
  { project_type: 'Bath', risk_name: 'Subfloor damage', default_level: 'Medium', exposure_low_pct: 0.02, exposure_high_pct: 0.05, mitigation_note: 'Inspect after demo; repair allowance', default_included: true },
  { project_type: 'Bath', risk_name: 'Permit/inspection delays', default_level: 'Low', exposure_low_pct: 0.01, exposure_high_pct: 0.03, mitigation_note: 'Submit early; schedule buffers', default_included: true },
  { project_type: 'Full Rehab', risk_name: 'Structural reframing', default_level: 'High', exposure_low_pct: 0.03, exposure_high_pct: 0.10, mitigation_note: 'Open walls early; engineer if needed; CO protection', default_included: true },
  { project_type: 'Full Rehab', risk_name: 'MEP unknowns', default_level: 'Medium', exposure_low_pct: 0.03, exposure_high_pct: 0.07, mitigation_note: 'Early rough inspections; upgrade allowances', default_included: true },
  { project_type: 'Full Rehab', risk_name: 'Material lead times', default_level: 'Medium', exposure_low_pct: 0.02, exposure_high_pct: 0.05, mitigation_note: 'Order long-leads early; alternates list', default_included: true },
  { project_type: 'Full Rehab', risk_name: 'City inspection cycle', default_level: 'Medium', exposure_low_pct: 0.02, exposure_high_pct: 0.06, mitigation_note: 'Buffer schedule; staged inspections', default_included: true },
  { project_type: 'Kitchen', risk_name: 'Hidden plumbing/gas issues', default_level: 'Medium', exposure_low_pct: 0.02, exposure_high_pct: 0.07, mitigation_note: 'Verify gas lines and water supply before demo', default_included: true },
  { project_type: 'Kitchen', risk_name: 'Structural wall discovery', default_level: 'Medium', exposure_low_pct: 0.03, exposure_high_pct: 0.08, mitigation_note: 'Investigate wall before layout changes; engineer if needed', default_included: true },
  { project_type: 'Kitchen', risk_name: 'Cabinet/countertop lead times', default_level: 'Low', exposure_low_pct: 0.01, exposure_high_pct: 0.04, mitigation_note: 'Order early; confirm templates before fabrication', default_included: true },
  { project_type: 'Kitchen', risk_name: 'Permit/inspection delays', default_level: 'Low', exposure_low_pct: 0.01, exposure_high_pct: 0.03, mitigation_note: 'Submit early; schedule buffers', default_included: true },
  { project_type: 'Small Job', risk_name: 'Scope creep / hidden damage', default_level: 'Medium', exposure_low_pct: 0.05, exposure_high_pct: 0.15, mitigation_note: 'Document scope clearly; CO for extras', default_included: true },
  { project_type: 'Small Job', risk_name: 'Material availability', default_level: 'Low', exposure_low_pct: 0.02, exposure_high_pct: 0.05, mitigation_note: 'Verify materials in stock before scheduling', default_included: true },
];

export async function initStore() {
  try {
    const userId = await getUserId();
    
    const { count: costCount } = await supabase.from('cost_library').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    if (costCount === 0) {
      const rows = SEED_COST_LIBRARY.map(item => ({ ...item, id: uid(), user_id: userId }));
      await supabase.from('cost_library').insert(rows as any);
    }

    const { count: riskCount } = await supabase.from('risk_library').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    if (riskCount === 0) {
      const rows = SEED_RISK_LIBRARY.map(item => ({ ...item, id: uid(), user_id: userId }));
      await supabase.from('risk_library').insert(rows as any);
    }
  } catch (e) {
    console.error('initStore error:', e);
  }
}

// ─── Row Mappers ───
function rowToEstimate(r: any): Estimate {
  return {
    estimate_id: r.estimate_id, created_at: r.created_at, updated_at: r.updated_at,
    created_by: r.created_by, status: r.status, client_name: r.client_name,
    client_email: r.client_email, client_phone: r.client_phone,
    project_address: r.project_address, city: r.city, state: r.state, zip: r.zip,
    project_name: r.project_name, project_type: r.project_type,
    sqft: Number(r.sqft), fixture_count: Number(r.fixture_count), labor_hours: Number(r.labor_hours),
    finish_level: r.finish_level, finish_materials_included: r.finish_materials_included,
    labor_subtotal: Number(r.labor_subtotal), material_subtotal: Number(r.material_subtotal),
    subtotal: Number(r.subtotal), cost_structure_json: r.cost_structure_json,
    line_items_json: r.line_items_json, risk_cost_low: Number(r.risk_cost_low),
    risk_cost_high: Number(r.risk_cost_high), overall_risk_level: r.overall_risk_level,
    risk_table_json: r.risk_table_json, overhead_pct: Number(r.overhead_pct),
    profit_pct: Number(r.profit_pct), contingency_pct: Number(r.contingency_pct),
    total_low: Number(r.total_low), total_high: Number(r.total_high),
    assumptions_rich: r.assumptions_rich, timeline_rich: r.timeline_rich,
    ai_scope: r.ai_scope, ai_price_audit_summary: r.ai_price_audit_summary,
    public_pdf_url: r.public_pdf_url, internal_pdf_url: r.internal_pdf_url,
    version: r.version, last_revision_summary: r.last_revision_summary,
    crew_size: Number(r.crew_size || 2), hours_per_day: Number(r.hours_per_day || 8),
    subtotal_labor_hours: Number(r.subtotal_labor_hours || 0),
    estimated_duration_days: Number(r.estimated_duration_days || 0),
    internal_notes: r.internal_notes || '', public_notes: r.public_notes || '',
    clarification_answers_json: r.clarification_answers_json || '[]',
    ai_suggestions_last_json: r.ai_suggestions_last_json || '[]',
    validity_days: Number(r.validity_days ?? 14),
    material_volatility_flag: r.material_volatility_flag ?? false,
    volatility_reviewed: r.volatility_reviewed ?? false,
    completeness_score: Number(r.completeness_score ?? 0),
    calc_status: r.calc_status || 'Stale',
  } as Estimate;
}

function estimateToRow(est: Estimate, userId: string) {
  return {
    user_id: userId, estimate_id: est.estimate_id,
    created_at: est.created_at, updated_at: est.updated_at || new Date().toISOString(),
    created_by: est.created_by, status: est.status, client_name: est.client_name,
    client_email: est.client_email, client_phone: est.client_phone,
    project_address: est.project_address, city: est.city, state: est.state, zip: est.zip,
    project_name: est.project_name, project_type: est.project_type,
    sqft: est.sqft, fixture_count: est.fixture_count, labor_hours: est.labor_hours,
    finish_level: est.finish_level, finish_materials_included: est.finish_materials_included,
    labor_subtotal: est.labor_subtotal, material_subtotal: est.material_subtotal,
    subtotal: est.subtotal, cost_structure_json: est.cost_structure_json,
    line_items_json: est.line_items_json, risk_cost_low: est.risk_cost_low,
    risk_cost_high: est.risk_cost_high, overall_risk_level: est.overall_risk_level,
    risk_table_json: est.risk_table_json, overhead_pct: est.overhead_pct,
    profit_pct: est.profit_pct, contingency_pct: est.contingency_pct,
    total_low: est.total_low, total_high: est.total_high,
    assumptions_rich: est.assumptions_rich, timeline_rich: est.timeline_rich,
    ai_scope: est.ai_scope, ai_price_audit_summary: est.ai_price_audit_summary,
    public_pdf_url: est.public_pdf_url, internal_pdf_url: est.internal_pdf_url,
    version: est.version, last_revision_summary: est.last_revision_summary,
    crew_size: est.crew_size, hours_per_day: est.hours_per_day,
    subtotal_labor_hours: est.subtotal_labor_hours, estimated_duration_days: est.estimated_duration_days,
    internal_notes: est.internal_notes, public_notes: est.public_notes,
    clarification_answers_json: est.clarification_answers_json || '[]',
    ai_suggestions_last_json: est.ai_suggestions_last_json || '[]',
    validity_days: (est as any).validity_days ?? 14,
    material_volatility_flag: (est as any).material_volatility_flag ?? false,
    volatility_reviewed: (est as any).volatility_reviewed ?? false,
    completeness_score: (est as any).completeness_score ?? 0,
    calc_status: (est as any).calc_status || 'Stale',
  };
}

function rowToCostItem(r: any): CostLibraryItem {
  return {
    id: r.id, project_type: r.project_type, trade: r.trade, description: r.description,
    qty_rule: r.qty_rule, default_included: r.default_included,
    labor_unit_cost: Number(r.labor_unit_cost), material_unit_cost: Number(r.material_unit_cost),
    unit_label: r.unit_label, notes: r.notes, last_updated: r.last_updated,
    labor_hours_per_unit: Number(r.labor_hours_per_unit || 0),
    crew_trade: r.crew_trade || 'General',
    productivity_note: r.productivity_note || '',
    active: r.active !== false,
  };
}

function rowToRiskItem(r: any): RiskLibraryItem {
  return {
    id: r.id, project_type: r.project_type, risk_name: r.risk_name,
    default_level: r.default_level, exposure_low_pct: Number(r.exposure_low_pct),
    exposure_high_pct: Number(r.exposure_high_pct), mitigation_note: r.mitigation_note,
    default_included: r.default_included,
  };
}
