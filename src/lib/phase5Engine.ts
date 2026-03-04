// ─── Phase 5: Computation Engines ───

import type { Subcontract, SubcontractInvoice, VendorPerformance, SchedulePhase, RiskQuadrant } from './phase5Types';
import { PM_SCORECARD_WEIGHTS } from './phase5Types';
import type { Contract } from './contractTypes';

// ══════════════════════════════════════════════
// 1. SUBCONTRACT EXPOSURE ENGINE
// ══════════════════════════════════════════════

export interface ExposureResult {
  exposure_index: number;
  remaining_commitment: number;
  overcommit_risk: boolean;
  overbilling_risk: boolean;
}

export function computeSubcontractExposure(
  sub: Subcontract,
  pendingInvoices: SubcontractInvoice[],
  scheduleVelocity?: number
): ExposureResult {
  const pendingTotal = pendingInvoices
    .filter(i => i.status === 'Pending' || i.status === 'Approved')
    .reduce((s, i) => s + i.amount, 0);

  const exposure_index = sub.estimated_trade_budget > 0
    ? Math.round(((sub.committed_cost + pendingTotal) / sub.estimated_trade_budget) * 1000) / 1000
    : 0;

  const remaining_commitment = Math.round((sub.committed_cost - sub.approved_cost) * 100) / 100;

  // Invoice velocity = total invoiced / months active (rough)
  const allInvoiceTotal = pendingInvoices.reduce((s, i) => s + i.amount, 0);
  const invoiceVelocity = allInvoiceTotal; // simplified per-period

  return {
    exposure_index,
    remaining_commitment,
    overcommit_risk: exposure_index > 1.08,
    overbilling_risk: scheduleVelocity !== undefined && invoiceVelocity > scheduleVelocity,
  };
}

// ══════════════════════════════════════════════
// 2. VENDOR PERFORMANCE ENGINE
// ══════════════════════════════════════════════

export function computeVendorPerformanceScore(vendor: VendorPerformance): number {
  // 40% Cost Reliability + 30% Schedule + 20% Billing + 10% CO Behavior
  const score = Math.round((
    vendor.cost_reliability_score * 0.40 +
    vendor.schedule_reliability_score * 0.30 +
    vendor.billing_accuracy_score * 0.20 +
    vendor.change_order_behavior_score * 0.10
  ) * 100) / 100;
  return Math.max(0, Math.min(100, score));
}

export function detectVendorDegradation(current: number, previous: number): boolean {
  return current < previous - 10; // >10pt drop
}

// ══════════════════════════════════════════════
// 3. SCHEDULE DELAY PROPAGATION
// ══════════════════════════════════════════════

export function computeDelayRatio(phase: SchedulePhase): number {
  if (phase.planned_days <= 0) return 1.0;
  const actual = phase.actual_days > 0 ? phase.actual_days : phase.planned_days;
  return Math.round((actual / phase.planned_days) * 1000) / 1000;
}

export function propagateDelays(phases: SchedulePhase[]): SchedulePhase[] {
  const phaseMap = new Map(phases.map(p => [p.id, p]));
  const updated = phases.map(p => ({ ...p }));

  for (const phase of updated) {
    phase.delay_ratio = computeDelayRatio(phase);

    // If this phase depends on another and that parent is delayed
    if (phase.depends_on_phase) {
      const parent = phaseMap.get(phase.depends_on_phase);
      if (parent && parent.delay_ratio > 1.0) {
        // Propagate delay: shift this phase proportionally
        const parentDelayDays = parent.actual_days - parent.planned_days;
        if (parentDelayDays > 0 && phase.status === 'Not Started') {
          phase.actual_days = phase.planned_days + Math.ceil(parentDelayDays * 0.5); // 50% propagation
          phase.delay_ratio = computeDelayRatio(phase);
        }
      }
    }
  }

  return updated;
}

export function hasScheduleCompressionRisk(phases: SchedulePhase[]): boolean {
  return phases.some(p => p.delay_ratio > 1.15);
}

// ══════════════════════════════════════════════
// 4. COST VOLATILITY ENGINE
// ══════════════════════════════════════════════

export function computeCostVolatilityIndex(variances: number[]): number {
  if (variances.length < 2) return 0;
  const mean = variances.reduce((a, b) => a + b, 0) / variances.length;
  const sqDiffs = variances.map(v => (v - mean) ** 2);
  const stdDev = Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / variances.length);
  return Math.round(stdDev * 1000) / 1000;
}

