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
  // Kitchen
  { id: uid(), project_type: 'Kitchen', trade: 'Demo & Prep', description: 'Protect, demo cabinets/counters, haul', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 950, material_unit_cost: 120, unit_label: 'ls', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Kitchen', trade: 'Plumbing', description: 'Rough + trim (sink, dishwasher, gas)', qty_rule: 'fixture', default_included: true, labor_unit_cost: 420, material_unit_cost: 160, unit_label: 'fixture', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Kitchen', trade: 'Electrical', description: 'Circuits, outlets, lighting allowance', qty_rule: 'fixture', default_included: true, labor_unit_cost: 280, material_unit_cost: 110, unit_label: 'fixture', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Kitchen', trade: 'Drywall', description: 'Patch & finish after demo', qty_rule: 'sqft', default_included: true, labor_unit_cost: 3.00, material_unit_cost: 1.10, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Kitchen', trade: 'Cabinets', description: 'Cabinet install labor', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 1800, material_unit_cost: 0, unit_label: 'ls', notes: 'Owner-supplied cabinets assumed', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Kitchen', trade: 'Countertops', description: 'Countertop template & install', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 650, material_unit_cost: 0, unit_label: 'ls', notes: 'Owner-supplied countertop assumed', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Kitchen', trade: 'Tile Setting Materials', description: 'Backsplash thinset/grout/consumables', qty_rule: 'sqft', default_included: true, labor_unit_cost: 0, material_unit_cost: 1.85, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Kitchen', trade: 'Tile Labor', description: 'Backsplash tile install', qty_rule: 'sqft', default_included: true, labor_unit_cost: 10.00, material_unit_cost: 0, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Kitchen', trade: 'Flooring Underlayment/Consumables', description: 'Underlayment + consumables', qty_rule: 'sqft', default_included: true, labor_unit_cost: 0, material_unit_cost: 0.55, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Kitchen', trade: 'Flooring Labor', description: 'Flooring install labor', qty_rule: 'sqft', default_included: true, labor_unit_cost: 2.85, material_unit_cost: 0, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Kitchen', trade: 'Paint Materials', description: 'Primer/paint supplies', qty_rule: 'sqft', default_included: true, labor_unit_cost: 0, material_unit_cost: 0.50, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Kitchen', trade: 'Paint Labor', description: 'Paint labor', qty_rule: 'sqft', default_included: true, labor_unit_cost: 1.75, material_unit_cost: 0, unit_label: 'sf', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Kitchen', trade: 'Appliance Hookup', description: 'Gas/electric appliance connections', qty_rule: 'fixture', default_included: true, labor_unit_cost: 175, material_unit_cost: 35, unit_label: 'fixture', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Kitchen', trade: 'Decorative Fixtures', description: 'Hardware, lighting allowance', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 0, material_unit_cost: 350, unit_label: 'ls', notes: '', last_updated: '2025-01-01' },
  // Small Job (hourly labor + material lump sums)
  { id: uid(), project_type: 'Small Job', trade: 'General Labor', description: 'Handyman labor (hourly)', qty_rule: 'hour', default_included: true, labor_unit_cost: 75, material_unit_cost: 0, unit_label: 'hr', notes: 'Mixed trades', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Small Job', trade: 'Drywall Patch', description: 'Drywall patch & repair materials', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 0, material_unit_cost: 85, unit_label: 'ls', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Small Job', trade: 'Paint Materials', description: 'Touch-up paint supplies', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 0, material_unit_cost: 65, unit_label: 'ls', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Small Job', trade: 'Minor Plumbing', description: 'Fixture swap / repair materials', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 0, material_unit_cost: 95, unit_label: 'ls', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Small Job', trade: 'Minor Electrical', description: 'Outlet/switch/fixture materials', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 0, material_unit_cost: 75, unit_label: 'ls', notes: '', last_updated: '2025-01-01' },
  { id: uid(), project_type: 'Small Job', trade: 'Caulking & Sealant', description: 'Caulk and sealant supplies', qty_rule: 'lump_sum', default_included: true, labor_unit_cost: 0, material_unit_cost: 35, unit_label: 'ls', notes: '', last_updated: '2025-01-01' },
];

