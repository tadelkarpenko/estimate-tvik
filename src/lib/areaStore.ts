import { supabase } from '@/integrations/supabase/client';

const getUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
};

export type AreaType = 'Kitchen' | 'Bathroom' | 'Basement' | 'Exterior Front' | 'Exterior Rear' | 'Roof' | 'Mechanical Room' | 'Bedroom' | 'Hallway' | 'Garage' | 'Utility' | 'Crawlspace' | 'Living Room' | 'Dining Room' | 'Laundry' | 'Other';
export type RevisionStatus = 'Original' | 'Updated' | 'Needs Review';
export type AIConfidence = 'High' | 'Medium' | 'Low';
export type VoiceCaptureStatus = 'Not Started' | 'Recording' | 'Paused' | 'Captured' | 'Transcribed' | 'Failed';
export type VoiceAnalysisStatus = 'Not Run' | 'Ready' | 'Complete' | 'Failed';
export type PhotoAnalysisStatus = 'Not Run' | 'Ready' | 'Complete' | 'Failed';
export type VoiceTranscriptSource = '' | 'recorded' | 'pasted' | 'imported';

export const AREA_TYPES: AreaType[] = [
  'Kitchen', 'Bathroom', 'Basement', 'Bedroom', 'Living Room', 'Dining Room',
  'Hallway', 'Laundry', 'Garage', 'Utility', 'Crawlspace',
  'Exterior Front', 'Exterior Rear', 'Roof', 'Mechanical Room', 'Other',
];

export type MergeAnalysisStatus = 'Not Run' | 'Ready' | 'Complete' | 'Failed';

export interface EstimateArea {
  id?: string;
  area_id: string;
  estimate_id: string;
  user_id?: string;
  area_name: string;
  area_type: AreaType;
  area_sequence: number;
  notes_text: string;
  voice_transcript_raw: string;
  voice_transcript_cleaned: string;
  voice_transcript_source: VoiceTranscriptSource;
  voice_last_updated_at: string | null;
  voice_capture_status: VoiceCaptureStatus;
  voice_analysis_status: VoiceAnalysisStatus;
  latest_voice_batch_id: string;
  uploaded_photo_count: number;
  latest_photo_batch_id: string;
  photo_analysis_status: 'Not Run' | 'Ready' | 'Complete' | 'Failed';
  photo_analysis_summary: string;
  missing_visual_information: string;
  quick_tags: string;
  visible_findings: string;
  likely_scope_items: string;
  possible_hidden_risks: string;
  ai_detected_trades: string;
  suggested_allowances: string;
  suggested_exclusions: string;
  suggested_assumptions: string;
  missing_info_questions: string;
  confidence: AIConfidence;
  low_confidence_warning: boolean;
  site_visit_flag: boolean;
  site_visit_reason: string;
  revision_status: RevisionStatus;
  latest_ai_summary: string;
  // Patch 6: Merge fields
  merged_scope_summary: string;
  merged_visible_facts: string;
  merged_inferences: string;
  merged_needs_verification: string;
  merged_risks: string;
  merged_trade_detection: string;
  merged_missing_questions: string;
  merged_confidence: string;
  merged_last_updated_at: string | null;
  merged_analysis_status: MergeAnalysisStatus;
  latest_merge_batch_id: string;
  conflict_summary: string;
  created_at?: string;
  updated_at?: string;
}

export const QUICK_TAGS_EXTENDED = [
  'Demo', 'Plumbing', 'Electrical', 'Paint', 'Flooring', 'Drywall', 'Trim',
  'Cabinetry', 'Structural', 'Roofing', 'HVAC', 'Water Damage', 'Mold Risk',
  'Finish Unknown', 'Permit Likely', 'Customer Supplied Materials', 'Match Existing',
  'Full Replace', 'Repair Only', 'Needs Measurement', 'Unknown Condition',
];

// ─── CRUD ───

export const getEstimateAreas = async (estimateDbId: string): Promise<EstimateArea[]> => {
  const { data, error } = await supabase
    .from('estimate_areas')
    .select('*')
    .eq('estimate_id', estimateDbId)
    .order('area_sequence', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToArea);
};

