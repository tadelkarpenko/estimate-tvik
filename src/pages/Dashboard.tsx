import { useMemo } from 'react';
import { getEstimates, getCostAudits, getCostLibrary } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function Dashboard() {
  const estimates = useMemo(() => getEstimates(), []);
  const audits = useMemo(() => getCostAudits(), []);
  const costLib = useMemo(() => getCostLibrary(), []);

  const now = Date.now();
  const d7 = now - 7 * 86400000;
  const d30 = now - 30 * 86400000;
  const est7 = estimates.filter(e => new Date(e.created_at).getTime() > d7).length;
  const est30 = estimates.filter(e => new Date(e.created_at).getTime() > d30).length;

  const byType = (type: string) => estimates.filter(e => e.project_type === type && e.subtotal > 0);
  const avgCps = (type: string) => {
    const arr = byType(type);
    return arr.length > 0 ? arr.reduce((s, e) => s + e.subtotal / (e.sqft || 1), 0) / arr.length : 0;
  };

  const avgRiskHigh = estimates.length > 0
    ? estimates.filter(e => e.subtotal > 0).reduce((s, e) => s + (e.risk_cost_high / (e.subtotal || 1)), 0) / estimates.filter(e => e.subtotal > 0).length
    : 0;

  const avgMargin = (() => {
    const valid = estimates.filter(e => e.subtotal > 0 && e.total_high > 0);
    if (!valid.length) return 0;
    return valid.reduce((s, e) => s + (e.total_high - e.subtotal) / e.total_high, 0) / valid.length;
  })();

  const openAudits = audits.filter(a => a.status === 'Open');
  const staleRows = costLib.filter(r => {
    const d = new Date(r.last_updated).getTime();
    return now - d > 120 * 86400000;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI title="Estimates (7d)" value={est7} />
        <KPI title="Estimates (30d)" value={est30} />
        <KPI title="Avg $/SF (Bath)" value={`$${avgCps('Bath').toFixed(2)}`} />
        <KPI title="Avg $/SF (Full Rehab)" value={`$${avgCps('Full Rehab').toFixed(2)}`} />
        <KPI title="Avg Risk Ratio (High)" value={`${(avgRiskHigh * 100).toFixed(1)}%`} />
        <KPI title="Avg Margin" value={`${(avgMargin * 100).toFixed(1)}%`} />
        <KPI title="Open Audits" value={openAudits.length} />
        <KPI title="Stale CostLib Rows" value={staleRows.length} />
      </div>

      {openAudits.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Open Audit Anomalies</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Estimate</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {openAudits.slice(0, 10).map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-sm">{a.estimate_id}</TableCell>
                    <TableCell>{new Date(a.created_at).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant="destructive">Open</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {staleRows.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Stale Cost Library Rows (&gt;120 days)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Trade</TableHead><TableHead>Type</TableHead><TableHead>Last Updated</TableHead></TableRow></TableHeader>
              <TableBody>
                {staleRows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.trade}</TableCell>
                    <TableCell>{r.project_type}</TableCell>
                    <TableCell>{r.last_updated}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KPI({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-xs text-muted-foreground mb-1">{title}</p>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
