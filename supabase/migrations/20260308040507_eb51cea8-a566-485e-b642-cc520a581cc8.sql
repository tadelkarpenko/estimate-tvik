
-- Add voice transcript fields to estimates
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS voice_transcript_raw text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS voice_transcript_cleaned text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS voice_detected_scope text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS voice_detected_risks text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS voice_detected_rooms text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS voice_detected_material_preferences text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS voice_last_updated_at timestamp with time zone DEFAULT NULL;

-- Create AI Suggestions Queue table
CREATE TABLE IF NOT EXISTS public.ai_suggestions_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id text NOT NULL DEFAULT gen_random_uuid()::text,
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  source_type text NOT NULL DEFAULT 'text',
  suggestion_type text NOT NULL DEFAULT 'internal_note',
  confidence text NOT NULL DEFAULT 'Medium',
  evidence_summary text NOT NULL DEFAULT '',
  reason_for_suggestion text NOT NULL DEFAULT '',
  suggested_value text NOT NULL DEFAULT '',
  apply_target text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  reviewer_notes text NOT NULL DEFAULT '',
  approved_by text NOT NULL DEFAULT '',
  approved_at timestamp with time zone DEFAULT NULL,
  rejected_at timestamp with time zone DEFAULT NULL,
  edited_value text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_suggestions_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai_suggestions_queue" ON public.ai_suggestions_queue
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai_suggestions_queue" ON public.ai_suggestions_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ai_suggestions_queue" ON public.ai_suggestions_queue
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ai_suggestions_queue" ON public.ai_suggestions_queue
  FOR DELETE USING (auth.uid() = user_id);

-- Create AI Applied Suggestions Audit table
CREATE TABLE IF NOT EXISTS public.ai_applied_suggestions_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id text NOT NULL DEFAULT gen_random_uuid()::text,
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  suggestion_id uuid NOT NULL REFERENCES public.ai_suggestions_queue(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  original_suggestion text NOT NULL DEFAULT '',
  final_applied_value text NOT NULL DEFAULT '',
  applied_field text NOT NULL DEFAULT '',
  confidence text NOT NULL DEFAULT 'Medium',
  approved_by text NOT NULL DEFAULT '',
  approved_at timestamp with time zone DEFAULT NULL,
  source_type text NOT NULL DEFAULT 'text',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_applied_suggestions_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai_applied_suggestions_audit" ON public.ai_applied_suggestions_audit
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai_applied_suggestions_audit" ON public.ai_applied_suggestions_audit
  FOR INSERT WITH CHECK (auth.uid() = user_id);
