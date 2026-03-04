
-- Add fields to estimate_line_items
ALTER TABLE public.estimate_line_items
  ADD COLUMN IF NOT EXISTS include_in_public_pdf boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_in_internal_pdf boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by text NOT NULL DEFAULT 'Manual';

-- Contract Media
CREATE TABLE public.contract_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  media_id text NOT NULL,
  file_url text NOT NULL DEFAULT '',
  caption text NOT NULL DEFAULT '',
  include_in_internal_pdf boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own contract_media" ON public.contract_media FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contract_media" ON public.contract_media FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contract_media" ON public.contract_media FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contract_media" ON public.contract_media FOR DELETE USING (auth.uid() = user_id);

-- Contract Media Analysis
CREATE TABLE public.contract_media_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES public.contract_media(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  analysis_id text NOT NULL,
  observed_conditions_json text NOT NULL DEFAULT '{}',
  conditional_items_json text NOT NULL DEFAULT '[]',
  allowance_risk_flags_json text NOT NULL DEFAULT '[]',
  questions_needed_json text NOT NULL DEFAULT '[]',
  confidence text NOT NULL DEFAULT 'Medium',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_media_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own contract_media_analysis" ON public.contract_media_analysis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contract_media_analysis" ON public.contract_media_analysis FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contract_media_analysis" ON public.contract_media_analysis FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contract_media_analysis" ON public.contract_media_analysis FOR DELETE USING (auth.uid() = user_id);

-- Contract Chat Threads
CREATE TABLE public.contract_chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  thread_id text NOT NULL,
  title text NOT NULL DEFAULT 'Assistant',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own contract_chat_threads" ON public.contract_chat_threads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contract_chat_threads" ON public.contract_chat_threads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contract_chat_threads" ON public.contract_chat_threads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contract_chat_threads" ON public.contract_chat_threads FOR DELETE USING (auth.uid() = user_id);

-- Contract Chat Messages
CREATE TABLE public.contract_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.contract_chat_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message_id text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL DEFAULT '',
  suggested_changes_json text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own contract_chat_messages" ON public.contract_chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contract_chat_messages" ON public.contract_chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contract_chat_messages" ON public.contract_chat_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contract_chat_messages" ON public.contract_chat_messages FOR DELETE USING (auth.uid() = user_id);
