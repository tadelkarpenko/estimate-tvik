import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Contract, ChangeOrder, ContractAuditEntry, ChangeOrderType, PaymentMilestone } from '@/lib/contractTypes';
import { MARGIN_FIREWALL_THRESHOLD, PAYMENT_TEMPLATES } from '@/lib/contractTypes';
import type { EstimateLineItem } from '@/lib/types';
import {
  getContract, updateContract, getChangeOrders, saveChangeOrder,
  approveChangeOrder, getAuditLog, logAuditEntry, updateLineItemWIP,
} from '@/lib/contractStore';
import { getEstimateLineItems } from '@/lib/store';
import { recomputeContractWIP, computeCashForecast } from '@/lib/contractEngine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle, Plus, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ContractDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contract, setContract] = useState<Contract | null>(null);
  const [lineItems, setLineItems] = useState<EstimateLineItem[]>([]);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [auditLog, setAuditLog] = useState<ContractAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [coModal, setCoModal] = useState(false);
  const [coForm, setCoForm] = useState({ description: '', change_type: 'Scope Correction' as ChangeOrderType, delta_value: 0 });
  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const c = await getContract(id);
      if (!c) { navigate('/contracts'); return; }
      setContract(c);
      const [items, cos, log] = await Promise.all([
        getEstimateLineItems(c.estimate_id),
        getChangeOrders(c.id!),
        getAuditLog(c.id!),
      ]);
      setLineItems(items);
      setChangeOrders(cos);
      setAuditLog(log);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (n: number) => (n * 100).toFixed(1) + '%';

  // Margin firewall check
  const checkMarginFirewall = (action: () => Promise<void>) => {
    if (contract && contract.margin_current_pct < MARGIN_FIREWALL_THRESHOLD) {
      setPendingAction(() => action);
      setOverrideModal(true);
      return;
    }
    action();
  };

  const executeOverride = async () => {
    if (!overrideReason.trim() || !pendingAction || !contract) return;
    await logAuditEntry({
      contract_id: contract.id!, action_type: 'Margin Override',
      old_value: pct(contract.margin_current_pct), new_value: `Override approved`,
      reason: overrideReason,
    });
    await pendingAction();
    setOverrideModal(false);
    setOverrideReason('');
    setPendingAction(null);
    await load();
  };

  // WIP recompute
  const recompute = async () => {
    if (!contract) return;
    const updates = recomputeContractWIP(contract, lineItems);
    // Cash forecast
    let milestones: PaymentMilestone[] = [];
    try { milestones = JSON.parse(contract.payment_schedule_json); } catch {}
    const forecast = computeCashForecast(milestones, contract.net_contract_value, updates.percent_complete || 0);
    const fullUpdates = { ...updates, ...forecast };
    await updateContract(contract.id!, fullUpdates);
    await logAuditEntry({
      contract_id: contract.id!, action_type: 'WIP Recompute',
      old_value: `${contract.percent_complete}% / ${fmt(contract.projected_final_cost)}`,
      new_value: `${updates.percent_complete}% / ${fmt(updates.projected_final_cost || 0)}`,
      reason: 'Manual recompute',
    });
    toast({ title: 'WIP recomputed' });
    await load();
  };

  // Create change order
  const createCO = async () => {
    if (!contract || !coForm.description.trim()) return;
    const coId = `CO-${contract.contract_id}-${changeOrders.length + 1}`;
    await saveChangeOrder({
      change_order_id: coId, contract_id: contract.id!,
      description: coForm.description, change_type: coForm.change_type,
      delta_value: coForm.delta_value, approved: false, override_reason: '',
    });
    await logAuditEntry({
      contract_id: contract.id!, action_type: 'Change Order Created',
      old_value: '', new_value: `${coId}: ${fmt(coForm.delta_value)}`,
      reason: coForm.description,
    });
    setCoModal(false);
    setCoForm({ description: '', change_type: 'Scope Correction', delta_value: 0 });
    toast({ title: 'Change order created' });
    await load();
  };

  // Approve change order
  const approveCO = async (co: ChangeOrder) => {
    if (!contract) return;
    const doApprove = async () => {
      await approveChangeOrder(co.id!);
      // Recompute net_contract_value
      const allCOs = await getChangeOrders(contract.id!);
      const approvedSum = allCOs.filter(c => c.approved || c.id === co.id).reduce((s, c) => s + c.delta_value, 0);
      const newNet = Math.round((contract.baseline_contract_value + approvedSum) * 100) / 100;
      await updateContract(contract.id!, { net_contract_value: newNet } as any);
      await logAuditEntry({
        contract_id: contract.id!, action_type: 'Change Order Approved',
        old_value: fmt(contract.net_contract_value), new_value: fmt(newNet),
        reason: `Approved ${co.change_order_id}: ${co.description}`,
      });
      toast({ title: 'Change order approved', description: `Net value: ${fmt(newNet)}` });
      await load();
    };
    checkMarginFirewall(doApprove);
  };

  // Update line item WIP
  const updateItemWIP = async (item: EstimateLineItem, field: string, value: number) => {
    if (!item.id || !contract) return;
    const updates: any = { [field]: value };
    // Auto-set wip_status based on percent_complete
    if (field === 'percent_complete') {
      if (value >= 100) { updates.wip_status = 'Completed'; updates.percent_complete = 100; }
      else if (value > 0) updates.wip_status = 'In Progress';
      else updates.wip_status = 'Not Started';
    }
    await updateLineItemWIP(item.id, updates);
    await logAuditEntry({
      contract_id: contract.id!, action_type: 'WIP Line Item Update',
      old_value: `${item.description}: ${field}=${(item as any)[field] || 0}`,
      new_value: `${item.description}: ${field}=${value}`,
      reason: 'Manual update',
    });
    await load();
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading…</div>;
  if (!contract) return <div className="py-8 text-center text-muted-foreground">Contract not found</div>;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{contract.contract_id}</h1>
          <p className="text-sm text-muted-foreground">Signed {new Date(contract.signed_date).toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={contract.contract_status === 'Active' ? 'default' : 'secondary'}>{contract.contract_status}</Badge>
          {contract.profit_fade_flag && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />Profit Fade
            </Badge>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <MiniCard label="Baseline" value={fmt(contract.baseline_contract_value)} />
        <MiniCard label="Net Value" value={fmt(contract.net_contract_value)} />
        <MiniCard label="% Complete" value={`${contract.percent_complete.toFixed(1)}%`} />
        <MiniCard label="Earned Rev" value={fmt(contract.earned_revenue)} />
        <MiniCard label="Proj. Profit" value={fmt(contract.projected_final_profit)} />
        <MiniCard label="Margin" value={pct(contract.margin_current_pct)} />
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={recompute}>Recompute WIP</Button>
        <Button size="sm" variant="outline" onClick={() => setCoModal(true)}><Plus className="h-3 w-3 mr-1" />Create Change Order</Button>
      </div>

      <Tabs defaultValue="wip">
        <TabsList>
          <TabsTrigger value="wip">Line-Item WIP</TabsTrigger>
          <TabsTrigger value="change-orders">Change Orders ({changeOrders.length})</TabsTrigger>
          <TabsTrigger value="cash">Cash Forecast</TabsTrigger>
          <TabsTrigger value="margin">Margin & Risk</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* WIP Tab */}
        <TabsContent value="wip" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Phase</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                      <TableHead>WIP Status</TableHead>
                      <TableHead className="text-right">% Complete</TableHead>
                      <TableHead className="text-right">Actual Labor</TableHead>
                      <TableHead className="text-right">Actual Material</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map(li => (
                      <TableRow key={li.line_id}>
                        <TableCell className="font-medium">{li.description}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{li.phase}</Badge></TableCell>
                        <TableCell className="text-right">{fmt(li.line_total)}</TableCell>
                        <TableCell>
                          <Badge variant={(li as any).wip_status === 'Completed' ? 'default' : (li as any).wip_status === 'In Progress' ? 'secondary' : 'outline'}>
                            {(li as any).wip_status || 'Not Started'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input type="number" className="w-20 h-7 text-sm inline-block"
                            value={(li as any).percent_complete || 0} min={0} max={100}
                            onChange={e => updateItemWIP(li, 'percent_complete', Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input type="number" className="w-24 h-7 text-sm inline-block" step="0.01"
                            value={(li as any).actual_labor_cost_to_date || 0}
                            onChange={e => updateItemWIP(li, 'actual_labor_cost_to_date', Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input type="number" className="w-24 h-7 text-sm inline-block" step="0.01"
                            value={(li as any).actual_material_cost_to_date || 0}
                            onChange={e => updateItemWIP(li, 'actual_material_cost_to_date', Number(e.target.value))}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Change Orders Tab */}
        <TabsContent value="change-orders" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CO ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Delta</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changeOrders.map(co => (
                    <TableRow key={co.id}>
                      <TableCell className="font-mono text-sm">{co.change_order_id}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{co.change_type}</Badge></TableCell>
                      <TableCell>{co.description}</TableCell>
                      <TableCell className={`text-right font-medium ${co.delta_value >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {co.delta_value >= 0 ? '+' : ''}{fmt(co.delta_value)}
                      </TableCell>
                      <TableCell>
                        {co.approved
                          ? <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>
                          : <Badge variant="destructive">Pending</Badge>
                        }
                      </TableCell>
                      <TableCell>
                        {!co.approved && (
                          <Button size="sm" variant="outline" onClick={() => approveCO(co)}>Approve</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {changeOrders.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No change orders</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Forecast Tab */}
        <TabsContent value="cash" className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <MiniCard label="30-Day Forecast" value={fmt(contract.cash_forecast_30)} />
            <MiniCard label="60-Day Forecast" value={fmt(contract.cash_forecast_60)} />
            <MiniCard label="90-Day Forecast" value={fmt(contract.cash_forecast_90)} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Payment Schedule ({contract.payment_terms_template})</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                let milestones: PaymentMilestone[] = [];
                try { milestones = JSON.parse(contract.payment_schedule_json); } catch {}
                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Milestone</TableHead>
                        <TableHead className="text-right">%</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Trigger</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {milestones.map((m, i) => {
                        const amount = Math.round(contract.net_contract_value * (m.percent / 100) * 100) / 100;
                        const triggered = typeof m.trigger_value === 'number' && contract.percent_complete >= m.trigger_value;
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{m.label}</TableCell>
                            <TableCell className="text-right">{m.percent}%</TableCell>
                            <TableCell className="text-right">{fmt(amount)}</TableCell>
                            <TableCell>At {m.trigger_value}% complete</TableCell>
                            <TableCell>
                              {m.paid ? <Badge className="bg-green-100 text-green-800">Paid</Badge>
                                : triggered ? <Badge variant="secondary">Due</Badge>
                                : <Badge variant="outline">Pending</Badge>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Margin & Risk Tab */}
        <TabsContent value="margin" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniCard label="Baseline Margin" value={pct(contract.baseline_margin_pct)} />
            <MiniCard label="Current Margin" value={pct(contract.margin_current_pct)} />
            <MiniCard label="Baseline Risk" value={fmt(contract.baseline_risk_exposure)} />
            <MiniCard label="Proj. Final Cost" value={fmt(contract.projected_final_cost)} />
          </div>

          {contract.profit_fade_flag && (
            <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-destructive font-medium">⚠ Profit Fade: Margin dropped more than 5 pts from baseline ({pct(contract.baseline_margin_pct)} → {pct(contract.margin_current_pct)})</span>
            </div>
          )}

          {contract.margin_current_pct < MARGIN_FIREWALL_THRESHOLD && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-md p-3 text-sm">
              <Shield className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-amber-800">Margin Firewall: Current margin ({pct(contract.margin_current_pct)}) is below {(MARGIN_FIREWALL_THRESHOLD * 100).toFixed(0)}% threshold. Override required for financial actions.</span>
            </div>
          )}

          <Card>
            <CardHeader><CardTitle className="text-sm">Financial Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm font-mono">
              <p>Baseline Contract: <strong>{fmt(contract.baseline_contract_value)}</strong></p>
              <p>Approved COs: <strong>{fmt(contract.net_contract_value - contract.baseline_contract_value)}</strong></p>
              <p>Net Contract Value: <strong>{fmt(contract.net_contract_value)}</strong></p>
              <hr className="my-2 border-border" />
              <p>Projected Final Cost: <strong>{fmt(contract.projected_final_cost)}</strong></p>
              <p>Projected Profit: <strong>{fmt(contract.projected_final_profit)}</strong></p>
              <p>Current Margin: <strong>{pct(contract.margin_current_pct)}</strong></p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Old Value</TableHead>
                    <TableHead>New Value</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLog.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(entry.created_at!).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{entry.action_type}</Badge></TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate">{entry.old_value}</TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate">{entry.new_value}</TableCell>
                      <TableCell className="text-sm">{entry.reason}</TableCell>
                    </TableRow>
                  ))}
                  {auditLog.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No audit entries</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create CO Modal */}
      <Dialog open={coModal} onOpenChange={setCoModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Change Order</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Description</Label><Textarea value={coForm.description} onChange={e => setCoForm(p => ({ ...p, description: e.target.value }))} rows={3} /></div>
            <div>
              <Label>Type</Label>
              <Select value={coForm.change_type} onValueChange={v => setCoForm(p => ({ ...p, change_type: v as ChangeOrderType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Client Upgrade">Client Upgrade</SelectItem>
                  <SelectItem value="Hidden Condition">Hidden Condition</SelectItem>
                  <SelectItem value="Design Change">Design Change</SelectItem>
                  <SelectItem value="Scope Correction">Scope Correction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Delta Value ($)</Label><Input type="number" step="0.01" value={coForm.delta_value || ''} onChange={e => setCoForm(p => ({ ...p, delta_value: Number(e.target.value) }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCoModal(false)}>Cancel</Button>
            <Button onClick={createCO} disabled={!coForm.description.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Margin Override Modal */}
      <Dialog open={overrideModal} onOpenChange={setOverrideModal}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-destructive" />Margin Firewall</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Current margin ({pct(contract.margin_current_pct)}) is below the {(MARGIN_FIREWALL_THRESHOLD * 100).toFixed(0)}% threshold.
              An override reason is required to proceed.
            </p>
            <div>
              <Label>Override Reason (mandatory)</Label>
              <Textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)} rows={3} placeholder="Explain why this action is justified..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOverrideModal(false); setPendingAction(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={executeOverride} disabled={!overrideReason.trim()}>Override & Proceed</Button>
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
