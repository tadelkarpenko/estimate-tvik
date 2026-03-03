import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function AdminPage() {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const { toast } = useToast();

  const changePw = () => {
    const stored = localStorage.getItem('tvik_admin_password') || 'tvik2024';
    if (currentPw !== stored) { toast({ title: 'Current password incorrect', variant: 'destructive' }); return; }
    if (newPw.length < 4) { toast({ title: 'Password too short', variant: 'destructive' }); return; }
    localStorage.setItem('tvik_admin_password', newPw);
    setCurrentPw(''); setNewPw('');
    toast({ title: 'Password updated' });
  };

  const clearData = () => {
    if (!confirm('Clear ALL data? This cannot be undone.')) return;
    const pw = localStorage.getItem('tvik_admin_password');
    localStorage.clear();
    if (pw) localStorage.setItem('tvik_admin_password', pw);
    window.location.reload();
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">Admin</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Change Password</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Current Password</Label><Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} /></div>
          <div><Label>New Password</Label><Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} /></div>
          <Button onClick={changePw}>Update Password</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">System</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Version: 1.0.0 | Data stored in browser localStorage</p>
          <Button variant="destructive" onClick={clearData}>Clear All Data</Button>
        </CardContent>
      </Card>
    </div>
  );
}
