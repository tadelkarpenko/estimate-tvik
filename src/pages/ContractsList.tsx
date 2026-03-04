import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Contract } from '@/lib/contractTypes';
import { getContracts, getCompletedLineItemsForDrift } from '@/lib/contractStore';
import { computeTradeDrift, type TradeDriftEntry } from '@/lib/contractEngine';
import { computePortfolioIntelligence, type PortfolioIntelligence } from '@/lib/phase5Engine';
import { getVendorPerformance } from '@/lib/phase5Store';
import type { VendorPerformance } from '@/lib/phase5Types';
import { getCrewCapacities, getAllActiveContractLineItems } from '@/lib/capacityStore';
import { computeFullCapacityAnalysis, assessBacklogHealth, detectBottlenecks, type TradeUtilizationSummary, type CrewCapacity } from '@/lib/capacityEngine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle, TrendingUp, TrendingDown, BarChart3, Plus, Users, Trash2 } from 'lucide-react';
import { saveCrewCapacity, deleteCrewCapacity } from '@/lib/capacityStore';
import { useToast } from '@/hooks/use-toast';

const TIER_COLORS: Record<string, string> = {
  Green: 'bg-green-100 text-green-800',
  Yellow: 'bg-yellow-100 text-yellow-800',
  Orange: 'bg-orange-100 text-orange-800',
  Red: 'bg-red-100 text-red-800',
};

