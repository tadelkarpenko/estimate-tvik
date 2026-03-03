import { useState, useMemo } from 'react';
import { getCostLibrary, saveCostLibraryItem, deleteCostLibraryItem, uid } from '@/lib/store';
import type { CostLibraryItem, ProjectType, QtyRule } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const emptyItem: Partial<CostLibraryItem> = {
  project_type: 'Full Rehab', trade: '', description: '', qty_rule: 'sqft',
  default_included: true, labor_unit_cost: 0, material_unit_cost: 0, unit_label: 'sf', notes: '',
};

export default function CostLibraryPage() {
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState<string>('all');
  const [editing, setEditing] = useState<Partial<CostLibraryItem> | null>(null);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const items = useMemo(() => {
    const all = getCostLibrary();
    return filter === 'all' ? all : all.filter(i => i.project_type === filter);
  }, [refresh, filter]);

  const save = () => {
    if (!editing?.trade) return;
    const item: CostLibraryItem = {
      ...emptyItem, ...editing,
      id: editing.id || uid(),
      last_updated: new Date().toISOString().split('T')[0],
    } as CostLibraryItem;
    saveCostLibraryItem(item);
    setOpen(false);
    setEditing(null);
    setRefresh(r => r + 1);
    toast({ title: 'Saved' });
  };

  const del = (id: string) => { if (confirm('Delete?')) { deleteCostLibraryItem(id); setRefresh(r => r + 1); } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cost Library</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="gold" onClick={() => setEditing({ ...emptyItem })}><Plus className="mr-1 h-4 w-4" />Add Row</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing?.id ? 'Edit' : 'Add'} Cost Item</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Project Type</Label><Select value={editing.project_type} onValueChange={v => setEditing({ ...editing, project_type: v as ProjectType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Bath">Bath</SelectItem><SelectItem value="Full Rehab">Full Rehab</SelectItem></SelectContent></Select></div>
                  <div><Label>Qty Rule</Label><Select value={editing.qty_rule} onValueChange={v => setEditing({ ...editing, qty_rule: v as QtyRule })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sqft">sqft</SelectItem><SelectItem value="fixture">fixture</SelectItem><SelectItem value="lump_sum">lump_sum</SelectItem><SelectItem value="each">each</SelectItem><SelectItem value="lf">lf</SelectItem></SelectContent></Select></div>
                </div>
                <div><Label>Trade</Label><Input value={editing.trade || ''} onChange={e => setEditing({ ...editing, trade: e.target.value })} /></div>
                <div><Label>Description</Label><Input value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Labor $/unit</Label><Input type="number" step="0.01" value={editing.labor_unit_cost ?? 0} onChange={e => setEditing({ ...editing, labor_unit_cost: Number(e.target.value) })} /></div>
                  <div><Label>Material $/unit</Label><Input type="number" step="0.01" value={editing.material_unit_cost ?? 0} onChange={e => setEditing({ ...editing, material_unit_cost: Number(e.target.value) })} /></div>
                  <div><Label>Unit Label</Label><Input value={editing.unit_label || ''} onChange={e => setEditing({ ...editing, unit_label: e.target.value })} /></div>
                </div>
                <div><Label>Notes</Label><Input value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Trade</TableHead><TableHead>Desc</TableHead><TableHead>Rule</TableHead><TableHead className="text-right">Labor</TableHead><TableHead className="text-right">Material</TableHead><TableHead>Unit</TableHead><TableHead>Incl</TableHead><TableHead>Updated</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">{item.project_type}</TableCell>
                    <TableCell className="font-medium">{item.trade}</TableCell>
                    <TableCell className="text-sm">{item.description}</TableCell>
                    <TableCell className="text-sm">{item.qty_rule}</TableCell>
                    <TableCell className="text-right">${item.labor_unit_cost.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${item.material_unit_cost.toFixed(2)}</TableCell>
                    <TableCell>{item.unit_label}</TableCell>
                    <TableCell>{item.default_included ? '✓' : '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.last_updated}</TableCell>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
