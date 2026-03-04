import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Estimate, EstimateStatus, ProjectType, FinishLevel, EstimateLineItem, EstimateMedia, EstimateChatThread, EstimateChatMessage } from '@/lib/types';
import {
  getEstimate, saveEstimate, nextEstimateId, uid, getCostLibrary, getRiskLibrary,
  getRevisionLogs, saveRevisionLog, updateEstimateStatus, initStore, getEstimateDbId,
  getEstimateLineItems, upsertEstimateLineItems, deleteCostLibraryLineItems,
  getEstimateMedia, saveEstimateMedia, deleteEstimateMedia,
  getChatThreads, createChatThread, getChatMessages, saveChatMessage,
} from '@/lib/store';
import { runCostEngine } from '@/lib/costEngine';
import { runRiskEngine } from '@/lib/riskEngine';
import { generateAssumptions, generateTimeline, generateScopeAI, generateAuditAI } from '@/lib/generators';
import { generatePublicPDF, generateInternalPDF } from '@/lib/pdfGenerator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Copy, FileDown, Send, CheckCircle, XCircle, Plus, Trash2, ImagePlus, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { EstimateRevisionLog } from '@/lib/types';

const defaultEst: Partial<Estimate> = {
  status: 'Draft', created_by: 'TVIK', state: 'IL', project_type: 'Full Rehab',
  finish_level: 'Basic', finish_materials_included: false, overhead_pct: 0.10,
  profit_pct: 0.20, contingency_pct: 0.10, sqft: 0, fixture_count: 0, labor_hours: 0, version: 'v1.0',
  client_name: '', client_email: '', client_phone: '', project_address: '', city: '', zip: '',
  project_name: '', labor_subtotal: 0, material_subtotal: 0, subtotal: 0, risk_cost_low: 0,
  risk_cost_high: 0, overall_risk_level: 'Low', total_low: 0, total_high: 0,
  assumptions_rich: '', timeline_rich: '', ai_scope: '', ai_price_audit_summary: '',
  cost_structure_json: '[]', line_items_json: '[]', risk_table_json: '[]',
  public_pdf_url: '', internal_pdf_url: '', last_revision_summary: '',
  crew_size: 2, hours_per_day: 8, subtotal_labor_hours: 0, estimated_duration_days: 0,
  internal_notes: '', public_notes: '',
};

