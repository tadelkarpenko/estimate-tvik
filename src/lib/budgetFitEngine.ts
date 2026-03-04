import type { EstimateLineItem, Phase } from './types';

export interface BudgetFitScenario {
  name: 'Base' | 'Balanced' | 'Premium';
  description: string;
  projected_total: number;
  delta: number;
  changes: BudgetFitChange[];
}

export interface BudgetFitChange {
  line_id: string;
  description: string;
  action: 'REMOVE' | 'REDUCE' | 'CONVERT_TO_ALLOWANCE' | 'KEEP';
  original_total: number;
  new_total: number;
  reason: string;
}

/**
 * Generate 3 budget-fit scenarios: Base, Balanced, Premium.
 * Each scenario proposes different approaches to fit within a target budget.
 */
export function fitEstimateToBudget(
  lineItems: EstimateLineItem[],
  currentSubtotal: number,
  targetTotal: number,
  overheadPct: number,
  profitPct: number,
  contingencyPct: number,
): BudgetFitScenario[] {
  const marginMult = (1 + overheadPct) * (1 + profitPct) * (1 + contingencyPct);
  // Target subtotal to hit targetTotal after margin
  const targetSubtotal = targetTotal / marginMult;
  const delta = currentSubtotal - targetSubtotal;

  if (delta <= 0) {
    // Already within budget
    return [{
      name: 'Base',
      description: 'Already within budget — no changes needed.',
      projected_total: Math.round(currentSubtotal * marginMult * 100) / 100,
      delta: 0,
      changes: [],
    }, {
      name: 'Balanced',
      description: 'Already within budget.',
      projected_total: Math.round(currentSubtotal * marginMult * 100) / 100,
      delta: 0,
      changes: [],
    }, {
      name: 'Premium',
      description: 'Current scope is under target.',
      projected_total: Math.round(currentSubtotal * marginMult * 100) / 100,
      delta: 0,
      changes: [],
    }];
  }

  // Sort items by priority for removal: lowest cost-impact first
  const sortedByTotal = [...lineItems].sort((a, b) => a.line_total - b.line_total);
  const sortedByTotalDesc = [...lineItems].sort((a, b) => b.line_total - a.line_total);

  // BASE scenario: Aggressive — remove/convert smallest items
  const baseChanges = buildBaseScenario(sortedByTotal, delta);
  const baseRemoved = baseChanges.reduce((s, c) => s + (c.original_total - c.new_total), 0);
  const baseSubtotal = currentSubtotal - baseRemoved;

  // BALANCED scenario: Reduce across the board proportionally
  const balancedChanges = buildBalancedScenario(lineItems, delta, currentSubtotal);
  const balancedRemoved = balancedChanges.reduce((s, c) => s + (c.original_total - c.new_total), 0);
  const balancedSubtotal = currentSubtotal - balancedRemoved;

  // PREMIUM scenario: Keep scope, explain why budget should increase
  const premiumChanges = buildPremiumScenario(sortedByTotalDesc);

  return [
    {
      name: 'Base',
      description: 'Remove or convert lowest-value items to allowances. Most aggressive cost reduction.',
      projected_total: Math.round(baseSubtotal * marginMult * 100) / 100,
      delta: Math.round((currentSubtotal * marginMult - baseSubtotal * marginMult) * 100) / 100,
      changes: baseChanges,
    },
    {
      name: 'Balanced',
      description: 'Proportional reduction across all items. Moderate approach preserving scope coverage.',
      projected_total: Math.round(balancedSubtotal * marginMult * 100) / 100,
      delta: Math.round((currentSubtotal * marginMult - balancedSubtotal * marginMult) * 100) / 100,
      changes: balancedChanges,
    },
    {
      name: 'Premium',
      description: 'Keep full scope. Recommends higher budget based on trade requirements.',
      projected_total: Math.round(currentSubtotal * marginMult * 100) / 100,
      delta: 0,
      changes: premiumChanges,
    },
  ];
}

function buildBaseScenario(sortedItems: EstimateLineItem[], targetDelta: number): BudgetFitChange[] {
  const changes: BudgetFitChange[] = [];
  let removed = 0;

  for (const item of sortedItems) {
    if (removed >= targetDelta) break;
    if (item.line_total <= 0) continue;

    if (item.line_total < targetDelta * 0.15) {
      // Small items: convert to $0 allowance
      changes.push({
        line_id: item.line_id,
        description: item.description,
        action: 'CONVERT_TO_ALLOWANCE',
        original_total: item.line_total,
        new_total: 0,
        reason: `Convert to $0 allowance (client-supplied or deferred)`,
      });
      removed += item.line_total;
    } else {
      // Larger items: reduce by 30%
      const reduction = item.line_total * 0.3;
      changes.push({
        line_id: item.line_id,
        description: item.description,
        action: 'REDUCE',
        original_total: item.line_total,
        new_total: Math.round((item.line_total - reduction) * 100) / 100,
        reason: `Reduce scope by 30%`,
      });
      removed += reduction;
    }
  }

  return changes;
}

function buildBalancedScenario(items: EstimateLineItem[], targetDelta: number, currentSubtotal: number): BudgetFitChange[] {
  const reductionPct = Math.min(targetDelta / currentSubtotal, 0.25); // cap at 25%
  return items
    .filter(i => i.line_total > 0)
    .map(item => ({
      line_id: item.line_id,
      description: item.description,
      action: 'REDUCE' as const,
      original_total: item.line_total,
      new_total: Math.round(item.line_total * (1 - reductionPct) * 100) / 100,
      reason: `Reduce by ${(reductionPct * 100).toFixed(0)}% across all items`,
    }));
}

function buildPremiumScenario(sortedDesc: EstimateLineItem[]): BudgetFitChange[] {
  return sortedDesc.slice(0, 5).map(item => ({
    line_id: item.line_id,
    description: item.description,
    action: 'KEEP' as const,
    original_total: item.line_total,
    new_total: item.line_total,
    reason: `Required for scope completeness — ${item.phase}`,
  }));
}
