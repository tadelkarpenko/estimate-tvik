import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getHealthChecks, type EstimateHealthCheck } from '@/lib/healthCheckStore';
import { Activity, Database } from 'lucide-react';

export default function AdminPage() {
  const [newPw, setNewPw] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Collection verification
  const [collectionStatus, setCollectionStatus] = useState<Record<string, { exists: boolean; count: number }>>({});
  const [verifying, setVerifying] = useState(false);

  // Health checks
  const [healthChecks, setHealthChecks] = useState<EstimateHealthCheck[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthEstimateId, setHealthEstimateId] = useState('');

  const changePw = async () => {
    if (newPw.length < 6) { toast({ title: 'Password must be at least 6 characters', variant: 'destructive' }); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setLoading(false);
    if (error) {
      toast({ title: error.message, variant: 'destructive' });
    } else {
      setNewPw('');
      toast({ title: 'Password updated' });
    }
  };

  const verifyCollections = async () => {
    setVerifying(true);
    const tables = ['estimate_areas', 'ai_suggestions_queue', 'ai_applied_suggestions_audit', 'estimate_health_checks'];
    const results: Record<string, { exists: boolean; count: number }> = {};
    for (const table of tables) {
      try {
        const { count, error } = await supabase.from(table as any).select('*', { count: 'exact', head: true });
        results[table] = { exists: !error, count: count || 0 };
      } catch {
        results[table] = { exists: false, count: 0 };
      }
    }
    setCollectionStatus(results);
    setVerifying(false);
    toast({ title: 'Collection verification complete' });
  };

  const loadHealthChecks = async () => {
    if (!healthEstimateId.trim()) {
      // Load all via direct query
      setHealthLoading(true);
      const { data, error } = await supabase.from('estimate_health_checks').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) {
        toast({ title: 'Failed to load', description: error.message, variant: 'destructive' });
      } else {
        setHealthChecks((data || []) as unknown as EstimateHealthCheck[]);
      }
      setHealthLoading(false);
      return;
    }
    setHealthLoading(true);
    try {
      const checks = await getHealthChecks(healthEstimateId.trim());
      setHealthChecks(checks);
    } catch (e: any) {
      toast({ title: 'Failed to load', description: e.message, variant: 'destructive' });
    }
    setHealthLoading(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Admin</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Signed in as: {user?.email}</p>
          <div><Label>New Password</Label><Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} /></div>
          <Button onClick={changePw} disabled={loading}>{loading ? 'Updating…' : 'Update Password'}</Button>
        </CardContent>
      </Card>

      {/* Collection Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" />Collection Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" size="sm" onClick={verifyCollections} disabled={verifying}>
            {verifying ? 'Verifying…' : 'Verify 4 Core Collections'}
          </Button>
          {Object.keys(collectionStatus).length > 0 && (
            <div className="space-y-2">
              {Object.entries(collectionStatus).map(([table, info]) => (
                <div key={table} className="flex items-center gap-2 text-sm">
                  <Badge variant={info.exists ? 'default' : 'destructive'} className="text-xs">
                    {info.exists ? '✓' : '✗'}
                  </Badge>
                  <span className="font-mono text-xs">{table}</span>
                  <span className="text-muted-foreground text-xs">({info.count} rows)</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Health Checks Browser */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" />Estimate Health Checks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">Estimate ID (leave blank for all)</Label>
              <Input value={healthEstimateId} onChange={e => setHealthEstimateId(e.target.value)} placeholder="UUID…" className="text-xs" />
            </div>
            <Button variant="outline" size="sm" onClick={loadHealthChecks} disabled={healthLoading}>
              {healthLoading ? 'Loading…' : 'Load'}
            </Button>
          </div>
          {healthChecks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No health check records found. These will be created by future completeness engine patches.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {healthChecks.map(hc => (
                <div key={hc.id} className="border rounded p-3 space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{hc.block_source}</Badge>
                    <Badge variant={hc.warning_level === 'High' ? 'destructive' : 'outline'}>{hc.warning_level}</Badge>
                    <Badge variant="outline">{hc.confidence_rollup}</Badge>
                    {hc.site_visit_recommended && <Badge variant="destructive">Site Visit</Badge>}
                    {hc.block_approval && <Badge>Blocked</Badge>}
                  </div>
                  <p className="text-muted-foreground">Score: {hc.completeness_score} · {hc.created_at ? new Date(hc.created_at).toLocaleString() : ''}</p>
                  {hc.mismatch_summary && <p>{hc.mismatch_summary}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">System</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Version: 1.0.0 | Data stored in Lovable Cloud</p>
        </CardContent>
      </Card>
    </div>
  );
}
