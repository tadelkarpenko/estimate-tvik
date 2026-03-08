import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEstimates, deleteEstimate, saveEstimate, nextEstimateId } from '@/lib/store';
import type { Estimate } from '@/lib/types';
import { PROJECT_CATEGORIES } from '@/lib/types';
import { generatePublicPDF, generateInternalPDF } from '@/lib/pdfGenerator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Copy, FileDown, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function EstimatesList() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const load = useCallback(async () => {
    const all = await getEstimates();
    setEstimates(all);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = estimates
    .filter(e => !search || `${e.estimate_id} ${e.project_name} ${e.client_name} ${e.city}`.toLowerCase().includes(search.toLowerCase()))
    .filter(e => typeFilter === 'all' || e.project_category === typeFilter || e.project_type === typeFilter)
    .filter(e => statusFilter === 'all' || e.status === statusFilter)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const dup = async (est: Estimate) => {
    const newId = await nextEstimateId();
    await saveEstimate({ ...est, estimate_id: newId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: 'Draft', version: 'v1.0' });
    await load();
    toast({ title: 'Duplicated', description: newId });
  };

  const del = async (id: string) => {
    if (!confirm('Delete this estimate?')) return;
    await deleteEstimate(id);
    await load();
  };

  const fmt = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Estimates</h1>
        <Button variant="gold" onClick={() => navigate('/estimates/new')}>+ New Estimate</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:max-w-xs" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {PROJECT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="Draft">Draft</SelectItem><SelectItem value="Ready">Ready</SelectItem><SelectItem value="Sent">Sent</SelectItem><SelectItem value="Accepted">Accepted</SelectItem><SelectItem value="Rejected">Rejected</SelectItem></SelectContent>
        </Select>
      </div>

      {/* Mobile card view */}
      <div className="block md:hidden space-y-2">
        {filtered.map(e => (
          <Card key={e.estimate_id} className="cursor-pointer" onClick={() => navigate(`/estimates/${e.estimate_id}`)}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{e.project_name || e.estimate_id}</p>
                  <p className="text-xs text-muted-foreground truncate">{e.client_name || '—'} · {e.city || '—'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{e.total_low > 0 ? `${fmt(e.total_low)}–${fmt(e.total_high)}` : '—'}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant={e.status === 'Accepted' ? 'default' : 'secondary'} className="text-xs">{e.status}</Badge>
                  <Badge variant="secondary" className="text-xs">{e.project_category || e.project_type}</Badge>
                </div>
              </div>
              <div className="flex gap-1 mt-2" onClick={ev => ev.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => dup(e)}><Copy className="h-3 w-3" /></Button>
                {e.subtotal > 0 && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => generatePublicPDF(e)}><FileDown className="h-3 w-3" /></Button>}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => del(e.estimate_id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground">No estimates found</p>}
      </div>

      {/* Desktop table view */}
      <Card className="hidden md:block">
        <CardContent className="pt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead><TableHead>Project</TableHead><TableHead>Client</TableHead><TableHead>Category</TableHead>
                <TableHead>City</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Range</TableHead><TableHead>Updated</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(e => (
                <TableRow key={e.estimate_id} className="cursor-pointer" onClick={() => navigate(`/estimates/${e.estimate_id}`)}>
                  <TableCell className="font-mono text-sm">{e.estimate_id}</TableCell>
                  <TableCell className="font-medium">{e.project_name || '—'}</TableCell>
                  <TableCell>{e.client_name || '—'}</TableCell>
                  <TableCell><Badge variant="secondary">{e.project_type}</Badge></TableCell>
                  <TableCell>{e.city}</TableCell>
                  <TableCell><Badge variant={e.status === 'Accepted' ? 'default' : 'secondary'}>{e.status}</Badge></TableCell>
                  <TableCell className="text-right text-sm">{e.total_low > 0 ? `${fmt(e.total_low)}–${fmt(e.total_high)}` : '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(e.updated_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={ev => ev.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/estimates/${e.estimate_id}`)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => dup(e)}><Copy className="h-4 w-4" /></Button>
                      {e.subtotal > 0 && <Button variant="ghost" size="icon" onClick={() => generatePublicPDF(e)}><FileDown className="h-4 w-4" /></Button>}
                      <Button variant="ghost" size="icon" onClick={() => del(e.estimate_id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No estimates found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
