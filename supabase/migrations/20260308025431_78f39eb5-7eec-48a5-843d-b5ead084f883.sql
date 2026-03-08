
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL,
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  job_title text NOT NULL DEFAULT '',
  property_address text NOT NULL DEFAULT '',
  job_status text NOT NULL DEFAULT 'Draft',
  start_datetime timestamptz,
  end_datetime timestamptz,
  assigned_crew text NOT NULL DEFAULT '',
  crew_lead_name text NOT NULL DEFAULT '',
  crew_lead_phone text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  client_email text NOT NULL DEFAULT '',
  client_phone text NOT NULL DEFAULT '',
  internal_notes text NOT NULL DEFAULT '',
  reminder_email_enabled boolean NOT NULL DEFAULT true,
  reminder_sms_enabled boolean NOT NULL DEFAULT false,
  reminder_whatsapp_enabled boolean NOT NULL DEFAULT false,
  reminder_telegram_enabled boolean NOT NULL DEFAULT false,
  reminder_24h_status text NOT NULL DEFAULT 'Not Sent',
  reminder_4h_status text NOT NULL DEFAULT 'Not Sent',
  reminder_1h_status text NOT NULL DEFAULT 'Not Sent',
  calendar_event_id text NOT NULL DEFAULT '',
  notification_status_summary text NOT NULL DEFAULT '',
  created_from_estimate boolean NOT NULL DEFAULT true,
  scheduling_ready boolean NOT NULL DEFAULT false,
  last_notification_at timestamptz,
  created_by text NOT NULL DEFAULT 'TVIK',
  updated_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs" ON public.jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own jobs" ON public.jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jobs" ON public.jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own jobs" ON public.jobs FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
