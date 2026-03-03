import type { Estimate, CostStructureItem } from './types';
import { getEstimates, getCostAudits, saveCostAudit, uid } from './store';
import { supabase } from '@/integrations/supabase/client';

export function generateAssumptions(est: Partial<Estimate>): string {
  const lines: string[] = [
    '## Assumptions & Conditions\n',
    '- All work based on field verification of existing conditions. Hidden or concealed conditions discovered during construction may require change orders.',
    '- Owner is responsible for all items not explicitly included in this estimate.',
  ];
  if (!est.finish_materials_included) {
    lines.push('- **Finish materials are EXCLUDED**: Paint materials, tile setting materials, flooring underlayment/consumables, and decorative fixtures are not included. Owner to supply or contract separately.');
  } else {
    lines.push('- Finish materials are included at the specified finish level.');
  }
  lines.push(
    '- No work shall proceed without written approval. All scope changes require a signed change order before execution.',
    '- Differing site conditions discovered during work may result in additional costs, to be documented via change order.',
    '- Material prices are subject to escalation. Pricing valid for 15 days; increases exceeding 10% after acceptance will be passed through.',
    '- Permits and inspections are excluded unless explicitly stated in scope.',
    '- Payment terms: 50% upon acceptance, progress draws per schedule, final payment upon completion. Late payments subject to 1.5%/month finance charge.',
    '- All notices to be provided in writing within 3 business days of discovery.',
  );
  return lines.join('\n');
}

export function generateTimeline(est: Partial<Estimate>): string {
  if (est.project_type === 'Bath') {
    return '## Estimated Timeline\n\n- **Demolition & Prep**: 2-3 days\n- **Rough-in (Plumbing/Electrical)**: 3-4 days\n- **Drywall & Tile**: 5-7 days\n- **Paint & Finish**: 2-3 days\n- **Final Inspections**: 1-2 days\n\n**Total: ~3-4 weeks**';
  }
  return '## Estimated Timeline\n\n- **Demolition & Protection**: 1-2 weeks\n- **Structural/Framing**: 1-2 weeks\n- **MEP Rough-in**: 2-3 weeks\n- **Drywall & Finishes**: 2-3 weeks\n- **Flooring & Paint**: 1-2 weeks\n- **Punch & Inspections**: 1 week\n\n**Total: ~8-13 weeks**';
}

export async function generateScopeAI(est: Partial<Estimate>): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('estimate-ai', {
      body: {
        action: 'scope',
        data: {
          project_name: est.project_name,
          project_type: est.project_type,
          project_address: est.project_address,
          city: est.city,
          state: est.state,
          zip: est.zip,
          sqft: est.sqft,
          finish_level: est.finish_level,
          finish_materials_included: est.finish_materials_included,
          labor_subtotal: est.labor_subtotal,
          material_subtotal: est.material_subtotal,
          subtotal: est.subtotal,
          total_low: est.total_low,
          total_high: est.total_high,
          line_items_json: est.line_items_json,
          cost_structure_json: est.cost_structure_json,
          risk_table_json: est.risk_table_json,
          assumptions_rich: est.assumptions_rich,
          timeline_rich: est.timeline_rich,
        },
      },
    });
    if (error) throw error;
    return data?.content || 'AI scope generation failed — no content returned.';
  } catch (e) {
    console.error('AI scope error:', e);
    return `AI scope generation failed: ${e instanceof Error ? e.message : 'Unknown error'}. Falling back to template.\n\n${generateScopeFallback(est)}`;
  }
}

export async function generateAuditAI(est: Partial<Estimate>): Promise<string> {
  const estimates = getEstimates().filter(e => e.project_type === est.project_type && e.subtotal > 0 && e.estimate_id !== est.estimate_id);
  const costPerSqft = (est.subtotal || 0) / (est.sqft || 1);
  const laborRatio = (est.labor_subtotal || 0) / (est.subtotal || 1);
  const riskRatioHigh = (est.risk_cost_high || 0) / (est.subtotal || 1);
  const histAvgCPS = estimates.length > 0 ? estimates.reduce((s, e) => s + (e.subtotal / (e.sqft || 1)), 0) / estimates.length : costPerSqft;
  const histAvgRR = estimates.length > 0 ? estimates.reduce((s, e) => s + ((e.risk_cost_high || 0) / (e.subtotal || 1)), 0) / estimates.length : riskRatioHigh;
  const costStructure: CostStructureItem[] = est.cost_structure_json ? JSON.parse(est.cost_structure_json) : [];

  try {
    const { data, error } = await supabase.functions.invoke('estimate-ai', {
      body: {
        action: 'audit',
        data: {
          cost_per_sqft: costPerSqft,
          labor_ratio: laborRatio,
          risk_ratio_high: riskRatioHigh,
          historical_avg_cost_per_sqft: histAvgCPS,
          historical_avg_risk_ratio_high: histAvgRR,
          historical_count: estimates.length,
          cost_structure: costStructure,
          subtotal: est.subtotal,
          project_type: est.project_type,
          sqft: est.sqft,
        },
      },
    });
    if (error) throw error;
    const auditText = data?.content || 'No audit content returned.';

    saveCostAudit({
      id: uid(),
      estimate_id: est.estimate_id || '',
      created_at: new Date().toISOString(),
      findings_json: JSON.stringify([auditText]),
      recommended_actions: auditText,
      status: 'Open',
    });

    return auditText;
  } catch (e) {
    console.error('AI audit error:', e);
    const fallback = generateAuditFallback(est, costPerSqft, histAvgCPS, riskRatioHigh, costStructure);
    saveCostAudit({
      id: uid(),
      estimate_id: est.estimate_id || '',
      created_at: new Date().toISOString(),
      findings_json: '[]',
      recommended_actions: fallback,
      status: 'Open',
    });
    return `AI audit failed: ${e instanceof Error ? e.message : 'Unknown error'}. Falling back to template.\n\n${fallback}`;
  }
}

// Fallback generators (kept for offline/error scenarios)
function generateScopeFallback(est: Partial<Estimate>): string {
  return `# Preconstruction Advisory — ${est.project_name || 'Project'}\n\n## 1. Executive Summary\n${est.project_type} project, ${est.sqft} SF, ${est.finish_level} finish.\nRange: $${(est.total_low || 0).toLocaleString()} – $${(est.total_high || 0).toLocaleString()}\n\n## 2–6. See generated assumptions and risk tables for details.`;
}

function generateAuditFallback(est: Partial<Estimate>, cps: number, histCps: number, rrh: number, cs: CostStructureItem[]): string {
  const findings: string[] = [];
  const cpsDev = histCps > 0 ? Math.abs(cps - histCps) / histCps : 0;
  if (cpsDev > 0.15) findings.push(`Cost/sqft ($${cps.toFixed(2)}) deviates ${(cpsDev * 100).toFixed(1)}% from avg ($${histCps.toFixed(2)})`);
  const top = cs.sort((a, b) => b.percent - a.percent)[0];
  if (top && top.percent > 35) findings.push(`${top.trade} = ${top.percent.toFixed(1)}% of subtotal (>35%)`);
  if (rrh > 0.18) findings.push(`Risk ratio ${(rrh * 100).toFixed(1)}% > 18%`);
  return findings.length > 0 ? `## Findings (Template)\n${findings.map(f => `- ${f}`).join('\n')}` : '## No material anomalies detected.';
}
