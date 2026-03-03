import { useState, useMemo } from 'react';
import { getRiskLibrary, saveRiskLibraryItem, deleteRiskLibraryItem, uid } from '@/lib/store';
import type { RiskLibraryItem, ProjectType, RiskLevel } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const emptyItem: Partial<RiskLibraryItem> = {
  project_type: 'Full Rehab', risk_name: '', default_level: 'Medium',
  exposure_low_pct: 0.02, exposure_high_pct: 0.06, mitigation_note: '', default_included: true,
};

export default function RiskLibraryPage() {
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState<string>('all');
  const [editing, setEditing] = useState<Partial<RiskLibraryItem> | null>(null);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const items = useMemo(() => {
    const all = getRiskLibrary();
    return filter === 'all' ? all : all.filter(i => i.project_type === filter);
  }, [refresh, filter]);

  const save = () => {
    if (!editing?.risk_name) return;
    const item: RiskLibraryItem = { ...emptyItem, ...editing, id: editing.id || uid() } as RiskLibraryItem;
    saveRiskLibraryItem(item);
    setOpen(false); setEditing(null); setRefresh(r => r + 1);
    toast({ title: 'Saved' });
  };

  const del = (id: string) => { if (confirm('Delete?')) { deleteRiskLibraryItem(id); setRefresh(r => r + 1); } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Risk Library</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="gold" onClick={() => setEditing({ ...emptyItem })}><Plus className="mr-1 h-4 w-4" />Add Risk</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing?.id ? 'Edit' : 'Add'} Risk</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Project Type</Label><Select value={editing.project_type} onValueChange={v => setEditing({ ...editing, project_type: v as ProjectType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Bath">Bath</SelectItem><SelectItem value="Full Rehab">Full Rehab</SelectItem></SelectContent></Select></div>
                  <div><Label>Default Level</Label><Select value={editing.default_level} onValueChange={v => setEditing({ ...editing, default_level: v as RiskLevel })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Low">Low</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="High">High</SelectItem></SelectContent></Select></div>
                </div>
                <div><Label>Risk Name</Label><Input value={editing.risk_name || ''} onChange={e => setEditing({ ...editing, risk_name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Exposure Low %</Label><Input type="number" step="0.01" value={editing.exposure_low_pct ?? 0.02} onChange={e => setEditing({ ...editing, exposure_low_pct: Number(e.target.value) })} /></div>
                  <div><Label>Exposure High %</Label><Input type="number" step="0.01" value={editing.exposure_high_pct ?? 0.06} onChange={e => setEditing({ ...editing, exposure_high_pct: Number(e.target.value) })} /></div>
                </div>
                <div><Label>Mitigation Note</Label><Input value={editing.mitigation_note || ''} onChange={e => setEditing({ ...editing, mitigation_note: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Switch checked={editing.default_included} onCheckedChange={v => setEditing({ ...editing, default_included: v })} /><Label>Default Included</Label></div>
                <Button onClick={save} className="w-full">Save</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="Bath">Bath</SelectItem><SelectItem value="Full Rehab">Full Rehab</SelectItem></SelectContent>
      </Select>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Risk</TableHead><TableHead>Level</TableHead><TableHead className="text-right">Low %</TableHead><TableHead className="text-right">High %</TableHead><TableHead>Mitigation</TableHead><TableHead>Incl</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm">{item.project_type}</TableCell>
                  <TableCell className="font-medium">{item.risk_name}</TableCell>
                  <TableCell><Badge variant={item.default_level === 'High' ? 'destructive' : 'secondary'}>{item.default_level}</Badge></TableCell>
                  <TableCell className="text-right">{(item.exposure_low_pct * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{(item.exposure_high_pct * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-sm">{item.mitigation_note}</TableCell>
                  <TableCell>{item.default_included ? '✓' : '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing({ ...item }); setOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => del(item.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
