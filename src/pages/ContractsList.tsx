import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Contract } from '@/lib/contractTypes';
import { getContracts } from '@/lib/contractStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

export default function ContractsList() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const data = await getContracts();
        setContracts(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const fmt = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (n: number) => (n * 100).toFixed(1) + '%';

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold">Contracts</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniCard label="Active" value={String(contracts.filter(c => c.contract_status === 'Active').length)} />
        <MiniCard label="Total Value" value={fmt(contracts.reduce((s, c) => s + c.net_contract_value, 0))} />
        <MiniCard label="Avg Margin" value={contracts.length > 0 ? pct(contracts.reduce((s, c) => s + c.margin_current_pct, 0) / contracts.length) : '—'} />
        <MiniCard label="Fade Alerts" value={String(contracts.filter(c => c.profit_fade_flag).length)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">All Contracts</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract ID</TableHead>
                <TableHead>Signed</TableHead>
                <TableHead className="text-right">Net Value</TableHead>
                <TableHead className="text-right">% Complete</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead>Fade</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/contracts/${c.id}`)}>
                  <TableCell className="font-mono font-medium">{c.contract_id}</TableCell>
                  <TableCell>{new Date(c.signed_date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(c.net_contract_value)}</TableCell>
                  <TableCell className="text-right">{c.percent_complete.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{pct(c.margin_current_pct)}</TableCell>
                  <TableCell>
                    {c.profit_fade_flag && (
                      <div className="flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        <span className="text-xs">Fade</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.contract_status === 'Active' ? 'default' : c.contract_status === 'Completed' ? 'secondary' : 'outline'}>
                      {c.contract_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {contracts.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No contracts yet. Accept an estimate to create one.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="pt-3 pb-2 px-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-base font-bold">{value}</p></CardContent></Card>
  );
}
