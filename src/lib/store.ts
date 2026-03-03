import type { Estimate, CostLibraryItem, RiskLibraryItem, EstimateRevisionLog, CostAudit } from './types';

const KEYS = {
  ESTIMATES: 'tvik_estimates',
  COST_LIBRARY: 'tvik_cost_library',
  RISK_LIBRARY: 'tvik_risk_library',
  REVISION_LOGS: 'tvik_revision_logs',
  COST_AUDITS: 'tvik_cost_audits',
};

function get<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function set<T>(key: string, data: T[]) { localStorage.setItem(key, JSON.stringify(data)); }

// Estimates
export const getEstimates = (): Estimate[] => get(KEYS.ESTIMATES);
export const getEstimate = (id: string) => getEstimates().find(e => e.estimate_id === id);
export const saveEstimate = (est: Estimate) => {
  const all = getEstimates();
  const idx = all.findIndex(e => e.estimate_id === est.estimate_id);
  est.updated_at = new Date().toISOString();
  if (idx >= 0) all[idx] = est; else all.push(est);
  set(KEYS.ESTIMATES, all);
};
export const deleteEstimate = (id: string) => set(KEYS.ESTIMATES, getEstimates().filter(e => e.estimate_id !== id));

// Cost Library
export const getCostLibrary = (): CostLibraryItem[] => get(KEYS.COST_LIBRARY);
export const saveCostLibraryItem = (item: CostLibraryItem) => {
  const all = getCostLibrary();
  const idx = all.findIndex(i => i.id === item.id);
  if (idx >= 0) all[idx] = item; else all.push(item);
  set(KEYS.COST_LIBRARY, all);
};
export const deleteCostLibraryItem = (id: string) => set(KEYS.COST_LIBRARY, getCostLibrary().filter(i => i.id !== id));

// Risk Library
export const getRiskLibrary = (): RiskLibraryItem[] => get(KEYS.RISK_LIBRARY);
export const saveRiskLibraryItem = (item: RiskLibraryItem) => {
  const all = getRiskLibrary();
  const idx = all.findIndex(i => i.id === item.id);
  if (idx >= 0) all[idx] = item; else all.push(item);
  set(KEYS.RISK_LIBRARY, all);
};
export const deleteRiskLibraryItem = (id: string) => set(KEYS.RISK_LIBRARY, getRiskLibrary().filter(i => i.id !== id));

// Revision Logs
export const getRevisionLogs = (estimateId?: string): EstimateRevisionLog[] => {
  const all: EstimateRevisionLog[] = get(KEYS.REVISION_LOGS);
  return estimateId ? all.filter(r => r.estimate_id === estimateId) : all;
};
export const saveRevisionLog = (log: EstimateRevisionLog) => {
  const all = getRevisionLogs();
  all.push(log);
  set(KEYS.REVISION_LOGS, all);
};

// Cost Audits
export const getCostAudits = (estimateId?: string): CostAudit[] => {
  const all: CostAudit[] = get(KEYS.COST_AUDITS);
  return estimateId ? all.filter(a => a.estimate_id === estimateId) : all;
};
export const saveCostAudit = (audit: CostAudit) => {
  const all: CostAudit[] = get(KEYS.COST_AUDITS);
  const idx = all.findIndex(a => a.id === audit.id);
  if (idx >= 0) all[idx] = audit; else all.push(audit);
  set(KEYS.COST_AUDITS, all);
};

// ID generation
let counter = parseInt(localStorage.getItem('tvik_id_counter') || '0', 10);
export const nextEstimateId = () => {
  counter++;
  localStorage.setItem('tvik_id_counter', String(counter));
  return `EST-${String(counter).padStart(4, '0')}`;
};
export const uid = () => crypto.randomUUID();

