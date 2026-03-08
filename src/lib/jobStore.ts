import { supabase } from '@/integrations/supabase/client';

export interface Job {
  id: string;
  job_id: string;
  estimate_id: string;
  user_id: string;
  job_title: string;
  property_address: string;
  job_status: string;
  start_datetime: string | null;
  end_datetime: string | null;
  assigned_crew: string;
  crew_lead_name: string;
  crew_lead_phone: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  internal_notes: string;
  reminder_email_enabled: boolean;
  reminder_sms_enabled: boolean;
  reminder_whatsapp_enabled: boolean;
  reminder_telegram_enabled: boolean;
  reminder_24h_status: string;
  reminder_4h_status: string;
  reminder_1h_status: string;
  calendar_event_id: string;
  notification_status_summary: string;
  created_from_estimate: boolean;
  scheduling_ready: boolean;
  last_notification_at: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export const JOB_STATUSES = ['Draft', 'Scheduled', 'Confirmed', 'In Progress', 'On Hold', 'Completed', 'Cancelled'] as const;
export type JobStatus = typeof JOB_STATUSES[number];

const REMINDER_STATUSES = ['Not Sent', 'Queued', 'Sent', 'Failed', 'Skipped'] as const;

async function getUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}

export async function getJobs(): Promise<Job[]> {
  const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as Job[];
}

export async function getJob(id: string): Promise<Job | null> {
  const { data, error } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as unknown as Job | null;
}

export async function getJobByEstimateId(estimateId: string): Promise<Job | null> {
  const { data, error } = await supabase.from('jobs').select('*').eq('estimate_id', estimateId).maybeSingle();
  if (error) throw error;
  return data as unknown as Job | null;
}

export async function createJob(fields: {
  estimate_id: string;
  job_title: string;
  property_address: string;
  client_name: string;
  client_email: string;
  client_phone: string;
}): Promise<Job> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  // Generate job_id
  const count = await supabase.from('jobs').select('id', { count: 'exact', head: true });
  const num = (count.count || 0) + 1;
  const job_id = `JOB-${String(num).padStart(4, '0')}`;

  const { data, error } = await supabase.from('jobs').insert({
    job_id,
    estimate_id: fields.estimate_id,
    user_id: userId,
    job_title: fields.job_title,
    property_address: fields.property_address,
    client_name: fields.client_name,
    client_email: fields.client_email,
    client_phone: fields.client_phone,
    created_from_estimate: true,
    created_by: 'TVIK',
  } as any).select().single();
  if (error) throw error;
  return data as unknown as Job;
}

export async function updateJob(id: string, updates: Partial<Job>): Promise<Job> {
  // Compute scheduling_ready
  const scheduling_ready = !!(updates.start_datetime && updates.end_datetime && updates.property_address);
  
  const { data, error } = await supabase.from('jobs').update({
    ...updates,
    scheduling_ready,
    updated_by: 'TVIK',
  } as any).eq('id', id).select().single();
  if (error) throw error;
  return data as unknown as Job;
}

export function validateStatusTransition(job: Job, newStatus: string): string | null {
  if (newStatus === 'Scheduled' && (!job.start_datetime || !job.end_datetime)) {
    return 'Cannot set status to Scheduled without start and end dates.';
  }
  if (newStatus === 'Scheduled' && !job.property_address) {
    return 'Cannot set status to Scheduled without a property address.';
  }
  return null;
}
