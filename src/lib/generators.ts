import type { Estimate, LineItem, CostStructureItem, RiskTableItem } from './types';
import { getEstimates, getCostAudits, saveCostAudit, uid } from './store';

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

export function generateScope(est: Partial<Estimate>): string {
  const lineItems: LineItem[] = est.line_items_json ? JSON.parse(est.line_items_json) : [];
  const costStructure: CostStructureItem[] = est.cost_structure_json ? JSON.parse(est.cost_structure_json) : [];
  const riskTable: RiskTableItem[] = est.risk_table_json ? JSON.parse(est.risk_table_json) : [];

  let scope = `# Preconstruction Advisory — ${est.project_name || 'Project'}\n\n`;
  scope += `## 1. Executive Summary\n\nThis estimate covers a **${est.project_type}** project at ${est.project_address || 'TBD'}, ${est.city || ''}, ${est.state || 'IL'} ${est.zip || ''}. Total area: **${est.sqft} SF**. Finish level: **${est.finish_level}**.\n\n`;
  scope += `- Labor subtotal: $${(est.labor_subtotal || 0).toLocaleString()}\n- Material subtotal: $${(est.material_subtotal || 0).toLocaleString()}\n- Base subtotal: $${(est.subtotal || 0).toLocaleString()}\n- Range: $${(est.total_low || 0).toLocaleString()} – $${(est.total_high || 0).toLocaleString()}\n\n`;

  scope += `## 2. Scope by Trades\n\n`;
  for (const li of lineItems) {
    if (li.total > 0) scope += `- **${li.trade}**: ${li.description} — ${li.qty} ${li.unit} — Labor $${li.labor.toLocaleString()} / Material $${li.material.toLocaleString()}\n`;
  }

  scope += `\n## 3. Allowances & Owner Items\n\n`;
  if (!est.finish_materials_included) {
    scope += `- **Finish materials excluded**: Paint materials, tile setting materials, flooring underlayment/consumables, and decorative fixtures are NOT included in this estimate. Owner to procure or contract separately.\n`;
  }
  scope += `- Owner responsible for all furnishings, appliances (unless specified), and items outside listed scope.\n`;

  scope += `\n## 4. Assumptions\n\n${est.assumptions_rich || 'See assumptions section.'}\n`;

  scope += `\n## 5. Risk Notes\n\n`;
  for (const r of riskTable) {
    scope += `- **${r.risk_name}** (${r.level}): Exposure $${r.exposure_low.toLocaleString()}–$${r.exposure_high.toLocaleString()}. Mitigation: ${r.mitigation_note}\n`;
  }

  scope += `\n## 6. Next Steps\n\n- Review and approve estimate\n- Schedule site walkthrough for field verification\n- Finalize material selections (if applicable)\n- Execute contract and submit permits\n`;

  return scope;
}

export function generateAudit(est: Partial<Estimate>): string {
  const estimates = getEstimates().filter(e => e.project_type === est.project_type && e.subtotal > 0 && e.estimate_id !== est.estimate_id);
  const costPerSqft = (est.subtotal || 0) / (est.sqft || 1);
  const laborRatio = (est.labor_subtotal || 0) / (est.subtotal || 1);
  const materialRatio = (est.material_subtotal || 0) / (est.subtotal || 1);
  const riskRatioHigh = (est.risk_cost_high || 0) / (est.subtotal || 1);

  const histAvgCPS = estimates.length > 0 ? estimates.reduce((s, e) => s + (e.subtotal / (e.sqft || 1)), 0) / estimates.length : costPerSqft;
  const histAvgRR = estimates.length > 0 ? estimates.reduce((s, e) => s + ((e.risk_cost_high || 0) / (e.subtotal || 1)), 0) / estimates.length : riskRatioHigh;

  const costStructure: CostStructureItem[] = est.cost_structure_json ? JSON.parse(est.cost_structure_json) : [];
  const findings: string[] = [];
  const causes: string[] = [];
  const actions: string[] = [];

  const cpsDev = histAvgCPS > 0 ? Math.abs(costPerSqft - histAvgCPS) / histAvgCPS : 0;
  if (cpsDev > 0.15) {
    findings.push(`Cost/sqft ($${costPerSqft.toFixed(2)}) deviates ${(cpsDev * 100).toFixed(1)}% from historical avg ($${histAvgCPS.toFixed(2)})`);
    causes.push('Scope complexity, material selections, or market conditions may differ from historical norms');
    actions.push('Review trade unit costs against current market rates');
  }

  const topTrade = costStructure.sort((a, b) => b.percent - a.percent)[0];
  if (topTrade && topTrade.percent > 35) {
    findings.push(`${topTrade.trade} represents ${topTrade.percent.toFixed(1)}% of subtotal (>35% threshold)`);
    causes.push(`${topTrade.trade} may have elevated unit costs or disproportionate scope`);
    actions.push(`Verify ${topTrade.trade} unit costs and scope against field conditions`);
  }

  if (riskRatioHigh > 0.18) {
    findings.push(`Risk ratio high (${(riskRatioHigh * 100).toFixed(1)}%) exceeds 18% threshold`);
    causes.push('Multiple elevated risk factors or high-exposure items');
    actions.push('Consider pre-construction investigations to reduce uncertainty');
  }

  let auditText = '## AI Price Audit\n\n';
  if (findings.length === 0) {
    auditText += '**No material anomalies detected.** All metrics within acceptable ranges.\n';
  } else {
    auditText += '### A) Findings\n';
    findings.forEach(f => auditText += `- ${f}\n`);
    auditText += '\n### B) Likely Causes\n';
    causes.forEach(c => auditText += `- ${c}\n`);
    auditText += '\n### C) Recommended Actions\n';
    actions.forEach(a => auditText += `- ${a}\n`);
    auditText += '\n### D) What NOT to Change\n- Do not manually adjust computed totals. Any corrections should flow through CostLibrary unit cost updates.\n';
  }

  // Save CostAudit record
  saveCostAudit({
    id: uid(),
    estimate_id: est.estimate_id || '',
    created_at: new Date().toISOString(),
    findings_json: JSON.stringify(findings),
    recommended_actions: auditText,
    status: findings.length > 0 ? 'Open' : 'Accepted',
  });

  return auditText;
}
