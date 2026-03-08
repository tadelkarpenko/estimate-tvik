
CREATE TABLE public.estimate_write_execution_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  estimate_id UUID NOT NULL REFERENCES public.estimates(id),
  estimate_version TEXT NOT NULL DEFAULT '',
  write_plan_id TEXT NOT NULL DEFAULT '',
  execution_status TEXT NOT NULL DEFAULT 'pending',
  version_check_passed BOOLEAN NOT NULL DEFAULT false,
  idempotency_check_passed BOOLEAN NOT NULL DEFAULT false,
  applied_fields TEXT NOT NULL DEFAULT '[]',
  applied_line_items TEXT NOT NULL DEFAULT '[]',
  created_audit_entries TEXT NOT NULL DEFAULT '[]',
  status_updates TEXT NOT NULL DEFAULT '[]',
  requires_reapproval_applied BOOLEAN NOT NULL DEFAULT false,
  errors TEXT NOT NULL DEFAULT '[]',
  summary TEXT NOT NULL DEFAULT '',
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.estimate_write_execution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own execution_log" ON public.estimate_write_execution_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own execution_log" ON public.estimate_write_execution_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own execution_log" ON public.estimate_write_execution_log FOR UPDATE USING (auth.uid() = user_id);
