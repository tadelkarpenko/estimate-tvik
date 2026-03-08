import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJob, updateJob, validateStatusTransition, JOB_STATUSES, type Job } from '@/lib/jobStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, ExternalLink, AlertTriangle } from 'lucide-react';

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<Job>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getJob(id).then(j => {
      setJob(j);
      if (j) setDraft(j);
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    if (!job) return;
    setValidationError(null);

    // Validate status transition
    const merged = { ...job, ...draft } as Job;
    if (draft.job_status && draft.job_status !== job.job_status) {
      const err = validateStatusTransition(merged, draft.job_status);
      if (err) { setValidationError(err); return; }
    }

    // Validate start < end
    const start = draft.start_datetime || job.start_datetime;
    const end = draft.end_datetime || job.end_datetime;
    if (start && end && new Date(start) >= new Date(end)) {
      setValidationError('Start date/time must be before end date/time.');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateJob(job.id, draft);
      setJob(updated);
      setDraft(updated);
      toast({ title: 'Job saved' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof Job, value: any) => setDraft(prev => ({ ...prev, [field]: value }));

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!job) return <div className="p-6 text-muted-foreground">Job not found.</div>;

  const d = { ...job, ...draft };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/jobs')}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">{d.job_title || d.job_id}</h1>
          <p className="text-sm text-muted-foreground">{d.job_id}</p>
        </div>
        <Badge className="ml-auto" variant="outline">{d.scheduling_ready ? '✓ Scheduling Ready' : '○ Not Ready'}</Badge>
      </div>

      {validationError && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4" /> {validationError}
        </div>
      )}

      {/* Job Summary */}
      <Card>
        <CardHeader><CardTitle className="text-base">Job Summary</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Job Title</Label>
            <Input value={d.job_title} onChange={e => update('job_title', e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={d.job_status} onValueChange={v => update('job_status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{JOB_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Property Address</Label>
            <Input value={d.property_address} onChange={e => update('property_address', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader><CardTitle className="text-base">Schedule</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Start Date/Time</Label>
            <Input type="datetime-local" value={d.start_datetime ? d.start_datetime.slice(0, 16) : ''} onChange={e => update('start_datetime', e.target.value ? new Date(e.target.value).toISOString() : null)} />
          </div>
          <div>
            <Label>End Date/Time</Label>
            <Input type="datetime-local" value={d.end_datetime ? d.end_datetime.slice(0, 16) : ''} onChange={e => update('end_datetime', e.target.value ? new Date(e.target.value).toISOString() : null)} />
          </div>
        </CardContent>
      </Card>

      {/* Crew Assignment */}
      <Card>
        <CardHeader><CardTitle className="text-base">Crew Assignment</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Assigned Crew</Label>
            <Input value={d.assigned_crew} onChange={e => update('assigned_crew', e.target.value)} placeholder="e.g. Team A, John + Mike" />
          </div>
          <div>
            <Label>Crew Lead Name</Label>
            <Input value={d.crew_lead_name} onChange={e => update('crew_lead_name', e.target.value)} />
          </div>
          <div>
            <Label>Crew Lead Phone</Label>
            <Input value={d.crew_lead_phone} onChange={e => update('crew_lead_phone', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Client Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Client Info</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Name</Label><Input value={d.client_name} onChange={e => update('client_name', e.target.value)} /></div>
          <div><Label>Email</Label><Input value={d.client_email} onChange={e => update('client_email', e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={d.client_phone} onChange={e => update('client_phone', e.target.value)} /></div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader><CardTitle className="text-base">Notification Settings <span className="text-xs font-normal text-muted-foreground">(manual for now)</span></CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2"><Switch checked={d.reminder_email_enabled} onCheckedChange={v => update('reminder_email_enabled', v)} /><Label>Email</Label></div>
            <div className="flex items-center gap-2"><Switch checked={d.reminder_sms_enabled} onCheckedChange={v => update('reminder_sms_enabled', v)} /><Label>SMS</Label></div>
            <div className="flex items-center gap-2"><Switch checked={d.reminder_whatsapp_enabled} onCheckedChange={v => update('reminder_whatsapp_enabled', v)} /><Label>WhatsApp</Label></div>
            <div className="flex items-center gap-2"><Switch checked={d.reminder_telegram_enabled} onCheckedChange={v => update('reminder_telegram_enabled', v)} /><Label>Telegram</Label></div>
          </div>
          <Separator />
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><Label className="text-xs text-muted-foreground">24h Reminder</Label><Badge variant="outline">{d.reminder_24h_status}</Badge></div>
            <div><Label className="text-xs text-muted-foreground">4h Reminder</Label><Badge variant="outline">{d.reminder_4h_status}</Badge></div>
            <div><Label className="text-xs text-muted-foreground">1h Reminder</Label><Badge variant="outline">{d.reminder_1h_status}</Badge></div>
          </div>
          {d.notification_status_summary && <p className="text-xs text-muted-foreground">{d.notification_status_summary}</p>}
        </CardContent>
      </Card>

      {/* Internal Notes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Internal Notes</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={4} value={d.internal_notes} onChange={e => update('internal_notes', e.target.value)} placeholder="Private notes for internal team…" />
        </CardContent>
      </Card>

      {/* Source Estimate */}
      <Card>
        <CardHeader><CardTitle className="text-base">Source Estimate</CardTitle></CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => navigate(`/estimates/${job.estimate_id}`)}>
            <ExternalLink className="h-3 w-3 mr-1" /> Open Source Estimate
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving…' : 'Save Job'}
        </Button>
      </div>
    </div>
  );
}
