import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Estimate, EstimateStatus, ProjectType, FinishLevel } from '@/lib/types';
import { getEstimate, saveEstimate, nextEstimateId, uid, getCostLibrary, getRiskLibrary, getRevisionLogs, saveRevisionLog } from '@/lib/store';
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
import { ChevronDown, Copy, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
};

export default function NewEstimate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<Estimate>>({ ...defaultEst });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [advOpen, setAdvOpen] = useState(false);
  const isEdit = !!id;

  useEffect(() => {
    if (id) {
      const existing = getEstimate(id);
      if (existing) setForm(existing);
      else navigate('/estimates', { replace: true });
    }
  }, [id]);

  const update = (updates: Partial<Estimate>) => setForm(prev => ({ ...prev, ...updates }));
  const revisions = useMemo(() => getRevisionLogs(form.estimate_id), [form.estimate_id, form.version]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (form.project_type !== 'Small Job' && (!form.sqft || form.sqft <= 0)) errs.sqft = 'Square footage required';
    if ((form.project_type === 'Bath' || form.project_type === 'Kitchen') && (!form.fixture_count || form.fixture_count <= 0))
      errs.fixture_count = 'Fixture count required';
    if (form.project_type === 'Small Job' && (!form.labor_hours || form.labor_hours <= 0))
      errs.labor_hours = 'Labor hours required for Small Jobs';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveDraft = () => {
    const est: Estimate = {
      ...defaultEst, ...form,
      estimate_id: form.estimate_id || nextEstimateId(),
      created_at: form.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Estimate;
    saveEstimate(est);
    update({ estimate_id: est.estimate_id, created_at: est.created_at });
    toast({ title: 'Draft saved', description: est.estimate_id });
  };

  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!validate()) { toast({ title: 'Validation failed', variant: 'destructive' }); return; }
    setGenerating(true);

    try {
      const costLib = getCostLibrary();
      const riskLib = getRiskLibrary();
      const costResult = runCostEngine({
        project_type: form.project_type as ProjectType, sqft: form.sqft!, fixture_count: form.fixture_count || 0,
        labor_hours: form.labor_hours || 0,
        finish_level: form.finish_level as FinishLevel, finish_materials_included: form.finish_materials_included!,
        costLibrary: costLib,
      });
      const riskResult = runRiskEngine({ project_type: form.project_type as ProjectType, subtotal: costResult.subtotal, riskLibrary: riskLib });

      const marginMult = (1 + (form.overhead_pct || 0.1)) * (1 + (form.profit_pct || 0.2)) * (1 + (form.contingency_pct || 0.1));
      const total_low = Math.round((costResult.subtotal + riskResult.risk_cost_low) * marginMult * 100) / 100;
      const total_high = Math.round((costResult.subtotal + riskResult.risk_cost_high) * marginMult * 100) / 100;

      const partial: Partial<Estimate> = {
        ...costResult, line_items_json: JSON.stringify(costResult.line_items),
        cost_structure_json: JSON.stringify(costResult.cost_structure),
        ...riskResult, risk_table_json: JSON.stringify(riskResult.risk_table),
        total_low, total_high,
      };
      const merged = { ...form, ...partial };
      merged.assumptions_rich = generateAssumptions(merged);
      merged.timeline_rich = generateTimeline(merged);

      // Save deterministic results first
      const estId = merged.estimate_id || nextEstimateId();
      merged.estimate_id = estId;
      merged.created_at = merged.created_at || new Date().toISOString();
      merged.status = 'Ready' as EstimateStatus;

      // Run AI in parallel
      toast({ title: 'Running AI analysis...', description: 'Generating scope & audit via AI' });
      const [scope, audit] = await Promise.all([
        generateScopeAI(merged),
        generateAuditAI({ ...merged, estimate_id: estId }),
      ]);
      merged.ai_scope = scope;
      merged.ai_price_audit_summary = audit;

      const est: Estimate = {
        ...defaultEst, ...merged, updated_at: new Date().toISOString(),
      } as Estimate;
      saveEstimate(est);
      setForm(est);
      toast({ title: 'Estimate generated', description: `${est.estimate_id} — $${est.total_low.toLocaleString()} – $${est.total_high.toLocaleString()}` });
    } catch (e) {
      console.error('Generate error:', e);
      toast({ title: 'Generation error', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const createRevision = () => {
    const summary = prompt('Change summary (required):');
    if (!summary) return;
    const prevVersion = form.version || 'v1.0';
    const parts = prevVersion.replace('v', '').split('.');
    const newVersion = `v${parts[0]}.${parseInt(parts[1] || '0') + 1}`;
    saveRevisionLog({
      id: uid(), estimate_id: form.estimate_id!, created_at: new Date().toISOString(),
      version: prevVersion, change_summary: summary, snapshot_json: JSON.stringify(form),
      delta_low: 0, delta_high: 0,
    });
    update({ version: newVersion, last_revision_summary: summary });
    toast({ title: 'Revision created', description: newVersion });
  };

  const duplicate = () => {
    const newId = nextEstimateId();
    const dup: Estimate = { ...defaultEst, ...form, estimate_id: newId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: 'Draft', version: 'v1.0' } as Estimate;
    saveEstimate(dup);
    navigate(`/estimates/${newId}`);
    toast({ title: 'Estimate duplicated', description: newId });
  };

  const lineItems = form.line_items_json ? JSON.parse(form.line_items_json) : [];
  const costStructure = form.cost_structure_json ? JSON.parse(form.cost_structure_json) : [];
  const riskTable = form.risk_table_json ? JSON.parse(form.risk_table_json) : [];
  const fmt = (n?: number) => '$' + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
                <Label>Project Type</Label>
                <Select value={form.project_type} onValueChange={v => update({ project_type: v as ProjectType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bath">Bath</SelectItem>
                    <SelectItem value="Full Rehab">Full Rehab</SelectItem>
                    <SelectItem value="Kitchen">Kitchen</SelectItem>
                    <SelectItem value="Small Job">Small Job</SelectItem>
                  </SelectContent>
                </Select>
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

      {/* Output Panels */}
      {form.subtotal! > 0 && (
        <Tabs defaultValue="costs" className="mt-4">
          <TabsList>
            <TabsTrigger value="costs">Cost Summary</TabsTrigger>
            <TabsTrigger value="risks">Risk Analysis</TabsTrigger>
            <TabsTrigger value="scope">Scope & Assumptions</TabsTrigger>
            <TabsTrigger value="audit">Audit & History</TabsTrigger>
          </TabsList>

          <TabsContent value="costs" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MiniCard label="Labor" value={fmt(form.labor_subtotal)} />
              <MiniCard label="Materials" value={fmt(form.material_subtotal)} />
              <MiniCard label="Subtotal" value={fmt(form.subtotal)} />
              <MiniCard label="Range" value={`${fmt(form.total_low)} – ${fmt(form.total_high)}`} />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-sm">Line Items</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Trade</TableHead><TableHead>Desc</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Unit</TableHead><TableHead className="text-right">Labor</TableHead><TableHead className="text-right">Material</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {lineItems.map((l: any, i: number) => (
                        <TableRow key={i}><TableCell className="font-medium">{l.trade}</TableCell><TableCell>{l.description}</TableCell><TableCell className="text-right">{l.qty}</TableCell><TableCell>{l.unit}</TableCell><TableCell className="text-right">{fmt(l.labor)}</TableCell><TableCell className="text-right">{fmt(l.material)}</TableCell><TableCell className="text-right font-medium">{fmt(l.total)}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
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

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="pt-3 pb-2 px-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-base font-bold">{value}</p></CardContent></Card>
  );
}
