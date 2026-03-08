import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getJobs, type Job, JOB_STATUSES } from '@/lib/jobStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

const statusColor: Record<string, string> = {
  Draft: 'bg-muted text-muted-foreground',
  Scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  Confirmed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  'In Progress': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  'On Hold': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  Completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  Cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    getJobs().then(j => { setJobs(j); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = jobs.filter(j => {
    if (statusFilter !== 'all' && j.job_status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return j.job_title.toLowerCase().includes(s) || j.client_name.toLowerCase().includes(s) || j.property_address.toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
        <div className="flex gap-2">
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="w-48" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {JOB_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-muted-foreground">No jobs found. Create a job from an approved estimate.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Crew</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(j => (
                  <TableRow key={j.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/jobs/${j.id}`)}>
                    <TableCell className="font-mono text-xs">{j.job_id}</TableCell>
                    <TableCell>{j.job_title || '—'}</TableCell>
                    <TableCell>{j.client_name || '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{j.property_address || '—'}</TableCell>
                    <TableCell>{j.start_datetime ? format(new Date(j.start_datetime), 'MMM d, yyyy h:mm a') : '—'}</TableCell>
                    <TableCell>{j.end_datetime ? format(new Date(j.end_datetime), 'MMM d, yyyy h:mm a') : '—'}</TableCell>
                    <TableCell><Badge className={statusColor[j.job_status] || ''}>{j.job_status}</Badge></TableCell>
                    <TableCell>{j.assigned_crew || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
