import type { Contract, PaymentMilestone } from './contractTypes';
import { PROFIT_FADE_THRESHOLD } from './contractTypes';
import type { EstimateLineItem } from './types';

/**
 * Compute weighted percent complete from line items.
 * percent_complete = Σ(line_total × line.percent_complete/100) / Σ(line_total) × 100
 */
export function computePercentComplete(items: EstimateLineItem[]): number {
  const totalValue = items.reduce((s, li) => s + li.line_total, 0);
  if (totalValue <= 0) return 0;
  const weightedComplete = items.reduce((s, li) => {
    const pct = (li as any).percent_complete ?? 0;
    return s + li.line_total * (pct / 100);
  }, 0);
  return Math.round((weightedComplete / totalValue) * 10000) / 100;
}

/**
 * Compute earned revenue from net contract value and percent complete.
 */
export function computeEarnedRevenue(netContractValue: number, percentComplete: number): number {
  return Math.round(netContractValue * (percentComplete / 100) * 100) / 100;
}

/**
 * Compute projected final cost from line items with optional trade drift.
 * For each line: if trade drift data exists, multiply by drift factor.
 */
export function computeProjectedFinalCost(items: EstimateLineItem[], tradeDriftFactors?: Record<string, number>): number {
  let total = 0;
  for (const li of items) {
    const driftFactor = tradeDriftFactors?.[(li as any).phase || 'Other'] ?? 1.0;
    const projLabor = (li as any).projected_labor_cost > 0
      ? (li as any).projected_labor_cost
      : li.labor_total * driftFactor;
    const projMaterial = (li as any).projected_material_cost > 0
      ? (li as any).projected_material_cost
      : li.material_total * driftFactor;
    total += projLabor + projMaterial;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Detect profit fade: margin dropped more than threshold from baseline.
 */
export function detectProfitFade(baselineMarginPct: number, currentMarginPct: number): boolean {
  return currentMarginPct < (baselineMarginPct - PROFIT_FADE_THRESHOLD);
}

/**
 * Full WIP recompute for a contract given its line items.
 */
export function recomputeContractWIP(
  contract: Contract,
  items: EstimateLineItem[],
  tradeDriftFactors?: Record<string, number>
): Partial<Contract> {
  const percent_complete = computePercentComplete(items);
  const earned_revenue = computeEarnedRevenue(contract.net_contract_value, percent_complete);
  const projected_final_cost = computeProjectedFinalCost(items, tradeDriftFactors);
  const projected_final_profit = Math.round((contract.net_contract_value - projected_final_cost) * 100) / 100;
  const margin_current_pct = contract.net_contract_value > 0
    ? Math.round((projected_final_profit / contract.net_contract_value) * 10000) / 10000
    : 0;
  const profit_fade_flag = detectProfitFade(contract.baseline_margin_pct, margin_current_pct);

  return {
    percent_complete,
    earned_revenue,
    projected_final_cost,
    projected_final_profit,
    margin_current_pct,
    profit_fade_flag,
  };
}

/**
 * Compute cash forecast from payment schedule and current percent complete.
 */
export function computeCashForecast(
  milestones: PaymentMilestone[],
  netContractValue: number,
  percentComplete: number
): { cash_forecast_30: number; cash_forecast_60: number; cash_forecast_90: number } {
  // Simple heuristic: estimate when milestones will be triggered
  // based on current completion rate
  let f30 = 0, f60 = 0, f90 = 0;

  for (const m of milestones) {
    if (m.paid) continue;
    const amount = Math.round(netContractValue * (m.percent / 100) * 100) / 100;
    const triggerPct = typeof m.trigger_value === 'number' ? m.trigger_value : 0;

    if (triggerPct <= percentComplete) {
      // Already triggered, expect payment in 30 days
      f30 += amount;
    } else {
      // Estimate days until trigger at ~2% completion per day
      const pctRemaining = triggerPct - percentComplete;
      const estimatedDays = pctRemaining / 2; // rough ~2%/day rate
      if (estimatedDays <= 30) f30 += amount;
      else if (estimatedDays <= 60) f60 += amount;
      else if (estimatedDays <= 90) f90 += amount;
    }
  }

  return {
    cash_forecast_30: Math.round(f30 * 100) / 100,
    cash_forecast_60: Math.round(f60 * 100) / 100,
    cash_forecast_90: Math.round(f90 * 100) / 100,
  };
}
