import type { Estimate, CostStructureItem, RiskTableItem } from './types';
import type { EstimateLineItem } from './types';

const NAVY = '#0B1F3B';
const GOLD = '#C9A227';

function baseStyles() {
  return `<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'IBM Plex Sans', -apple-system, sans-serif; color: #333; max-width: 860px; margin: 0 auto; padding: 40px; }
    h1 { color: ${NAVY}; font-size: 22px; margin-bottom: 4px; }
    h2 { color: ${NAVY}; font-size: 16px; border-bottom: 2px solid ${GOLD}; padding-bottom: 4px; margin: 24px 0 12px; }
    h3 { font-size: 14px; margin: 16px 0 8px; }
    p, li { font-size: 13px; line-height: 1.5; }
    ul { padding-left: 20px; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
    th { background: ${NAVY}; color: white; text-align: left; padding: 8px 10px; font-weight: 600; }
    td { padding: 6px 10px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) { background: #f8f9fa; }
    .header-bar { background: ${NAVY}; color: white; padding: 20px 24px; margin: -40px -40px 24px; }
    .header-bar h1 { color: white; }
    .gold-line { height: 3px; background: ${GOLD}; margin-bottom: 20px; }
    .summary-box { background: #f0f2f5; padding: 16px; border-radius: 6px; margin: 12px 0; }
    .sig-block { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px; }
    .sig-line { border-bottom: 1px solid #333; width: 300px; height: 40px; margin: 8px 0; }
    @media print { body { padding: 20px; } .header-bar { margin: -20px -20px 24px; } }
  </style>`;
}

