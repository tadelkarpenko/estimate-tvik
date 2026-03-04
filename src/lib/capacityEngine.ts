// ─── Phase 7: Backlog Capacity & Crew Utilization Engine ───

import type { EstimateLineItem } from './types';

export interface CrewCapacity {
  id?: string;
  user_id?: string;
  trade: string;
  crew_size: number;
  hours_per_day: number;
  work_days_per_week: number;
  effective_from: string;
  effective_to?: string | null;
  overtime_allowed: boolean;
  overtime_multiplier: number;
  max_safe_utilization_pct: number;
  created_at?: string;
  updated_at?: string;
}

export type UtilizationTier = 'Green' | 'Yellow' | 'Orange' | 'Red';

export interface WeeklyUtilization {
  week_start: string;
  trade: string;
  demand_hours: number;
  available_hours: number;
  utilization_pct: number;
  tier: UtilizationTier;
}

export interface TradeUtilizationSummary {
  trade: string;
  next_30d_pct: number;
  next_60d_pct: number;
  next_90d_pct: number;
  status: UtilizationTier;
  bottleneck: boolean;
  earliest_new_start: string | null;
}

export interface BacklogSimulation {
  trade: string;
  current_utilization_pct: number;
  projected_utilization_pct: number;
  overload: boolean;
  schedule_extension_days: number;
  message: string;
}

// ── Utilization tier classification ──
export function classifyUtilization(pct: number): UtilizationTier {
  if (pct > 95) return 'Red';
  if (pct > 85) return 'Orange';
  if (pct > 75) return 'Yellow';
  return 'Green';
}

// ── Compute remaining labor hours per line item ──
export function computeRemainingLaborHours(item: {
  labor_hours_per_unit: number;
  qty: number;
  percent_complete: number;
}): number {
  return Math.max(0, item.labor_hours_per_unit * item.qty * (1 - item.percent_complete / 100));
}

