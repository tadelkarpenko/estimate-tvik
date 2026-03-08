// ─── Estimate Reliability & Pricing Intelligence Engine ───

import type { Estimate, EstimateLineItem, ProjectType } from './types';

// ══════════════════════════════════════════════
// 1. SCOPE COMPLETENESS SCORING
// ══════════════════════════════════════════════

export interface CompletenessChecklist {
  label: string;
  present: boolean;
}

const REQUIRED_SCOPE_ITEMS: Record<ProjectType, string[]> = {
  'Full Rehab': [
    'Demo & Protection', 'Framing', 'Electrical', 'Plumbing', 'HVAC',
    'Drywall', 'Flooring', 'Paint', 'Permits', 'Cleaning',
  ],
  'Bath': [
    'Demo & Prep', 'Plumbing', 'Electrical', 'Drywall', 'Tile',
    'Paint', 'Decorative Fixtures',
  ],
  'Kitchen': [
    'Demo & Prep', 'Plumbing', 'Electrical', 'Drywall', 'Flooring',
    'Paint', 'Countertops', 'Cabinetry',
  ],
  'Small Job': [
    'Labor',
  ],
};

export function computeCompletenessScore(
  projectType: ProjectType,
  lineItems: EstimateLineItem[]
): { score: number; checklist: CompletenessChecklist[] } {
  const required = REQUIRED_SCOPE_ITEMS[projectType] || REQUIRED_SCOPE_ITEMS['Full Rehab'];
  const lineDescriptions = lineItems.map(li =>
    `${li.description} ${li.phase}`.toLowerCase()
  );

  const checklist: CompletenessChecklist[] = required.map(item => ({
    label: item,
    present: lineDescriptions.some(d =>
      d.includes(item.toLowerCase()) ||
      d.includes(item.split(' ')[0].toLowerCase())
    ),
  }));

  const presentCount = checklist.filter(c => c.present).length;
  const score = required.length > 0
    ? Math.round((presentCount / required.length) * 100)
    : 100;

  return { score, checklist };
}

// ══════════════════════════════════════════════
// 2. CALC STATUS (Fresh/Stale)
// ══════════════════════════════════════════════

export function computeCalcStatus(est: Partial<Estimate>): 'Fresh' | 'Stale' {
  // Fresh if totals have been computed (subtotal > 0 and status is Ready or higher)
  if ((est.subtotal || 0) > 0 && est.status !== 'Draft') return 'Fresh';
  return 'Stale';
}

// ══════════════════════════════════════════════
// 3. APPROVAL GATE — Can estimate move to "Sent"?
// ══════════════════════════════════════════════

export interface ApprovalGateResult {
  canSend: boolean;
  reasons: string[];
  calcStatus: 'Fresh' | 'Stale';
  completenessScore: number;
  marginOk: boolean;
  volatilityReviewed: boolean;
  requiredFieldsComplete: boolean;
}

export function evaluateApprovalGate(
  est: Partial<Estimate>,
  lineItems: EstimateLineItem[]
): ApprovalGateResult {
  const reasons: string[] = [];

  // 1. Calc status
  const calcStatus = computeCalcStatus(est);
  if (calcStatus !== 'Fresh') reasons.push('Estimate not generated yet (calc_status = Stale)');

  // 2. Required fields
  const legacyType = est.project_type || 'Full Rehab';
  const requiredFieldsComplete = !!(
    est.client_name && est.project_name &&
    (legacyType === 'Small Job' || (est.job_complexity as any) === 'Quick Repair'
      ? (est.labor_hours && est.labor_hours > 0)
      : (est.sqft && est.sqft > 0))
  );
  if (!requiredFieldsComplete) reasons.push('Required fields incomplete (client name, project name, sqft/hours)');

  // 3. Completeness score ≥ 80
  const { score } = computeCompletenessScore(est.project_type as ProjectType || 'Full Rehab', lineItems);
  if (score < 80) reasons.push(`Scope completeness score (${score}%) below 80% minimum`);

  // 4. Margin check
  const marginMult = (1 + (est.overhead_pct || 0.1)) * (1 + (est.profit_pct || 0.2)) * (1 + (est.contingency_pct || 0.1));
  const marginOk = marginMult >= 1.16; // at least 16% combined margin
  if (!marginOk) reasons.push('Combined margin below 16% threshold');

  // 5. Volatility reviewed
  const materialVolatility = (est as any).material_volatility_flag || false;
  const volatilityReviewed = !(materialVolatility) || (est as any).volatility_reviewed === true;
  if (!volatilityReviewed) reasons.push('Material volatility flag active — review required before sending');

  return {
    canSend: reasons.length === 0,
    reasons,
    calcStatus,
    completenessScore: score,
    marginOk,
    volatilityReviewed,
    requiredFieldsComplete,
  };
}

