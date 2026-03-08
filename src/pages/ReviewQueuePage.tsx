import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  getAllSuggestions, getSuggestions, updateSuggestionStatus,
  SUGGESTION_TYPE_LABELS, SUGGESTION_STATUS_COLORS, SEVERITY_COLORS, CONFIDENCE_COLORS,
  type AISuggestion, type DecisionState, type SuggestionType, type SuggestionConfidence, type SeverityLevel,
} from '@/lib/suggestionStore';
import {
  ClipboardList, Filter, Eye, Check, X, Pencil, RotateCcw, ExternalLink,
  AlertTriangle, Clock, CheckCircle, XCircle, Edit3, ArrowUpDown,
} from 'lucide-react';

type SortMode = 'newest' | 'oldest' | 'severity' | 'pending_first';
type EstimateMeta = { id: string; estimate_id: string; project_name: string; status: string; project_category: string; client_name: string; project_address: string };

export default function ReviewQueuePage() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [estimates, setEstimates] = useState<EstimateMeta[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterEstimate, setFilterEstimate] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterConfidence, setFilterConfidence] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  // Detail
  const [detailItem, setDetailItem] = useState<AISuggestion | null>(null);
  const [editValue, setEditValue] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');

  const loadEstimates = useCallback(async () => {
    const { data } = await supabase
      .from('estimates')
      .select('id, estimate_id, project_name, status, project_category, client_name, project_address')
      .order('created_at', { ascending: false })
      .limit(200);
    setEstimates((data || []) as EstimateMeta[]);
  }, []);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      if (filterEstimate === 'all') {
        const items = await getAllSuggestions(500);
        setSuggestions(items);
      } else {
        const items = await getSuggestions(filterEstimate);
        setSuggestions(items);
      }
    } catch (e: any) {
      toast({ title: 'Failed to load queue', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  }, [filterEstimate, toast]);

  useEffect(() => { loadEstimates(); }, [loadEstimates]);
  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);

  // Filtering + sorting
  const filtered = useMemo(() => {
    let items = suggestions.filter(s => {
      if (filterStatus !== 'all' && s.decision_state !== filterStatus) return false;
      if (filterType !== 'all' && s.suggestion_type !== filterType) return false;
      if (filterSource !== 'all' && s.source_type !== filterSource) return false;
      if (filterConfidence !== 'all' && s.confidence !== filterConfidence) return false;
      if (filterSeverity !== 'all' && s.severity_level !== filterSeverity) return false;
      return true;
    });
    switch (sortMode) {
      case 'oldest': items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case 'severity': {
        const sev: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
        items.sort((a, b) => (sev[a.severity_level] ?? 1) - (sev[b.severity_level] ?? 1));
        break;
      }
      case 'pending_first': {
        const st: Record<string, number> = { pending: 0, edited: 1, approved: 2, rejected: 3, applied: 4 };
        items.sort((a, b) => (st[a.decision_state] ?? 5) - (st[b.decision_state] ?? 5));
        break;
      }
      default: // newest first — already default from query
        break;
    }
    return items;
  }, [suggestions, filterStatus, filterType, filterSource, filterConfidence, filterSeverity, sortMode]);

  // Summary counts
  const counts = useMemo(() => {
    const c = { total: suggestions.length, pending: 0, approved: 0, edited: 0, rejected: 0, applied: 0, highSeverityPending: 0, siteVisit: 0 };
    suggestions.forEach(s => {
      c[s.decision_state as keyof typeof c]++;
      if (s.decision_state === 'pending' && s.severity_level === 'High') c.highSeverityPending++;
      if (s.suggestion_type === 'site_visit_recommendation') c.siteVisit++;
    });
    return c;
  }, [suggestions]);

  const handleAction = async (id: string, action: DecisionState, extras?: { edited_value?: string; reviewer_notes?: string }) => {
    try {
      await updateSuggestionStatus(id, action, extras);
      toast({ title: `Suggestion ${action}` });
      await loadSuggestions();
      setDetailItem(null);
    } catch (e: any) {
      toast({ title: 'Action failed', description: e.message, variant: 'destructive' });
    }
  };

  const getEstimate = (estId: string) => estimates.find(x => x.id === estId);
  const getEstimateName = (estId: string) => {
    const e = getEstimate(estId);
    return e ? (e.project_name || e.estimate_id) : estId.slice(0, 8);
  };

  const openDetail = (s: AISuggestion) => {
    setDetailItem(s);
    setEditValue(s.edited_value || s.suggested_value);
    setReviewerNotes(s.reviewer_notes);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">AI Suggestions Review Queue</h1>
        <Badge variant="outline" className="ml-auto text-sm">{filtered.length} shown</Badge>
      </div>

      {/* Summary widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total', value: counts.total, icon: ClipboardList },
          { label: 'Pending', value: counts.pending, icon: Clock },
          { label: 'Approved', value: counts.approved, icon: CheckCircle },
          { label: 'Edited', value: counts.edited, icon: Edit3 },
          { label: 'Rejected', value: counts.rejected, icon: XCircle },
          { label: 'High Sev Pending', value: counts.highSeverityPending, icon: AlertTriangle },
          { label: 'Site Visit', value: counts.siteVisit, icon: Eye },
        ].map(w => (
          <Card key={w.label}>
            <CardContent className="py-3 px-4 flex items-center gap-2">
              <w.icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-lg font-bold leading-none">{w.value}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{w.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status quick-filter badges */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'approved', 'edited', 'rejected', 'applied'] as const).map(s => (
          <Badge
            key={s}
            variant={filterStatus === s ? 'default' : 'outline'}
            className="cursor-pointer capitalize"
            onClick={() => setFilterStatus(s)}
          >
            {s === 'all' ? `All (${counts.total})` : `${s} (${counts[s as keyof typeof counts]})`}
          </Badge>
        ))}
      </div>

      {/* Filters row */}
      <Card>
        <CardContent className="pt-4 pb-4 flex flex-wrap gap-3 items-end">
          <FilterSelect label="Estimate" value={filterEstimate} onChange={setFilterEstimate}
            options={[{ value: 'all', label: 'All Estimates' }, ...estimates.map(e => ({ value: e.id, label: e.project_name || e.estimate_id }))]} />
          <FilterSelect label="Type" value={filterType} onChange={setFilterType}
            options={[{ value: 'all', label: 'All Types' }, ...Object.entries(SUGGESTION_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))]} />
          <FilterSelect label="Source" value={filterSource} onChange={setFilterSource}
            options={[{ value: 'all', label: 'All Sources' }, ...['text', 'voice', 'photo', 'merged'].map(s => ({ value: s, label: s }))]} />
          <FilterSelect label="Confidence" value={filterConfidence} onChange={setFilterConfidence}
            options={[{ value: 'all', label: 'All' }, ...['High', 'Medium', 'Low'].map(s => ({ value: s, label: s }))]} />
          <FilterSelect label="Severity" value={filterSeverity} onChange={setFilterSeverity}
            options={[{ value: 'all', label: 'All' }, ...['High', 'Medium', 'Low'].map(s => ({ value: s, label: s }))]} />
          <div className="space-y-1 min-w-[140px]">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><ArrowUpDown className="h-3 w-3" />Sort</label>
            <Select value={sortMode} onValueChange={v => setSortMode(v as SortMode)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="severity">Highest Severity</SelectItem>
                <SelectItem value="pending_first">Pending First</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={loadSuggestions} className="h-9">Refresh</Button>
        </CardContent>
      </Card>

      {/* Queue list */}
      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Loading queue…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {suggestions.length === 0 ? 'No suggestions in queue yet. Use the AI Intake Assistant to generate suggestions.' : 'No items match current filters.'}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <Card key={s.id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => openDetail(s)}>
              <CardContent className="py-3 px-4 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{SUGGESTION_TYPE_LABELS[s.suggestion_type] || s.suggestion_type}</Badge>
                    <Badge className={`text-[10px] border ${SUGGESTION_STATUS_COLORS[s.decision_state]}`}>{s.decision_state}</Badge>
                    <Badge className={`text-[10px] border ${CONFIDENCE_COLORS[s.confidence]}`}>{s.confidence}</Badge>
                    <Badge className={`text-[10px] border ${SEVERITY_COLORS[s.severity_level]}`}>Sev: {s.severity_level}</Badge>
                    <span className="text-[10px] text-muted-foreground">{s.source_type}</span>
                  </div>
                  <p className="text-sm font-medium truncate">{s.suggested_value.slice(0, 140)}{s.suggested_value.length > 140 ? '…' : ''}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    Est: {getEstimateName(s.estimate_id)} · Target: {s.apply_target}
                    {s.area_id ? ` · Area: ${s.area_id.slice(0, 8)}` : ''}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  {s.decision_state === 'pending' && (
                    <>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" title="Approve" onClick={() => handleAction(s.id, 'approved')}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Reject" onClick={() => handleAction(s.id, 'rejected')}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {s.decision_state !== 'pending' && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" title="Reset" onClick={() => handleAction(s.id, 'pending')}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={open => { if (!open) setDetailItem(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailItem && <SuggestionDetail
            item={detailItem}
            estimateMeta={getEstimate(detailItem.estimate_id)}
            editValue={editValue}
            setEditValue={setEditValue}
            reviewerNotes={reviewerNotes}
            setReviewerNotes={setReviewerNotes}
            onAction={handleAction}
            onNavigate={navigate}
          />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Filter Select helper ───
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1 min-w-[150px]">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Filter className="h-3 w-3" />{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Detail panel ───
function SuggestionDetail({ item, estimateMeta, editValue, setEditValue, reviewerNotes, setReviewerNotes, onAction, onNavigate }: {
  item: AISuggestion;
  estimateMeta?: EstimateMeta;
  editValue: string;
  setEditValue: (v: string) => void;
  reviewerNotes: string;
  setReviewerNotes: (v: string) => void;
  onAction: (id: string, action: DecisionState, extras?: any) => Promise<void>;
  onNavigate: (path: string) => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{SUGGESTION_TYPE_LABELS[item.suggestion_type]}</Badge>
          <Badge className={`border ${SUGGESTION_STATUS_COLORS[item.decision_state]}`}>{item.decision_state}</Badge>
          <Badge className={`border ${CONFIDENCE_COLORS[item.confidence]}`}>{item.confidence}</Badge>
          <Badge className={`border ${SEVERITY_COLORS[item.severity_level]}`}>Sev: {item.severity_level}</Badge>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 text-sm">
        {/* Estimate context */}
        {estimateMeta && (
          <Card className="bg-muted/50">
            <CardContent className="py-3 px-4 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Linked Estimate</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span><strong>ID:</strong> {estimateMeta.estimate_id}</span>
                <span><strong>Name:</strong> {estimateMeta.project_name || '—'}</span>
                <span><strong>Status:</strong> {estimateMeta.status}</span>
                {estimateMeta.project_category && <span><strong>Category:</strong> {estimateMeta.project_category}</span>}
                {estimateMeta.client_name && <span><strong>Client:</strong> {estimateMeta.client_name}</span>}
                {estimateMeta.project_address && <span><strong>Address:</strong> {estimateMeta.project_address}</span>}
              </div>
              <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => onNavigate(`/estimates/${estimateMeta.id}`)}>
                <ExternalLink className="h-3 w-3 mr-1" />Open Estimate
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Suggested value */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Suggested Value</p>
          <div className="bg-muted p-3 rounded text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">{item.suggested_value}</div>
        </div>

        {/* Core metadata grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
          <MetaField label="Suggestion ID" value={item.suggestion_id} />
          <MetaField label="Apply Target" value={item.apply_target} />
          <MetaField label="Source Type" value={item.source_type} />
          <MetaField label="Batch ID" value={item.suggestion_batch_id} />
          <MetaField label="Schema Version" value={item.schema_version} />
          <MetaField label="Block Name" value={item.block_name || '—'} />
          <MetaField label="Estimate Version" value={item.estimate_version || '—'} />
          <MetaField label="Area ID" value={item.area_id?.slice(0, 12) || '—'} />
          <MetaField label="Idempotency Key" value={item.idempotency_key || '—'} />
          <MetaField label="Supersedes" value={item.supersedes_suggestion_id || '—'} />
          <MetaField label="Requires Re-approval" value={item.requires_reapproval_if_applied ? 'Yes' : 'No'} />
          <MetaField label="Created" value={item.created_at ? new Date(item.created_at).toLocaleString() : '—'} />
          <MetaField label="Updated" value={item.updated_at ? new Date(item.updated_at).toLocaleString() : '—'} />
          <MetaField label="Approved At" value={item.approved_at ? new Date(item.approved_at).toLocaleString() : '—'} />
          <MetaField label="Rejected At" value={item.rejected_at ? new Date(item.rejected_at).toLocaleString() : '—'} />
          <MetaField label="Approved By" value={item.approved_by || '—'} />
        </div>

        {/* Evidence & reason */}
        {item.evidence_summary && (
          <div><p className="text-xs font-medium text-muted-foreground mb-1">Evidence Summary</p><p className="text-sm whitespace-pre-wrap">{item.evidence_summary}</p></div>
        )}
        {item.reason_for_suggestion && (
          <div><p className="text-xs font-medium text-muted-foreground mb-1">Reason for Suggestion</p><p className="text-sm whitespace-pre-wrap">{item.reason_for_suggestion}</p></div>
        )}
        {item.source_refs && (
          <div><p className="text-xs font-medium text-muted-foreground mb-1">Source Refs</p><p className="text-xs font-mono whitespace-pre-wrap">{item.source_refs}</p></div>
        )}

        <Separator />

        {/* Review controls */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Edit Value (for edited approval)</p>
          <Textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={3} className="text-sm" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Reviewer Notes</p>
          <Input value={reviewerNotes} onChange={e => setReviewerNotes(e.target.value)} placeholder="Optional review notes…" className="text-sm" />
        </div>
      </div>

      <DialogFooter className="flex-wrap gap-2 pt-2">
        <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={() => onAction(item.id, 'approved', { reviewer_notes: reviewerNotes })}>
          <Check className="h-4 w-4 mr-1" />Approve
        </Button>
        <Button size="sm" variant="outline" className="text-blue-700 border-blue-300 hover:bg-blue-50" onClick={() => onAction(item.id, 'edited', { edited_value: editValue, reviewer_notes: reviewerNotes })}>
          <Pencil className="h-4 w-4 mr-1" />Edit & Approve
        </Button>
        <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => onAction(item.id, 'rejected', { reviewer_notes: reviewerNotes })}>
          <X className="h-4 w-4 mr-1" />Reject
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onAction(item.id, 'pending', { reviewer_notes: reviewerNotes })}>
          <RotateCcw className="h-4 w-4 mr-1" />Reset to Pending
        </Button>
      </DialogFooter>
    </>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-[10px] font-medium">{label}</p>
      <p className="truncate">{value}</p>
    </div>
  );
}
