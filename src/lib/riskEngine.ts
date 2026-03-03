import type { RiskLibraryItem, RiskTableItem, RiskLevel, ProjectType } from './types';

const LEVEL_MULT: Record<RiskLevel, number> = { Low: 0.6, Medium: 1.0, High: 1.4 };

interface RiskInput {
  project_type: ProjectType;
  subtotal: number;
  riskLibrary: RiskLibraryItem[];
}

export interface RiskResult {
  risk_cost_low: number;
  risk_cost_high: number;
  overall_risk_level: RiskLevel;
  risk_table: RiskTableItem[];
}

export function runRiskEngine(input: RiskInput): RiskResult {
  const rows = input.riskLibrary.filter(r => r.project_type === input.project_type && r.default_included);
  const riskTable: RiskTableItem[] = [];
  let totalLow = 0, totalHigh = 0;
  let hasHigh = false;

  for (const row of rows) {
    const mult = LEVEL_MULT[row.default_level];
    const expLow = Math.round(input.subtotal * row.exposure_low_pct * mult * 100) / 100;
    const expHigh = Math.round(input.subtotal * row.exposure_high_pct * mult * 100) / 100;
    totalLow += expLow;
    totalHigh += expHigh;
    if (row.default_level === 'High') hasHigh = true;
    riskTable.push({ risk_name: row.risk_name, level: row.default_level, exposure_low: expLow, exposure_high: expHigh, mitigation_note: row.mitigation_note });
  }

  const riskRatioHigh = input.subtotal > 0 ? totalHigh / input.subtotal : 0;
  let overall: RiskLevel = 'Low';
  if (hasHigh || riskRatioHigh > 0.15) overall = 'High';
  else if (riskRatioHigh >= 0.08) overall = 'Medium';

  return {
    risk_cost_low: Math.round(totalLow * 100) / 100,
    risk_cost_high: Math.round(totalHigh * 100) / 100,
    overall_risk_level: overall,
    risk_table: riskTable,
  };
}
