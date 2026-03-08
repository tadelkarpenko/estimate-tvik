import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEstimates, getCostAudits, getCostLibrary, initStore } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import type { Estimate, CostAudit, CostLibraryItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, Clock, FileText, Gauge, Plus, RotateCcw, Target, TrendingDown, TrendingUp, Zap, Camera, ArrowRight } from 'lucide-react';

type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

interface ActionItem {
  type: 'Estimate' | 'Contract' | 'Audit' | 'CostLib';
  title: string;
  severity: Severity;
  impactValue: number;
  ageDays: number;
  actionType: 'Fix' | 'Recompute' | 'Analyze' | 'Review' | 'Review CostLib';
  link: string;
}

const SEVERITY_ORDER: Record<Severity, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

export default function Dashboard() {
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [audits, setAudits] = useState<CostAudit[]>([]);
  const [costLib, setCostLib] = useState<CostLibraryItem[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiWindow, setKpiWindow] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    (async () => {
      await initStore();
      const [e, a, c] = await Promise.all([getEstimates(), getCostAudits(), getCostLibrary()]);
      const { data: contractData } = await supabase.from('contracts').select('*').order('created_at', { ascending: false });
      setEstimates(e); setAudits(a); setCostLib(c);
      setContracts(contractData || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading…</div>;

  const now = Date.now();
  const windowMs = kpiWindow === '7d' ? 7 * 86400000 : kpiWindow === '30d' ? 30 * 86400000 : 90 * 86400000;
  const cutoff = now - windowMs;

  // KPIs
  const estCreated = estimates.filter(e => new Date(e.created_at).getTime() > cutoff).length;
  const estSent = estimates.filter(e => e.status === 'Sent' && new Date(e.updated_at).getTime() > cutoff).length;
  const estAccepted = estimates.filter(e => e.status === 'Accepted' && new Date(e.updated_at).getTime() > cutoff).length;
  const conversionRate = estSent > 0 ? Math.round((estAccepted / estSent) * 100) : 0;
  const validMarginEsts = estimates.filter(e => e.subtotal > 0 && e.total_high > 0);
  const avgMargin = validMarginEsts.length > 0
    ? Math.round(validMarginEsts.reduce((s, e) => s + (e.total_high - e.subtotal) / e.total_high, 0) / validMarginEsts.length * 100)
    : 0;
  const profitFadeCount = contracts.filter(c => c.profit_fade_flag).length;

  // Pipeline
  const pipeline = [
    { stage: 'Draft', count: estimates.filter(e => e.status === 'Draft').length, total: estimates.filter(e => e.status === 'Draft').reduce((s, e) => s + (e.total_high || 0), 0) },
    { stage: 'Ready', count: estimates.filter(e => e.status === 'Ready').length, total: estimates.filter(e => e.status === 'Ready').reduce((s, e) => s + (e.total_high || 0), 0) },
    { stage: 'Sent', count: estimates.filter(e => e.status === 'Sent').length, total: estimates.filter(e => e.status === 'Sent').reduce((s, e) => s + (e.total_high || 0), 0) },
    { stage: 'Accepted', count: estimates.filter(e => e.status === 'Accepted').length, total: estimates.filter(e => e.status === 'Accepted').reduce((s, e) => s + (e.total_high || 0), 0) },
  ];

  // Action Queue
  const existingEstIds = new Set(estimates.map(e => e.estimate_id));
  const openAudits = audits.filter(a => a.status === 'Open' && existingEstIds.has(a.estimate_id));
  const staleRows = costLib.filter(r => now - new Date(r.last_updated).getTime() > 120 * 86400000);
  const actions: ActionItem[] = [];

  // Contract-level actions
  for (const c of contracts) {
    if (c.profit_fade_flag) {
      actions.push({ type: 'Contract', title: `${c.contract_id} — Profit Fade Active`, severity: 'Critical', impactValue: c.net_contract_value, ageDays: Math.floor((now - new Date(c.created_at).getTime()) / 86400000), actionType: 'Review', link: `/contracts/${c.contract_id}` });
    }
    if (c.margin_current_pct < 0.16 && c.margin_current_pct > 0) {
      actions.push({ type: 'Contract', title: `${c.contract_id} — Margin below 16%`, severity: 'High', impactValue: c.net_contract_value, ageDays: Math.floor((now - new Date(c.created_at).getTime()) / 86400000), actionType: 'Review', link: `/contracts/${c.contract_id}` });
    }
  }

  // Estimate-level actions
  for (const e of estimates) {
    if ((e as any).calc_status === 'Failed') {
      actions.push({ type: 'Estimate', title: `${e.estimate_id} — Calc Failed`, severity: 'Critical', impactValue: e.total_high, ageDays: Math.floor((now - new Date(e.created_at).getTime()) / 86400000), actionType: 'Recompute', link: `/estimates/${e.estimate_id}` });
    }
    if ((e as any).completeness_score < 80 && e.status === 'Ready') {
      actions.push({ type: 'Estimate', title: `${e.estimate_id} — Send Gate Blocked`, severity: 'High', impactValue: e.total_high, ageDays: Math.floor((now - new Date(e.created_at).getTime()) / 86400000), actionType: 'Fix', link: `/estimates/${e.estimate_id}` });
    }
    if ((e as any).calc_status === 'Stale' && e.subtotal > 0) {
      actions.push({ type: 'Estimate', title: `${e.estimate_id} — Stale Calculations`, severity: 'Medium', impactValue: e.total_high, ageDays: Math.floor((now - new Date(e.updated_at).getTime()) / 86400000), actionType: 'Recompute', link: `/estimates/${e.estimate_id}` });
    }
    if ((e as any).material_volatility_flag && !(e as any).volatility_reviewed) {
      actions.push({ type: 'Estimate', title: `${e.estimate_id} — Material Volatility Unreviewed`, severity: 'High', impactValue: e.total_high, ageDays: 0, actionType: 'Review', link: `/estimates/${e.estimate_id}` });
    }
  }

  // Audit actions
  for (const a of openAudits) {
    actions.push({ type: 'Audit', title: `${a.estimate_id} — Open Anomaly`, severity: 'High', impactValue: 0, ageDays: Math.floor((now - new Date(a.created_at).getTime()) / 86400000), actionType: 'Review', link: '/cost-audit' });
  }

  // CostLib actions
  if (staleRows.length > 0) {
    actions.push({ type: 'CostLib', title: `${staleRows.length} Stale CostLib Rows (>120d)`, severity: 'Low', impactValue: 0, ageDays: 120, actionType: 'Review CostLib', link: '/cost-library' });
  }

  // Sort: Severity → $ Impact → Age
  actions.sort((a, b) => (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]) || (b.impactValue - a.impactValue) || (b.ageDays - a.ageDays));

  const fmt = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const severityColor = (s: Severity) =>
    s === 'Critical' ? 'destructive' : s === 'High' ? 'destructive' : s === 'Medium' ? 'secondary' : 'outline';
  const actionLabel = (t: string) =>
    t === 'Fix' ? 'Fix' : t === 'Recompute' ? 'Recompute' : t === 'Analyze' ? 'Analyze' : t === 'Review CostLib' ? 'Review' : 'Review';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
        <Button size="sm" onClick={() => navigate('/estimates/new')}><Plus className="h-3 w-3 mr-1" />New Estimate</Button>
      </div>

      {/* ACTION QUEUE */}
      {actions.length > 0 && (
        <Card className="border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />Action Queue — Today
              <Badge variant="outline" className="ml-auto">{Math.min(actions.length, 12)} items</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {actions.slice(0, 12).map((a, i) => (
                <div key={i} className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                  <Badge variant={severityColor(a.severity)} className="text-xs w-16 justify-center shrink-0">{a.severity}</Badge>
                  <Badge variant="outline" className="text-xs shrink-0">{a.type}</Badge>
                  <span className="text-sm flex-1 truncate w-full sm:w-auto">{a.title}</span>
                  <div className="flex items-center gap-2 ml-auto">
                    {a.impactValue > 0 && <span className="text-xs text-muted-foreground font-mono">{fmt(a.impactValue)}</span>}
                    <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => navigate(a.link)}>
                      {actionLabel(a.actionType)}<ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI ROW */}
      <div className="space-y-2">
        <div className="flex gap-1">
          {(['7d', '30d', '90d'] as const).map(w => (
            <Button key={w} size="sm" variant={kpiWindow === w ? 'default' : 'ghost'} className="h-6 text-xs px-2" onClick={() => setKpiWindow(w)}>{w}</Button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <KPI title="Estimates Created" value={estCreated} />
          <KPI title="Estimates Sent" value={estSent} />
          <KPI title="Conversion %" value={`${conversionRate}%`} />
          <KPI title="Avg Margin" value={`${avgMargin}%`} />
          <KPI title="Profit Fade" value={profitFadeCount} alert={profitFadeCount > 0} />
          <KPI title="Active Contracts" value={contracts.filter(c => c.contract_status === 'Active').length} />
        </div>
      </div>

      {/* PIPELINE FUNNEL */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Estimate Pipeline</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {pipeline.map(p => (
              <div key={p.stage} className="text-center p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors" onClick={() => navigate('/estimates')}>
                <p className="text-2xl font-bold">{p.count}</p>
                <p className="text-xs text-muted-foreground">{p.stage}</p>
                <p className="text-xs font-mono text-muted-foreground">{fmt(p.total)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* MARGIN & RISK */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Margin & Risk</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <KPI title="Avg Margin (30d)" value={`${avgMargin}%`} />
              <KPI title="Profit Fade Contracts" value={profitFadeCount} alert={profitFadeCount > 0} />
            </div>
            {contracts.filter(c => c.profit_fade_flag).length > 0 && (
              <div className="space-y-1">
                {contracts.filter(c => c.profit_fade_flag).map(c => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <Badge variant="destructive" className="text-xs">Fade</Badge>
                    <span className="font-mono">{c.contract_id}</span>
                    <span className="text-muted-foreground">{fmt(c.net_contract_value)}</span>
                    <Button size="sm" variant="ghost" className="h-6 text-xs ml-auto" onClick={() => navigate(`/contracts/${c.contract_id}`)}>
                      View<ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* PRICING INTELLIGENCE */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" />Pricing Intelligence</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {staleRows.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">{staleRows.length} cost library items not updated in 120+ days</p>
                <Table>
                  <TableHeader><TableRow><TableHead>Trade</TableHead><TableHead>Type</TableHead><TableHead>Last Updated</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {staleRows.slice(0, 5).map(r => (
                      <TableRow key={r.id}><TableCell className="text-sm">{r.trade}</TableCell><TableCell className="text-sm">{r.project_type}</TableCell><TableCell className="text-xs text-muted-foreground">{r.last_updated}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button size="sm" variant="outline" onClick={() => navigate('/cost-library')}>Review CostLib<ArrowRight className="h-3 w-3 ml-1" /></Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">All cost library items are current ✓</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* OPEN AUDITS */}
      {openAudits.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Open Audit Anomalies</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Estimate</TableHead><TableHead>Date</TableHead><TableHead>Age</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {openAudits.slice(0, 10).map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-sm">{a.estimate_id}</TableCell>
                    <TableCell className="text-sm">{new Date(a.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{Math.floor((now - new Date(a.created_at).getTime()) / 86400000)}d</TableCell>
                    <TableCell><Badge variant="destructive">Open</Badge></TableCell>
                    <TableCell><Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => navigate('/cost-audit')}>Review</Button></TableCell>
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

function KPI({ title, value, alert }: { title: string; value: string | number; alert?: boolean }) {
  return (
    <Card className={alert ? 'border-destructive/30' : ''}>
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-xs text-muted-foreground mb-1">{title}</p>
        <p className={`text-xl font-bold ${alert ? 'text-destructive' : ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
