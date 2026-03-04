import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Contract } from '@/lib/contractTypes';
import { getContracts, getCompletedLineItemsForDrift } from '@/lib/contractStore';
import { computeTradeDrift, type TradeDriftEntry } from '@/lib/contractEngine';
import { computePortfolioIntelligence, type PortfolioIntelligence } from '@/lib/phase5Engine';
import { getVendorPerformance } from '@/lib/phase5Store';
import type { VendorPerformance } from '@/lib/phase5Types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

export default function ContractsList() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [driftEntries, setDriftEntries] = useState<TradeDriftEntry[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioIntelligence | null>(null);
  const [vendors, setVendors] = useState<VendorPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const [data, completedItems, vendorData] = await Promise.all([
          getContracts(),
          getCompletedLineItemsForDrift(),
          getVendorPerformance(),
        ]);
        setContracts(data);
        setDriftEntries(computeTradeDrift(completedItems));
        setPortfolio(computePortfolioIntelligence(data));
        setVendors(vendorData);
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
      <h1 className="text-2xl font-bold">Contracts & Portfolio Intelligence</h1>

      {/* Portfolio Intelligence Cards */}
      {portfolio && (
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
          <MiniCard label="Active" value={String(portfolio.active_contracts)} />
          <MiniCard label="Total Net Value" value={fmt(portfolio.total_net_value)} />
          <MiniCard label="Proj. Profit" value={fmt(portfolio.total_projected_profit)} />
          <MiniCard label="Avg Margin" value={pct(portfolio.avg_margin)} />
          <MiniCard label="Fade Alerts" value={String(portfolio.fade_count)} />
          <MiniCard label="Risk Index" value={String(portfolio.portfolio_risk_index)} />
          <MiniCard label="Opportunity" value={String(portfolio.portfolio_opportunity_index)} />
        </div>
      )}

      <Tabs defaultValue="contracts">
        <TabsList>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="drift">Trade Drift{driftAlerts.length > 0 ? ' ⚠' : ''}</TabsTrigger>
          <TabsTrigger value="vendors">Vendor Ranking ({vendors.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="contracts" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract ID</TableHead>
                    <TableHead>Signed</TableHead>
                    <TableHead className="text-right">Net Value</TableHead>
                    <TableHead className="text-right">% Complete</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead>Fade</TableHead>
                    <TableHead>Quadrant</TableHead>
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
                            <AlertTriangle className="h-3 w-3" /><span className="text-xs">Fade</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{(c as any).risk_quadrant || 'Stable'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.contract_status === 'Active' ? 'default' : 'secondary'}>{c.contract_status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {contracts.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No contracts yet. Accept an estimate to create one.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drift" className="space-y-4">
          {driftAlerts.length > 0 && (
            <Card className="border-destructive/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />Drift Alerts
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
                          {d.drift_factor > 1.12
                            ? <div className="flex items-center gap-1 text-destructive text-xs"><TrendingUp className="h-3 w-3" />Over budget</div>
                            : <div className="flex items-center gap-1 text-green-600 text-xs"><TrendingDown className="h-3 w-3" />Under budget</div>
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {driftEntries.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">All Trades Drift Summary</CardTitle></CardHeader>
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
                <p className="text-xs text-muted-foreground mt-2">AI may suggest CostLibrary review. No auto-updates.</p>
              </CardContent>
            </Card>
          )}

          {driftEntries.length === 0 && (
            <Card><CardContent className="py-6 text-center text-muted-foreground">No drift data yet. Complete WIP tracking on contracts to generate trade drift.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="vendors" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" />Vendor Performance Ranking</CardTitle></CardHeader>
            <CardContent>
              {vendors.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Contracts</TableHead>
                      <TableHead className="text-right">Cost Reliability</TableHead>
                      <TableHead className="text-right">Schedule</TableHead>
                      <TableHead className="text-right">Billing</TableHead>
                      <TableHead className="text-right">CO Behavior</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendors.map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.vendor_name}</TableCell>
                        <TableCell className="text-right">{v.contracts_count}</TableCell>
                        <TableCell className="text-right">{v.cost_reliability_score.toFixed(0)}</TableCell>
                        <TableCell className="text-right">{v.schedule_reliability_score.toFixed(0)}</TableCell>
                        <TableCell className="text-right">{v.billing_accuracy_score.toFixed(0)}</TableCell>
                        <TableCell className="text-right">{v.change_order_behavior_score.toFixed(0)}</TableCell>
                        <TableCell className="text-right font-bold">
                          <Badge variant={v.performance_score >= 70 ? 'default' : v.performance_score >= 50 ? 'secondary' : 'destructive'}>
                            {v.performance_score.toFixed(0)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-4 text-muted-foreground">No vendor data yet. Add subcontracts to contracts to track vendor performance.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="pt-3 pb-2 px-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-base font-bold">{value}</p></CardContent></Card>
  );
}