export default function NewEstimate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<Estimate>>({ ...defaultEst });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [advOpen, setAdvOpen] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [revisions, setRevisions] = useState<EstimateRevisionLog[]>([]);
  const [dbLineItems, setDbLineItems] = useState<EstimateLineItem[]>([]);
  const [media, setMedia] = useState<EstimateMedia[]>([]);
  const [chatThreads, setChatThreads] = useState<EstimateChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<EstimateChatThread | null>(null);
  const [chatMessages, setChatMessages] = useState<EstimateChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [estimateDbId, setEstimateDbId] = useState<string | undefined>();
  const isEdit = !!id;

  useEffect(() => {
    (async () => {
      await initStore();
      if (id) {
        const existing = await getEstimate(id);
        if (existing) {
          setForm(existing);
          const [revs, dbId] = await Promise.all([getRevisionLogs(id), getEstimateDbId(id)]);
          setRevisions(revs);
          if (dbId) {
            setEstimateDbId(dbId);
            const [items, med, threads] = await Promise.all([
              getEstimateLineItems(dbId), getEstimateMedia(dbId), getChatThreads(dbId),
            ]);
            setDbLineItems(items);
            setMedia(med);
            setChatThreads(threads);
          }
        } else {
          navigate('/estimates', { replace: true });
        }
      }
      setLoading(false);
    })();
  }, [id]);

  const update = (updates: Partial<Estimate>) => setForm(prev => ({ ...prev, ...updates }));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.project_type) errs.project_type = 'Project type required';
    if (form.project_type !== 'Small Job' && (!form.sqft || form.sqft <= 0)) errs.sqft = 'Square footage required';
    if ((form.project_type === 'Bath' || form.project_type === 'Kitchen') && (!form.fixture_count || form.fixture_count <= 0))
      errs.fixture_count = 'Fixture count required';
    if (form.project_type === 'Small Job' && (!form.labor_hours || form.labor_hours <= 0))
      errs.labor_hours = 'Labor hours required for Small Jobs';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveDraft = async () => {
    const estId = form.estimate_id || await nextEstimateId();
    const est: Estimate = {
      ...defaultEst, ...form,
      estimate_id: estId,
      created_at: form.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Estimate;
    await saveEstimate(est);
    update({ estimate_id: est.estimate_id, created_at: est.created_at });
    const dbId = await getEstimateDbId(estId);
    if (dbId) setEstimateDbId(dbId);
    toast({ title: 'Draft saved', description: est.estimate_id });
  };

  const generate = async () => {
    if (!validate()) { toast({ title: 'Validation failed', variant: 'destructive' }); return; }
    setGenerating(true);

    try {
      // Ensure estimate is saved first to get DB id
      const estId = form.estimate_id || await nextEstimateId();
      const preEst: Estimate = {
        ...defaultEst, ...form,
        estimate_id: estId,
        created_at: form.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Estimate;
      await saveEstimate(preEst);
      const dbId = await getEstimateDbId(estId);
      if (!dbId) throw new Error('Could not resolve estimate DB id');
      setEstimateDbId(dbId);

      const costLib = await getCostLibrary();
      const riskLib = await getRiskLibrary();

      // Delete old CostLibrary-sourced lines (keep Manual lines)
      await deleteCostLibraryLineItems(dbId);

      const costResult = runCostEngine({
        project_type: form.project_type as ProjectType,
        sqft: form.sqft!,
        fixture_count: form.fixture_count || 0,
        labor_hours: form.labor_hours || 0,
        finish_level: form.finish_level as FinishLevel,
        finish_materials_included: form.finish_materials_included!,
        costLibrary: costLib,
        estimate_db_id: dbId,
        crew_size: form.crew_size || 2,
        hours_per_day: form.hours_per_day || 8,
      });

      // Upsert generated line items to DB
      await upsertEstimateLineItems(costResult.line_items);
      setDbLineItems(costResult.line_items);

      const riskResult = runRiskEngine({ project_type: form.project_type as ProjectType, subtotal: costResult.subtotal, riskLibrary: riskLib });

      const marginMult = (1 + (form.overhead_pct || 0.1)) * (1 + (form.profit_pct || 0.2)) * (1 + (form.contingency_pct || 0.1));
      const total_low = Math.round((costResult.subtotal + riskResult.risk_cost_low) * marginMult * 100) / 100;
      const total_high = Math.round((costResult.subtotal + riskResult.risk_cost_high) * marginMult * 100) / 100;

      const partial: Partial<Estimate> = {
        labor_subtotal: costResult.labor_subtotal,
        material_subtotal: costResult.material_subtotal,
        subtotal: costResult.subtotal,
        subtotal_labor_hours: costResult.subtotal_labor_hours,
        estimated_duration_days: costResult.estimated_duration_days,
        line_items_json: JSON.stringify(costResult.legacy_line_items),
        cost_structure_json: JSON.stringify(costResult.cost_structure),
        risk_cost_low: riskResult.risk_cost_low,
        risk_cost_high: riskResult.risk_cost_high,
        overall_risk_level: riskResult.overall_risk_level,
        risk_table_json: JSON.stringify(riskResult.risk_table),
        total_low, total_high,
      };
      const merged = { ...form, ...partial, estimate_id: estId };
      merged.assumptions_rich = generateAssumptions(merged);
      merged.timeline_rich = generateTimeline(merged);
      merged.created_at = merged.created_at || new Date().toISOString();
      merged.status = 'Ready' as EstimateStatus;

      toast({ title: 'Running AI analysis...', description: 'Generating scope & audit via AI' });
      const [scope, audit] = await Promise.all([
        generateScopeAI(merged),
        generateAuditAI({ ...merged, estimate_id: estId }),
      ]);
      merged.ai_scope = scope;
      merged.ai_price_audit_summary = audit;

      const est: Estimate = { ...defaultEst, ...merged, updated_at: new Date().toISOString() } as Estimate;
      await saveEstimate(est);
      setForm(est);
      toast({ title: 'Estimate generated', description: `${est.estimate_id} — $${est.total_low.toLocaleString()} – $${est.total_high.toLocaleString()}` });
    } catch (e) {
      console.error('Generate error:', e);
      toast({ title: 'Generation error', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const createRevision = async () => {
    const summary = prompt('Change summary (required):');
    if (!summary) return;
    const prevVersion = form.version || 'v1.0';
    const parts = prevVersion.replace('v', '').split('.');
    const newVersion = `v${parts[0]}.${parseInt(parts[1] || '0') + 1}`;
    await saveRevisionLog({
      id: uid(), estimate_id: form.estimate_id!, created_at: new Date().toISOString(),
      version: prevVersion, change_summary: summary, snapshot_json: JSON.stringify(form),
      delta_low: 0, delta_high: 0,
    });
    update({ version: newVersion, last_revision_summary: summary });
    const revs = await getRevisionLogs(form.estimate_id);
    setRevisions(revs);
    toast({ title: 'Revision created', description: newVersion });
  };

  const duplicate = async () => {
    const newId = await nextEstimateId();
    const dup: Estimate = { ...defaultEst, ...form, estimate_id: newId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: 'Draft', version: 'v1.0' } as Estimate;
    await saveEstimate(dup);
    navigate(`/estimates/${newId}`);
    toast({ title: 'Estimate duplicated', description: newId });
  };

  const setStatus = async (status: EstimateStatus) => {
    if (!form.estimate_id) return;
    await updateEstimateStatus(form.estimate_id, status);
    update({ status });
    toast({ title: `Marked as ${status}` });
  };

  // ─── Media handlers ───
  const addMedia = async () => {
    if (!mediaUrl || !estimateDbId) return;
    const m: EstimateMedia = {
      media_id: uid(), estimate_id: estimateDbId,
      file_url: mediaUrl, caption: mediaCaption,
      include_in_internal_pdf: true, include_in_public_pdf: false,
    };
    await saveEstimateMedia(m);
    setMedia(prev => [...prev, m]);
    setMediaUrl(''); setMediaCaption('');
    toast({ title: 'Media added' });
  };

  const removeMedia = async (mediaId: string) => {
    await deleteEstimateMedia(mediaId);
    setMedia(prev => prev.filter(m => m.media_id !== mediaId));
  };

  // ─── Chat handlers ───
  const loadThread = useCallback(async (thread: EstimateChatThread) => {
    setActiveThread(thread);
    if (thread.id) {
      const msgs = await getChatMessages(thread.id);
      setChatMessages(msgs);
    }
  }, []);

  const newThread = async () => {
    if (!estimateDbId) return;
    const title = prompt('Thread title:') || 'New Thread';
    const thread: EstimateChatThread = { thread_id: uid(), estimate_id: estimateDbId, title };
    const dbId = await createChatThread(thread);
    thread.id = dbId;
    setChatThreads(prev => [...prev, thread]);
    loadThread(thread);
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || !activeThread?.id) return;
    const msg: EstimateChatMessage = {
      message_id: uid(), thread_id: activeThread.id, role: 'user', content: chatInput,
    };
    await saveChatMessage(msg);
    setChatMessages(prev => [...prev, msg]);
    setChatInput('');
  };

  const costStructure = form.cost_structure_json ? JSON.parse(form.cost_structure_json) : [];
  const riskTable = form.risk_table_json ? JSON.parse(form.risk_table_json) : [];
  const fmt = (n?: number) => '$' + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isEdit ? `Edit ${form.estimate_id}` : 'New Estimate'}</h1>
        {form.estimate_id && <Badge>{form.status}</Badge>}
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Project Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Project Type *</Label>
                <Select value={form.project_type} onValueChange={v => update({ project_type: v as ProjectType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bath">Bath</SelectItem>
                    <SelectItem value="Full Rehab">Full Rehab</SelectItem>
                    <SelectItem value="Kitchen">Kitchen</SelectItem>
                    <SelectItem value="Small Job">Small Job</SelectItem>
                  </SelectContent>
                </Select>
                {errors.project_type && <p className="text-xs text-destructive mt-1">{errors.project_type}</p>}
              </div>
              <div>
                <Label>Finish Level</Label>
                <Select value={form.finish_level} onValueChange={v => update({ finish_level: v as FinishLevel })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Basic">Basic</SelectItem><SelectItem value="Mid">Mid</SelectItem><SelectItem value="High">High</SelectItem><SelectItem value="Luxury">Luxury</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {form.project_type !== 'Small Job' && (
                <div>
                  <Label>Square Footage *</Label>
                  <Input type="number" value={form.sqft || ''} onChange={e => update({ sqft: Number(e.target.value) })} />
                  {errors.sqft && <p className="text-xs text-destructive mt-1">{errors.sqft}</p>}
                </div>
              )}
              {(form.project_type === 'Bath' || form.project_type === 'Kitchen') && (
                <div>
                  <Label>Fixture Count *</Label>
                  <Input type="number" value={form.fixture_count || ''} onChange={e => update({ fixture_count: Number(e.target.value) })} />
                  {errors.fixture_count && <p className="text-xs text-destructive mt-1">{errors.fixture_count}</p>}
                </div>
              )}
              {form.project_type === 'Small Job' && (
                <div>
                  <Label>Labor Hours *</Label>
                  <Input type="number" value={form.labor_hours || ''} onChange={e => update({ labor_hours: Number(e.target.value) })} />
                  {errors.labor_hours && <p className="text-xs text-destructive mt-1">{errors.labor_hours}</p>}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Crew Size</Label>
                <Input type="number" value={form.crew_size || 2} onChange={e => update({ crew_size: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Hours/Day</Label>
                <Input type="number" value={form.hours_per_day || 8} onChange={e => update({ hours_per_day: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.finish_materials_included} onCheckedChange={v => update({ finish_materials_included: v })} />
              <Label>Finish Materials Included</Label>
            </div>
            <div>
              <Label>Project Name</Label>
              <Input value={form.project_name || ''} onChange={e => update({ project_name: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Client Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Name</Label><Input value={form.client_name || ''} onChange={e => update({ client_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input value={form.client_email || ''} onChange={e => update({ client_email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.client_phone || ''} onChange={e => update({ client_phone: e.target.value })} /></div>
            </div>
            <div><Label>Address</Label><Input value={form.project_address || ''} onChange={e => update({ project_address: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>City</Label><Input value={form.city || ''} onChange={e => update({ city: e.target.value })} /></div>
              <div><Label>State</Label><Input value={form.state || ''} onChange={e => update({ state: e.target.value })} /></div>
              <div><Label>Zip</Label><Input value={form.zip || ''} onChange={e => update({ zip: e.target.value })} /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Internal Notes</CardTitle></CardHeader>
          <CardContent><Textarea rows={3} value={form.internal_notes || ''} onChange={e => update({ internal_notes: e.target.value })} placeholder="Internal team notes..." /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Public Notes</CardTitle></CardHeader>
          <CardContent><Textarea rows={3} value={form.public_notes || ''} onChange={e => update({ public_notes: e.target.value })} placeholder="Notes visible to client..." /></CardContent>
        </Card>
      </div>

      {/* Advanced */}
      <Collapsible open={advOpen} onOpenChange={setAdvOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm"><ChevronDown className={`mr-1 h-4 w-4 transition-transform ${advOpen ? 'rotate-180' : ''}`} />Advanced (Internal Margins)</Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2">
            <CardContent className="pt-4 grid grid-cols-3 gap-4">
              <div><Label>Overhead %</Label><Input type="number" step="0.01" value={form.overhead_pct} onChange={e => update({ overhead_pct: Number(e.target.value) })} /></div>
              <div><Label>Profit %</Label><Input type="number" step="0.01" value={form.profit_pct} onChange={e => update({ profit_pct: Number(e.target.value) })} /></div>
              <div><Label>Contingency %</Label><Input type="number" step="0.01" value={form.contingency_pct} onChange={e => update({ contingency_pct: Number(e.target.value) })} /></div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={saveDraft}>Save Draft</Button>
        <Button variant="gold" onClick={generate} disabled={generating}>{generating ? 'Generating...' : 'Generate'}</Button>
        {form.subtotal! > 0 && (
          <>
            <Button variant="outline" onClick={() => generatePublicPDF(form as Estimate)}><FileDown className="mr-1 h-4 w-4" />Public PDF</Button>
            <Button variant="outline" onClick={() => generateInternalPDF(form as Estimate)}><FileDown className="mr-1 h-4 w-4" />Internal PDF</Button>
            <Button variant="outline" onClick={createRevision}>Create Revision</Button>
            <Button variant="outline" onClick={duplicate}><Copy className="mr-1 h-4 w-4" />Duplicate</Button>
          </>
        )}
      </div>

      {/* Status Workflow Buttons */}
      {form.estimate_id && form.status !== 'Draft' && (
        <div className="flex flex-wrap gap-2">
          {form.status !== 'Sent' && (
            <Button variant="outline" onClick={() => setStatus('Sent')} className="text-blue-600 border-blue-300 hover:bg-blue-50">
              <Send className="mr-1 h-4 w-4" />Mark as Sent
            </Button>
          )}
          {form.status !== 'Accepted' && (
            <Button variant="outline" onClick={() => setStatus('Accepted')} className="text-green-600 border-green-300 hover:bg-green-50">
              <CheckCircle className="mr-1 h-4 w-4" />Mark as Accepted
            </Button>
          )}
          {form.status !== 'Rejected' && (
            <Button variant="outline" onClick={() => setStatus('Rejected')} className="text-red-600 border-red-300 hover:bg-red-50">
              <XCircle className="mr-1 h-4 w-4" />Mark as Rejected
            </Button>
          )}
        </div>
      )}

      {/* Output Panels */}
      {form.subtotal! > 0 && (
        <Tabs defaultValue="line-items" className="mt-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="line-items">Line Items</TabsTrigger>
            <TabsTrigger value="costs">Cost Summary</TabsTrigger>
            <TabsTrigger value="risks">Risk Analysis</TabsTrigger>
            <TabsTrigger value="scope">Scope & Assumptions</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="audit">Audit & History</TabsTrigger>
          </TabsList>

          {/* G) LINE ITEMS TAB with full traceability */}
          <TabsContent value="line-items" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <MiniCard label="Labor" value={fmt(form.labor_subtotal)} />
              <MiniCard label="Materials" value={fmt(form.material_subtotal)} />
              <MiniCard label="Labor Hours" value={String(form.subtotal_labor_hours || 0)} />
              <MiniCard label="Est. Duration" value={`${form.estimated_duration_days || 0} days`} />
              <MiniCard label="Range" value={`${fmt(form.total_low)} – ${fmt(form.total_high)}`} />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-sm">Estimate Line Items</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Phase</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">Labor $/u</TableHead>
                        <TableHead className="text-right">Mat $/u</TableHead>
                        <TableHead className="text-right">Hrs/u</TableHead>
                        <TableHead className="text-right">Hrs Total</TableHead>
                        <TableHead className="text-right">Labor $</TableHead>
                        <TableHead className="text-right">Mat $</TableHead>
                        <TableHead className="text-right">Line Total</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dbLineItems.map((li, i) => (
                        <TableRow key={li.line_id || i}>
                          <TableCell><Badge variant="outline" className="text-xs">{li.phase}</Badge></TableCell>
                          <TableCell className="font-medium">{li.description}</TableCell>
                          <TableCell className="text-right">{li.qty}</TableCell>
                          <TableCell>{li.unit}</TableCell>
                          <TableCell className="text-right">{fmt(li.labor_unit_cost)}</TableCell>
                          <TableCell className="text-right">{fmt(li.material_unit_cost)}</TableCell>
                          <TableCell className="text-right">{li.labor_hours_per_unit.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{li.labor_hours_total.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{fmt(li.labor_total)}</TableCell>
                          <TableCell className="text-right">{fmt(li.material_total)}</TableCell>
                          <TableCell className="text-right font-bold">{fmt(li.line_total)}</TableCell>
                          <TableCell>
                            <Badge variant={li.source === 'CostLibrary' ? 'default' : li.source === 'Manual' ? 'secondary' : 'outline'} className="text-xs">
                              {li.source}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {dbLineItems.length === 0 && (
                        <TableRow><TableCell colSpan={12} className="text-center py-6 text-muted-foreground">No line items. Click Generate to create from Cost Library.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* How Totals Were Computed - Traceability */}
            <Collapsible open={traceOpen} onOpenChange={setTraceOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm"><ChevronDown className={`mr-1 h-4 w-4 transition-transform ${traceOpen ? 'rotate-180' : ''}`} />How totals were computed</Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="mt-2">
                  <CardContent className="pt-4 space-y-2 text-sm font-mono">
                    <p>Labor Subtotal: <strong>{fmt(form.labor_subtotal)}</strong> = Σ(line.qty × line.labor_unit_cost)</p>
                    <p>Material Subtotal: <strong>{fmt(form.material_subtotal)}</strong> = Σ(line.qty × line.material_unit_cost × finish_mult[{form.finish_level}={FINISH_MULTS[form.finish_level as FinishLevel] || 1}])</p>
                    <p>Subtotal: <strong>{fmt(form.subtotal)}</strong> = labor + material</p>
                    <hr className="my-2 border-border" />
                    <p>Risk Low: <strong>{fmt(form.risk_cost_low)}</strong> | Risk High: <strong>{fmt(form.risk_cost_high)}</strong></p>
                    <p>Overall Risk: <strong>{form.overall_risk_level}</strong></p>
                    <hr className="my-2 border-border" />
                    <p>Overhead: {((form.overhead_pct || 0) * 100).toFixed(0)}% | Profit: {((form.profit_pct || 0) * 100).toFixed(0)}% | Contingency: {((form.contingency_pct || 0) * 100).toFixed(0)}%</p>
                    <p>Margin Multiplier: <strong>{((1 + (form.overhead_pct || 0)) * (1 + (form.profit_pct || 0)) * (1 + (form.contingency_pct || 0))).toFixed(4)}</strong></p>
                    <hr className="my-2 border-border" />
                    <p>Total Low: <strong>{fmt(form.total_low)}</strong> = (subtotal + risk_low) × margin_mult</p>
                    <p>Total High: <strong>{fmt(form.total_high)}</strong> = (subtotal + risk_high) × margin_mult</p>
                    <hr className="my-2 border-border" />
                    <p>Labor Hours Total: <strong>{form.subtotal_labor_hours}</strong> hrs</p>
                    <p>Est. Duration: <strong>{form.estimated_duration_days}</strong> days = ⌈{form.subtotal_labor_hours} / ({form.crew_size} crew × {form.hours_per_day} hrs/day)⌉</p>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          <TabsContent value="costs" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MiniCard label="Labor" value={fmt(form.labor_subtotal)} />
              <MiniCard label="Materials" value={fmt(form.material_subtotal)} />
              <MiniCard label="Subtotal" value={fmt(form.subtotal)} />
              <MiniCard label="Range" value={`${fmt(form.total_low)} – ${fmt(form.total_high)}`} />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-sm">Cost Structure</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Trade</TableHead><TableHead className="text-right">Labor</TableHead><TableHead className="text-right">Material</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {costStructure.map((c: any, i: number) => (
                      <TableRow key={i}><TableCell>{c.trade}</TableCell><TableCell className="text-right">{fmt(c.labor)}</TableCell><TableCell className="text-right">{fmt(c.material)}</TableCell><TableCell className="text-right">{fmt(c.dollars)}</TableCell><TableCell className="text-right">{c.percent.toFixed(1)}%</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="risks" className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <MiniCard label="Risk Level" value={form.overall_risk_level || 'Low'} />
              <MiniCard label="Risk Low" value={fmt(form.risk_cost_low)} />
              <MiniCard label="Risk High" value={fmt(form.risk_cost_high)} />
            </div>
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader><TableRow><TableHead>Risk</TableHead><TableHead>Level</TableHead><TableHead className="text-right">Low</TableHead><TableHead className="text-right">High</TableHead><TableHead>Mitigation</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {riskTable.map((r: any, i: number) => (
                      <TableRow key={i}><TableCell>{r.risk_name}</TableCell><TableCell><Badge variant={r.level === 'High' ? 'destructive' : 'secondary'}>{r.level}</Badge></TableCell><TableCell className="text-right">{fmt(r.exposure_low)}</TableCell><TableCell className="text-right">{fmt(r.exposure_high)}</TableCell><TableCell className="text-sm">{r.mitigation_note}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scope" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Assumptions (editable)</CardTitle></CardHeader>
              <CardContent><Textarea rows={10} value={form.assumptions_rich || ''} onChange={e => update({ assumptions_rich: e.target.value })} /></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm">AI Scope</CardTitle><Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(form.ai_scope || '')}><Copy className="h-3 w-3 mr-1" />Copy</Button></CardHeader>
              <CardContent><pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md max-h-96 overflow-y-auto">{form.ai_scope}</pre></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Timeline</CardTitle></CardHeader>
              <CardContent><Textarea rows={6} value={form.timeline_rich || ''} onChange={e => update({ timeline_rich: e.target.value })} /></CardContent>
            </Card>
          </TabsContent>

          {/* MEDIA TAB */}
          <TabsContent value="media" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Estimate Media</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {estimateDbId && (
                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <Label>File URL</Label>
                      <Input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://..." />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <Label>Caption</Label>
                      <Input value={mediaCaption} onChange={e => setMediaCaption(e.target.value)} placeholder="Photo caption" />
                    </div>
                    <Button onClick={addMedia} disabled={!mediaUrl}><ImagePlus className="mr-1 h-4 w-4" />Add</Button>
                  </div>
                )}
                {media.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No media attached yet.</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {media.map(m => (
                    <Card key={m.media_id}>
                      <CardContent className="pt-3 space-y-2">
                        {m.file_url && (
                          <img src={m.file_url} alt={m.caption} className="w-full h-32 object-cover rounded-md" onError={e => (e.currentTarget.style.display = 'none')} />
                        )}
                        <p className="text-sm font-medium">{m.caption || 'No caption'}</p>
                        <div className="flex gap-2 text-xs">
                          <Badge variant={m.include_in_internal_pdf ? 'default' : 'outline'}>Internal</Badge>
                          <Badge variant={m.include_in_public_pdf ? 'default' : 'outline'}>Public</Badge>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeMedia(m.media_id)}><Trash2 className="h-3 w-3 mr-1" />Remove</Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CHAT TAB */}
          <TabsContent value="chat" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Estimate Chat Threads</CardTitle>
                <Button variant="outline" size="sm" onClick={newThread} disabled={!estimateDbId}><Plus className="h-3 w-3 mr-1" />New Thread</Button>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  {/* Thread list */}
                  <div className="w-48 space-y-1 border-r pr-4">
                    {chatThreads.map(t => (
                      <Button key={t.thread_id} variant={activeThread?.thread_id === t.thread_id ? 'default' : 'ghost'} size="sm" className="w-full justify-start text-left" onClick={() => loadThread(t)}>
                        <MessageSquare className="h-3 w-3 mr-1 shrink-0" />{t.title}
                      </Button>
                    ))}
                    {chatThreads.length === 0 && <p className="text-xs text-muted-foreground">No threads yet</p>}
                  </div>
                  {/* Messages */}
                  <div className="flex-1 space-y-3">
                    {activeThread ? (
                      <>
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                          {chatMessages.map(m => (
                            <div key={m.message_id} className={`p-2 rounded-md text-sm ${m.role === 'user' ? 'bg-primary/10 ml-8' : m.role === 'assistant' ? 'bg-muted mr-8' : 'bg-muted/50 text-xs italic'}`}>
                              <span className="font-medium text-xs text-muted-foreground">{m.role}</span>
                              <p className="mt-1">{m.content}</p>
                            </div>
                          ))}
                          {chatMessages.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No messages yet</p>}
                        </div>
                        <div className="flex gap-2">
                          <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type a message..." onKeyDown={e => e.key === 'Enter' && sendMessage()} />
                          <Button onClick={sendMessage} disabled={!chatInput.trim()}><Send className="h-4 w-4" /></Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">Select or create a thread to start chatting</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">AI Price Audit (Internal Only)</CardTitle></CardHeader>
              <CardContent><pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md max-h-96 overflow-y-auto">{form.ai_price_audit_summary}</pre></CardContent>
            </Card>
            {revisions.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Revision History</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Version</TableHead><TableHead>Date</TableHead><TableHead>Summary</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {revisions.map(r => (
                        <TableRow key={r.id}><TableCell className="font-mono">{r.version}</TableCell><TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell><TableCell>{r.change_summary}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

const FINISH_MULTS: Record<FinishLevel, number> = { Basic: 1.00, Mid: 1.15, High: 1.30, Luxury: 1.55 };

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="pt-3 pb-2 px-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-base font-bold">{value}</p></CardContent></Card>
  );
}