const SEED_RISK_LIBRARY: RiskLibraryItem[] = [
  { id: uid(), project_type: 'Bath', risk_name: 'Hidden plumbing/electrical', default_level: 'Medium', exposure_low_pct: 0.02, exposure_high_pct: 0.06, mitigation_note: 'Field verify + allowance; CO if discovered', default_included: true },
  { id: uid(), project_type: 'Bath', risk_name: 'Subfloor damage', default_level: 'Medium', exposure_low_pct: 0.02, exposure_high_pct: 0.05, mitigation_note: 'Inspect after demo; repair allowance', default_included: true },
  { id: uid(), project_type: 'Bath', risk_name: 'Permit/inspection delays', default_level: 'Low', exposure_low_pct: 0.01, exposure_high_pct: 0.03, mitigation_note: 'Submit early; schedule buffers', default_included: true },
  { id: uid(), project_type: 'Full Rehab', risk_name: 'Structural reframing', default_level: 'High', exposure_low_pct: 0.03, exposure_high_pct: 0.10, mitigation_note: 'Open walls early; engineer if needed; CO protection', default_included: true },
  { id: uid(), project_type: 'Full Rehab', risk_name: 'MEP unknowns', default_level: 'Medium', exposure_low_pct: 0.03, exposure_high_pct: 0.07, mitigation_note: 'Early rough inspections; upgrade allowances', default_included: true },
  { id: uid(), project_type: 'Full Rehab', risk_name: 'Material lead times', default_level: 'Medium', exposure_low_pct: 0.02, exposure_high_pct: 0.05, mitigation_note: 'Order long-leads early; alternates list', default_included: true },
  { id: uid(), project_type: 'Full Rehab', risk_name: 'City inspection cycle', default_level: 'Medium', exposure_low_pct: 0.02, exposure_high_pct: 0.06, mitigation_note: 'Buffer schedule; staged inspections', default_included: true },
  // Kitchen risks
  { id: uid(), project_type: 'Kitchen', risk_name: 'Hidden plumbing/gas issues', default_level: 'Medium', exposure_low_pct: 0.02, exposure_high_pct: 0.07, mitigation_note: 'Verify gas lines and water supply before demo', default_included: true },
  { id: uid(), project_type: 'Kitchen', risk_name: 'Structural wall discovery', default_level: 'Medium', exposure_low_pct: 0.03, exposure_high_pct: 0.08, mitigation_note: 'Investigate wall before layout changes; engineer if needed', default_included: true },
  { id: uid(), project_type: 'Kitchen', risk_name: 'Cabinet/countertop lead times', default_level: 'Low', exposure_low_pct: 0.01, exposure_high_pct: 0.04, mitigation_note: 'Order early; confirm templates before fabrication', default_included: true },
  { id: uid(), project_type: 'Kitchen', risk_name: 'Permit/inspection delays', default_level: 'Low', exposure_low_pct: 0.01, exposure_high_pct: 0.03, mitigation_note: 'Submit early; schedule buffers', default_included: true },
  // Small Job risks
  { id: uid(), project_type: 'Small Job', risk_name: 'Scope creep / hidden damage', default_level: 'Medium', exposure_low_pct: 0.05, exposure_high_pct: 0.15, mitigation_note: 'Document scope clearly; CO for extras', default_included: true },
  { id: uid(), project_type: 'Small Job', risk_name: 'Material availability', default_level: 'Low', exposure_low_pct: 0.02, exposure_high_pct: 0.05, mitigation_note: 'Verify materials in stock before scheduling', default_included: true },
];

export function initStore() {
  // Seed cost library: add missing project types
  const existingCost = getCostLibrary();
  const existingTypes = new Set(existingCost.map(i => i.project_type));
  const newCostItems = SEED_COST_LIBRARY.filter(i => !existingTypes.has(i.project_type));
  if (newCostItems.length > 0 || existingCost.length === 0) {
    set(KEYS.COST_LIBRARY, [...existingCost, ...newCostItems]);
  }

  // Seed risk library: add missing project types
  const existingRisk = getRiskLibrary();
  const existingRiskTypes = new Set(existingRisk.map(i => i.project_type));
  const newRiskItems = SEED_RISK_LIBRARY.filter(i => !existingRiskTypes.has(i.project_type));
  if (newRiskItems.length > 0 || existingRisk.length === 0) {
    set(KEYS.RISK_LIBRARY, [...existingRisk, ...newRiskItems]);
  }
}

initStore();