function formatMoney(n: number) { return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/**
 * Generate the PUBLIC PDF using canonical line items from the DB table.
 * Renders ALL line items where include_in_public_pdf = true (regardless of source: Manual, AI, CostLibrary).
 */
export function generatePublicPDF(est: Estimate, dbLineItems?: EstimateLineItem[]) {
  const costStructure: CostStructureItem[] = est.cost_structure_json ? JSON.parse(est.cost_structure_json) : [];
  const riskTable: RiskTableItem[] = est.risk_table_json ? JSON.parse(est.risk_table_json) : [];

  // Use DB line items (canonical) if provided; fall back to legacy JSON
  let lineItemsHtml = '';
  if (dbLineItems && dbLineItems.length > 0) {
    const publicItems = dbLineItems.filter(li => (li as any).include_in_public_pdf !== false && li.line_total > 0);
    lineItemsHtml = publicItems.map(li =>
      `<tr><td>${li.phase}</td><td>${li.description}</td><td>${li.qty}</td><td>${li.unit}</td><td>${formatMoney(li.labor_total)}</td><td>${formatMoney(li.material_total)}</td><td>${formatMoney(li.line_total)}</td></tr>`
    ).join('');
  } else {
    // Legacy fallback
    const legacyItems = est.line_items_json ? JSON.parse(est.line_items_json) : [];
    lineItemsHtml = legacyItems.filter((l: any) => l.total > 0).map((l: any) =>
      `<tr><td>${l.trade}</td><td>${l.description}</td><td>${l.qty}</td><td>${l.unit}</td><td>${formatMoney(l.labor)}</td><td>${formatMoney(l.material)}</td><td>${formatMoney(l.total)}</td></tr>`
    ).join('');
  }

  const html = `<!DOCTYPE html><html><head><title>Estimate ${est.estimate_id}</title>${baseStyles()}</head><body>
    <div class="header-bar">
      <h1>TVIK LLC</h1>
      <p style="font-size:12px;opacity:0.8;">Construction Estimating</p>
    </div>
    <div class="gold-line"></div>

    <h2>1. Project Summary</h2>
    <div class="summary-box">
      <p><strong>Project:</strong> ${est.project_name} | <strong>Type:</strong> ${est.project_type}</p>
      <p><strong>Client:</strong> ${est.client_name} | ${est.client_email} | ${est.client_phone}</p>
      <p><strong>Address:</strong> ${est.project_address}, ${est.city}, ${est.state} ${est.zip}</p>
      <p><strong>Area:</strong> ${est.sqft} SF | <strong>Finish:</strong> ${est.finish_level} | <strong>Estimate:</strong> ${est.estimate_id} ${est.version}</p>
    </div>

    <h2>2. Line Items</h2>
    <table><thead><tr><th>Phase</th><th>Description</th><th>Qty</th><th>Unit</th><th>Labor</th><th>Material</th><th>Total</th></tr></thead><tbody>
    ${lineItemsHtml}
    </tbody></table>

    <h2>3. Cost Summary</h2>
    <div class="summary-box">
      <p><strong>Labor:</strong> ${formatMoney(est.labor_subtotal)} | <strong>Materials:</strong> ${formatMoney(est.material_subtotal)} | <strong>Subtotal:</strong> ${formatMoney(est.subtotal)}</p>
      <p><strong>Estimated Range:</strong> ${formatMoney(est.total_low)} – ${formatMoney(est.total_high)}</p>
    </div>

    <h2>4. Cost Structure</h2>
    <table><thead><tr><th>Trade</th><th>Labor</th><th>Material</th><th>Total</th><th>%</th></tr></thead><tbody>
    ${costStructure.map(c => `<tr><td>${c.trade}</td><td>${formatMoney(c.labor)}</td><td>${formatMoney(c.material)}</td><td>${formatMoney(c.dollars)}</td><td>${c.percent.toFixed(1)}%</td></tr>`).join('')}
    </tbody></table>

    <h2>5. Risk Classification</h2>
    <p><strong>Overall Risk:</strong> ${est.overall_risk_level} | <strong>Risk Exposure:</strong> ${formatMoney(est.risk_cost_low)} – ${formatMoney(est.risk_cost_high)}</p>
    <table><thead><tr><th>Risk</th><th>Level</th><th>Low</th><th>High</th><th>Mitigation</th></tr></thead><tbody>
    ${riskTable.map(r => `<tr><td>${r.risk_name}</td><td>${r.level}</td><td>${formatMoney(r.exposure_low)}</td><td>${formatMoney(r.exposure_high)}</td><td>${r.mitigation_note}</td></tr>`).join('')}
    </tbody></table>

    <h2>6. Assumptions</h2>
    <div style="white-space:pre-wrap;font-size:13px;">${est.assumptions_rich || ''}</div>

    <h2>7. Scope Advisory</h2>
    <div style="white-space:pre-wrap;font-size:13px;">${est.ai_scope || ''}</div>

    <h2>8. Timeline</h2>
    <div style="white-space:pre-wrap;font-size:13px;">${est.timeline_rich || ''}</div>

    <h2>9. Terms & Acceptance</h2>
    <ul>
      <li>This estimate is valid for ${(est as any).validity_days || 15} calendar days from the date of issue.</li>
      <li>All work subject to a signed contract and approved scope of work.</li>
      <li>Changes to scope require a written change order prior to execution.</li>
      <li>Payment terms: 50% upon acceptance, progress draws per schedule, final upon completion.</li>
      <li>Late payments subject to 1.5% monthly finance charge.</li>
      <li>TVIK LLC carries general liability and workers' compensation insurance.</li>
    </ul>

    <h2>10. Acceptance</h2>
    <div class="sig-block">
      <p>By signing below, Client accepts the terms and scope outlined in this estimate.</p>
      <p style="margin-top:20px;">Client Signature:</p><div class="sig-line"></div>
      <p>Printed Name: _________________________ Date: _____________</p>
    </div>
  </body></html>`;

  openPDF(html);
  return 'generated';
}

export function generateInternalPDF(est: Estimate, dbLineItems?: EstimateLineItem[]) {
  const costStructure: CostStructureItem[] = est.cost_structure_json ? JSON.parse(est.cost_structure_json) : [];
  const riskTable: RiskTableItem[] = est.risk_table_json ? JSON.parse(est.risk_table_json) : [];

  let lineItemsHtml = '';
  if (dbLineItems && dbLineItems.length > 0) {
    const internalItems = dbLineItems.filter(li => (li as any).include_in_internal_pdf !== false);
    lineItemsHtml = internalItems.map(li =>
      `<tr><td>${li.phase}</td><td>${li.description}${li.source !== 'CostLibrary' ? ` <em style="color:#888">[${li.source}]</em>` : ''}</td><td>${li.qty}</td><td>${li.unit}</td><td>${formatMoney(li.labor_total)}</td><td>${formatMoney(li.material_total)}</td><td>${formatMoney(li.line_total)}</td></tr>`
    ).join('');
  } else {
    const legacyItems = est.line_items_json ? JSON.parse(est.line_items_json) : [];
    lineItemsHtml = legacyItems.map((l: any) =>
      `<tr><td>${l.trade}</td><td>${l.description}</td><td>${l.qty}</td><td>${l.unit}</td><td>${formatMoney(l.labor)}</td><td>${formatMoney(l.material)}</td><td>${formatMoney(l.total)}</td></tr>`
    ).join('');
  }

  const html = `<!DOCTYPE html><html><head><title>INTERNAL - ${est.estimate_id}</title>${baseStyles()}</head><body>
    <div class="header-bar">
      <h1>TVIK LLC — INTERNAL ESTIMATE</h1>
      <p style="font-size:12px;opacity:0.8;color:${GOLD};">CONFIDENTIAL — NOT FOR DISTRIBUTION</p>
    </div>
    <div class="gold-line"></div>

    <h2>Project Summary</h2>
    <div class="summary-box">
      <p><strong>Project:</strong> ${est.project_name} (${est.project_type}) | ${est.estimate_id} ${est.version}</p>
      <p><strong>Client:</strong> ${est.client_name} | ${est.sqft} SF | ${est.finish_level}</p>
    </div>

    <h2>Line Items</h2>
    <table><thead><tr><th>Phase</th><th>Desc</th><th>Qty</th><th>Unit</th><th>Labor</th><th>Material</th><th>Total</th></tr></thead><tbody>
    ${lineItemsHtml}
    </tbody></table>

    <h2>Cost Structure</h2>
    <table><thead><tr><th>Trade</th><th>Labor</th><th>Material</th><th>$</th><th>%</th></tr></thead><tbody>
    ${costStructure.map(c => `<tr><td>${c.trade}</td><td>${formatMoney(c.labor)}</td><td>${formatMoney(c.material)}</td><td>${formatMoney(c.dollars)}</td><td>${c.percent.toFixed(1)}%</td></tr>`).join('')}
    </tbody></table>

    <h2>Internal Margin</h2>
    <div class="summary-box">
      <p><strong>Base Subtotal:</strong> ${formatMoney(est.subtotal)}</p>
      <p><strong>Overhead:</strong> ${(est.overhead_pct * 100).toFixed(0)}% | <strong>Profit:</strong> ${(est.profit_pct * 100).toFixed(0)}% | <strong>Contingency:</strong> ${(est.contingency_pct * 100).toFixed(0)}%</p>
      <p><strong>Risk Low/High:</strong> ${formatMoney(est.risk_cost_low)} / ${formatMoney(est.risk_cost_high)}</p>
      <p style="font-size:15px;font-weight:bold;margin-top:8px;"><strong>Total Range:</strong> ${formatMoney(est.total_low)} – ${formatMoney(est.total_high)}</p>
    </div>

    <h2>Risk Analysis</h2>
    <table><thead><tr><th>Risk</th><th>Level</th><th>Low</th><th>High</th><th>Mitigation</th></tr></thead><tbody>
    ${riskTable.map(r => `<tr><td>${r.risk_name}</td><td>${r.level}</td><td>${formatMoney(r.exposure_low)}</td><td>${formatMoney(r.exposure_high)}</td><td>${r.mitigation_note}</td></tr>`).join('')}
    </tbody></table>

    <h2>AI Price Audit</h2>
    <div style="white-space:pre-wrap;font-size:13px;">${est.ai_price_audit_summary || 'No audit data.'}</div>

    <h2>Assumptions</h2>
    <div style="white-space:pre-wrap;font-size:13px;">${est.assumptions_rich || ''}</div>

    <h2>Scope Advisory</h2>
    <div style="white-space:pre-wrap;font-size:13px;">${est.ai_scope || ''}</div>
  </body></html>`;

  openPDF(html);
  return 'generated';
}

export function generateContractPDF(contract: {
  contract_id: string;
  signed_date: string;
  contract_status: string;
  baseline_contract_value: number;
  baseline_margin_pct: number;
  baseline_risk_exposure: number;
  net_contract_value: number;
  earned_revenue: number;
  percent_complete: number;
  projected_final_cost: number;
  projected_final_profit: number;
  margin_current_pct: number;
  profit_fade_flag: boolean;
  cash_forecast_30: number;
  cash_forecast_60: number;
  cash_forecast_90: number;
}, changeOrders: Array<{ change_order_id: string; description: string; change_type: string; delta_value: number; approved: boolean; }>) {
  const approvedCOs = changeOrders.filter(c => c.approved);
  const approvedTotal = approvedCOs.reduce((s, c) => s + c.delta_value, 0);

  const html = `<!DOCTYPE html><html><head><title>Contract Financial Summary - ${contract.contract_id}</title>${baseStyles()}</head><body>
    <div class="header-bar">
      <h1>TVIK LLC — CONTRACT FINANCIAL SUMMARY</h1>
      <p style="font-size:12px;opacity:0.8;color:${GOLD};">CONFIDENTIAL — INTERNAL USE ONLY</p>
    </div>
    <div class="gold-line"></div>

    <h2>1. Contract Overview</h2>
    <div class="summary-box">
      <p><strong>Contract:</strong> ${contract.contract_id} | <strong>Status:</strong> ${contract.contract_status}</p>
      <p><strong>Signed:</strong> ${new Date(contract.signed_date).toLocaleDateString()}</p>
    </div>

    <h2>2. Contract Values</h2>
    <table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>
      <tr><td>Baseline Contract Value</td><td style="text-align:right">${formatMoney(contract.baseline_contract_value)}</td></tr>
      <tr><td>Approved Change Orders (${approvedCOs.length})</td><td style="text-align:right">${approvedTotal >= 0 ? '+' : ''}${formatMoney(approvedTotal)}</td></tr>
      <tr><td><strong>Net Contract Value</strong></td><td style="text-align:right"><strong>${formatMoney(contract.net_contract_value)}</strong></td></tr>
    </tbody></table>

    ${approvedCOs.length > 0 ? `
    <h2>3. Approved Change Orders</h2>
    <table><thead><tr><th>CO ID</th><th>Type</th><th>Description</th><th>Delta</th></tr></thead><tbody>
    ${approvedCOs.map(co => `<tr><td>${co.change_order_id}</td><td>${co.change_type}</td><td>${co.description}</td><td style="text-align:right">${co.delta_value >= 0 ? '+' : ''}${formatMoney(co.delta_value)}</td></tr>`).join('')}
    </tbody></table>` : '<h2>3. Change Orders</h2><p>No approved change orders.</p>'}

    <h2>4. Work-in-Progress</h2>
    <div class="summary-box">
      <p><strong>Percent Complete:</strong> ${contract.percent_complete.toFixed(1)}%</p>
      <p><strong>Earned Revenue:</strong> ${formatMoney(contract.earned_revenue)}</p>
    </div>

    <h2>5. Projected Financials</h2>
    <table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>
      <tr><td>Projected Final Cost</td><td style="text-align:right">${formatMoney(contract.projected_final_cost)}</td></tr>
      <tr><td>Projected Profit</td><td style="text-align:right">${formatMoney(contract.projected_final_profit)}</td></tr>
      <tr><td>Current Margin</td><td style="text-align:right">${(contract.margin_current_pct * 100).toFixed(1)}%</td></tr>
      <tr><td>Baseline Margin</td><td style="text-align:right">${(contract.baseline_margin_pct * 100).toFixed(1)}%</td></tr>
      <tr><td>Baseline Risk Exposure</td><td style="text-align:right">${formatMoney(contract.baseline_risk_exposure)}</td></tr>
    </tbody></table>
    ${contract.profit_fade_flag ? '<p style="color:red;font-weight:bold;margin-top:8px;">⚠ PROFIT FADE DETECTED — Margin dropped more than 5 pts from baseline</p>' : ''}

    <h2>6. Cash Forecast</h2>
    <table><thead><tr><th>Window</th><th>Forecast</th></tr></thead><tbody>
      <tr><td>30-Day</td><td style="text-align:right">${formatMoney(contract.cash_forecast_30)}</td></tr>
      <tr><td>60-Day</td><td style="text-align:right">${formatMoney(contract.cash_forecast_60)}</td></tr>
      <tr><td>90-Day</td><td style="text-align:right">${formatMoney(contract.cash_forecast_90)}</td></tr>
    </tbody></table>

    <div class="sig-block">
      <p style="font-size:11px;color:#999;">Generated ${new Date().toLocaleString()} | TVIK LLC Internal Document</p>
    </div>
  </body></html>`;

  openPDF(html);
  return 'generated';
}

function openPDF(html: string) {
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}
