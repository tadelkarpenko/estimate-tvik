import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Contract, ChangeOrder, ContractAuditEntry, ChangeOrderType, PaymentMilestone } from '@/lib/contractTypes';
import { MARGIN_FIREWALL_THRESHOLD, PAYMENT_TEMPLATES } from '@/lib/contractTypes';
import type { EstimateLineItem } from '@/lib/types';
import {
  getContract, updateContract, getChangeOrders, saveChangeOrder,
  approveChangeOrder, getAuditLog, logAuditEntry, updateLineItemWIP,
  getCompletedLineItemsForDrift,
} from '@/lib/contractStore';
import { getEstimateLineItems, uid } from '@/lib/store';
import { recomputeContractWIP, computeCashForecast, computeTradeDrift, driftEntriesToFactors, type TradeDriftEntry } from '@/lib/contractEngine';
import { computeSubcontractExposure, propagateDelays, hasScheduleCompressionRisk } from '@/lib/phase5Engine';
import { computeContractDataQuality } from '@/lib/reliabilityEngine';
import {
  getSubcontracts, saveSubcontract, getSubcontractInvoices, getSchedulePhases,
  queueExecutionEvent, getLatestAdvisories, triggerIntelligenceProcessing,
  saveSchedulePhase,
} from '@/lib/phase5Store';
import {
  getContractMedia, saveContractMedia, deleteContractMedia,
  getContractMediaAnalysis, saveContractMediaAnalysis,
  type ContractMediaItem, type ContractMediaAnalysisItem,
} from '@/lib/contractMediaStore';
import type { Subcontract, SchedulePhase, ExecutionEvent } from '@/lib/phase5Types';
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
import { AlertTriangle, CheckCircle, Plus, Shield, TrendingUp, TrendingDown, FileText, Brain, Zap, Calendar, Clock, ImagePlus, Camera, Trash2 } from 'lucide-react';
import { MediaUploader } from '@/components/MediaUploader';
import { generateContractPDF } from '@/lib/pdfGenerator';
import { useToast } from '@/hooks/use-toast';

