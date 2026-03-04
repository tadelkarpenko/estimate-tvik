
-- =============================================
-- EXTEND cost_library
-- =============================================
ALTER TABLE public.cost_library
  ADD COLUMN labor_hours_per_unit numeric NOT NULL DEFAULT 0,
  ADD COLUMN crew_trade text NOT NULL DEFAULT 'General',
  ADD COLUMN productivity_note text NOT NULL DEFAULT '',
  ADD COLUMN active boolean NOT NULL DEFAULT true;

-- =============================================
-- EXTEND estimates
-- =============================================
ALTER TABLE public.estimates
  ADD COLUMN crew_size numeric NOT NULL DEFAULT 2,
  ADD COLUMN hours_per_day numeric NOT NULL DEFAULT 8,
  ADD COLUMN subtotal_labor_hours numeric NOT NULL DEFAULT 0,
  ADD COLUMN estimated_duration_days numeric NOT NULL DEFAULT 0,
  ADD COLUMN internal_notes text NOT NULL DEFAULT '',
  ADD COLUMN public_notes text NOT NULL DEFAULT '';

-- =============================================
-- CREATE estimate_line_items
-- =============================================
CREATE TABLE public.estimate_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id text NOT NULL UNIQUE,
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  phase text NOT NULL DEFAULT 'Other',
  description text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'ea',
  qty numeric NOT NULL DEFAULT 0,
  labor_unit_cost numeric NOT NULL DEFAULT 0,
  material_unit_cost numeric NOT NULL DEFAULT 0,
  labor_hours_per_unit numeric NOT NULL DEFAULT 0,
  labor_hours_total numeric NOT NULL DEFAULT 0,
  labor_total numeric NOT NULL DEFAULT 0,
  material_total numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'Manual',
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own estimate_line_items" ON public.estimate_line_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own estimate_line_items" ON public.estimate_line_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own estimate_line_items" ON public.estimate_line_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own estimate_line_items" ON public.estimate_line_items FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- CREATE estimate_media
-- =============================================
CREATE TABLE public.estimate_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id text NOT NULL UNIQUE,
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_url text NOT NULL DEFAULT '',
  caption text NOT NULL DEFAULT '',
  include_in_internal_pdf boolean NOT NULL DEFAULT true,
  include_in_public_pdf boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.estimate_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own estimate_media" ON public.estimate_media FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own estimate_media" ON public.estimate_media FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own estimate_media" ON public.estimate_media FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own estimate_media" ON public.estimate_media FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- CREATE estimate_media_analysis
-- =============================================
CREATE TABLE public.estimate_media_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id text NOT NULL UNIQUE,
  media_id uuid NOT NULL REFERENCES public.estimate_media(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  observed_conditions text NOT NULL DEFAULT '',
  suggested_scope_impacts text NOT NULL DEFAULT '',
  risk_flags text NOT NULL DEFAULT '',
  recommended_allowance_range text NOT NULL DEFAULT '',
  ai_confidence text NOT NULL DEFAULT 'Medium',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.estimate_media_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own estimate_media_analysis" ON public.estimate_media_analysis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own estimate_media_analysis" ON public.estimate_media_analysis FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own estimate_media_analysis" ON public.estimate_media_analysis FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own estimate_media_analysis" ON public.estimate_media_analysis FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- CREATE estimate_chat_threads
-- =============================================
CREATE TABLE public.estimate_chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text NOT NULL UNIQUE,
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.estimate_chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own estimate_chat_threads" ON public.estimate_chat_threads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own estimate_chat_threads" ON public.estimate_chat_threads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own estimate_chat_threads" ON public.estimate_chat_threads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own estimate_chat_threads" ON public.estimate_chat_threads FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- CREATE estimate_chat_messages
-- =============================================
CREATE TABLE public.estimate_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL UNIQUE,
  thread_id uuid NOT NULL REFERENCES public.estimate_chat_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.estimate_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own estimate_chat_messages" ON public.estimate_chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own estimate_chat_messages" ON public.estimate_chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own estimate_chat_messages" ON public.estimate_chat_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own estimate_chat_messages" ON public.estimate_chat_messages FOR DELETE USING (auth.uid() = user_id);