// ══════════════════════════════════════════════
// 4. CONTRACT DATA QUALITY SCORE
// ══════════════════════════════════════════════

export function computeContractDataQuality(lineItems: Array<{
  actual_labor_cost_to_date: number;
  actual_material_cost_to_date: number;
  percent_complete: number;
  wip_status: string;
}>): number {
  if (lineItems.length === 0) return 0;

  let qualityPoints = 0;
  const total = lineItems.length;

  for (const li of lineItems) {
    let points = 0;
    // Has actual cost data?
    if (li.actual_labor_cost_to_date > 0 || li.actual_material_cost_to_date > 0) points += 0.5;
    // Has WIP tracking?
    if (li.percent_complete > 0 || li.wip_status !== 'Not Started') points += 0.5;
    qualityPoints += points;
  }

  return Math.round((qualityPoints / total) * 100);
}

// ══════════════════════════════════════════════
// 5. PRICING SUGGESTION TYPES
// ══════════════════════════════════════════════

export interface PricingSuggestion {
  trade: string;
  description: string;
  current_labor_cost: number;
  current_material_cost: number;
  suggested_labor_range: [number, number];
  suggested_material_range: [number, number];
  confidence: 'Low' | 'Medium' | 'High';
  drift_source: string; // e.g. 'Trade Drift: 1.15x over 3 contracts'
  margin_impact: number; // delta to total if applied
}

export interface DraftPricingImpact {
  estimate_id: string;
  trade: string;
  old_unit_cost: number;
  new_unit_cost: number;
  margin_before: number;
  margin_after: number;
  delta_margin: number;
  review_status: 'Pending' | 'Applied' | 'Rejected';
}

// ══════════════════════════════════════════════
// 6. PROCUREMENT TIMING INTELLIGENCE
// ══════════════════════════════════════════════

export interface ProcurementPriority {
  material_category: string;
  trend_pct: number;
  volatility_score: number;
  lead_time_days: number;
  procurement_priority_score: number;
  recommended_order_by: string; // date
  buffer_pct: number;
}

export function computeProcurementPriority(
  materialCategory: string,
  trendPct: number,
  volatilityScore: number,
  leadTimeDays: number,
  projectStartDate: string
): ProcurementPriority {
  // Priority score: higher = more urgent
  const trendWeight = Math.abs(trendPct) * 2;
  const volatilityWeight = volatilityScore * 3;
  const leadTimeWeight = Math.min(leadTimeDays / 30, 3) * 10;
  const score = Math.min(100, Math.round(trendWeight + volatilityWeight + leadTimeWeight));

  // Buffer recommendation
  let buffer_pct = 0;
  if (volatilityScore > 0.15) buffer_pct = 10;
  else if (volatilityScore > 0.08) buffer_pct = 5;

  // Recommended order date
  const start = new Date(projectStartDate);
  const orderBy = new Date(start.getTime() - leadTimeDays * 24 * 60 * 60 * 1000);

  return {
    material_category: materialCategory,
    trend_pct: trendPct,
    volatility_score: volatilityScore,
    lead_time_days: leadTimeDays,
    procurement_priority_score: score,
    recommended_order_by: orderBy.toISOString().split('T')[0],
    buffer_pct,
  };
}

export function shouldTriggerMaterialShock(trendPct: number, volatilityScore: number): boolean {
  return Math.abs(trendPct) > 12 || volatilityScore > 0.20;
}