export function volatilityAdjustment(volatilityIndex: number): number {
  // Higher volatility = higher risk multiplier
  if (volatilityIndex > 0.20) return 0.10; // +10% adjustment
  if (volatilityIndex > 0.10) return 0.05; // +5%
  return 0;
}

// ══════════════════════════════════════════════
// 5. RISK QUADRANT CLASSIFICATION
// ══════════════════════════════════════════════

export function classifyRiskQuadrant(
  marginRiskScore: number,
  marginOpportunityScore: number
): RiskQuadrant {
  const highRisk = marginRiskScore > 50;
  const highOpp = marginOpportunityScore > 50;

  if (highRisk && highOpp) return 'High Risk / High Opportunity';
  if (highRisk && !highOpp) return 'High Risk / Low Opportunity';
  if (!highRisk && highOpp) return 'Low Risk / High Opportunity';
  return 'Stable';
}

// ══════════════════════════════════════════════
// 6. PM BALANCED SCORECARD
// ══════════════════════════════════════════════

export interface ScorecardInput {
  margin_discipline: number;    // 0-100
  schedule_integrity: number;   // 0-100
  forecast_accuracy: number;    // 0-100
  change_order_quality: number; // 0-100
  margin_expansion: number;     // 0-100
}

export function computePMScore(input: ScorecardInput): number {
  const w = PM_SCORECARD_WEIGHTS;
  const raw = (
    input.margin_discipline * w.margin_discipline +
    input.schedule_integrity * w.schedule_integrity +
    input.forecast_accuracy * w.forecast_accuracy +
    input.change_order_quality * w.change_order_quality +
    input.margin_expansion * w.margin_expansion
  );
  return Math.round(raw * 100) / 100;
}

/**
 * Anti-distortion: if schedule compressed but later caused fade,
 * penalize both schedule and margin scores.
 */
export function applyAntiDistortion(
  input: ScorecardInput,
  scheduleCompressed: boolean,
  subsequentFade: boolean
): ScorecardInput {
  if (scheduleCompressed && subsequentFade) {
    return {
      ...input,
      schedule_integrity: Math.max(0, input.schedule_integrity - 15),
      margin_discipline: Math.max(0, input.margin_discipline - 10),
    };
  }
  return input;
}

// ══════════════════════════════════════════════
// 7. PORTFOLIO INTELLIGENCE AGGREGATION
// ══════════════════════════════════════════════

export interface PortfolioIntelligence {
  portfolio_risk_index: number;
  portfolio_opportunity_index: number;
  liquidity_stability_index: number;
  total_contracts: number;
  active_contracts: number;
  total_net_value: number;
  total_projected_profit: number;
  avg_margin: number;
  fade_count: number;
}

export function computePortfolioIntelligence(contracts: Contract[]): PortfolioIntelligence {
  const active = contracts.filter(c => c.contract_status === 'Active');
  const totalNetValue = active.reduce((s, c) => s + c.net_contract_value, 0);
  const totalProjectedProfit = active.reduce((s, c) => s + c.projected_final_profit, 0);
  const avgMargin = active.length > 0
    ? active.reduce((s, c) => s + c.margin_current_pct, 0) / active.length
    : 0;
  const fadeCount = active.filter(c => c.profit_fade_flag).length;

  // Portfolio risk = weighted average of contract risk scores
  const riskScores = active.map(c => (c as any).margin_risk_score || 0);
  const oppScores = active.map(c => (c as any).margin_opportunity_score || 0);
  const portfolioRisk = riskScores.length > 0 ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length : 0;
  const portfolioOpp = oppScores.length > 0 ? oppScores.reduce((a, b) => a + b, 0) / oppScores.length : 0;

  // Liquidity: ratio of 30-day forecast to total net value
  const totalForecast30 = active.reduce((s, c) => s + c.cash_forecast_30, 0);
  const liquidityStability = totalNetValue > 0 ? (totalForecast30 / totalNetValue) * 100 : 0;

  return {
    portfolio_risk_index: Math.round(portfolioRisk * 100) / 100,
    portfolio_opportunity_index: Math.round(portfolioOpp * 100) / 100,
    liquidity_stability_index: Math.round(liquidityStability * 100) / 100,
    total_contracts: contracts.length,
    active_contracts: active.length,
    total_net_value: Math.round(totalNetValue * 100) / 100,
    total_projected_profit: Math.round(totalProjectedProfit * 100) / 100,
    avg_margin: Math.round(avgMargin * 10000) / 10000,
    fade_count: fadeCount,
  };
}
