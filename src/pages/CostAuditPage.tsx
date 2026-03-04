import { useState, useEffect, useCallback } from 'react';
import { getCostAudits, saveCostAudit } from '@/lib/store';
import type { CostAudit, AuditStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export default function CostAuditPage() {
  const [audits, setAudits] = useState<CostAudit[]>([]);
  const [selected, setSelected] = useState<CostAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const all = await getCostAudits();
    setAudits(all);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (audit: CostAudit, status: AuditStatus) => {
    await saveCostAudit({ ...audit, status });
    setSelected({ ...audit, status });
    await load();
    toast({ title: `Marked ${status}` });
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cost Audit</h1>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader><TableRow><TableHead>Estimate</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {audits.map(a => (
                <TableRow key={a.id} className="cursor-pointer" onClick={() => setSelected(a)}>
                  <TableCell className="font-mono">{a.estimate_id}</TableCell>
                  <TableCell>{new Date(a.created_at).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant={a.status === 'Open' ? 'destructive' : 'secondary'}>{a.status}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="sm">View</Button></TableCell>
                </TableRow>
              ))}
              {audits.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No audit records</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Audit: {selected?.estimate_id}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <Badge variant={selected.status === 'Open' ? 'destructive' : 'secondary'}>{selected.status}</Badge>
              <Card>
                <CardHeader><CardTitle className="text-sm">Findings & Recommendations</CardTitle></CardHeader>
                <CardContent><pre className="whitespace-pre-wrap text-sm">{selected.recommended_actions}</pre></CardContent>
              </Card>
              {selected.status === 'Open' && (
                <div className="flex gap-2">
                  <Button onClick={() => updateStatus(selected, 'Accepted')}>Accept</Button>
                  <Button variant="secondary" onClick={() => updateStatus(selected, 'Ignored')}>Ignore</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
