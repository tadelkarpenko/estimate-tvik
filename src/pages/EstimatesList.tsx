import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEstimates, deleteEstimate, saveEstimate, nextEstimateId } from '@/lib/store';
import type { Estimate } from '@/lib/types';
import { generatePublicPDF, generateInternalPDF } from '@/lib/pdfGenerator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Copy, FileDown, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function EstimatesList() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refresh, setRefresh] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  const estimates = useMemo(() => {
    let list = getEstimates();
    if (search) list = list.filter(e => `${e.estimate_id} ${e.project_name} ${e.client_name} ${e.city}`.toLowerCase().includes(search.toLowerCase()));
    if (typeFilter !== 'all') list = list.filter(e => e.project_type === typeFilter);
    if (statusFilter !== 'all') list = list.filter(e => e.status === statusFilter);
    return list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [search, typeFilter, statusFilter, refresh]);

  const dup = (est: Estimate) => {
    const newId = nextEstimateId();
    saveEstimate({ ...est, estimate_id: newId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: 'Draft', version: 'v1.0' });
    setRefresh(r => r + 1);
    toast({ title: 'Duplicated', description: newId });
  };

  const del = (id: string) => {
    if (!confirm('Delete this estimate?')) return;
    deleteEstimate(id);
    setRefresh(r => r + 1);
  };

  const fmt = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Estimates</h1>
        <Button variant="gold" onClick={() => navigate('/estimates/new')}>+ New Estimate</Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="Bath">Bath</SelectItem><SelectItem value="Full Rehab">Full Rehab</SelectItem></SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="Draft">Draft</SelectItem><SelectItem value="Ready">Ready</SelectItem><SelectItem value="Sent">Sent</SelectItem><SelectItem value="Accepted">Accepted</SelectItem><SelectItem value="Rejected">Rejected</SelectItem></SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead><TableHead>Project</TableHead><TableHead>Client</TableHead><TableHead>Type</TableHead>
                <TableHead>City</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Range</TableHead><TableHead>Updated</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estimates.map(e => (
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
              {estimates.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No estimates found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
