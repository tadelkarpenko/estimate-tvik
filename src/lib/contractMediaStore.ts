import { supabase } from '@/integrations/supabase/client';

const getUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
};

// ─── Contract Media ───
export interface ContractMediaItem {
  id?: string;
  media_id: string;
  contract_id: string;
  file_url: string;
  caption: string;
  include_in_internal_pdf: boolean;
  created_at?: string;
}

export const getContractMedia = async (contractId: string): Promise<ContractMediaItem[]> => {
  const { data, error } = await supabase.from('contract_media').select('*').eq('contract_id', contractId).order('created_at');
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id, media_id: r.media_id, contract_id: r.contract_id,
    file_url: r.file_url, caption: r.caption,
    include_in_internal_pdf: r.include_in_internal_pdf,
    created_at: r.created_at,
  }));
};

export const saveContractMedia = async (media: ContractMediaItem): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase.from('contract_media').upsert({
    media_id: media.media_id, contract_id: media.contract_id, user_id: userId,
    file_url: media.file_url, caption: media.caption,
    include_in_internal_pdf: media.include_in_internal_pdf,
  } as any, { onConflict: 'media_id' });
  if (error) throw error;
};

export const deleteContractMedia = async (mediaId: string): Promise<void> => {
  const { error } = await supabase.from('contract_media').delete().eq('media_id', mediaId);
  if (error) throw error;
};

// ─── Contract Media Analysis ───
export interface ContractMediaAnalysisItem {
  id?: string;
  analysis_id: string;
  media_id: string;
  observed_conditions_json: string;
  conditional_items_json: string;
  allowance_risk_flags_json: string;
  questions_needed_json: string;
  confidence: string;
  created_at?: string;
}

export const getContractMediaAnalysis = async (mediaDbId: string): Promise<ContractMediaAnalysisItem | null> => {
  const { data, error } = await supabase.from('contract_media_analysis').select('*').eq('media_id', mediaDbId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id, analysis_id: data.analysis_id, media_id: data.media_id,
    observed_conditions_json: data.observed_conditions_json,
    conditional_items_json: data.conditional_items_json,
    allowance_risk_flags_json: data.allowance_risk_flags_json,
    questions_needed_json: data.questions_needed_json,
    confidence: data.confidence, created_at: data.created_at,
  };
};

export const saveContractMediaAnalysis = async (analysis: ContractMediaAnalysisItem): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase.from('contract_media_analysis').upsert({
    analysis_id: analysis.analysis_id, media_id: analysis.media_id, user_id: userId,
    observed_conditions_json: analysis.observed_conditions_json,
    conditional_items_json: analysis.conditional_items_json,
    allowance_risk_flags_json: analysis.allowance_risk_flags_json,
    questions_needed_json: analysis.questions_needed_json,
    confidence: analysis.confidence,
  } as any, { onConflict: 'analysis_id' });
  if (error) throw error;
};

// ─── Contract Chat ───
export interface ContractChatThread {
  id?: string;
  thread_id: string;
  contract_id: string;
  title: string;
  created_at?: string;
}

export interface ContractChatMessage {
  id?: string;
  message_id: string;
  thread_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  suggested_changes_json: string;
  created_at?: string;
}

export const getContractChatThreads = async (contractId: string): Promise<ContractChatThread[]> => {
  const { data, error } = await supabase.from('contract_chat_threads').select('*').eq('contract_id', contractId).order('created_at');
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id, thread_id: r.thread_id, contract_id: r.contract_id,
    title: r.title, created_at: r.created_at,
  }));
};

export const createContractChatThread = async (thread: ContractChatThread): Promise<string> => {
  const userId = await getUserId();
  const { data, error } = await supabase.from('contract_chat_threads').insert({
    thread_id: thread.thread_id, contract_id: thread.contract_id,
    user_id: userId, title: thread.title,
  } as any).select('id').single();
  if (error) throw error;
  return data.id;
};

export const getContractChatMessages = async (threadDbId: string): Promise<ContractChatMessage[]> => {
  const { data, error } = await supabase.from('contract_chat_messages').select('*').eq('thread_id', threadDbId).order('created_at');
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id, message_id: r.message_id, thread_id: r.thread_id,
    role: r.role as any, content: r.content,
    suggested_changes_json: r.suggested_changes_json || '',
    created_at: r.created_at,
  }));
};

export const saveContractChatMessage = async (msg: ContractChatMessage): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase.from('contract_chat_messages').insert({
    message_id: msg.message_id, thread_id: msg.thread_id,
    user_id: userId, role: msg.role, content: msg.content,
    suggested_changes_json: msg.suggested_changes_json || '',
  } as any);
  if (error) throw error;
};
