import type { Estimate, LineItem, CostStructureItem, RiskTableItem } from './types';

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

export function generatePublicPDF(est: Estimate) {
  const lineItems: LineItem[] = est.line_items_json ? JSON.parse(est.line_items_json) : [];
  const costStructure: CostStructureItem[] = est.cost_structure_json ? JSON.parse(est.cost_structure_json) : [];
  const riskTable: RiskTableItem[] = est.risk_table_json ? JSON.parse(est.risk_table_json) : [];

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
    <table><thead><tr><th>Trade</th><th>Description</th><th>Qty</th><th>Unit</th><th>Labor</th><th>Material</th><th>Total</th></tr></thead><tbody>
    ${lineItems.filter(l => l.total > 0).map(l => `<tr><td>${l.trade}</td><td>${l.description}</td><td>${l.qty}</td><td>${l.unit}</td><td>${formatMoney(l.labor)}</td><td>${formatMoney(l.material)}</td><td>${formatMoney(l.total)}</td></tr>`).join('')}
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
      <li>This estimate is valid for 15 calendar days from the date of issue.</li>
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

export function generateInternalPDF(est: Estimate) {
  const lineItems: LineItem[] = est.line_items_json ? JSON.parse(est.line_items_json) : [];
  const costStructure: CostStructureItem[] = est.cost_structure_json ? JSON.parse(est.cost_structure_json) : [];
  const riskTable: RiskTableItem[] = est.risk_table_json ? JSON.parse(est.risk_table_json) : [];

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
    <table><thead><tr><th>Trade</th><th>Desc</th><th>Qty</th><th>Unit</th><th>Labor</th><th>Material</th><th>Total</th></tr></thead><tbody>
    ${lineItems.map(l => `<tr><td>${l.trade}</td><td>${l.description}</td><td>${l.qty}</td><td>${l.unit}</td><td>${formatMoney(l.labor)}</td><td>${formatMoney(l.material)}</td><td>${formatMoney(l.total)}</td></tr>`).join('')}
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

function openPDF(html: string) {
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}
