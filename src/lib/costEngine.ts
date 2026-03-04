import type { CostLibraryItem, EstimateLineItem, CostStructureItem, ProjectType, FinishLevel, Phase, LineItemUnit } from './types';

const FINISH_MULTIPLIERS: Record<FinishLevel, number> = {
  Basic: 1.00, Mid: 1.15, High: 1.30, Luxury: 1.55,
};

const FINISH_MATERIAL_DESCRIPTIONS = [
  'Paint Materials', 'Tile Setting Materials', 'Flooring Underlayment/Consumables',
];

// Map qty_rule -> LineItemUnit
function mapUnit(qtyRule: string): LineItemUnit {
  switch (qtyRule) {
    case 'sqft': return 'sf';
    case 'fixture': return 'fixture';
    case 'lump_sum': return 'lump_sum';
    case 'each': return 'ea';
    case 'lf': return 'lf';
    case 'hour': return 'hr';
    default: return 'ea';
  }
}

// Map crew_trade -> Phase
function mapPhase(crewTrade: string): Phase {
  const map: Record<string, Phase> = {
    Demo: 'Demo', Framing: 'Framing', Drywall: 'Drywall', Paint: 'Paint',
    Flooring: 'Flooring', Electrical: 'Electrical', Plumbing: 'Plumbing',
    HVAC: 'HVAC', General: 'Other', Exterior: 'Other', Roofing: 'Other',
  };
  return map[crewTrade] || 'Other';
}

/**
 * Derive labor_hours_per_unit when CostLibrary doesn't have one.
 * Deterministic heuristic: divide labor cost by a $/hr rate based on unit type.
 */
function deriveLaborHoursPerUnit(qtyRule: string, laborUnitCost: number): number {
  if (laborUnitCost <= 0) return 0;
  switch (qtyRule) {
    case 'sqft': return Math.round((laborUnitCost / 75) * 10000) / 10000;
    case 'fixture': return Math.round((laborUnitCost / 85) * 10000) / 10000;
    default: return Math.round((laborUnitCost / 80) * 10000) / 10000;
  }
}

interface CostInput {
  project_type: ProjectType;
  sqft: number;
  fixture_count: number;
  labor_hours: number;
  finish_level: FinishLevel;
  finish_materials_included: boolean;
  costLibrary: CostLibraryItem[];
  /** UUID of the estimate row (estimates.id) for FK linking */
  estimate_db_id: string;
  crew_size: number;
  hours_per_day: number;
}

export interface CostResult {
  labor_subtotal: number;
  material_subtotal: number;
  subtotal: number;
  subtotal_labor_hours: number;
  estimated_duration_days: number;
  line_items: EstimateLineItem[];
  cost_structure: CostStructureItem[];
  /** Legacy line_items_json-compatible array */
  legacy_line_items: { trade: string; description: string; qty: number; unit: string; labor: number; material: number; total: number }[];
}

/*
 * TEST CHECKLIST (deterministic engine):
 * - Bath: sqft + fixture_count, finish materials OFF → material_total = 0 for Paint Materials, Tile Setting Materials, Flooring Underlayment/Consumables
 * - Bath: finish materials ON → all materials included with finish multiplier
 * - Full Rehab: sqft only → fixture/hour lines get qty=1 or 0 appropriately
 * - Run Generate twice: CostLibrary lines refresh, Manual lines preserved
 * - subtotal_labor_hours and estimated_duration_days populate correctly
 * - Risk totals deterministic and risk_level rollup correct
 */
