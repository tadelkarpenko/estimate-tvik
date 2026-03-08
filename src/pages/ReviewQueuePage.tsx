import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  getSuggestions, updateSuggestionStatus,
  SUGGESTION_TYPE_LABELS, SUGGESTION_STATUS_COLORS,
  type AISuggestion, type SuggestionStatus, type SuggestionType,
} from '@/lib/suggestionStore';
import { ClipboardList, Filter, Eye, Check, X, Pencil, RotateCcw } from 'lucide-react';

type EstimateMeta = { id: string; estimate_id: string; project_name: string };

export default function ReviewQueuePage() {
  const { toast } = useToast();
  const [estimates, setEstimates] = useState<EstimateMeta[]>([]);
  const [selectedEstimate, setSelectedEstimate] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail dialog
  const [detailItem, setDetailItem] = useState<AISuggestion | null>(null);
  const [editValue, setEditValue] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');

  const loadEstimates = useCallback(async () => {
    const { data } = await supabase
      .from('estimates')
      .select('id, estimate_id, project_name')
      .order('created_at', { ascending: false })
      .limit(100);
    setEstimates((data || []) as EstimateMeta[]);
  }, []);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      if (selectedEstimate === 'all') {
        const { data, error } = await supabase
          .from('ai_suggestions_queue')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);
        if (error) throw error;
        setSuggestions((data || []) as unknown as AISuggestion[]);
      } else {
        const items = await getSuggestions(selectedEstimate);
        setSuggestions(items);
      }
    } catch (e: any) {
      toast({ title: 'Failed to load queue', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  }, [selectedEstimate, toast]);

  useEffect(() => { loadEstimates(); }, [loadEstimates]);
  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);

  const filtered = suggestions.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (typeFilter !== 'all' && s.suggestion_type !== typeFilter) return false;
    return true;
  });

  const handleAction = async (id: string, action: SuggestionStatus, extras?: { edited_value?: string; reviewer_notes?: string }) => {
    try {
      await updateSuggestionStatus(id, action, extras);
      toast({ title: `Suggestion ${action}` });
      await loadSuggestions();
      setDetailItem(null);
    } catch (e: any) {
      toast({ title: 'Action failed', description: e.message, variant: 'destructive' });
    }
  };

  const getEstimateName = (estId: string) => {
    const e = estimates.find(x => x.id === estId);
    return e ? (e.project_name || e.estimate_id) : estId.slice(0, 8);
  };

  const statusCounts = {
    all: suggestions.length,
    pending: suggestions.filter(s => s.status === 'pending').length,
    approved: suggestions.filter(s => s.status === 'approved').length,
    edited: suggestions.filter(s => s.status === 'edited').length,
    rejected: suggestions.filter(s => s.status === 'rejected').length,
    applied: suggestions.filter(s => s.status === 'applied').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">AI Review Queue</h1>
        <Badge variant="outline" className="ml-auto text-sm">{filtered.length} items</Badge>
      </div>

      {/* Status summary badges */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'approved', 'edited', 'rejected', 'applied'] as const).map(s => (
          <Badge
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            className="cursor-pointer capitalize"
            onClick={() => setStatusFilter(s)}
          >
            {s} ({statusCounts[s]})
          </Badge>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-1 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Filter className="h-3 w-3" />Estimate</label>
            <Select value={selectedEstimate} onValueChange={setSelectedEstimate}>
              <SelectTrigger><SelectValue placeholder="All estimates" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Estimates</SelectItem>
                {estimates.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.project_name || e.estimate_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-[180px]">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(SUGGESTION_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={loadSuggestions}>Refresh</Button>
        </CardContent>
      </Card>

      {/* Queue items */}
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No suggestions in queue. Use AI Intake Assistant to generate suggestions.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => (
            <Card key={s.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">{SUGGESTION_TYPE_LABELS[s.suggestion_type] || s.suggestion_type}</Badge>
                    <Badge className={`text-xs border ${SUGGESTION_STATUS_COLORS[s.status]}`}>{s.status}</Badge>
                    <Badge variant="outline" className="text-xs">{s.confidence}</Badge>
                    <span className="text-xs text-muted-foreground">{s.source_type}</span>
                  </div>
                  <p className="text-sm font-medium truncate">{s.suggested_value.slice(0, 120)}{s.suggested_value.length > 120 ? '…' : ''}</p>
                  <p className="text-xs text-muted-foreground truncate">Estimate: {getEstimateName(s.estimate_id)} · Target: {s.apply_target}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" title="View details" onClick={() => { setDetailItem(s); setEditValue(s.edited_value || s.suggested_value); setReviewerNotes(s.reviewer_notes); }}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {s.status === 'pending' && (
                    <>
                      <Button size="sm" variant="ghost" className="text-emerald-600" title="Approve" onClick={() => handleAction(s.id, 'approved')}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600" title="Reject" onClick={() => handleAction(s.id, 'rejected')}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {(s.status !== 'pending') && (
                    <Button size="sm" variant="ghost" className="text-muted-foreground" title="Reset to pending" onClick={() => handleAction(s.id, 'pending')}>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {detailItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Badge variant="outline">{SUGGESTION_TYPE_LABELS[detailItem.suggestion_type]}</Badge>
                  <Badge className={`border ${SUGGESTION_STATUS_COLORS[detailItem.status]}`}>{detailItem.status}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Suggested Value</p>
                  <p className="bg-muted p-2 rounded text-sm whitespace-pre-wrap">{detailItem.suggested_value}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs font-medium text-muted-foreground">Confidence</p><p>{detailItem.confidence}</p></div>
                  <div><p className="text-xs font-medium text-muted-foreground">Source</p><p>{detailItem.source_type}</p></div>
                  <div><p className="text-xs font-medium text-muted-foreground">Target Field</p><p>{detailItem.apply_target}</p></div>
                  <div><p className="text-xs font-medium text-muted-foreground">Estimate</p><p>{getEstimateName(detailItem.estimate_id)}</p></div>
                </div>
                {detailItem.evidence_summary && (
                  <div><p className="text-xs font-medium text-muted-foreground mb-1">Evidence</p><p className="text-sm">{detailItem.evidence_summary}</p></div>
                )}
                {detailItem.reason_for_suggestion && (
                  <div><p className="text-xs font-medium text-muted-foreground mb-1">Reason</p><p className="text-sm">{detailItem.reason_for_suggestion}</p></div>
                )}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Edit Value (for edited approval)</p>
                  <Textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={3} />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Reviewer Notes</p>
                  <Input value={reviewerNotes} onChange={e => setReviewerNotes(e.target.value)} placeholder="Optional notes…" />
                </div>
              </div>
              <DialogFooter className="flex-wrap gap-2">
                <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-300" onClick={() => handleAction(detailItem.id, 'approved', { reviewer_notes: reviewerNotes })}>
                  <Check className="h-4 w-4 mr-1" />Approve
                </Button>
                <Button size="sm" variant="outline" className="text-blue-600 border-blue-300" onClick={() => handleAction(detailItem.id, 'edited', { edited_value: editValue, reviewer_notes: reviewerNotes })}>
                  <Pencil className="h-4 w-4 mr-1" />Edit & Approve
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-300" onClick={() => handleAction(detailItem.id, 'rejected', { reviewer_notes: reviewerNotes })}>
                  <X className="h-4 w-4 mr-1" />Reject
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleAction(detailItem.id, 'pending', { reviewer_notes: reviewerNotes })}>
                  <RotateCcw className="h-4 w-4 mr-1" />Reset
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
