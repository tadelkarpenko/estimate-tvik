import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getJobs, type Job, JOB_STATUSES } from '@/lib/jobStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { format, startOfWeek, addDays, isSameDay, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';

const statusColor: Record<string, string> = {
  Draft: 'border-l-muted-foreground',
  Scheduled: 'border-l-blue-500',
  Confirmed: 'border-l-emerald-500',
  'In Progress': 'border-l-amber-500',
  'On Hold': 'border-l-orange-500',
  Completed: 'border-l-green-500',
  Cancelled: 'border-l-red-500',
};

export default function JobCalendar() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [view, setView] = useState<'week' | 'list'>('week');
  const navigate = useNavigate();

  useEffect(() => {
    getJobs().then(j => { setJobs(j); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = jobs.filter(j => statusFilter === 'all' || j.job_status === statusFilter);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const getJobsForDay = (day: Date) =>
    filtered.filter(j => {
      if (!j.start_datetime) return false;
      const start = parseISO(j.start_datetime);
      const end = j.end_datetime ? parseISO(j.end_datetime) : start;
      return isSameDay(start, day) || isSameDay(end, day) || isWithinInterval(day, { start: startOfDay(start), end: endOfDay(end) });
    });

  const unscheduled = filtered.filter(j => !j.start_datetime);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">Job Calendar</h1>
        <div className="flex gap-2 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {JOB_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setView(view === 'week' ? 'list' : 'week')}>
            {view === 'week' ? <List className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-medium text-foreground">{format(weekDays[0], 'MMM d')} – {format(weekDays[6], 'MMM d, yyyy')}</span>
        <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Today</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : view === 'week' ? (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(day => {
            const dayJobs = getJobsForDay(day);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()} className={`min-h-[120px] rounded-lg border p-2 ${isToday ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <p className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  {format(day, 'EEE d')}
                </p>
                <div className="space-y-1">
                  {dayJobs.map(j => (
                    <div
                      key={j.id}
                      className={`border-l-2 ${statusColor[j.job_status] || ''} bg-card rounded px-1.5 py-1 cursor-pointer hover:bg-accent/50 transition-colors`}
                      onClick={() => navigate(`/jobs/${j.id}`)}
                    >
                      <p className="text-xs font-medium truncate">{j.job_title || j.job_id}</p>
                      {j.start_datetime && <p className="text-[10px] text-muted-foreground">{format(parseISO(j.start_datetime), 'h:mm a')}</p>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.filter(j => j.start_datetime).sort((a, b) => (a.start_datetime || '').localeCompare(b.start_datetime || '')).map(j => (
            <Card key={j.id} className="cursor-pointer hover:bg-accent/30" onClick={() => navigate(`/jobs/${j.id}`)}>
              <CardContent className="p-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{j.job_title || j.job_id}</p>
                  <p className="text-xs text-muted-foreground">{j.client_name} · {j.property_address}</p>
                  {j.start_datetime && <p className="text-xs text-muted-foreground">{format(parseISO(j.start_datetime), 'MMM d, yyyy h:mm a')}</p>}
                </div>
                <Badge variant="outline">{j.job_status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Unscheduled jobs */}
      {unscheduled.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Unscheduled Jobs ({unscheduled.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {unscheduled.map(j => (
              <div key={j.id} className="flex justify-between items-center p-2 rounded border cursor-pointer hover:bg-accent/30" onClick={() => navigate(`/jobs/${j.id}`)}>
                <div>
                  <p className="text-sm font-medium">{j.job_title || j.job_id}</p>
                  <p className="text-xs text-muted-foreground">{j.client_name}</p>
                </div>
                <Badge variant="outline">{j.job_status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