export function runCostEngine(input: CostInput): CostResult {
  const rows = input.costLibrary.filter(
    r => r.project_type === input.project_type && r.default_included && (r.active !== false)
  );
  const finishMult = FINISH_MULTIPLIERS[input.finish_level];
  const lineItems: EstimateLineItem[] = [];

  for (const row of rows) {
    // A) Deterministic qty
    let qty = 0;
    switch (row.qty_rule) {
      case 'sqft': qty = input.sqft; break;
      case 'fixture': qty = input.fixture_count || 1; break;
      case 'lump_sum': case 'each': qty = 1; break;
      case 'lf': qty = 0; break; // ignored for now
      case 'hour': qty = input.labor_hours || 1; break;
    }

    // B) Finish multiplier on material only
    let materialUnitCost = Math.round(row.material_unit_cost * finishMult * 100) / 100;

    // C) Finish materials toggle
    if (!input.finish_materials_included && FINISH_MATERIAL_DESCRIPTIONS.some(d => row.trade.includes(d) || row.description.includes(d))) {
      materialUnitCost = 0;
    }

    const labor_total = Math.round(qty * row.labor_unit_cost * 100) / 100;
    const material_total = Math.round(qty * materialUnitCost * 100) / 100;

    // Labor hours per unit: use library value or derive deterministically
    const labor_hours_per_unit = (row.labor_hours_per_unit && row.labor_hours_per_unit > 0)
      ? row.labor_hours_per_unit
      : deriveLaborHoursPerUnit(row.qty_rule, row.labor_unit_cost);
    const labor_hours_total = Math.round(qty * labor_hours_per_unit * 100) / 100;

    lineItems.push({
      line_id: `CL-${row.id}`,
      estimate_id: input.estimate_db_id,
      phase: mapPhase(row.crew_trade || 'General'),
      description: row.trade,
      unit: mapUnit(row.qty_rule),
      qty,
      labor_unit_cost: row.labor_unit_cost,
      material_unit_cost: materialUnitCost,
      labor_hours_per_unit,
      labor_hours_total,
      labor_total,
      material_total,
      line_total: Math.round((labor_total + material_total) * 100) / 100,
      source: 'CostLibrary',
      locked: false,
      pending_confirmation: false,
      confidence: 'High',
      evidence_source: 'CostLibrary',
      notes: '',
    });
  }

  // D) Totals
  const labor_subtotal = Math.round(lineItems.reduce((s, l) => s + l.labor_total, 0) * 100) / 100;
  const material_subtotal = Math.round(lineItems.reduce((s, l) => s + l.material_total, 0) * 100) / 100;
  const subtotal = Math.round((labor_subtotal + material_subtotal) * 100) / 100;
  const subtotal_labor_hours = Math.round(lineItems.reduce((s, l) => s + l.labor_hours_total, 0) * 100) / 100;

  const crewSize = input.crew_size || 2;
  const hoursPerDay = input.hours_per_day || 8;
  const estimated_duration_days = subtotal_labor_hours > 0
    ? Math.ceil(subtotal_labor_hours / (crewSize * hoursPerDay))
    : 0;

  // Cost structure by trade
  const tradeMap = new Map<string, { labor: number; material: number }>();
  for (const li of lineItems) {
    const existing = tradeMap.get(li.description) || { labor: 0, material: 0 };
    existing.labor += li.labor_total;
    existing.material += li.material_total;
    tradeMap.set(li.description, existing);
  }
  const cost_structure: CostStructureItem[] = Array.from(tradeMap.entries()).map(([trade, v]) => ({
    trade,
    labor: Math.round(v.labor * 100) / 100,
    material: Math.round(v.material * 100) / 100,
    dollars: Math.round((v.labor + v.material) * 100) / 100,
    percent: subtotal > 0 ? Math.round(((v.labor + v.material) / subtotal) * 10000) / 100 : 0,
  }));

  // Legacy line items for backward compat (line_items_json)
  const legacy_line_items = lineItems.map(li => ({
    trade: li.description,
    description: li.description,
    qty: li.qty,
    unit: li.unit,
    labor: li.labor_total,
    material: li.material_total,
    total: li.line_total,
  }));

  return { labor_subtotal, material_subtotal, subtotal, subtotal_labor_hours, estimated_duration_days, line_items: lineItems, cost_structure, legacy_line_items };
}