export default function ContractDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contract, setContract] = useState<Contract | null>(null);
  const [lineItems, setLineItems] = useState<EstimateLineItem[]>([]);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [auditLog, setAuditLog] = useState<ContractAuditEntry[]>([]);
  const [driftEntries, setDriftEntries] = useState<TradeDriftEntry[]>([]);
  const [subcontracts, setSubcontracts] = useState<Subcontract[]>([]);
  const [schedulePhases, setSchedulePhases] = useState<SchedulePhase[]>([]);
  const [advisories, setAdvisories] = useState<ExecutionEvent[]>([]);
  const [contractMedia, setContractMedia] = useState<ContractMediaItem[]>([]);
  const [mediaAnalyses, setMediaAnalyses] = useState<Record<string, ContractMediaAnalysisItem>>({});
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [analyzingMedia, setAnalyzingMedia] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingAI, setProcessingAI] = useState(false);
  const [coModal, setCoModal] = useState(false);
  const [coForm, setCoForm] = useState({ description: '', change_type: 'Scope Correction' as ChangeOrderType, delta_value: 0 });
  const [subModal, setSubModal] = useState(false);
  const [subForm, setSubForm] = useState({ vendor_name: '', trade: '', committed_cost: 0, estimated_trade_budget: 0 });
  const [phaseModal, setPhaseModal] = useState(false);
  const [phaseForm, setPhaseForm] = useState({ phase_name: '', planned_days: 0, planned_start: '', planned_finish: '', depends_on_phase: '' });
  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const c = await getContract(id);
      if (!c) { navigate('/contracts'); return; }
      setContract(c);
      const [items, cos, log, completedItems, subs, phases, advs, cMedia] = await Promise.all([
        getEstimateLineItems(c.estimate_id),
        getChangeOrders(c.id!),
        getAuditLog(c.id!),
        getCompletedLineItemsForDrift(),
        getSubcontracts(c.id!),
        getSchedulePhases(c.id!),
        getLatestAdvisories(c.id!),
        getContractMedia(c.id!),
      ]);
      setLineItems(items);
      setChangeOrders(cos);
      setAuditLog(log);
      setDriftEntries(computeTradeDrift(completedItems));
      setSubcontracts(subs);
      setSchedulePhases(phases);
      setAdvisories(advs);
      setContractMedia(cMedia);
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
    const prevPct = contract.percent_complete;
    const prevFade = contract.profit_fade_flag;
    const tradeDriftFactors = driftEntriesToFactors(driftEntries);
    const updates = recomputeContractWIP(contract, lineItems, tradeDriftFactors);
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
    // Queue async execution event
    await queueExecutionEvent({
      contract_id: contract.id!,
      event_type: 'wip_recompute',
      payload_json: JSON.stringify({
        event_type: 'wip_recompute',
        percent_complete_before: prevPct,
        margin_before: contract.margin_current_pct,
        profit_fade_before: prevFade,
      }),
      status: 'Queued',
      result_json: '{}',
    });
    // Fire async intelligence processing (non-blocking)
    triggerIntelligenceProcessing();
    toast({ title: 'WIP recomputed', description: 'AI advisory queued.' });
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
      const allCOs = await getChangeOrders(contract.id!);
      const approvedSum = allCOs.filter(c => c.approved || c.id === co.id).reduce((s, c) => s + c.delta_value, 0);
      const newNet = Math.round((contract.baseline_contract_value + approvedSum) * 100) / 100;
      await updateContract(contract.id!, { net_contract_value: newNet } as any);
      await logAuditEntry({
        contract_id: contract.id!, action_type: 'Change Order Approved',
        old_value: fmt(contract.net_contract_value), new_value: fmt(newNet),
        reason: `Approved ${co.change_order_id}: ${co.description}`,
      });
      // Queue event for AI analysis
      await queueExecutionEvent({
        contract_id: contract.id!,
        event_type: 'change_order_approved',
        payload_json: JSON.stringify({
          event_type: 'change_order_approved',
          margin_before: contract.margin_current_pct,
          profit_fade_before: contract.profit_fade_flag,
          co_delta: co.delta_value,
        }),
        status: 'Queued',
        result_json: '{}',
      });
      triggerIntelligenceProcessing();
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

  // Create subcontract
  const createSub = async () => {
    if (!contract || !subForm.vendor_name.trim()) return;
    const subId = `SUB-${contract.contract_id}-${subcontracts.length + 1}`;
    await saveSubcontract({
      subcontract_id: subId, contract_id: contract.id!,
      vendor_name: subForm.vendor_name, trade: subForm.trade,
      committed_cost: subForm.committed_cost, approved_cost: 0,
      estimated_trade_budget: subForm.estimated_trade_budget,
      remaining_commitment: subForm.committed_cost,
      exposure_index: subForm.estimated_trade_budget > 0 ? subForm.committed_cost / subForm.estimated_trade_budget : 0,
      status: 'Active', notes: '',
    });
    await logAuditEntry({
      contract_id: contract.id!, action_type: 'Subcontract Created',
      old_value: '', new_value: `${subId}: ${subForm.vendor_name} - ${fmt(subForm.committed_cost)}`,
      reason: `Trade: ${subForm.trade}`,
    });
    setSubModal(false);
    setSubForm({ vendor_name: '', trade: '', committed_cost: 0, estimated_trade_budget: 0 });
    toast({ title: 'Subcontract created' });
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
      <div className="grid grid-cols-2 lg:grid-cols-8 gap-3">
        <MiniCard label="Baseline" value={fmt(contract.baseline_contract_value)} />
        <MiniCard label="Net Value" value={fmt(contract.net_contract_value)} />
        <MiniCard label="% Complete" value={`${contract.percent_complete.toFixed(1)}%`} />
        <MiniCard label="Earned Rev" value={fmt(contract.earned_revenue)} />
        <MiniCard label="Proj. Profit" value={fmt(contract.projected_final_profit)} />
        <MiniCard label="Margin" value={pct(contract.margin_current_pct)} />
        <MiniCard label="Quadrant" value={(contract as any).risk_quadrant || 'Stable'} />
        <MiniCard label="Data Quality" value={`${computeContractDataQuality(lineItems.map(li => ({
          actual_labor_cost_to_date: (li as any).actual_labor_cost_to_date || 0,
          actual_material_cost_to_date: (li as any).actual_material_cost_to_date || 0,
          percent_complete: (li as any).percent_complete || 0,
          wip_status: (li as any).wip_status || 'Not Started',
        })))}%`} />
      </div>

      {/* Latest Advisory Banner */}
      {advisories.length > 0 && (() => {
        try {
          const latest = JSON.parse(advisories[0].result_json);
          if (latest.advisory_text) return (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-3 pb-2 px-4">
                <div className="flex items-start gap-2">
                  <Brain className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-primary">AI Advisory</span>
                      {latest.impact_level && <Badge variant="outline" className="text-xs">{latest.impact_level}</Badge>}
                      {latest.confidence && <Badge variant="secondary" className="text-xs">{latest.confidence}</Badge>}
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-line">{latest.advisory_text}</p>
                    <p className="text-xs text-muted-foreground mt-1">Generated {new Date(advisories[0].processed_at!).toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        } catch {}
        return null;
      })()}

      <div className="flex gap-2">
        <Button size="sm" onClick={recompute}>Recompute WIP</Button>
        <Button size="sm" variant="outline" onClick={async () => {
          setProcessingAI(true);
          try {
            await queueExecutionEvent({
              contract_id: contract.id!,
              event_type: 'manual_analysis',
              payload_json: JSON.stringify({
                event_type: 'manual_analysis',
                margin_before: contract.margin_current_pct,
                profit_fade_before: contract.profit_fade_flag,
                percent_complete_before: contract.percent_complete,
              }),
              status: 'Queued', result_json: '{}',
            });
            await triggerIntelligenceProcessing();
            toast({ title: 'AI analysis queued', description: 'Advisory will appear shortly.' });
            // Reload after a short delay to pick up results
            setTimeout(() => load(), 5000);
          } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
          finally { setProcessingAI(false); }
        }} disabled={processingAI}>
          <Brain className="h-3 w-3 mr-1" />{processingAI ? 'Processing…' : 'Run AI Analysis'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setCoModal(true)}><Plus className="h-3 w-3 mr-1" />Create Change Order</Button>
        <Button size="sm" variant="outline" onClick={() => generateContractPDF(contract, changeOrders)}>
          <FileText className="h-3 w-3 mr-1" />Export Financial PDF
        </Button>
      </div>

      <Tabs defaultValue="wip">
        <TabsList className="flex-wrap">
          <TabsTrigger value="wip">Line-Item WIP</TabsTrigger>
          <TabsTrigger value="change-orders">Change Orders ({changeOrders.length})</TabsTrigger>
          <TabsTrigger value="subcontracts">Subcontracts ({subcontracts.length})</TabsTrigger>
          <TabsTrigger value="schedule">Schedule{hasScheduleCompressionRisk(propagateDelays(schedulePhases)) ? ' ⚠' : ''} ({schedulePhases.length})</TabsTrigger>
          <TabsTrigger value="cash">Cash Forecast</TabsTrigger>
          <TabsTrigger value="drift">Trade Drift{driftEntries.some(d => d.alert) ? ' ⚠' : ''}</TabsTrigger>
          <TabsTrigger value="margin">Margin & Risk</TabsTrigger>
          <TabsTrigger value="advisories">
            AI Advisories{advisories.length > 0 ? ` (${advisories.length})` : ''}
            {advisories.length > 0 && <Zap className="h-3 w-3 ml-1 text-primary" />}
          </TabsTrigger>
          <TabsTrigger value="media">Media ({contractMedia.length})</TabsTrigger>
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

        {/* Subcontracts Tab */}
        <TabsContent value="subcontracts" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setSubModal(true)}><Plus className="h-3 w-3 mr-1" />Add Subcontract</Button>
          </div>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead className="text-right">Committed</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="text-right">Exposure</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subcontracts.map(sub => {
                    const exposure = computeSubcontractExposure(sub, []);
                    return (
                      <TableRow key={sub.id}>
                        <TableCell className="font-mono text-sm">{sub.subcontract_id}</TableCell>
                        <TableCell className="font-medium">{sub.vendor_name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{sub.trade}</Badge></TableCell>
                        <TableCell className="text-right">{fmt(sub.committed_cost)}</TableCell>
                        <TableCell className="text-right">{fmt(sub.estimated_trade_budget)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          <span className={exposure.overcommit_risk ? 'text-destructive' : ''}>{exposure.exposure_index.toFixed(3)}x</span>
                        </TableCell>
                        <TableCell>
                          {exposure.overcommit_risk ? (
                            <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Overcommit</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Normal</Badge>
                          )}
                        </TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{sub.status}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                  {subcontracts.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center py-4 text-muted-foreground">No subcontracts</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Phases Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setPhaseModal(true)}><Plus className="h-3 w-3 mr-1" />Add Phase</Button>
          </div>
          {hasScheduleCompressionRisk(propagateDelays(schedulePhases)) && (
            <Card className="border-destructive/30">
              <CardContent className="pt-3 pb-2 px-4">
                <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                  <AlertTriangle className="h-4 w-4" />⚠ Schedule Compression Risk — One or more phases have delay_ratio &gt; 1.15x
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" />Schedule Phases & Delay Propagation</CardTitle></CardHeader>
            <CardContent>
              {schedulePhases.length > 0 ? (() => {
                const propagated = propagateDelays(schedulePhases);
                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Phase</TableHead>
                        <TableHead>Planned Days</TableHead>
                        <TableHead>Actual Days</TableHead>
                        <TableHead>Delay Ratio</TableHead>
                        <TableHead>Depends On</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {propagated.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.phase_name}</TableCell>
                          <TableCell>{p.planned_days}d</TableCell>
                          <TableCell>{p.actual_days > 0 ? `${p.actual_days}d` : '—'}</TableCell>
                          <TableCell>
                            <span className={p.delay_ratio > 1.15 ? 'text-destructive font-bold' : p.delay_ratio > 1.0 ? 'text-amber-600' : ''}>
                              {p.delay_ratio.toFixed(2)}x
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">{p.depends_on_phase ? schedulePhases.find(s => s.id === p.depends_on_phase)?.phase_name || '—' : '—'}</TableCell>
                          <TableCell><Badge variant={p.status === 'Completed' ? 'default' : p.status === 'In Progress' ? 'secondary' : 'outline'} className="text-xs">{p.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                );
              })() : (
                <p className="text-center py-4 text-muted-foreground">No schedule phases defined. Add phases to track delay propagation.</p>
              )}
              <p className="text-xs text-muted-foreground mt-3">Delay ratio = actual_days ÷ planned_days. Downstream phases auto-shift when parent delayed. Compression risk at &gt;1.15x.</p>
            </CardContent>
          </Card>
        </TabsContent>

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

        {/* Trade Drift Tab */}
        <TabsContent value="drift" className="space-y-4">
          {driftEntries.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-muted-foreground">No completed line items with actuals yet. Complete WIP tracking to generate drift data.</CardContent></Card>
          ) : (
            <Card>
              <CardHeader><CardTitle className="text-sm">Trade Cost Drift Analysis</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trade</TableHead>
                      <TableHead className="text-right">Estimated Cost</TableHead>
                      <TableHead className="text-right">Actual Cost</TableHead>
                      <TableHead className="text-right">Drift Factor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {driftEntries.map(d => (
                      <TableRow key={d.trade}>
                        <TableCell className="font-medium">{d.trade}</TableCell>
                        <TableCell className="text-right">{fmt(d.estimated_cost)}</TableCell>
                        <TableCell className="text-right">{fmt(d.actual_cost)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          <span className={d.alert ? (d.drift_factor > 1 ? 'text-destructive' : 'text-green-600') : ''}>
                            {d.drift_factor.toFixed(3)}x
                          </span>
                        </TableCell>
                        <TableCell>
                          {d.alert ? (
                            <Badge variant="destructive" className="text-xs flex items-center gap-1 w-fit">
                              <AlertTriangle className="h-3 w-3" />
                              {d.drift_factor > 1.12 ? 'Over budget' : 'Under budget'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Normal</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-3">
                  Drift factor = actual cost ÷ estimated cost. Alert threshold: &gt;1.12x or &lt;0.90x.
                  Drift factors are applied automatically during WIP recompute to adjust projected costs.
                  AI may suggest CostLibrary review — no auto-updates.
                </p>
              </CardContent>
            </Card>
          )}
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

        {/* AI Advisories Tab */}
        <TabsContent value="advisories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4" />Execution Intelligence Advisories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <MiniCard label="Risk Score" value={String((contract as any).margin_risk_score || 0)} />
                <MiniCard label="Opportunity Score" value={String((contract as any).margin_opportunity_score || 0)} />
                <MiniCard label="Exec Priority" value={String((contract as any).execution_priority_score || 0)} />
                <MiniCard label="Quadrant" value={(contract as any).risk_quadrant || 'Stable'} />
              </div>

              {advisories.length > 0 ? (
                <div className="space-y-3">
                  {advisories.map((adv, i) => {
                    let result: any = {};
                    try { result = JSON.parse(adv.result_json); } catch {}
                    return (
                      <Card key={adv.id || i} className="border-muted">
                        <CardContent className="pt-3 pb-2 px-4">
                          <div className="flex items-start gap-2">
                            <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">{adv.event_type}</Badge>
                                {result.impact_level && <Badge variant={result.impact_level === 'Critical' ? 'destructive' : 'secondary'} className="text-xs">{result.impact_level}</Badge>}
                                {result.confidence && <span className="text-xs text-muted-foreground">Confidence: {result.confidence}</span>}
                              </div>
                              <p className="text-sm whitespace-pre-line">{result.advisory_text || 'No advisory text'}</p>
                              {result.margin_risk_score !== undefined && (
                                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                                  <span>Risk: {result.margin_risk_score}</span>
                                  <span>Opportunity: {result.margin_opportunity_score}</span>
                                  <span>Priority: {result.execution_priority_score}</span>
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {adv.processed_at ? new Date(adv.processed_at).toLocaleString() : 'Processing…'}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center py-6 text-muted-foreground">No advisories yet. Click "Run AI Analysis" or recompute WIP to generate advisories.</p>
              )}

              <div className="mt-3 p-3 bg-muted/50 rounded-md text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Debounce Rules:</p>
                <p>• Max 1 advisory per contract per 10 minutes</p>
                <p>• Max 5 advisories per contract per 24 hours</p>
                <p>• AI is advisory only — no financial modifications</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Media Tab */}
        <TabsContent value="media" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Photos & Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Real file upload */}
              <MediaUploader
                folder="contracts"
                onUploaded={async (url, cap) => {
                  if (!contract) return;
                  await saveContractMedia({
                    media_id: uid(), contract_id: contract.id!,
                    file_url: url, caption: cap,
                    include_in_internal_pdf: true,
                  });
                  await load();
                }}
              />

              {/* Gallery */}
              {contractMedia.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No media uploaded yet.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {contractMedia.map(m => (
                    <div key={m.id} className="border rounded-lg overflow-hidden">
                      <img src={m.file_url} alt={m.caption} className="w-full h-32 object-cover" />
                      <div className="p-2 space-y-1">
                        <p className="text-xs font-medium truncate">{m.caption || 'No caption'}</p>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="text-xs h-7"
                            disabled={analyzingMedia === m.id}
                            onClick={async () => {
                              if (!m.id) return;
                              setAnalyzingMedia(m.id);
                              try {
                                const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-ai`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                                  },
                                  body: JSON.stringify({ action: 'photo_analyze', data: { image_url: m.file_url, caption: m.caption } }),
                                });
                                const result = await resp.json();
                                const content = result.content || '';
                                let parsed: any = {};
                                try { const jm = content.match(/```json\s*([\s\S]*?)\s*```/); parsed = jm ? JSON.parse(jm[1]) : JSON.parse(content); } catch {}
                                const analysis: ContractMediaAnalysisItem = {
                                  analysis_id: uid(), media_id: m.id!,
                                  observed_conditions_json: JSON.stringify(parsed.observed_conditions || ''),
                                  conditional_items_json: JSON.stringify(parsed.suggested_scope_impacts || []),
                                  allowance_risk_flags_json: JSON.stringify(parsed.risk_flags || []),
                                  questions_needed_json: JSON.stringify(parsed.questions_needed || []),
                                  confidence: parsed.ai_confidence || 'Medium',
                                };
                                await saveContractMediaAnalysis(analysis);
                                setMediaAnalyses(prev => ({ ...prev, [m.id!]: analysis }));
                                toast({ title: 'Photo analyzed' });
                              } catch (e: any) { toast({ title: 'Analysis error', description: e.message, variant: 'destructive' }); }
                              finally { setAnalyzingMedia(null); }
                            }}>
                            <Camera className="h-3 w-3 mr-1" />{analyzingMedia === m.id ? 'Analyzing...' : 'Analyze'}
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive"
                            onClick={async () => { await deleteContractMedia(m.media_id); toast({ title: 'Photo removed' }); await load(); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {/* Analysis results */}
                        {mediaAnalyses[m.id!] && (() => {
                          const a = mediaAnalyses[m.id!];
                          let conditions = ''; try { conditions = JSON.parse(a.observed_conditions_json); } catch { conditions = a.observed_conditions_json; }
                          let risks = ''; try { risks = JSON.parse(a.allowance_risk_flags_json); } catch { risks = a.allowance_risk_flags_json; }
                          return (
                            <div className="text-xs space-y-1 mt-1 p-2 bg-muted rounded">
                              <p><strong>Conditions:</strong> {typeof conditions === 'string' ? conditions : JSON.stringify(conditions)}</p>
                              <p><strong>Risks:</strong> {typeof risks === 'string' ? risks : JSON.stringify(risks)}</p>
                              <Badge variant="outline" className="text-xs">{a.confidence}</Badge>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

      {/* Create Subcontract Modal */}
      <Dialog open={subModal} onOpenChange={setSubModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Subcontract</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Vendor Name</Label><Input value={subForm.vendor_name} onChange={e => setSubForm(p => ({ ...p, vendor_name: e.target.value }))} /></div>
            <div><Label>Trade</Label><Input value={subForm.trade} onChange={e => setSubForm(p => ({ ...p, trade: e.target.value }))} placeholder="e.g. Plumbing, Electrical" /></div>
            <div><Label>Committed Cost ($)</Label><Input type="number" step="0.01" value={subForm.committed_cost || ''} onChange={e => setSubForm(p => ({ ...p, committed_cost: Number(e.target.value) }))} /></div>
            <div><Label>Estimated Trade Budget ($)</Label><Input type="number" step="0.01" value={subForm.estimated_trade_budget || ''} onChange={e => setSubForm(p => ({ ...p, estimated_trade_budget: Number(e.target.value) }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubModal(false)}>Cancel</Button>
            <Button onClick={createSub} disabled={!subForm.vendor_name.trim()}>Create</Button>
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

      {/* Add Schedule Phase Modal */}
      <Dialog open={phaseModal} onOpenChange={setPhaseModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Schedule Phase</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Phase Name</Label><Input value={phaseForm.phase_name} onChange={e => setPhaseForm(p => ({ ...p, phase_name: e.target.value }))} placeholder="e.g. Framing, Drywall, Paint" /></div>
            <div><Label>Planned Days</Label><Input type="number" value={phaseForm.planned_days || ''} onChange={e => setPhaseForm(p => ({ ...p, planned_days: Number(e.target.value) }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Planned Start</Label><Input type="date" value={phaseForm.planned_start} onChange={e => setPhaseForm(p => ({ ...p, planned_start: e.target.value }))} /></div>
              <div><Label>Planned Finish</Label><Input type="date" value={phaseForm.planned_finish} onChange={e => setPhaseForm(p => ({ ...p, planned_finish: e.target.value }))} /></div>
            </div>
            {schedulePhases.length > 0 && (
              <div>
                <Label>Depends On Phase</Label>
                <Select value={phaseForm.depends_on_phase || 'none'} onValueChange={v => setPhaseForm(p => ({ ...p, depends_on_phase: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {schedulePhases.map(sp => (
                      <SelectItem key={sp.id} value={sp.id!}>{sp.phase_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhaseModal(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!contract || !phaseForm.phase_name) return;
              await saveSchedulePhase({
                contract_id: contract.id!,
                phase_name: phaseForm.phase_name,
                planned_days: phaseForm.planned_days,
                actual_days: 0,
                delay_ratio: 1.0,
                planned_start: phaseForm.planned_start || null,
                planned_finish: phaseForm.planned_finish || null,
                actual_start: null,
                actual_finish: null,
                depends_on_phase: phaseForm.depends_on_phase || null,
                status: 'Not Started',
              });
              setPhaseModal(false);
              setPhaseForm({ phase_name: '', planned_days: 0, planned_start: '', planned_finish: '', depends_on_phase: '' });
              toast({ title: 'Schedule phase added' });
              await load();
            }} disabled={!phaseForm.phase_name}>Create</Button>
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
