
-- Add Phase 3 columns to estimate_line_items
ALTER TABLE public.estimate_line_items
  ADD COLUMN IF NOT EXISTS pending_confirmation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS confidence text NOT NULL DEFAULT 'Medium',
  ADD COLUMN IF NOT EXISTS evidence_source text NOT NULL DEFAULT 'CostLibrary',
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';

-- Add Phase 3 columns to estimates
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS clarification_answers_json text NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ai_suggestions_last_json text NOT NULL DEFAULT '[]';

-- Add suggested_changes_json to estimate_chat_messages
ALTER TABLE public.estimate_chat_messages
  ADD COLUMN IF NOT EXISTS suggested_changes_json text NOT NULL DEFAULT '';

-- Add questions_needed_json to estimate_media_analysis
ALTER TABLE public.estimate_media_analysis
  ADD COLUMN IF NOT EXISTS questions_needed_json text NOT NULL DEFAULT '[]';