export const saveEstimateArea = async (area: EstimateArea): Promise<string> => {
  const userId = await getUserId();
  const row = {
    area_id: area.area_id,
    estimate_id: area.estimate_id,
    user_id: userId,
    area_name: area.area_name,
    area_type: area.area_type,
    area_sequence: area.area_sequence,
    notes_text: area.notes_text,
    voice_transcript_raw: area.voice_transcript_raw,
    voice_transcript_cleaned: area.voice_transcript_cleaned,
    voice_transcript_source: area.voice_transcript_source,
    voice_last_updated_at: area.voice_last_updated_at,
    voice_capture_status: area.voice_capture_status,
    voice_analysis_status: area.voice_analysis_status,
    latest_voice_batch_id: area.latest_voice_batch_id,
    uploaded_photo_count: area.uploaded_photo_count,
    latest_photo_batch_id: area.latest_photo_batch_id,
    photo_analysis_status: area.photo_analysis_status,
    photo_analysis_summary: area.photo_analysis_summary,
    missing_visual_information: area.missing_visual_information,
    quick_tags: area.quick_tags,
    visible_findings: area.visible_findings,
    likely_scope_items: area.likely_scope_items,
    possible_hidden_risks: area.possible_hidden_risks,
    ai_detected_trades: area.ai_detected_trades,
    suggested_allowances: area.suggested_allowances,
    suggested_exclusions: area.suggested_exclusions,
    suggested_assumptions: area.suggested_assumptions,
    missing_info_questions: area.missing_info_questions,
    confidence: area.confidence,
    low_confidence_warning: area.low_confidence_warning,
    site_visit_flag: area.site_visit_flag,
    site_visit_reason: area.site_visit_reason,
    revision_status: area.revision_status,
    latest_ai_summary: area.latest_ai_summary,
    merged_scope_summary: area.merged_scope_summary,
    merged_visible_facts: area.merged_visible_facts,
    merged_inferences: area.merged_inferences,
    merged_needs_verification: area.merged_needs_verification,
    merged_risks: area.merged_risks,
    merged_trade_detection: area.merged_trade_detection,
    merged_missing_questions: area.merged_missing_questions,
    merged_confidence: area.merged_confidence,
    merged_last_updated_at: area.merged_last_updated_at,
    merged_analysis_status: area.merged_analysis_status,
    latest_merge_batch_id: area.latest_merge_batch_id,
    conflict_summary: area.conflict_summary,
    updated_at: new Date().toISOString(),
  };

  if (area.id) {
    const { error } = await supabase.from('estimate_areas').update(row as any).eq('id', area.id);
    if (error) throw error;
    return area.id;
  } else {
    const { data, error } = await supabase.from('estimate_areas').insert(row as any).select('id').single();
    if (error) throw error;
    return data.id;
  }
};

export const deleteEstimateArea = async (id: string): Promise<void> => {
  const { error } = await supabase.from('estimate_areas').delete().eq('id', id);
  if (error) throw error;
};

export const createDefaultArea = (estimateDbId: string, areaType: AreaType, sequence: number): EstimateArea => ({
  area_id: crypto.randomUUID(),
  estimate_id: estimateDbId,
  area_name: areaType,
  area_type: areaType,
  area_sequence: sequence,
  notes_text: '',
  voice_transcript_raw: '',
  voice_transcript_cleaned: '',
  voice_transcript_source: '',
  voice_last_updated_at: null,
  voice_capture_status: 'Not Started',
  voice_analysis_status: 'Not Run',
  latest_voice_batch_id: '',
  uploaded_photo_count: 0,
  latest_photo_batch_id: '',
  photo_analysis_status: 'Not Run',
  photo_analysis_summary: '',
  missing_visual_information: '',
  quick_tags: '',
  visible_findings: '',
  likely_scope_items: '',
  possible_hidden_risks: '',
  ai_detected_trades: '',
  suggested_allowances: '',
  suggested_exclusions: '',
  suggested_assumptions: '',
  missing_info_questions: '',
  confidence: 'Medium',
  low_confidence_warning: false,
  site_visit_flag: false,
  site_visit_reason: '',
  revision_status: 'Original',
  latest_ai_summary: '',
  merged_scope_summary: '',
  merged_visible_facts: '',
  merged_inferences: '',
  merged_needs_verification: '',
  merged_risks: '',
  merged_trade_detection: '',
  merged_missing_questions: '',
  merged_confidence: '',
  merged_last_updated_at: null,
  merged_analysis_status: 'Not Run',
  latest_merge_batch_id: '',
  conflict_summary: '',
});

// ─── Rollup Logic ───

export type EstimateHealthStatus = 'Good' | 'Review Needed' | 'High Risk';
export type RevisionReviewStatus = 'No Review Needed' | 'Review Needed' | 'Revision Recommended';

