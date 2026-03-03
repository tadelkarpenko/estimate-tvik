import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) { navigate('/admin-dashboard', { replace: true }); return null; }

  const lockUntil = parseInt(localStorage.getItem('tvik_lockout') || '0', 10);
  const isLocked = lockUntil > Date.now();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) { setError('Too many attempts. Try again in 30 seconds.'); return; }
    if (login(password)) {
      navigate('/admin-dashboard', { replace: true });
    } else {
      setError('Invalid password');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 text-2xl font-bold text-primary">TVIK LLC</div>
          <CardTitle className="text-lg">Estimator Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLocked}>
              {isLocked ? 'Locked — wait 30s' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