// Seed data
const SEED_COST_LIBRARY: CostLibraryItem[] = [
  { id: uid(), project_type: 'Bath', trade: 'Demo & Prep', description: 'Protect, demo, haul', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 650, material_unit_cost: 75, unit_label: 'ls', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Bath', trade: 'Plumbing', description: 'Rough + trim (allowance)', qty_rule: 'fixture', default_included: true, labor_unit_cost: 380, material_unit_cost: 140, unit_label: 'fixture', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Bath', trade: 'Electrical', description: 'Bath circuits/fixtures allowance', qty_rule: 'fixture', default_included: true, labor_unit_cost: 220, material_unit_cost: 90, unit_label: 'fixture', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Bath', trade: 'Drywall', description: 'Hang/tape/finish patch areas', qty_rule: 'sqft', default_included: true, labor_unit_cost: 3.25, material_unit_cost: 1.15, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Bath', trade: 'Tile Setting Materials', description: 'Thinset/grout/consumables', qty_rule: 'sqft', default_included: true, labor_unit_cost: 0, material_unit_cost: 1.75, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Bath', trade: 'Tile Labor', description: 'Tile install labor', qty_rule: 'sqft', default_included: true, labor_unit_cost: 9.50, material_unit_cost: 0, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Bath', trade: 'Paint Materials', description: 'Primer/paint supplies', qty_rule: 'sqft', default_included: true, labor_unit_cost: 0, material_unit_cost: 0.55, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Bath', trade: 'Paint Labor', description: 'Paint labor', qty_rule: 'sqft', default_included: true, labor_unit_cost: 1.90, material_unit_cost: 0, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Bath', trade: 'Decorative Fixtures', description: 'Mirror/vanity light allowance', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 0, material_unit_cost: 250, unit_label: 'ls', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Full Rehab', trade: 'Demo & Protection', description: 'Selective demo + protect', qty_rule: 'sqft', default_included: true, labor_unit_cost: 1.10, material_unit_cost: 0.20, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Full Rehab', trade: 'Framing', description: 'Repairs allowance', qty_rule: 'sqft', default_included: true, labor_unit_cost: 1.40, material_unit_cost: 0.60, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Full Rehab', trade: 'Electrical', description: 'Rehab allowance', qty_rule: 'sqft', default_included: true, labor_unit_cost: 1.85, material_unit_cost: 0.65, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Full Rehab', trade: 'Plumbing', description: 'Rehab allowance', qty_rule: 'sqft', default_included: true, labor_unit_cost: 1.60, material_unit_cost: 0.70, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Full Rehab', trade: 'HVAC', description: 'Allowance', qty_rule: 'sqft', default_included: true, labor_unit_cost: 0.85, material_unit_cost: 0.65, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Full Rehab', trade: 'Drywall', description: 'Hang/tape/finish', qty_rule: 'sqft', default_included: true, labor_unit_cost: 2.95, material_unit_cost: 1.05, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Full Rehab', trade: 'Flooring Underlayment/Consumables', description: 'Underlayment + consumables', qty_rule: 'sqft', default_included: true, labor_unit_cost: 0, material_unit_cost: 0.55, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Full Rehab', trade: 'Flooring Labor', description: 'Install labor', qty_rule: 'sqft', default_included: true, labor_unit_cost: 2.75, material_unit_cost: 0, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Full Rehab', trade: 'Paint Materials', description: 'Primer/paint supplies', qty_rule: 'sqft', default_included: true, labor_unit_cost: 0, material_unit_cost: 0.45, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Full Rehab', trade: 'Paint Labor', description: 'Paint labor', qty_rule: 'sqft', default_included: true, labor_unit_cost: 1.35, material_unit_cost: 0, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
];

const SEED_RISK_LIBRARY: RiskLibraryItem[] = [
  { id: uid(), project_type: 'Bath', risk_name: 'Hidden plumbing/electrical', default_level: 'Medium', exposure_low_pct: 0.02, exposure_high_pct: 0.06, mitigation_note: 'Field verify + allowance; CO if discovered', default_included: true },
  { id: uid(), project_type: 'Bath', risk_name: 'Subfloor damage', default_level: 'Medium', exposure_low_pct: 0.02, exposure_high_pct: 0.05, mitigation_note: 'Inspect after demo; repair allowance', default_included: true },
  { id: uid(), project_type: 'Bath', risk_name: 'Permit/inspection delays', default_level: 'Low', exposure_low_pct: 0.01, exposure_high_pct: 0.03, mitigation_note: 'Submit early; schedule buffers', default_included: true },
  { id: uid(), project_type: 'Full Rehab', risk_name: 'Structural reframing', default_level: 'High', exposure_low_pct: 0.03, exposure_high_pct: 0.10, mitigation_note: 'Open walls early; engineer if needed; CO protection', default_included: true },
  { id: uid(), project_type: 'Full Rehab', risk_name: 'MEP unknowns', default_level: 'Medium', exposure_low_pct: 0.03, exposure_high_pct: 0.07, mitigation_note: 'Early rough inspections; upgrade allowances', default_included: true },
  { id: uid(), project_type: 'Full Rehab', risk_name: 'Material lead times', default_level: 'Medium', exposure_low_pct: 0.02, exposure_high_pct: 0.05, mitigation_note: 'Order long-leads early; alternates list', default_included: true },
  { id: uid(), project_type: 'Full Rehab', risk_name: 'City inspection cycle', default_level: 'Medium', exposure_low_pct: 0.02, exposure_high_pct: 0.06, mitigation_note: 'Buffer schedule; staged inspections', default_included: true },
];

export function initStore() {
  if (!localStorage.getItem(KEYS.COST_LIBRARY)) {
    set(KEYS.COST_LIBRARY, SEED_COST_LIBRARY);
  }
  if (!localStorage.getItem(KEYS.RISK_LIBRARY)) {
    set(KEYS.RISK_LIBRARY, SEED_RISK_LIBRARY);
  }
}

initStore();