export interface EstimateRollup {
  area_count: number;
  ai_pending_suggestions_count: number;
  ai_estimate_health_status: EstimateHealthStatus;
  ai_estimate_rollup_summary: string;
  ai_revision_review_status: RevisionReviewStatus;
  estimate_site_visit_recommended: boolean;
  estimate_confidence_rollup: AIConfidence;
}

export const computeEstimateRollup = (areas: EstimateArea[], pendingSuggestionCount: number): EstimateRollup => {
  const areaCount = areas.length;
  const lowConfAreas = areas.filter(a => a.confidence === 'Low');
  const siteVisitAreas = areas.filter(a => a.site_visit_flag);
  const needsReviewAreas = areas.filter(a => a.revision_status === 'Needs Review');

  let health: EstimateHealthStatus = 'Good';
  let confidence: AIConfidence = 'High';
  let revisionStatus: RevisionReviewStatus = 'No Review Needed';

  if (lowConfAreas.length >= 2 || siteVisitAreas.length >= 2) {
    health = 'High Risk';
    confidence = 'Low';
  } else if (lowConfAreas.length >= 1 || pendingSuggestionCount > 10) {
    health = 'Review Needed';
    confidence = 'Medium';
  }

  if (needsReviewAreas.length > 0) {
    revisionStatus = needsReviewAreas.length >= 2 ? 'Revision Recommended' : 'Review Needed';
  }

  const summaryParts: string[] = [];
  if (lowConfAreas.length > 0) summaryParts.push(`${lowConfAreas.length} area(s) with low confidence`);
  if (siteVisitAreas.length > 0) summaryParts.push(`${siteVisitAreas.length} area(s) flagged for site visit`);
  if (pendingSuggestionCount > 0) summaryParts.push(`${pendingSuggestionCount} pending suggestions`);
  if (needsReviewAreas.length > 0) summaryParts.push(`${needsReviewAreas.length} area(s) need revision review`);

  return {
    area_count: areaCount,
    ai_pending_suggestions_count: pendingSuggestionCount,
    ai_estimate_health_status: health,
    ai_estimate_rollup_summary: summaryParts.length > 0 ? summaryParts.join('. ') + '.' : 'All areas look good.',
    ai_revision_review_status: revisionStatus,
    estimate_site_visit_recommended: siteVisitAreas.length > 0 || lowConfAreas.length >= 2,
    estimate_confidence_rollup: confidence,
  };
};

// ─── Row Mapper ───

function rowToArea(r: any): EstimateArea {
  return {
    id: r.id,
    area_id: r.area_id,
    estimate_id: r.estimate_id,
    user_id: r.user_id,
    area_name: r.area_name || '',
    area_type: r.area_type || 'Other',
    area_sequence: Number(r.area_sequence || 0),
    notes_text: r.notes_text || '',
    voice_transcript_raw: r.voice_transcript_raw || '',
    voice_transcript_cleaned: r.voice_transcript_cleaned || '',
    voice_transcript_source: (r.voice_transcript_source || '') as VoiceTranscriptSource,
    voice_last_updated_at: r.voice_last_updated_at || null,
    voice_capture_status: (r.voice_capture_status || 'Not Started') as VoiceCaptureStatus,
    voice_analysis_status: (r.voice_analysis_status || 'Not Run') as VoiceAnalysisStatus,
    latest_voice_batch_id: r.latest_voice_batch_id || '',
    uploaded_photo_count: Number(r.uploaded_photo_count || 0),
    latest_photo_batch_id: r.latest_photo_batch_id || '',
    photo_analysis_status: (r.photo_analysis_status || 'Not Run') as any,
    photo_analysis_summary: r.photo_analysis_summary || '',
    missing_visual_information: r.missing_visual_information || '',
    quick_tags: r.quick_tags || '',
    visible_findings: r.visible_findings || '',
    likely_scope_items: r.likely_scope_items || '',
    possible_hidden_risks: r.possible_hidden_risks || '',
    ai_detected_trades: r.ai_detected_trades || '',
    suggested_allowances: r.suggested_allowances || '',
    suggested_exclusions: r.suggested_exclusions || '',
    suggested_assumptions: r.suggested_assumptions || '',
    missing_info_questions: r.missing_info_questions || '',
    confidence: (r.confidence || 'Medium') as AIConfidence,
    low_confidence_warning: r.low_confidence_warning ?? false,
    site_visit_flag: r.site_visit_flag ?? false,
    site_visit_reason: r.site_visit_reason || '',
    revision_status: (r.revision_status || 'Original') as RevisionStatus,
    latest_ai_summary: r.latest_ai_summary || '',
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