// ── Aggregate labor demand by trade across a date range ──
export function aggregateLaborDemand(
  lineItems: Array<{
    phase: string;
    labor_hours_per_unit: number;
    qty: number;
    percent_complete: number;
    scheduled_start?: string | null;
    scheduled_finish?: string | null;
  }>,
  periodDays: number
): Record<string, number> {
  const demand: Record<string, number> = {};

  const now = new Date();
  const periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

  for (const li of lineItems) {
    const remaining = computeRemainingLaborHours(li);
    if (remaining <= 0) continue;

    const trade = li.phase || 'General';
    // Distribute hours evenly if within period
    const start = li.scheduled_start ? new Date(li.scheduled_start) : now;
    const finish = li.scheduled_finish ? new Date(li.scheduled_finish) : periodEnd;

    // Check overlap with our period
    const overlapStart = Math.max(now.getTime(), start.getTime());
    const overlapEnd = Math.min(periodEnd.getTime(), finish.getTime());
    if (overlapEnd <= overlapStart) continue;

    const totalDuration = Math.max(1, (finish.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    const overlapDuration = (overlapEnd - overlapStart) / (24 * 60 * 60 * 1000);
    const proportionalHours = remaining * (overlapDuration / totalDuration);

    demand[trade] = (demand[trade] || 0) + proportionalHours;
  }

  return demand;
}

// ── Compute utilization for each trade ──
export function computeTradeUtilization(
  demand: Record<string, number>,
  capacities: CrewCapacity[],
  periodDays: number
): TradeUtilizationSummary[] {
  const allTrades = new Set([...Object.keys(demand), ...capacities.map(c => c.trade)]);
  const results: TradeUtilizationSummary[] = [];

  for (const trade of allTrades) {
    const cap = capacities.find(c => c.trade === trade);
    const demandHours = demand[trade] || 0;

    if (!cap) {
      results.push({
        trade,
        next_30d_pct: demandHours > 0 ? 100 : 0,
        next_60d_pct: 0,
        next_90d_pct: 0,
        status: demandHours > 0 ? 'Red' : 'Green',
        bottleneck: demandHours > 0,
        earliest_new_start: null,
      });
      continue;
    }

    const weeks = periodDays / 7;
    const weeklyCapacity = cap.crew_size * cap.hours_per_day * cap.work_days_per_week;
    const totalCapacity = weeklyCapacity * weeks;
    const utilizationPct = totalCapacity > 0 ? (demandHours / totalCapacity) * 100 : 0;
    const tier = classifyUtilization(utilizationPct);

    // Estimate earliest new start based on current load
    let earliestStart: string | null = null;
    if (utilizationPct > cap.max_safe_utilization_pct) {
      const excessHours = demandHours - (totalCapacity * cap.max_safe_utilization_pct / 100);
      const daysToFree = excessHours / (cap.crew_size * cap.hours_per_day);
      const freeDate = new Date(Date.now() + daysToFree * 24 * 60 * 60 * 1000);
      earliestStart = freeDate.toISOString().split('T')[0];
    }

    results.push({
      trade,
      next_30d_pct: Math.round(utilizationPct * 10) / 10,
      next_60d_pct: 0, // filled by caller for different periods
      next_90d_pct: 0,
      status: tier,
      bottleneck: utilizationPct > 85,
      earliest_new_start: earliestStart,
    });
  }

  return results;
}

// ── Full capacity analysis for multiple time periods ──
export function computeFullCapacityAnalysis(
  allLineItems: Array<{
    phase: string;
    labor_hours_per_unit: number;
    qty: number;
    percent_complete: number;
    scheduled_start?: string | null;
    scheduled_finish?: string | null;
  }>,
  capacities: CrewCapacity[]
): TradeUtilizationSummary[] {
  const demand30 = aggregateLaborDemand(allLineItems, 30);
  const demand60 = aggregateLaborDemand(allLineItems, 60);
  const demand90 = aggregateLaborDemand(allLineItems, 90);

  const results30 = computeTradeUtilization(demand30, capacities, 30);

  // Enrich with 60/90 day data
  for (const r of results30) {
    const cap = capacities.find(c => c.trade === r.trade);
    if (cap) {
      const weeklyCapacity = cap.crew_size * cap.hours_per_day * cap.work_days_per_week;
      const cap60 = weeklyCapacity * (60 / 7);
      const cap90 = weeklyCapacity * (90 / 7);
      r.next_60d_pct = cap60 > 0 ? Math.round(((demand60[r.trade] || 0) / cap60) * 1000) / 10 : 0;
      r.next_90d_pct = cap90 > 0 ? Math.round(((demand90[r.trade] || 0) / cap90) * 1000) / 10 : 0;
    }
  }

  return results30.sort((a, b) => b.next_30d_pct - a.next_30d_pct);
}

// ── Simulate adding a new estimate's labor to existing backlog ──
export function simulateBacklogImpact(
  existingItems: Array<{
    phase: string;
    labor_hours_per_unit: number;
    qty: number;
    percent_complete: number;
    scheduled_start?: string | null;
    scheduled_finish?: string | null;
  }>,
  newEstimateItems: Array<{
    phase: string;
    labor_hours_per_unit: number;
    qty: number;
  }>,
  capacities: CrewCapacity[]
): BacklogSimulation[] {
  // Current utilization
  const currentDemand = aggregateLaborDemand(existingItems, 60);
  
  // New items demand (assume all start now, spread over 60 days)
  const newDemand: Record<string, number> = {};
  for (const li of newEstimateItems) {
    const trade = li.phase || 'General';
    const hours = li.labor_hours_per_unit * li.qty;
    newDemand[trade] = (newDemand[trade] || 0) + hours;
  }

  const results: BacklogSimulation[] = [];
  const allTrades = new Set([...Object.keys(currentDemand), ...Object.keys(newDemand)]);

  for (const trade of allTrades) {
    const cap = capacities.find(c => c.trade === trade);
    const weeklyCapacity = cap ? cap.crew_size * cap.hours_per_day * cap.work_days_per_week : 0;
    const periodCapacity = weeklyCapacity * (60 / 7);

    const currentHours = currentDemand[trade] || 0;
    const addedHours = newDemand[trade] || 0;
    if (addedHours <= 0) continue;

    const currentPct = periodCapacity > 0 ? (currentHours / periodCapacity) * 100 : 0;
    const projectedPct = periodCapacity > 0 ? ((currentHours + addedHours) / periodCapacity) * 100 : 100;
    const overload = projectedPct > (cap?.max_safe_utilization_pct || 85);

    let extensionDays = 0;
    if (overload && periodCapacity > 0) {
      const excessHours = (currentHours + addedHours) - (periodCapacity * (cap?.max_safe_utilization_pct || 85) / 100);
      const dailyCapacity = cap ? cap.crew_size * cap.hours_per_day : 8;
      extensionDays = Math.ceil(excessHours / dailyCapacity);
    }

    const tierBefore = classifyUtilization(currentPct);
    const tierAfter = classifyUtilization(projectedPct);

    results.push({
      trade,
      current_utilization_pct: Math.round(currentPct * 10) / 10,
      projected_utilization_pct: Math.round(projectedPct * 10) / 10,
      overload,
      schedule_extension_days: extensionDays,
      message: overload
        ? `${trade} utilization rises from ${currentPct.toFixed(0)}% → ${projectedPct.toFixed(0)}%. ⚠ Overload Risk. Est. schedule extension: +${extensionDays} days`
        : `${trade} utilization: ${currentPct.toFixed(0)}% → ${projectedPct.toFixed(0)}% (${tierBefore} → ${tierAfter})`,
    });
  }

  return results.sort((a, b) => b.projected_utilization_pct - a.projected_utilization_pct);
}

// ── Detect bottleneck trades ──
export function detectBottlenecks(summaries: TradeUtilizationSummary[]): TradeUtilizationSummary[] {
  const overloaded = summaries.filter(s => s.next_30d_pct > 85);
  const underloaded = summaries.filter(s => s.next_30d_pct < 60);
  
  // A bottleneck is when one trade is >85% while others are <60%
  if (overloaded.length > 0 && underloaded.length > 0) {
    return overloaded.map(s => ({ ...s, bottleneck: true }));
  }
  return [];
}

// ── Backlog health assessment ──
export function assessBacklogHealth(summaries: TradeUtilizationSummary[]): {
  status: 'Low' | 'Healthy' | 'High' | 'Critical';
  message: string;
} {
  const avgUtilization = summaries.length > 0
    ? summaries.reduce((s, t) => s + t.next_60d_pct, 0) / summaries.length
    : 0;

  if (avgUtilization < 50) return { status: 'Low', message: '⚠ Revenue Dip Risk — Backlog below 50% capacity next 60 days' };
  if (avgUtilization > 95) return { status: 'Critical', message: '⚠ Cash Strain + Schedule Compression Risk' };
  if (avgUtilization > 85) return { status: 'High', message: 'High backlog — watch for margin compression' };
  return { status: 'Healthy', message: 'Healthy backlog level' };
}