export default function ContractsList() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [driftEntries, setDriftEntries] = useState<TradeDriftEntry[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioIntelligence | null>(null);
  const [vendors, setVendors] = useState<VendorPerformance[]>([]);
  const [capacities, setCapacities] = useState<CrewCapacity[]>([]);
  const [utilization, setUtilization] = useState<TradeUtilizationSummary[]>([]);
  const [backlogHealth, setBacklogHealth] = useState<{ status: string; message: string } | null>(null);
  const [bottlenecks, setBottlenecks] = useState<TradeUtilizationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [capModal, setCapModal] = useState(false);
  const [capForm, setCapForm] = useState<Partial<CrewCapacity>>({
    trade: '', crew_size: 2, hours_per_day: 8, work_days_per_week: 5,
    overtime_allowed: false, overtime_multiplier: 1.5, max_safe_utilization_pct: 85,
    effective_from: new Date().toISOString().split('T')[0],
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  const loadAll = async () => {
    try {
      const [data, completedItems, vendorData, caps, activeItems] = await Promise.all([
        getContracts(), getCompletedLineItemsForDrift(), getVendorPerformance(),
        getCrewCapacities(), getAllActiveContractLineItems(),
      ]);
      setContracts(data);
      setDriftEntries(computeTradeDrift(completedItems));
      setPortfolio(computePortfolioIntelligence(data));
      setVendors(vendorData);
      setCapacities(caps);

      // Compute capacity analysis
      if (caps.length > 0) {
        const util = computeFullCapacityAnalysis(activeItems, caps);
        setUtilization(util);
        setBacklogHealth(assessBacklogHealth(util));
        setBottlenecks(detectBottlenecks(util));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const fmt = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (n: number) => (n * 100).toFixed(1) + '%';
  const driftAlerts = driftEntries.filter(d => d.alert);

  const addCapacity = async () => {
    if (!capForm.trade) return;
    await saveCrewCapacity(capForm as CrewCapacity);
    setCapModal(false);
    setCapForm({
      trade: '', crew_size: 2, hours_per_day: 8, work_days_per_week: 5,
      overtime_allowed: false, overtime_multiplier: 1.5, max_safe_utilization_pct: 85,
      effective_from: new Date().toISOString().split('T')[0],
    });
    toast({ title: 'Crew capacity added' });
    await loadAll();
  };

  const removeCap = async (id: string) => {
    await deleteCrewCapacity(id);
    toast({ title: 'Crew capacity removed' });
    await loadAll();
  };

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
        <TabsList className="flex-wrap">
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="capacity">
            Capacity{bottlenecks.length > 0 ? ' ⚠' : ''}
          </TabsTrigger>
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

        {/* Capacity Intelligence Tab */}
        <TabsContent value="capacity" className="space-y-4">
          {/* Backlog Health */}
          {backlogHealth && (
            <Card className={backlogHealth.status === 'Critical' || backlogHealth.status === 'Low' ? 'border-destructive/30' : ''}>
              <CardContent className="pt-3 pb-2 px-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <Badge className={
                    backlogHealth.status === 'Healthy' ? 'bg-green-100 text-green-800' :
                    backlogHealth.status === 'High' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }>{backlogHealth.status}</Badge>
                  <span className="text-sm">{backlogHealth.message}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bottleneck Alerts */}
          {bottlenecks.length > 0 && (
            <Card className="border-destructive/30">
              <CardContent className="pt-3 pb-2 px-4 space-y-1">
                {bottlenecks.map(b => (
                  <div key={b.trade} className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                    <span className="text-destructive font-medium">⚠ {b.trade} Crew Overloaded — {b.next_30d_pct.toFixed(0)}% utilization next 30 days</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Utilization Table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" />Trade Utilization</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setCapModal(true)}><Plus className="h-3 w-3 mr-1" />Add Crew Capacity</Button>
              </div>
            </CardHeader>
            <CardContent>
              {utilization.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trade</TableHead>
                      <TableHead className="text-right">30d Util%</TableHead>
                      <TableHead className="text-right">60d Util%</TableHead>
                      <TableHead className="text-right">90d Util%</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Earliest New Start</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {utilization.map(u => (
                      <TableRow key={u.trade}>
                        <TableCell className="font-medium">{u.trade}</TableCell>
                        <TableCell className="text-right font-mono">{u.next_30d_pct.toFixed(0)}%</TableCell>
                        <TableCell className="text-right font-mono">{u.next_60d_pct.toFixed(0)}%</TableCell>
                        <TableCell className="text-right font-mono">{u.next_90d_pct.toFixed(0)}%</TableCell>
                        <TableCell><Badge className={TIER_COLORS[u.status] || ''}>{u.status}</Badge></TableCell>
                        <TableCell className="text-sm">{u.earliest_new_start || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-4 text-muted-foreground">
                  {capacities.length === 0 ? 'Add crew capacity per trade to see utilization analysis.' : 'No active contract line items to analyze.'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Crew Capacity Configuration */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Crew Capacity Configuration</CardTitle></CardHeader>
            <CardContent>
              {capacities.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trade</TableHead>
                      <TableHead className="text-right">Crew Size</TableHead>
                      <TableHead className="text-right">Hrs/Day</TableHead>
                      <TableHead className="text-right">Days/Wk</TableHead>
                      <TableHead>OT</TableHead>
                      <TableHead className="text-right">Max Util%</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {capacities.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.trade}</TableCell>
                        <TableCell className="text-right">{c.crew_size}</TableCell>
                        <TableCell className="text-right">{c.hours_per_day}</TableCell>
                        <TableCell className="text-right">{c.work_days_per_week}</TableCell>
                        <TableCell>{c.overtime_allowed ? <Badge variant="secondary" className="text-xs">Yes ({c.overtime_multiplier}x)</Badge> : '—'}</TableCell>
                        <TableCell className="text-right">{c.max_safe_utilization_pct}%</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => removeCap(c.id!)}><Trash2 className="h-3 w-3" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-4 text-muted-foreground">No crew capacity configured yet.</p>
              )}
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

      {/* Add Crew Capacity Modal */}
      <Dialog open={capModal} onOpenChange={setCapModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Crew Capacity</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Trade</Label><Input value={capForm.trade || ''} onChange={e => setCapForm(p => ({ ...p, trade: e.target.value }))} placeholder="e.g. Electrical, Plumbing, Framing" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Crew Size</Label><Input type="number" value={capForm.crew_size || ''} onChange={e => setCapForm(p => ({ ...p, crew_size: Number(e.target.value) }))} /></div>
              <div><Label>Hours/Day</Label><Input type="number" value={capForm.hours_per_day || ''} onChange={e => setCapForm(p => ({ ...p, hours_per_day: Number(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Work Days/Week</Label><Input type="number" value={capForm.work_days_per_week || ''} onChange={e => setCapForm(p => ({ ...p, work_days_per_week: Number(e.target.value) }))} /></div>
              <div><Label>Max Safe Utilization %</Label><Input type="number" value={capForm.max_safe_utilization_pct || ''} onChange={e => setCapForm(p => ({ ...p, max_safe_utilization_pct: Number(e.target.value) }))} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={capForm.overtime_allowed || false} onCheckedChange={v => setCapForm(p => ({ ...p, overtime_allowed: v }))} />
              <Label>Overtime Allowed</Label>
              {capForm.overtime_allowed && (
                <div className="flex items-center gap-1 ml-2">
                  <Label className="text-xs">Multiplier:</Label>
                  <Input type="number" step="0.1" className="w-16 h-7 text-sm" value={capForm.overtime_multiplier || 1.5} onChange={e => setCapForm(p => ({ ...p, overtime_multiplier: Number(e.target.value) }))} />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCapModal(false)}>Cancel</Button>
            <Button onClick={addCapacity} disabled={!capForm.trade}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="pt-3 pb-2 px-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-base font-bold">{value}</p></CardContent></Card>
  );
}
