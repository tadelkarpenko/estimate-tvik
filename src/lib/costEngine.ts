import type { CostLibraryItem, LineItem, CostStructureItem, ProjectType, FinishLevel } from './types';

const FINISH_MULTIPLIERS: Record<FinishLevel, number> = {
  Basic: 1.00, Mid: 1.15, High: 1.30, Luxury: 1.55,
};

const FINISH_MATERIAL_TRADES = [
  'Paint Materials', 'Tile Setting Materials', 'Flooring Underlayment/Consumables', 'Decorative Fixtures',
];

interface CostInput {
  project_type: ProjectType;
  sqft: number;
  fixture_count: number;
  finish_level: FinishLevel;
  finish_materials_included: boolean;
  costLibrary: CostLibraryItem[];
}

export interface CostResult {
  labor_subtotal: number;
  material_subtotal: number;
  subtotal: number;
  line_items: LineItem[];
  cost_structure: CostStructureItem[];
}

export function runCostEngine(input: CostInput): CostResult {
  const rows = input.costLibrary.filter(r => r.project_type === input.project_type && r.default_included);
  const finishMult = FINISH_MULTIPLIERS[input.finish_level];
  const lineItems: LineItem[] = [];

  for (const row of rows) {
    let qty = 0;
    switch (row.qty_rule) {
      case 'sqft': qty = input.sqft; break;
      case 'fixture': qty = input.fixture_count; break;
      case 'lump_sum': case 'each': qty = 1; break;
      case 'lf': qty = 0; break;
    }
    const labor = Math.round(qty * row.labor_unit_cost * 100) / 100;
    let material = Math.round(qty * row.material_unit_cost * finishMult * 100) / 100;

    if (!input.finish_materials_included && FINISH_MATERIAL_TRADES.includes(row.trade)) {
      material = 0;
    }

    lineItems.push({
      trade: row.trade,
      description: row.description,
      qty,
      unit: row.unit_label,
      labor,
      material,
      total: Math.round((labor + material) * 100) / 100,
    });
  }

  const labor_subtotal = Math.round(lineItems.reduce((s, l) => s + l.labor, 0) * 100) / 100;
  const material_subtotal = Math.round(lineItems.reduce((s, l) => s + l.material, 0) * 100) / 100;
  const subtotal = Math.round((labor_subtotal + material_subtotal) * 100) / 100;

  // Cost structure by trade
  const tradeMap = new Map<string, { labor: number; material: number }>();
  for (const li of lineItems) {
    const existing = tradeMap.get(li.trade) || { labor: 0, material: 0 };
    existing.labor += li.labor;
    existing.material += li.material;
    tradeMap.set(li.trade, existing);
  }
  const cost_structure: CostStructureItem[] = Array.from(tradeMap.entries()).map(([trade, v]) => ({
    trade,
    labor: Math.round(v.labor * 100) / 100,
    material: Math.round(v.material * 100) / 100,
    dollars: Math.round((v.labor + v.material) * 100) / 100,
    percent: subtotal > 0 ? Math.round(((v.labor + v.material) / subtotal) * 10000) / 100 : 0,
  }));

  return { labor_subtotal, material_subtotal, subtotal, line_items: lineItems, cost_structure };
}
