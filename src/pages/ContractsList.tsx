import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Contract } from '@/lib/contractTypes';
import { getContracts, getCompletedLineItemsForDrift } from '@/lib/contractStore';
import { computeTradeDrift, type TradeDriftEntry } from '@/lib/contractEngine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

export default function ContractsList() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [driftEntries, setDriftEntries] = useState<TradeDriftEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const [data, completedItems] = await Promise.all([
          getContracts(),
          getCompletedLineItemsForDrift(),
        ]);
        setContracts(data);
        setDriftEntries(computeTradeDrift(completedItems));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const fmt = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (n: number) => (n * 100).toFixed(1) + '%';
  const driftAlerts = driftEntries.filter(d => d.alert);

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold">Contracts</h1>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MiniCard label="Active" value={String(contracts.filter(c => c.contract_status === 'Active').length)} />
        <MiniCard label="Total Value" value={fmt(contracts.reduce((s, c) => s + c.net_contract_value, 0))} />
        <MiniCard label="Avg Margin" value={contracts.length > 0 ? pct(contracts.reduce((s, c) => s + c.margin_current_pct, 0) / contracts.length) : '—'} />
        <MiniCard label="Fade Alerts" value={String(contracts.filter(c => c.profit_fade_flag).length)} />
        <MiniCard label="Drift Alerts" value={String(driftAlerts.length)} />
      </div>

      {/* Trade Drift Alerts */}
      {driftAlerts.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Trade Cost Drift Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trade</TableHead>
                  <TableHead className="text-right">Estimated</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Drift Factor</TableHead>
                  <TableHead>Direction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {driftAlerts.map(d => (
                  <TableRow key={d.trade}>
                    <TableCell className="font-medium">{d.trade}</TableCell>
                    <TableCell className="text-right">{fmt(d.estimated_cost)}</TableCell>
                    <TableCell className="text-right">{fmt(d.actual_cost)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      <span className={d.drift_factor > 1.12 ? 'text-destructive' : 'text-green-600'}>
                        {d.drift_factor.toFixed(3)}x
                      </span>
                    </TableCell>
                    <TableCell>
                      {d.drift_factor > 1.12 ? (
                        <div className="flex items-center gap-1 text-destructive text-xs">
                          <TrendingUp className="h-3 w-3" />Over budget
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-green-600 text-xs">
                          <TrendingDown className="h-3 w-3" />Under budget
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-2">AI may suggest CostLibrary review for flagged trades. No auto-updates applied.</p>
          </CardContent>
        </Card>
      )}

      {/* All Drift Data (non-alerts) */}
      {driftEntries.length > 0 && driftEntries.some(d => !d.alert) && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Trade Drift Summary (All Trades)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trade</TableHead>
                  <TableHead className="text-right">Estimated</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Drift Factor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {driftEntries.map(d => (
                  <TableRow key={d.trade}>
                    <TableCell className="font-medium">{d.trade}</TableCell>
                    <TableCell className="text-right">{fmt(d.estimated_cost)}</TableCell>
                    <TableCell className="text-right">{fmt(d.actual_cost)}</TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={d.alert ? (d.drift_factor > 1 ? 'text-destructive font-bold' : 'text-green-600 font-bold') : ''}>
                        {d.drift_factor.toFixed(3)}x
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">All Contracts</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract ID</TableHead>
                <TableHead>Signed</TableHead>
                <TableHead className="text-right">Net Value</TableHead>
                <TableHead className="text-right">% Complete</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead>Fade</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/contracts/${c.id}`)}>
                  <TableCell className="font-mono font-medium">{c.contract_id}</TableCell>
                  <TableCell>{new Date(c.signed_date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(c.net_contract_value)}</TableCell>
                  <TableCell className="text-right">{c.percent_complete.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{pct(c.margin_current_pct)}</TableCell>
                  <TableCell>
                    {c.profit_fade_flag && (
                      <div className="flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        <span className="text-xs">Fade</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.contract_status === 'Active' ? 'default' : c.contract_status === 'Completed' ? 'secondary' : 'outline'}>
                      {c.contract_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {contracts.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No contracts yet. Accept an estimate to create one.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="pt-3 pb-2 px-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-base font-bold">{value}</p></CardContent></Card>
  );
}
