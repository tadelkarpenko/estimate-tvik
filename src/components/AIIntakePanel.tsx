import { useState, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sparkles, Camera, HelpCircle, RefreshCw, CheckCircle, AlertTriangle,
  ChevronDown, ChevronRight, Eye, Shield, Wrench, FileQuestion, MapPin,
  Mic, MicOff, Send, ClipboardList, X, Edit, ThumbsUp, ThumbsDown,
  Plus, Trash2, BarChart3, Home, Square,
} from 'lucide-react';
import { MediaUploader } from '@/components/MediaUploader';
import type { Estimate, EstimateMedia, AIConfidence } from '@/lib/types';
import type { VoiceCaptureStatus, VoiceAnalysisStatus, PhotoAnalysisStatus, MergeAnalysisStatus } from '@/lib/areaStore';
import {
  getSuggestions, insertSuggestions, updateSuggestionStatus, insertAppliedAudit,
  type AISuggestion, type SuggestionType, type SuggestionSourceType,
  SUGGESTION_TYPE_LABELS, SUGGESTION_STATUS_COLORS,
} from '@/lib/suggestionStore';
import {
  getEstimateAreas, saveEstimateArea, deleteEstimateArea, createDefaultArea,
  computeEstimateRollup, AREA_TYPES, QUICK_TAGS_EXTENDED,
  type EstimateArea, type AreaType, type EstimateRollup,
} from '@/lib/areaStore';
import { saveHealthCheck } from '@/lib/healthCheckStore';
import { generateWritePlan, saveWritePlan, updateWritePlanStatus, type WritePlan, type WritePlanFieldUpdate, type WritePlanLineItem, type WritePlanAuditEntry } from '@/lib/writePlanStore';
import { executeWriteback, type ExecutionResult } from '@/lib/writebackEngine';
import { runPostWriteRecheck, type PostWriteRecheckResult } from '@/lib/postWriteRecheckEngine';
import { useToast } from '@/hooks/use-toast';

interface IntakeFindings {
  visible_findings: string;
  likely_scope_items: string;
  possible_hidden_risks: string;
  missing_info_questions: string;
  suggested_trades: string;
  suggested_allowances: string;
  suggested_exclusions: string;
  suggested_assumptions: string;
  suggested_line_items: string;
  site_visit_required: boolean;
  confidence: AIConfidence;
  intake_summary: string;
}

interface AIIntakePanelProps {
  estimate: Partial<Estimate>;
  estimateDbId?: string;
  media: EstimateMedia[];
  onUpdate: (updates: Partial<Estimate>) => void;
  onSave: () => Promise<string | undefined>;
  onMediaChange: () => void;
}

const FINDINGS_TO_SUGGESTIONS: Array<{
  findingsKey: keyof IntakeFindings;
  type: SuggestionType;
  target: string;
}> = [
  { findingsKey: 'suggested_line_items', type: 'line_item', target: 'suggested_line_items' },
  { findingsKey: 'suggested_exclusions', type: 'exclusion', target: 'suggested_exclusions' },
  { findingsKey: 'suggested_allowances', type: 'allowance', target: 'suggested_allowances' },
  { findingsKey: 'suggested_assumptions', type: 'assumption', target: 'suggested_assumptions' },
  { findingsKey: 'possible_hidden_risks', type: 'risk_note', target: 'possible_hidden_risks' },
  { findingsKey: 'visible_findings', type: 'internal_note', target: 'visible_findings' },
  { findingsKey: 'missing_info_questions', type: 'missing_info', target: 'missing_info_questions' },
  { findingsKey: 'suggested_trades', type: 'trade_detection', target: 'ai_detected_trades' },
];

// ─── Initial Intake Result Type ───
interface InitialIntakeResult {
  summary_of_request: string;
  probable_work_categories: string[];
  likely_trades: string[];
  obvious_unknowns: string[];
  next_questions: Array<{ question: string; why_it_matters: string }>;
  review_queue_items: Array<{
    suggestion_type: string;
    suggested_value: string;
    apply_target?: string;
    confidence: string;
    evidence_summary: string;
    reason_for_suggestion: string;
  }>;
  confidence: 'High' | 'Medium' | 'Low';
  site_visit_recommended: boolean;
}

export function AIIntakePanel({ estimate, estimateDbId, media, onUpdate, onSave, onMediaChange }: AIIntakePanelProps) {
  const { toast } = useToast();

  // Auto-save helper: ensures estimate is persisted before AI actions
  const ensureSaved = useCallback(async (): Promise<string | null> => {
    if (estimateDbId) return estimateDbId;
    try {
      const dbId = await onSave();
      if (!dbId) {
        toast({ title: 'Could not save estimate', description: 'Please try saving manually first.', variant: 'destructive' });
        return null;
      }
      return dbId;
    } catch (e: any) {
      toast({ title: 'Auto-save failed', description: e.message, variant: 'destructive' });
      return null;
    }
  }, [estimateDbId, onSave, toast]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('initial');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary', 'findings', 'questions']));

  // Area state
  const [areas, setAreas] = useState<EstimateArea[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [areaFindings, setAreaFindings] = useState<IntakeFindings | null>(null);

  // Review queue state
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [queueFilter, setQueueFilter] = useState<string>('all');
  const [queueAreaFilter, setQueueAreaFilter] = useState<string>('all');

  // Initial Intake state (Patch 3)
  const [initialIntakeDesc, setInitialIntakeDesc] = useState('');
  const [initialIntakeGoal, setInitialIntakeGoal] = useState('');
  const [initialIntakeUrgency, setInitialIntakeUrgency] = useState('');
  const [initialIntakeResult, setInitialIntakeResult] = useState<InitialIntakeResult | null>(null);
  const [initialIntakeLoading, setInitialIntakeLoading] = useState(false);
  const [photoAnalysisLoading, setPhotoAnalysisLoading] = useState(false);
  const [photoAnalysisResult, setPhotoAnalysisResult] = useState<any>(null);
  const [mergeAnalysisLoading, setMergeAnalysisLoading] = useState(false);
  const [mergeAnalysisResult, setMergeAnalysisResult] = useState<any>(null);
  const [missingInfoLoading, setMissingInfoLoading] = useState(false);
  const [missingInfoResult, setMissingInfoResult] = useState<any>(null);
  const [completenessLoading, setCompletenessLoading] = useState(false);
  const [completenessResult, setCompletenessResult] = useState<any>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [writePlan, setWritePlan] = useState<WritePlan | null>(null);
  const [writePlanLoading, setWritePlanLoading] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [recheckResult, setRecheckResult] = useState<PostWriteRecheckResult | null>(null);
  const [recheckLoading, setRecheckLoading] = useState(false);

  // Rollup
  const [rollup, setRollup] = useState<EstimateRollup | null>(null);

  // Speech recognition
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const speechSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startRecording = useCallback(() => {
    if (!speechSupported || !selectedAreaId) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      if (final) {
        setAreas(prev => prev.map(a => {
          if (a.id !== selectedAreaId) return a;
          return { ...a, voice_transcript_raw: (a.voice_transcript_raw ? a.voice_transcript_raw + ' ' : '') + final.trim() };
        }));
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      toast({ title: 'Voice error', description: event.error, variant: 'destructive' });
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [speechSupported, selectedAreaId, toast]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setInterimTranscript('');
  }, []);

  const isApproved = estimate.status === 'Accepted';
  const selectedArea = areas.find(a => a.id === selectedAreaId);

  // Load areas and suggestions
  useEffect(() => {
    if (estimateDbId) {
      getEstimateAreas(estimateDbId).then(a => {
        setAreas(a);
        if (a.length > 0 && !selectedAreaId) setSelectedAreaId(a[0].id!);
      }).catch(console.error);
      getSuggestions(estimateDbId).then(setSuggestions).catch(console.error);
    }
  }, [estimateDbId]);

  // Recompute rollup when areas or suggestions change
  useEffect(() => {
    const pendingCount = suggestions.filter(s => s.status === 'pending').length;
    const r = computeEstimateRollup(areas, pendingCount);
    setRollup(r);
  }, [areas, suggestions]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ─── Area CRUD ───
  const addArea = async (areaType: AreaType) => {
    const dbId = await ensureSaved();
    if (!dbId) return;
    const newArea = createDefaultArea(dbId, areaType, areas.length);
    try {
      const id = await saveEstimateArea(newArea);
      const updated = await getEstimateAreas(dbId);
      setAreas(updated);
      setSelectedAreaId(id);
      onUpdate({ area_count: updated.length } as any);
      toast({ title: `${areaType} area added` });
    } catch (e: any) {
      toast({ title: 'Failed to add area', description: e.message, variant: 'destructive' });
    }
  };

  const updateArea = async (field: keyof EstimateArea, value: any) => {
    if (!selectedArea) return;
    const updated = { ...selectedArea, [field]: value };
    setAreas(prev => prev.map(a => a.id === selectedArea.id ? updated : a));
  };

  const saveCurrentArea = async () => {
    if (!selectedArea) return;
    try {
      await saveEstimateArea(selectedArea);
      toast({ title: 'Area saved' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
  };

  const removeArea = async (areaId: string) => {
    try {
      await deleteEstimateArea(areaId);
      const updated = areas.filter(a => a.id !== areaId);
      setAreas(updated);
      if (selectedAreaId === areaId) setSelectedAreaId(updated[0]?.id || null);
      onUpdate({ area_count: updated.length } as any);
      toast({ title: 'Area removed' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  const toggleAreaTag = (tag: string) => {
    if (!selectedArea) return;
    const currentTags = selectedArea.quick_tags ? selectedArea.quick_tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const newTags = currentTags.includes(tag) ? currentTags.filter(t => t !== tag) : [...currentTags, tag];
    updateArea('quick_tags', newTags.join(', '));
  };

  // ─── Initial Intake Analysis (Patch 3) ───
  const analyzeInitialIntake = useCallback(async () => {
    const dbId = await ensureSaved();
    if (!dbId) return;
    if (isApproved) {
      toast({ title: 'Estimate is approved', description: 'Initial intake is advisory only on approved estimates.', variant: 'destructive' });
    }
    const description = initialIntakeDesc.trim() || estimate.internal_notes || '';
    if (!description) {
      toast({ title: 'Enter a project description', variant: 'destructive' });
      return;
    }
    setInitialIntakeLoading(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'initial_intake',
          data: {
            project_type: estimate.project_type || '',
            typed_description: description,
            customer_goal: initialIntakeGoal.trim() || '',
            urgency: initialIntakeUrgency.trim() || '',
            existing_status: estimate.status || 'Draft',
            sqft: estimate.sqft || 0,
            finish_level: estimate.finish_level || 'Basic',
            project_address: estimate.project_address || '',
            notes: estimate.internal_notes || '',
          },
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const { structured } = await resp.json();
      setInitialIntakeResult(structured);

      // Safe support field updates (not protected content)
      if (!isApproved) {
        const supportUpdates: Partial<Estimate> = {
          ai_intake_summary: structured.summary_of_request || '',
          likely_scope_items: structured.probable_work_categories?.join(', ') || '',
          missing_info_questions: structured.next_questions?.map((q: any) => `- ${q.question}`).join('\n') || '',
          ai_detected_trades: structured.likely_trades?.join(', ') || '',
          ai_scope_confidence: structured.confidence || 'Medium',
          intake_last_updated_at: new Date().toISOString(),
          estimate_site_visit_recommended: structured.site_visit_recommended ?? false,
        } as any;
        onUpdate(supportUpdates);
      }

      // Create queue items if any
      if (structured.review_queue_items?.length > 0 && !isApproved) {
        const batchId = crypto.randomUUID();
        const queueItems = structured.review_queue_items.map((item: any) => ({
          suggestion_id: crypto.randomUUID(),
          estimate_id: dbId,
          source_type: 'text' as SuggestionSourceType,
          suggestion_type: item.suggestion_type || 'internal_note',
          confidence: item.confidence || 'Medium',
          evidence_summary: item.evidence_summary || '',
          reason_for_suggestion: item.reason_for_suggestion || 'Initial Intake AI',
          suggested_value: item.suggested_value || '',
          apply_target: item.apply_target || '',
          status: 'pending',
          decision_state: 'pending',
          reviewer_notes: '',
          approved_by: '',
          edited_value: '',
          suggestion_batch_id: batchId,
          block_name: 'initial_intake',
          priority_level: item.confidence === 'Low' ? 'High' : 'Medium',
          queue_group: 'Initial Intake',
          source_timestamp: new Date().toISOString(),
          idempotency_key: `initial-${dbId}-${crypto.randomUUID().slice(0, 8)}`,
        }));
        await insertSuggestions(queueItems);
        const updated = await getSuggestions(dbId);
        setSuggestions(updated);
      }

      toast({ title: 'Initial Intake complete', description: `${structured.confidence} confidence` });
    } catch (e: any) {
      toast({ title: 'Initial Intake failed', description: e.message, variant: 'destructive' });
    } finally {
      setInitialIntakeLoading(false);
    }
  }, [ensureSaved, initialIntakeDesc, initialIntakeGoal, initialIntakeUrgency, estimate, isApproved, toast, onUpdate]);

  // ─── Area-Level AI Analysis ───
  const analyzeArea = useCallback(async () => {
    if (!selectedArea) return;
    const resolvedId = estimateDbId;
    if (!resolvedId) return;
    setLoading(true);

    // Save area first
    await saveEstimateArea(selectedArea);

    const hasExistingData = selectedArea.latest_ai_summary.length > 0;
    const workflow = hasExistingData ? 'revision_check' : 'intake_fresh';
    const batchId = crypto.randomUUID();

    const combinedInput = [
      selectedArea.notes_text.trim(),
      selectedArea.voice_transcript_raw.trim() ? `\n\n[Voice Transcript]:\n${selectedArea.voice_transcript_raw.trim()}` : '',
      selectedArea.quick_tags ? `\n\n[Quick Tags]: ${selectedArea.quick_tags}` : '',
    ].filter(Boolean).join('');

    try {
      const areaMedia = media.filter(() => true);
      const photoAnalyses = areaMedia.map(m => ({ caption: m.caption, url: m.file_url }));

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'intake',
          data: {
            workflow,
            project_type: estimate.project_type || '',
            description: `Area: ${selectedArea.area_name} (${selectedArea.area_type})`,
            notes: selectedArea.notes_text || '',
            sqft: estimate.sqft || 0,
            fixture_count: estimate.fixture_count || 0,
            finish_level: estimate.finish_level || 'Basic',
            photo_analyses: photoAnalyses,
            existing_estimate: hasExistingData ? {
              ai_intake_summary: selectedArea.latest_ai_summary,
              visible_findings: selectedArea.visible_findings,
              likely_scope_items: selectedArea.likely_scope_items,
            } : null,
            user_input: combinedInput || null,
            voice_transcript: selectedArea.voice_transcript_raw.trim() || null,
          },
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const { content } = await resp.json();
      let parsed: IntakeFindings;
      try {
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        const raw = jsonMatch ? jsonMatch[1] : content;
        parsed = JSON.parse(raw);
      } catch {
        parsed = {
          visible_findings: '', likely_scope_items: '', possible_hidden_risks: '',
          missing_info_questions: '', suggested_trades: '', suggested_allowances: '',
          suggested_exclusions: '', suggested_assumptions: '', suggested_line_items: '',
          site_visit_required: false, confidence: 'Medium', intake_summary: content,
        };
      }

      setAreaFindings(parsed);

      const isLowConf = parsed.confidence === 'Low';

      // Update area with findings + voice lifecycle
      const updatedArea: EstimateArea = {
        ...selectedArea,
        visible_findings: parsed.visible_findings || '',
        likely_scope_items: parsed.likely_scope_items || '',
        possible_hidden_risks: parsed.possible_hidden_risks || '',
        ai_detected_trades: parsed.suggested_trades || '',
        suggested_allowances: parsed.suggested_allowances || '',
        suggested_exclusions: parsed.suggested_exclusions || '',
        suggested_assumptions: parsed.suggested_assumptions || '',
        missing_info_questions: parsed.missing_info_questions || '',
        confidence: parsed.confidence || 'Medium',
        low_confidence_warning: isLowConf,
        site_visit_flag: parsed.site_visit_required ?? false,
        site_visit_reason: parsed.site_visit_required ? `AI analysis flagged low confidence or hidden conditions in ${selectedArea.area_name}.` : selectedArea.site_visit_reason,
        latest_ai_summary: parsed.intake_summary || '',
        voice_transcript_cleaned: parsed.intake_summary || selectedArea.voice_transcript_cleaned,
        voice_analysis_status: 'Complete',
        latest_voice_batch_id: batchId,
        revision_status: hasExistingData ? 'Updated' : 'Original',
      };

      await saveEstimateArea(updatedArea);
      setAreas(prev => prev.map(a => a.id === selectedArea.id ? updatedArea : a));

      // Auto-create queue items from findings
      if (!isApproved) {
        const sourceType: SuggestionSourceType = selectedArea.voice_transcript_raw.trim()
          ? (media.length > 0 ? 'merged' : 'voice')
          : (media.length > 0 ? 'photo' : 'text');
        const newSuggestions: any[] = [];

        for (const mapping of FINDINGS_TO_SUGGESTIONS) {
          const value = parsed[mapping.findingsKey];
          if (typeof value === 'string' && value.trim()) {
            const items = value.split(/\n/).filter(l => l.trim().startsWith('-') || l.trim().startsWith('•') || l.trim().match(/^\d+\./));
            const processItems = items.length > 0 ? items : [value];
            for (const item of processItems) {
              const cleanItem = item.replace(/^[-•\d.)\s]+/, '').trim();
              if (!cleanItem) continue;
              newSuggestions.push({
                suggestion_id: crypto.randomUUID(),
              estimate_id: resolvedId,
              source_type: sourceType,
              suggestion_type: mapping.type,
              confidence: parsed.confidence,
              evidence_summary: `Area: ${selectedArea.area_name}. ${parsed.intake_summary || ''}`.slice(0, 200),
              reason_for_suggestion: `AI Walkthrough (${sourceType}) — ${selectedArea.area_name} — ${mapping.type}`,
              suggested_value: cleanItem,
              apply_target: mapping.target,
              status: 'pending',
              decision_state: 'pending',
              reviewer_notes: '',
              approved_by: '',
              edited_value: '',
              area_id: selectedArea.id,
              suggestion_batch_id: batchId,
              block_name: 'voice_walkthrough',
              priority_level: isLowConf ? 'High' : 'Medium',
              queue_group: selectedArea.area_name,
              source_timestamp: new Date().toISOString(),
              idempotency_key: `walk-${selectedArea.id}-${batchId.slice(0, 8)}`,
              });
            }
          }
        }

        if (parsed.site_visit_required) {
          newSuggestions.push({
            suggestion_id: crypto.randomUUID(),
            estimate_id: resolvedId,
            source_type: sourceType,
            suggestion_type: 'site_visit_recommendation',
            confidence: parsed.confidence,
            evidence_summary: `Area: ${selectedArea.area_name}`,
            reason_for_suggestion: 'Confidence is low or hidden conditions are likely.',
            suggested_value: `Site visit recommended for ${selectedArea.area_name}.`,
            apply_target: 'site_visit_required',
            status: 'pending',
            decision_state: 'pending',
            reviewer_notes: '',
            approved_by: '',
            edited_value: '',
            area_id: selectedArea.id,
            suggestion_batch_id: batchId,
            block_name: 'voice_walkthrough',
            priority_level: 'High',
            queue_group: selectedArea.area_name,
            source_timestamp: new Date().toISOString(),
            idempotency_key: `walk-sv-${selectedArea.id}-${batchId.slice(0, 8)}`,
          });
        }

        if (newSuggestions.length > 0) {
          await insertSuggestions(newSuggestions);
          const updated = await getSuggestions(resolvedId);
          setSuggestions(updated);
        }

        toast({ title: 'Voice walkthrough complete', description: `${selectedArea.area_name}: ${parsed.confidence} confidence. ${newSuggestions.length} suggestions queued.` });
      } else {
        toast({ title: 'Area analysis complete (advisory)', description: `${selectedArea.area_name}: ${parsed.confidence} confidence` });
      }
    } catch (e: any) {
      // Mark analysis as failed
      const failedArea = { ...selectedArea, voice_analysis_status: 'Failed' as const };
      setAreas(prev => prev.map(a => a.id === selectedArea.id ? failedArea : a));
      toast({ title: 'Analysis failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedArea, estimateDbId, estimate, media, isApproved, toast, onUpdate]);

  // ─── Photo Analysis (Patch 5) ───
  const analyzePhotos = useCallback(async () => {
    const resolvedPhotoId = estimateDbId;
    if (!resolvedPhotoId || media.length === 0) {
      toast({ title: 'Upload photos first', variant: 'destructive' });
      return;
    }
    if (isApproved) {
      toast({ title: 'Estimate is approved', description: 'Photo analysis is advisory only.', variant: 'destructive' });
    }

    setPhotoAnalysisLoading(true);
    const batchId = crypto.randomUUID();

    try {
      const imageUrls = media.map(m => m.file_url).filter(Boolean);
      const captions = media.map(m => m.caption).filter(Boolean).join('; ');

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'area_photo_analysis',
          data: {
            image_urls: imageUrls.slice(0, 8),
            area_name: selectedArea?.area_name || '',
            area_type: selectedArea?.area_type || '',
            project_type: estimate.project_type || '',
            quick_tags: selectedArea?.quick_tags || '',
            notes: selectedArea?.notes_text || '',
            captions,
          },
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const { structured } = await resp.json();
      setPhotoAnalysisResult(structured);

      // Update area fields if area is selected and not approved
      if (selectedArea && !isApproved) {
        const isLowConf = structured.image_confidence === 'Low';
        const updatedArea: EstimateArea = {
          ...selectedArea,
          photo_analysis_status: 'Complete',
          photo_analysis_summary: structured.photo_summary || '',
          latest_photo_batch_id: batchId,
          visible_findings: structured.visible_facts || selectedArea.visible_findings,
          likely_scope_items: structured.probable_scope_items || selectedArea.likely_scope_items,
          possible_hidden_risks: structured.probable_hidden_risks || selectedArea.possible_hidden_risks,
          ai_detected_trades: structured.trade_detection || selectedArea.ai_detected_trades,
          missing_visual_information: structured.missing_visual_information || '',
          confidence: structured.image_confidence || selectedArea.confidence,
          low_confidence_warning: isLowConf || selectedArea.low_confidence_warning,
          site_visit_flag: structured.site_visit_recommended || selectedArea.site_visit_flag,
          site_visit_reason: structured.site_visit_reason || selectedArea.site_visit_reason,
          uploaded_photo_count: media.length,
        };

        await saveEstimateArea(updatedArea);
        setAreas(prev => prev.map(a => a.id === selectedArea.id ? updatedArea : a));
      }

      // Update estimate-level rollup fields
      if (!isApproved) {
        onUpdate({
          photo_count: media.length,
          photo_analysis_summary: structured.photo_summary || '',
        } as any);
      }

      // Create queue items
      if (structured.review_queue_items?.length > 0 && !isApproved) {
        const newSuggestions = structured.review_queue_items.map((item: any) => ({
          suggestion_id: crypto.randomUUID(),
          estimate_id: resolvedPhotoId,
          area_id: selectedArea?.id || null,
          source_type: 'photo' as SuggestionSourceType,
          suggestion_type: item.suggestion_type || 'internal_note',
          confidence: item.confidence || 'Medium',
          evidence_summary: item.evidence_summary || '',
          reason_for_suggestion: item.reason_for_suggestion || 'Photo Analysis AI',
          suggested_value: item.suggested_value || '',
          apply_target: item.apply_target || '',
          status: 'pending',
          decision_state: 'pending',
          reviewer_notes: '',
          approved_by: '',
          edited_value: '',
          suggestion_batch_id: batchId,
          block_name: 'photo_analysis',
          priority_level: item.confidence === 'Low' ? 'High' : 'Medium',
          queue_group: selectedArea?.area_name || 'Photos',
          source_timestamp: new Date().toISOString(),
          idempotency_key: `photo-${resolvedPhotoId}-${selectedArea?.id || 'est'}-${crypto.randomUUID().slice(0, 8)}`,
        }));
        await insertSuggestions(newSuggestions);
        const updated = await getSuggestions(resolvedPhotoId);
        setSuggestions(updated);
      }

      toast({ title: 'Photo analysis complete', description: `${structured.image_confidence} confidence. ${structured.review_queue_items?.length || 0} suggestions queued.` });
    } catch (e: any) {
      if (selectedArea) {
        const failedArea = { ...selectedArea, photo_analysis_status: 'Failed' as const };
        setAreas(prev => prev.map(a => a.id === selectedArea.id ? failedArea : a));
      }
      toast({ title: 'Photo analysis failed', description: e.message, variant: 'destructive' });
    } finally {
      setPhotoAnalysisLoading(false);
    }
  }, [estimateDbId, selectedArea, media, estimate, isApproved, toast, onUpdate]);


  // ─── Merge Analysis (Patch 6) ───
  const analyzeMerge = useCallback(async () => {
    const dbId = await ensureSaved();
    if (!dbId) return;
    if (!selectedArea) {
      toast({ title: 'Select an area first', variant: 'destructive' });
      return;
    }
    if (isApproved) {
      toast({ title: 'Estimate is approved', description: 'Merge analysis is advisory only.', variant: 'destructive' });
    }

    setMergeAnalysisLoading(true);
    const batchId = crypto.randomUUID();

    try {
      // Build upstream structured outputs
      const typedOutput = selectedArea.notes_text.trim()
        ? `Notes: ${selectedArea.notes_text}\nQuick tags: ${selectedArea.quick_tags || 'None'}`
        : '';
      const voiceOutput = selectedArea.voice_analysis_status === 'Complete'
        ? `Summary: ${selectedArea.latest_ai_summary}\nVisible findings: ${selectedArea.visible_findings}\nScope items: ${selectedArea.likely_scope_items}\nRisks: ${selectedArea.possible_hidden_risks}\nTrades: ${selectedArea.ai_detected_trades}\nMissing info: ${selectedArea.missing_info_questions}`
        : '';
      const photoOutput = selectedArea.photo_analysis_status === 'Complete'
        ? `Photo summary: ${selectedArea.photo_analysis_summary}\nVisible findings: ${selectedArea.visible_findings}\nMissing visual info: ${selectedArea.missing_visual_information}\nTrades: ${selectedArea.ai_detected_trades}`
        : '';

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'area_merge_analysis',
          data: {
            area_name: selectedArea.area_name || '',
            area_type: selectedArea.area_type || '',
            project_type: estimate.project_type || '',
            current_status: estimate.status || 'Draft',
            quick_tags: selectedArea.quick_tags || '',
            typed_intake_output: typedOutput || 'Not available',
            voice_walkthrough_output: voiceOutput || 'Not available',
            photo_analysis_output: photoOutput || 'Not available',
            current_line_items: '',
            current_risk_notes: estimate.possible_hidden_risks || '',
          },
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const { structured } = await resp.json();
      setMergeAnalysisResult(structured);

      // Update area merge fields if not approved
      if (!isApproved) {
        const updatedArea: EstimateArea = {
          ...selectedArea,
          merged_scope_summary: structured.merged_scope_summary || '',
          merged_visible_facts: structured.merged_visible_facts || '',
          merged_inferences: structured.merged_inferences || '',
          merged_needs_verification: structured.merged_needs_verification || '',
          merged_risks: structured.merged_risks || '',
          merged_trade_detection: structured.merged_trade_detection || '',
          merged_missing_questions: structured.merged_missing_questions || '',
          merged_confidence: structured.merged_confidence || 'Medium',
          merged_last_updated_at: new Date().toISOString(),
          merged_analysis_status: 'Complete',
          latest_merge_batch_id: batchId,
          conflict_summary: structured.conflict_summary || '',
          site_visit_flag: structured.site_visit_recommended || selectedArea.site_visit_flag,
          site_visit_reason: structured.site_visit_reason || selectedArea.site_visit_reason,
        };

        await saveEstimateArea(updatedArea);
        setAreas(prev => prev.map(a => a.id === selectedArea.id ? updatedArea : a));
      }

      // Create queue items
      if (structured.review_queue_items?.length > 0 && !isApproved) {
        const newSuggestions = structured.review_queue_items.map((item: any) => ({
          suggestion_id: crypto.randomUUID(),
          estimate_id: estimateDbId,
          area_id: selectedArea.id || null,
          source_type: 'merged' as SuggestionSourceType,
          suggestion_type: item.suggestion_type || 'internal_note',
          confidence: item.confidence || 'Medium',
          evidence_summary: item.evidence_summary || '',
          reason_for_suggestion: item.reason_for_suggestion || 'Merge Analysis AI',
          suggested_value: item.suggested_value || '',
          apply_target: item.apply_target || '',
          status: 'pending',
          decision_state: 'pending',
          reviewer_notes: '',
          approved_by: '',
          edited_value: '',
          suggestion_batch_id: batchId,
          block_name: 'merge_analysis',
          priority_level: item.confidence === 'Low' ? 'High' : 'Medium',
          queue_group: selectedArea.area_name || 'Merge',
          source_timestamp: new Date().toISOString(),
          idempotency_key: `merge-${estimateDbId}-${selectedArea.id || 'est'}-${crypto.randomUUID().slice(0, 8)}`,
        }));
        await insertSuggestions(newSuggestions);
        const updated = await getSuggestions(estimateDbId);
        setSuggestions(updated);
      }

      toast({ title: 'Merge analysis complete', description: `${structured.merged_confidence} confidence. ${structured.review_queue_items?.length || 0} suggestions queued.` });
    } catch (e: any) {
      if (selectedArea) {
        const failedArea = { ...selectedArea, merged_analysis_status: 'Failed' as const };
        setAreas(prev => prev.map(a => a.id === selectedArea.id ? failedArea : a));
      }
      toast({ title: 'Merge analysis failed', description: e.message, variant: 'destructive' });
    } finally {
      setMergeAnalysisLoading(false);
    }
  }, [estimateDbId, ensureSaved, selectedArea, estimate, isApproved, toast, onUpdate]);

  // ─── Missing Info Questions (Patch 7) ───
  const generateMissingInfoQuestions = useCallback(async () => {
    const dbId = await ensureSaved();
    if (!dbId) return;
    if (!selectedArea) {
      toast({ title: 'Select an area first', variant: 'destructive' });
      return;
    }
    if (isApproved) {
      toast({ title: 'Estimate is approved', description: 'Missing info is advisory only.', variant: 'destructive' });
    }

    setMissingInfoLoading(true);
    const batchId = crypto.randomUUID();

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'missing_info_questions',
          data: {
            area_name: selectedArea.area_name || '',
            area_type: selectedArea.area_type || '',
            project_type: estimate.project_type || '',
            current_status: estimate.status || 'Draft',
            current_confidence: selectedArea.merged_confidence || selectedArea.confidence || 'Medium',
            merged_scope_summary: selectedArea.merged_scope_summary || '',
            merged_visible_facts: selectedArea.merged_visible_facts || '',
            merged_inferences: selectedArea.merged_inferences || '',
            merged_needs_verification: selectedArea.merged_needs_verification || '',
            merged_risks: selectedArea.merged_risks || '',
            merged_trade_detection: selectedArea.merged_trade_detection || '',
            current_exclusions: estimate.suggested_exclusions || '',
            current_allowances: estimate.suggested_allowances || '',
            current_assumptions: estimate.suggested_assumptions || '',
            current_risk_notes: estimate.possible_hidden_risks || '',
            already_asked_questions: selectedArea.missing_info_questions || '',
            current_site_visit_recommended: selectedArea.site_visit_flag || false,
          },
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const { structured } = await resp.json();
      setMissingInfoResult(structured);

      // Update area support fields if not approved
      if (!isApproved && structured.top_priority_questions?.length > 0) {
        const questionsText = structured.top_priority_questions
          .map((q: any, i: number) => `${i + 1}. ${q.question}\n   Why: ${q.why_it_matters}`)
          .join('\n\n');

        const updatedArea: EstimateArea = {
          ...selectedArea,
          missing_info_questions: questionsText,
          site_visit_flag: structured.site_visit_recommended || selectedArea.site_visit_flag,
          site_visit_reason: structured.site_visit_reason || selectedArea.site_visit_reason,
        };

        await saveEstimateArea(updatedArea);
        setAreas(prev => prev.map(a => a.id === selectedArea.id ? updatedArea : a));
      }

      // Create queue items
      if (structured.review_queue_items?.length > 0 && !isApproved) {
        const newSuggestions = structured.review_queue_items.map((item: any) => ({
          suggestion_id: crypto.randomUUID(),
          estimate_id: estimateDbId,
          area_id: selectedArea.id || null,
          source_type: 'merged' as SuggestionSourceType,
          suggestion_type: item.suggestion_type || 'missing_info',
          confidence: item.confidence || 'Medium',
          evidence_summary: item.evidence_summary || '',
          reason_for_suggestion: item.reason_for_suggestion || 'Missing Info Questions AI',
          suggested_value: item.suggested_value || '',
          apply_target: item.apply_target || 'missing_info_questions',
          status: 'pending',
          decision_state: 'pending',
          reviewer_notes: '',
          approved_by: '',
          edited_value: '',
          suggestion_batch_id: batchId,
          block_name: 'missing_info_questions',
          priority_level: item.confidence === 'Low' ? 'High' : 'Medium',
          queue_group: selectedArea.area_name || 'Questions',
          source_timestamp: new Date().toISOString(),
          idempotency_key: `missinginfo-${estimateDbId}-${selectedArea.id || 'est'}-${crypto.randomUUID().slice(0, 8)}`,
        }));
        await insertSuggestions(newSuggestions);
        const updated = await getSuggestions(estimateDbId);
        setSuggestions(updated);
      }

      toast({ title: 'Missing info questions generated', description: `${structured.top_priority_questions?.length || 0} questions. ${structured.review_queue_items?.length || 0} queued.` });
    } catch (e: any) {
      toast({ title: 'Missing info generation failed', description: e.message, variant: 'destructive' });
    } finally {
      setMissingInfoLoading(false);
    }
  }, [estimateDbId, ensureSaved, selectedArea, estimate, isApproved, toast]);

  // ─── Completeness Check (Patch 8) ───
  const runCompletenessCheck = useCallback(async () => {
    const dbId = await ensureSaved();
    if (!dbId) return;

    setCompletenessLoading(true);
    const batchId = crypto.randomUUID();

    try {
      // Aggregate merged data across all areas
      const mergedScopeSummary = areas.map(a => a.merged_scope_summary).filter(Boolean).join('\n\n');
      const mergedVisibleFacts = areas.map(a => a.merged_visible_facts).filter(Boolean).join('\n\n');
      const mergedInferences = areas.map(a => a.merged_inferences).filter(Boolean).join('\n\n');
      const mergedNeedsVerification = areas.map(a => a.merged_needs_verification).filter(Boolean).join('\n\n');
      const mergedRisks = areas.map(a => a.merged_risks).filter(Boolean).join('\n\n');
      const mergedTradeDetection = areas.map(a => a.merged_trade_detection).filter(Boolean).join(', ');
      const lowestConfidence = areas.reduce((worst, a) => {
        const c = a.merged_confidence || a.confidence || 'Medium';
        if (c === 'Low') return 'Low';
        if (c === 'Medium' && worst !== 'Low') return 'Medium';
        return worst;
      }, 'High' as string);

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'completeness_check',
          data: {
            area_name: areas.length === 1 ? areas[0].area_name : `${areas.length} areas`,
            project_type: estimate.project_type || '',
            project_category: estimate.project_category || '',
            current_status: estimate.status || 'Draft',
            current_confidence: lowestConfidence,
            merged_scope_summary: mergedScopeSummary || 'Not available',
            merged_visible_facts: mergedVisibleFacts || 'Not available',
            merged_inferences: mergedInferences || 'Not available',
            merged_needs_verification: mergedNeedsVerification || 'Not available',
            merged_risks: mergedRisks || 'Not available',
            merged_trade_detection: mergedTradeDetection || 'Not available',
            current_line_items: estimate.suggested_line_items || '',
            current_exclusions: estimate.suggested_exclusions || '',
            current_allowances: estimate.suggested_allowances || '',
            current_assumptions: estimate.suggested_assumptions || '',
            current_risk_notes: estimate.possible_hidden_risks || '',
            current_site_visit_recommended: estimate.estimate_site_visit_recommended || false,
          },
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const { structured } = await resp.json();
      setCompletenessResult(structured);

      // Save health check record
      await saveHealthCheck({
        health_check_id: crypto.randomUUID(),
        estimate_id: estimateDbId,
        estimate_version: estimate.version || 'v1.0',
        block_source: 'completeness_check',
        warning_level: structured.warning_level || 'Low',
        block_approval: structured.block_approval ?? false,
        blocking_reason: structured.blocking_reason || '',
        human_fix_required: structured.human_fix_required ?? false,
        override_allowed: structured.override_allowed ?? true,
        override_reason_required: structured.override_reason_required ?? false,
        completeness_score: structured.completeness_score ?? 0,
        missing_scope_categories: JSON.stringify(structured.missing_scope_categories || []),
        mismatch_summary: JSON.stringify(structured.mismatches || []),
        site_visit_recommended: structured.site_visit_recommended ?? false,
        confidence_rollup: structured.confidence_rollup || 'Medium',
      });

      // Update estimate-level control fields (not protected content)
      if (!isApproved) {
        const controlUpdates: Partial<Estimate> = {
          ai_estimate_health_status: structured.warning_level === 'High' ? 'High Risk' : structured.warning_level === 'Medium' ? 'Review Needed' : 'Good',
          estimate_completeness_summary: structured.completeness_summary || '',
          estimate_site_visit_recommended: structured.site_visit_recommended ?? false,
          estimate_confidence_rollup: structured.confidence_rollup || 'Medium',
          completeness_score: structured.completeness_score ?? 0,
        } as any;
        onUpdate(controlUpdates);
      }

      // Create queue items for material issues
      if (structured.review_queue_items?.length > 0 && !isApproved) {
        const newSuggestions = structured.review_queue_items.map((item: any) => ({
          suggestion_id: crypto.randomUUID(),
          estimate_id: estimateDbId,
          source_type: 'merged' as SuggestionSourceType,
          suggestion_type: item.suggestion_type || 'internal_note',
          confidence: item.confidence || 'Medium',
          evidence_summary: item.evidence_summary || '',
          reason_for_suggestion: item.reason_for_suggestion || 'Completeness Check AI',
          suggested_value: item.suggested_value || '',
          apply_target: item.apply_target || '',
          status: 'pending',
          decision_state: 'pending',
          reviewer_notes: '',
          approved_by: '',
          edited_value: '',
          suggestion_batch_id: batchId,
          block_name: 'completeness_check',
          priority_level: item.confidence === 'Low' ? 'High' : 'Medium',
          queue_group: 'Completeness Check',
          source_timestamp: new Date().toISOString(),
          idempotency_key: `cc-${estimateDbId}-${crypto.randomUUID().slice(0, 8)}`,
        }));
        await insertSuggestions(newSuggestions);
        const updated = await getSuggestions(estimateDbId);
        setSuggestions(updated);
      }

      toast({ title: 'Completeness check complete', description: `Score: ${structured.completeness_score}%. Warning: ${structured.warning_level}. ${structured.block_approval ? 'REVIEW BLOCKED' : 'No block'}` });
    } catch (e: any) {
      toast({ title: 'Completeness check failed', description: e.message, variant: 'destructive' });
    } finally {
      setCompletenessLoading(false);
    }
  }, [estimateDbId, ensureSaved, areas, estimate, isApproved, toast, onUpdate]);


  const sendSuggestionsToQueue = async () => {
    if (!areaFindings || !estimateDbId || !selectedArea) {
      toast({ title: 'Run analysis first', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const sourceType: SuggestionSourceType = selectedArea.voice_transcript_raw.trim()
        ? (media.length > 0 ? 'merged' : 'voice')
        : (media.length > 0 ? 'photo' : 'text');
      const batchId = crypto.randomUUID();
      const newSuggestions: any[] = [];

      for (const mapping of FINDINGS_TO_SUGGESTIONS) {
        const value = areaFindings[mapping.findingsKey];
        if (typeof value === 'string' && value.trim()) {
          const items = value.split(/\n/).filter(l => l.trim().startsWith('-') || l.trim().startsWith('•') || l.trim().match(/^\d+\./));
          const processItems = items.length > 0 ? items : [value];
          for (const item of processItems) {
            const cleanItem = item.replace(/^[-•\d.)\s]+/, '').trim();
            if (!cleanItem) continue;
            newSuggestions.push({
              suggestion_id: crypto.randomUUID(),
              estimate_id: estimateDbId,
              source_type: sourceType,
              suggestion_type: mapping.type,
              confidence: areaFindings.confidence,
              evidence_summary: `Area: ${selectedArea.area_name}. ${areaFindings.intake_summary || ''}`,
              reason_for_suggestion: `AI Intake (${sourceType}) — ${selectedArea.area_name} — ${mapping.type}`,
              suggested_value: cleanItem,
              apply_target: mapping.target,
              status: 'pending',
              reviewer_notes: '',
              approved_by: '',
              edited_value: '',
              area_id: selectedArea.id,
              suggestion_batch_id: batchId,
              priority_level: areaFindings.confidence === 'Low' ? 'High' : 'Medium',
              queue_group: selectedArea.area_name,
              source_timestamp: new Date().toISOString(),
            });
          }
        }
      }

      if (areaFindings.site_visit_required) {
        newSuggestions.push({
          suggestion_id: crypto.randomUUID(),
          estimate_id: estimateDbId,
          source_type: sourceType,
          suggestion_type: 'site_visit_recommendation',
          confidence: areaFindings.confidence,
          evidence_summary: `Area: ${selectedArea.area_name}`,
          reason_for_suggestion: 'Confidence is low or hidden conditions are likely.',
          suggested_value: `Site visit recommended for ${selectedArea.area_name}.`,
          apply_target: 'site_visit_required',
          status: 'pending',
          reviewer_notes: '',
          approved_by: '',
          edited_value: '',
          area_id: selectedArea.id,
          suggestion_batch_id: batchId,
          priority_level: 'High',
          queue_group: selectedArea.area_name,
          source_timestamp: new Date().toISOString(),
        });
      }

      await insertSuggestions(newSuggestions);
      const updated = await getSuggestions(estimateDbId);
      setSuggestions(updated);
      setActiveTab('queue');
      toast({ title: 'Sent to queue', description: `${newSuggestions.length} suggestions from ${selectedArea.area_name}` });
    } catch (e: any) {
      toast({ title: 'Queue error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Generate Write Plan (Patch 9) ───
  const generateAndStageWritePlan = useCallback(async () => {
    if (!estimateDbId) return;
    const approvable = suggestions.filter(s => s.status === 'approved' || s.status === 'edited');
    if (approvable.length === 0) {
      setWritePlan(null);
      toast({ title: 'No approved items', description: 'Approve suggestions in the Queue tab first.', variant: 'destructive' });
      return;
    }
    setWritePlanLoading(true);
    try {
      const plan = generateWritePlan(approvable, estimate, estimateDbId);
      await saveWritePlan(plan);
      setWritePlan(plan as WritePlan);
      toast({ title: 'Write plan staged', description: plan.summary });
    } catch (e: any) {
      toast({ title: 'Write plan failed', description: e.message, variant: 'destructive' });
    } finally {
      setWritePlanLoading(false);
    }
  }, [estimateDbId, suggestions, estimate, toast]);

  // ─── Execute Write Plan (Patch 10: Controlled Writeback) ───
  const executeWritePlanControlled = useCallback(async () => {
    if (!writePlan || !estimateDbId) return;
    setWritePlanLoading(true);
    setExecutionResult(null);
    try {
      const result = await executeWriteback(writePlan, estimate, estimateDbId);
      setExecutionResult(result);

      if (result.execution_status === 'success' || result.execution_status === 'partial_success') {
        // Refresh local state
        const updatedSuggestions = await getSuggestions(estimateDbId);
        setSuggestions(updatedSuggestions);
        setWritePlan({ ...writePlan, apply_status: 'applied' as any });

        // Apply local estimate updates for UI sync
        const fieldUpdates: Partial<Estimate> = {};
        for (const af of result.applied_fields) {
          if (af.result === 'applied') {
            (fieldUpdates as any)[af.field] = af.action === 'set'
              ? (af.field === 'site_visit_required' ? af.value === 'true' : af.value)
              : ((estimate as any)[af.field] || '') + (((estimate as any)[af.field] || '') ? `\n• ${af.value}` : `• ${af.value}`);
          }
        }
        if (result.requires_reapproval_applied && ['Approved', 'Sent'].includes(estimate.status || '')) {
          fieldUpdates.status = 'Ready for Review' as any;
        }
        fieldUpdates.ai_apply_status = 'Applied' as any;
        onUpdate(fieldUpdates);

        toast({
          title: result.execution_status === 'success' ? 'Writeback complete' : 'Partial writeback',
          description: result.summary,
        });
      } else {
        toast({ title: 'Writeback blocked', description: result.summary, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Execution failed', description: e.message, variant: 'destructive' });
    } finally {
      setWritePlanLoading(false);
    }
  }, [writePlan, estimateDbId, estimate, suggestions, onUpdate, toast]);

  // ─── Post-Write Health Recheck (Patch 11) ───
  const runRecheck = useCallback(async () => {
    if (!estimateDbId) return;
    setRecheckLoading(true);
    setRecheckResult(null);
    try {
      // Get latest health check for prior state
      const { data: priorChecks } = await (await import('@/integrations/supabase/client')).supabase
        .from('estimate_health_checks')
        .select('*')
        .eq('estimate_id', estimateDbId)
        .order('created_at', { ascending: false })
        .limit(1);
      const prior = priorChecks?.[0];

      // Get line items count
      const { count } = await (await import('@/integrations/supabase/client')).supabase
        .from('estimate_line_items')
        .select('id', { count: 'exact', head: true })
        .eq('estimate_id', estimateDbId);

      const result = await runPostWriteRecheck({
        estimate_id: estimateDbId,
        estimate_version: estimate.version || 'v1.0',
        current_status: estimate.status || 'Draft',
        related_execution_id: executionResult?.execution_id || '',
        related_write_plan_id: writePlan?.write_plan_id || '',
        current_line_items_count: count || 0,
        current_exclusions: estimate.suggested_exclusions || '',
        current_allowances: estimate.suggested_allowances || '',
        current_assumptions: estimate.suggested_assumptions || '',
        current_risk_notes: estimate.possible_hidden_risks || '',
        current_missing_info: estimate.missing_info_questions || '',
        merged_scope_summary: (estimate as any).merged_scope_summary || '',
        merged_visible_facts: (estimate as any).merged_visible_facts || '',
        merged_inferences: (estimate as any).merged_inferences || '',
        merged_needs_verification: (estimate as any).merged_needs_verification || '',
        merged_risks: (estimate as any).merged_risks || '',
        merged_trade_detection: (estimate as any).merged_trade_detection || '',
        current_confidence: estimate.estimate_confidence_rollup || 'Medium',
        prior_health_check_id: prior?.id || '',
        prior_blocking_reason: prior?.blocking_reason || '',
        prior_completeness_score: Number(prior?.completeness_score || 0),
        site_visit_required: estimate.site_visit_required || false,
      });
      setRecheckResult(result);

      // Sync local estimate state
      onUpdate({
        ai_estimate_health_status: result.health_status as any,
        estimate_site_visit_recommended: result.site_visit_recommended,
        estimate_confidence_rollup: result.confidence_rollup as any,
        completeness_score: result.completeness_score,
        review_blocked: result.block_approval,
        review_block_reason: result.blocking_reason,
        override_required: result.human_fix_required,
      } as any);

      // Refresh suggestions if queue items were created
      if (result.queue_items_created > 0) {
        const updated = await getSuggestions(estimateDbId);
        setSuggestions(updated);
      }

      toast({
        title: `Health: ${result.health_status}`,
        description: `Score: ${result.completeness_score}%. ${result.resolution_summary}`,
      });
    } catch (e: any) {
      toast({ title: 'Recheck failed', description: e.message, variant: 'destructive' });
    } finally {
      setRecheckLoading(false);
    }
  }, [estimateDbId, estimate, executionResult, writePlan, onUpdate, toast]);

  // ─── Apply Approved Suggestions (legacy) ───
  const applyApprovedSuggestions = async () => {
    if (!estimateDbId) return;
    const approvable = filteredSuggestions.filter(s => s.status === 'approved' || s.status === 'edited');
    if (approvable.length === 0) {
      toast({ title: 'Nothing to apply', variant: 'destructive' });
      return;
    }
    if (isApproved) {
      toast({ title: 'Approved Estimate — Advisory Only', description: 'Will NOT overwrite approved values.', variant: 'destructive' });
    }
    setLoading(true);
    try {
      const updates: Partial<Estimate> = {};
      const auditEntries: any[] = [];

      for (const s of approvable) {
        const value = s.status === 'edited' && s.edited_value ? s.edited_value : s.suggested_value;
        const target = s.apply_target;
        if (['suggested_exclusions', 'suggested_allowances', 'suggested_assumptions',
             'visible_findings', 'likely_scope_items', 'possible_hidden_risks',
             'missing_info_questions', 'ai_detected_trades', 'suggested_line_items'].includes(target)) {
          const existing = (estimate as any)[target] || '';
          (updates as any)[target] = existing ? `${existing}\n• ${value}` : `• ${value}`;
        } else if (target === 'site_visit_required') {
          updates.site_visit_required = true;
        } else if (target === 'internal_notes') {
          const existing = estimate.internal_notes || '';
          updates.internal_notes = existing ? `${existing}\n[AI] ${value}` : `[AI] ${value}`;
        }

        await updateSuggestionStatus(s.id, 'applied', { approved_by: 'TVIK' });
        auditEntries.push({
          audit_id: crypto.randomUUID(),
          estimate_id: estimateDbId,
          suggestion_id: s.id,
          original_suggestion: s.suggested_value,
          final_applied_value: value,
          applied_field: target,
          confidence: s.confidence,
          approved_by: 'TVIK',
          approved_at: new Date().toISOString(),
          source_type: s.source_type,
          area_id: (s as any).area_id || null,
          suggestion_batch_id: (s as any).suggestion_batch_id || '',
        });
      }

      updates.ai_apply_status = 'Draft Applied' as any;
      onUpdate(updates);
      if (auditEntries.length > 0) await insertAppliedAudit(auditEntries);
      await onSave();
      const updatedSuggestions = await getSuggestions(estimateDbId);
      setSuggestions(updatedSuggestions);
      toast({ title: 'Applied', description: `${approvable.length} suggestions applied. Audit trail created.` });
    } catch (e: any) {
      toast({ title: 'Apply failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Update Estimate Rollup ───
  const updateEstimateRollup = async () => {
    if (!rollup) return;
    onUpdate({
      area_count: rollup.area_count,
      ai_pending_suggestions_count: rollup.ai_pending_suggestions_count,
      ai_estimate_health_status: rollup.ai_estimate_health_status,
      ai_estimate_rollup_summary: rollup.ai_estimate_rollup_summary,
      ai_revision_review_status: rollup.ai_revision_review_status,
      estimate_site_visit_recommended: rollup.estimate_site_visit_recommended,
      estimate_confidence_rollup: rollup.estimate_confidence_rollup,
    } as any);
    await onSave();
    toast({ title: 'Estimate rollup updated' });
  };

  const handleApproveSuggestion = async (s: AISuggestion) => {
    await updateSuggestionStatus(s.id, 'approved', { approved_by: 'TVIK' });
    setSuggestions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'approved' as any } : x));
  };
  const handleRejectSuggestion = async (s: AISuggestion) => {
    await updateSuggestionStatus(s.id, 'rejected');
    setSuggestions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'rejected' as any } : x));
  };
  const handleEditSuggestion = (s: AISuggestion) => {
    setEditingSuggestionId(s.id);
    setEditValue(s.edited_value || s.suggested_value);
  };
  const handleSaveEdit = async (s: AISuggestion) => {
    await updateSuggestionStatus(s.id, 'edited', { edited_value: editValue, approved_by: 'TVIK' });
    setSuggestions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'edited' as any, edited_value: editValue } : x));
    setEditingSuggestionId(null);
    setEditValue('');
  };

  const confidenceBadge = (level: AIConfidence) => {
    const colors: Record<AIConfidence, string> = {
      High: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      Medium: 'bg-amber-100 text-amber-800 border-amber-300',
      Low: 'bg-red-100 text-red-800 border-red-300',
    };
    return <Badge variant="outline" className={`${colors[level]} text-xs`}>{level}</Badge>;
  };

  const healthBadge = (status: string) => {
    const colors: Record<string, string> = {
      'Good': 'bg-emerald-100 text-emerald-800',
      'Review Needed': 'bg-amber-100 text-amber-800',
      'High Risk': 'bg-red-100 text-red-800',
    };
    return <Badge className={`${colors[status] || ''} text-xs`}>{status}</Badge>;
  };

  const pendingCount = suggestions.filter(s => s.status === 'pending').length;
  const approvedCount = suggestions.filter(s => s.status === 'approved' || s.status === 'edited').length;

  // Filtered suggestions
  const filteredSuggestions = suggestions.filter(s => {
    if (queueFilter !== 'all' && s.status !== queueFilter) return false;
    if (queueAreaFilter !== 'all') {
      const areaId = (s as any).area_id;
      if (queueAreaFilter === 'no-area') return !areaId;
      if (areaId !== queueAreaFilter) return false;
    }
    return true;
  });

  const SectionHeader = ({ id, icon: Icon, title, badge }: { id: string; icon: any; title: string; badge?: React.ReactNode }) => (
    <button onClick={() => toggleSection(id)} className="flex items-center gap-2 w-full text-left py-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors">
      {expandedSections.has(id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{title}</span>
      {badge}
    </button>
  );

  const FindingSection = ({ content }: { content: string }) => {
    if (!content) return <p className="text-xs text-muted-foreground italic">No data yet</p>;
    return <div className="prose prose-sm max-w-none text-foreground text-xs"><ReactMarkdown>{content}</ReactMarkdown></div>;
  };

  const currentAreaTags = selectedArea?.quick_tags ? selectedArea.quick_tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">AI Intake Assistant</span>
            <Badge variant="outline" className="text-xs">Draft Only</Badge>
          </div>
          <div className="flex items-center gap-2">
            {rollup && healthBadge(rollup.ai_estimate_health_status)}
            {pendingCount > 0 && <Badge variant="secondary" className="text-xs">{pendingCount} pending</Badge>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Initial intake → room-by-room → review queue. All changes require approval.</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-2 mt-2 flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="initial" className="text-[10px] px-1.5 py-1 h-auto">Intake</TabsTrigger>
          <TabsTrigger value="areas" className="text-[10px] px-1.5 py-1 h-auto">Areas</TabsTrigger>
          <TabsTrigger value="capture" className="text-[10px] px-1.5 py-1 h-auto">Capture</TabsTrigger>
          <TabsTrigger value="photos" className="text-[10px] px-1.5 py-1 h-auto">Photos</TabsTrigger>
          <TabsTrigger value="merge" className="text-[10px] px-1.5 py-1 h-auto">Merge</TabsTrigger>
          <TabsTrigger value="questions" className="text-[10px] px-1.5 py-1 h-auto">Questions</TabsTrigger>
          <TabsTrigger value="check" className="text-[10px] px-1.5 py-1 h-auto">Check</TabsTrigger>
          <TabsTrigger value="queue" className="text-[10px] px-1.5 py-1 h-auto">Queue {pendingCount > 0 && `(${pendingCount})`}</TabsTrigger>
          <TabsTrigger value="apply" className="text-[10px] px-1.5 py-1 h-auto">Apply {approvedCount > 0 && `(${approvedCount})`}</TabsTrigger>
          <TabsTrigger value="summary" className="text-[10px] px-1.5 py-1 h-auto">Summary</TabsTrigger>
        </TabsList>

        {/* ═══ INITIAL INTAKE TAB (Patch 3) ═══ */}
        <TabsContent value="initial" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {isApproved && (
                <Card className="border-amber-300 bg-amber-50">
                  <CardContent className="py-2 px-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-800">Approved estimate — intake results are advisory only. No fields will be updated.</p>
                  </CardContent>
                </Card>
              )}

              {/* Typed Description Input */}
              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5" /> Project Description
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  <Textarea
                    value={initialIntakeDesc}
                    onChange={e => setInitialIntakeDesc(e.target.value)}
                    placeholder="Describe the project scope, conditions, customer requests... e.g. 'Full gut rehab of 2BR/1BA unit. Needs new kitchen, bathroom tile, all electrical updated. Tenant moved out, unit is empty. Water damage visible near tub.'"
                    className="text-xs min-h-[100px]"
                    disabled={initialIntakeLoading}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Customer Goal</Label>
                      <Input
                        value={initialIntakeGoal}
                        onChange={e => setInitialIntakeGoal(e.target.value)}
                        placeholder="e.g. Rent-ready, flip for sale"
                        className="text-xs h-8 mt-1"
                        disabled={initialIntakeLoading}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Urgency</Label>
                      <Input
                        value={initialIntakeUrgency}
                        onChange={e => setInitialIntakeUrgency(e.target.value)}
                        placeholder="e.g. ASAP, 30 days, flexible"
                        className="text-xs h-8 mt-1"
                        disabled={initialIntakeLoading}
                      />
                    </div>
                  </div>
                  {/* Context from estimate */}
                  {(estimate.project_type || estimate.sqft) && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {estimate.project_type && <Badge variant="outline" className="text-xs">{estimate.project_type}</Badge>}
                      {estimate.sqft ? <Badge variant="outline" className="text-xs">{estimate.sqft} sqft</Badge> : null}
                      {estimate.finish_level && <Badge variant="outline" className="text-xs">{estimate.finish_level}</Badge>}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Button */}
              <Button
                onClick={analyzeInitialIntake}
                disabled={initialIntakeLoading || (!initialIntakeDesc.trim() && !estimate.internal_notes)}
                className="w-full text-xs h-9"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                {initialIntakeLoading ? 'Analyzing Initial Intake…' : 'Analyze Initial Intake'}
              </Button>

              {/* ─── Structured Results ─── */}
              {initialIntakeResult && (
                <div className="space-y-3">
                  {/* Confidence Badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Confidence:</span>
                    {confidenceBadge(initialIntakeResult.confidence)}
                    {initialIntakeResult.site_visit_recommended && (
                      <Badge className="bg-red-100 text-red-800 border-red-300 text-xs">
                        <MapPin className="h-3 w-3 mr-1" />Site Visit Recommended
                      </Badge>
                    )}
                  </div>

                  {/* Summary of Request */}
                  <Card>
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-xs flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> Summary of Request</CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <p className="text-xs text-foreground">{initialIntakeResult.summary_of_request}</p>
                    </CardContent>
                  </Card>

                  {/* Probable Work Categories */}
                  {initialIntakeResult.probable_work_categories?.length > 0 && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> Probable Work Categories</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <div className="flex flex-wrap gap-1.5">
                          {initialIntakeResult.probable_work_categories.map((cat, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{cat}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Likely Trades */}
                  {initialIntakeResult.likely_trades?.length > 0 && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5"><HelpCircle className="h-3.5 w-3.5" /> Likely Trades</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <div className="flex flex-wrap gap-1.5">
                          {initialIntakeResult.likely_trades.map((trade, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{trade}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Obvious Unknowns */}
                  {initialIntakeResult.obvious_unknowns?.length > 0 && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Obvious Unknowns</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <ul className="space-y-1">
                          {initialIntakeResult.obvious_unknowns.map((u, i) => (
                            <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                              <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                              {u}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Next Questions */}
                  {initialIntakeResult.next_questions?.length > 0 && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5"><FileQuestion className="h-3.5 w-3.5" /> Follow-Up Questions ({initialIntakeResult.next_questions.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <ol className="space-y-2">
                          {initialIntakeResult.next_questions.map((q, i) => (
                            <li key={i} className="text-xs border rounded p-2">
                              <p className="font-medium text-foreground">{i + 1}. {q.question}</p>
                              <p className="text-muted-foreground mt-0.5">Why: {q.why_it_matters}</p>
                            </li>
                          ))}
                        </ol>
                      </CardContent>
                    </Card>
                  )}

                  {/* Queue Suggestions Preview */}
                  {initialIntakeResult.review_queue_items?.length > 0 && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5">
                          <Send className="h-3.5 w-3.5" /> Queue Suggestions
                          <Badge variant="secondary" className="text-xs">{initialIntakeResult.review_queue_items.length} created</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <ul className="space-y-1.5">
                          {initialIntakeResult.review_queue_items.map((item, i) => (
                            <li key={i} className="text-xs border rounded p-2 flex items-start gap-2">
                              <Badge variant="outline" className="text-xs shrink-0">{SUGGESTION_TYPE_LABELS[item.suggestion_type as SuggestionType] || item.suggestion_type}</Badge>
                              <span className="text-foreground">{item.suggested_value}</span>
                            </li>
                          ))}
                        </ul>
                        <Button size="sm" variant="outline" className="text-xs h-7 mt-2 w-full" onClick={() => setActiveTab('queue')}>
                          View in Review Queue →
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Empty state */}
              {!initialIntakeResult && !initialIntakeLoading && (
                <div className="text-center py-6">
                  <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">Enter a rough project description above and click "Analyze Initial Intake" to get structured first-pass estimating support.</p>
                  <p className="text-xs text-muted-foreground mt-1">The AI will identify trades, unknowns, and follow-up questions — no pricing or quantities.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ═══ AREAS TAB ═══ */}
        <TabsContent value="areas" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {/* Add Area */}
              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Area</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {AREA_TYPES.map(type => (
                      <Button key={type} size="sm" variant="outline" onClick={() => addArea(type)} className="text-xs h-8" disabled={!estimateDbId}>
                        <Home className="h-3 w-3 mr-1" />{type}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Area List */}
              {areas.length === 0 ? (
                <div className="text-center py-8">
                  <Home className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">No areas yet. Add areas to start room-by-room intake.</p>
                </div>
              ) : (
                areas.map(area => {
                  const areaPending = suggestions.filter(s => (s as any).area_id === area.id && s.status === 'pending').length;
                  return (
                    <Card
                      key={area.id}
                      className={`cursor-pointer transition-colors ${selectedAreaId === area.id ? 'border-primary ring-1 ring-primary/20' : 'hover:border-muted-foreground/30'}`}
                      onClick={() => { setSelectedAreaId(area.id!); setActiveTab('capture'); }}
                    >
                      <CardContent className="py-2 px-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Home className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{area.area_name || area.area_type}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-muted-foreground">{area.area_type}</span>
                                {area.voice_capture_status !== 'Not Started' && (
                                  <Badge variant="outline" className="text-xs py-0">{area.voice_capture_status}</Badge>
                                )}
                                {area.voice_analysis_status === 'Complete' && (
                                  <Badge variant="outline" className="text-xs py-0 bg-emerald-50 text-emerald-700 border-emerald-200">Analyzed</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {areaPending > 0 && <Badge variant="secondary" className="text-xs">{areaPending}</Badge>}
                            {confidenceBadge(area.confidence)}
                            {area.low_confidence_warning && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                            {area.site_visit_flag && <MapPin className="h-3 w-3 text-red-500" />}
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); removeArea(area.id!); }}>
                              <Trash2 className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                        {area.quick_tags && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {area.quick_tags.split(',').slice(0, 4).map((t, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{t.trim()}</Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ═══ CAPTURE TAB (Upgraded Voice Walkthrough) ═══ */}
        <TabsContent value="capture" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {!selectedArea ? (
                <div className="text-center py-8">
                  <p className="text-xs text-muted-foreground">Select or add an area from the Areas tab first.</p>
                </div>
              ) : (
                <>
                  {/* Area header with switcher */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">{selectedArea.area_name || selectedArea.area_type}</span>
                      {confidenceBadge(selectedArea.confidence)}
                      {selectedArea.low_confidence_warning && (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">Low Conf Warning</Badge>
                      )}
                    </div>
                    <Select value={selectedAreaId || ''} onValueChange={setSelectedAreaId}>
                      <SelectTrigger className="w-[140px] h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {areas.map(a => (
                          <SelectItem key={a.id} value={a.id!} className="text-xs">{a.area_name || a.area_type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Area Name */}
                  <div>
                    <Label className="text-xs">Area Name</Label>
                    <Input
                      value={selectedArea.area_name}
                      onChange={e => updateArea('area_name', e.target.value)}
                      className="text-xs h-8 mt-1"
                      placeholder="e.g. Master Bathroom"
                    />
                  </div>

                  {/* Warnings */}
                  {isApproved && (
                    <Card className="border-amber-300 bg-amber-50">
                      <CardContent className="py-2 px-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        <p className="text-xs text-amber-800">Approved estimate. AI findings are advisory only.</p>
                      </CardContent>
                    </Card>
                  )}

                  {selectedArea.site_visit_flag && (
                    <Card className="border-red-300 bg-red-50">
                      <CardContent className="py-2 px-3 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-red-600 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-red-800"><strong>Site visit recommended</strong> for this area.</p>
                          {selectedArea.site_visit_reason && (
                            <p className="text-xs text-red-700 mt-0.5">{selectedArea.site_visit_reason}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Voice Transcript Section */}
                  <Card>
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-xs flex items-center gap-1.5">
                        <Mic className="h-3.5 w-3.5" /> Voice Walkthrough
                        {isRecording && <Badge className="bg-destructive text-destructive-foreground text-xs animate-pulse">Recording…</Badge>}
                        {selectedArea.voice_capture_status !== 'Not Started' && !isRecording && (
                          <Badge variant="outline" className="text-xs">{selectedArea.voice_capture_status}</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-2">
                      {/* Recording controls */}
                      <div className="flex flex-wrap gap-1.5">
                        {speechSupported ? (
                          isRecording ? (
                            <Button size="sm" variant="destructive" onClick={() => {
                              stopRecording();
                              updateArea('voice_capture_status', 'Captured');
                              updateArea('voice_transcript_source', 'recorded');
                              updateArea('voice_last_updated_at', new Date().toISOString());
                            }} className="text-xs h-9 px-4">
                              <Square className="h-3 w-3 mr-1" />Stop Recording
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => {
                              startRecording();
                              updateArea('voice_capture_status', 'Recording');
                            }} disabled={loading} className="text-xs h-9 px-4">
                              <Mic className="h-3 w-3 mr-1" />Start Recording
                            </Button>
                          )
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Voice recording not supported. Paste transcript below.</p>
                        )}
                        <Button size="sm" variant="outline" onClick={() => {
                          updateArea('voice_transcript_raw', '');
                          updateArea('voice_capture_status', 'Not Started');
                          updateArea('voice_transcript_source', '');
                        }} disabled={loading || !selectedArea.voice_transcript_raw || isRecording} className="text-xs h-9">
                          <X className="h-3 w-3 mr-1" />Clear
                        </Button>
                      </div>

                      {/* Interim transcript */}
                      {interimTranscript && (
                        <p className="text-xs text-muted-foreground italic border-l-2 border-primary pl-2">{interimTranscript}</p>
                      )}

                      {/* Raw Transcript textarea */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Raw Transcript</Label>
                        <Textarea
                          value={selectedArea.voice_transcript_raw}
                          onChange={e => {
                            updateArea('voice_transcript_raw', e.target.value);
                            if (e.target.value.trim() && selectedArea.voice_capture_status === 'Not Started') {
                              updateArea('voice_capture_status', 'Captured');
                              updateArea('voice_transcript_source', 'pasted');
                              updateArea('voice_last_updated_at', new Date().toISOString());
                            }
                          }}
                          placeholder="Tap 'Start Recording' to dictate, or paste transcript here..."
                          className="text-xs min-h-[80px] mt-1"
                          disabled={loading || isRecording}
                        />
                      </div>

                      {/* Cleaned Transcript (read-only, shown after analysis) */}
                      {selectedArea.voice_transcript_cleaned && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Cleaned Transcript</Label>
                          <div className="text-xs border rounded p-2 mt-1 bg-muted/30 max-h-[100px] overflow-auto">
                            {selectedArea.voice_transcript_cleaned}
                          </div>
                        </div>
                      )}

                      {/* Voice lifecycle status bar */}
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        {selectedArea.voice_transcript_source && (
                          <span>Source: <strong>{selectedArea.voice_transcript_source}</strong></span>
                        )}
                        {selectedArea.voice_analysis_status !== 'Not Run' && (
                          <span>Analysis: <strong>{selectedArea.voice_analysis_status}</strong></span>
                        )}
                        {selectedArea.voice_last_updated_at && (
                          <span>Updated: {new Date(selectedArea.voice_last_updated_at).toLocaleTimeString()}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Typed Notes */}
                  <Card>
                    <CardContent className="py-3 px-3 space-y-2">
                      <Label className="text-xs font-medium">Typed Notes</Label>
                      <Textarea
                        value={selectedArea.notes_text}
                        onChange={e => updateArea('notes_text', e.target.value)}
                        placeholder="Describe conditions, customer requests, measurements..."
                        className="text-xs min-h-[60px]"
                        disabled={loading}
                      />
                    </CardContent>
                  </Card>

                  {/* Photos */}
                  <Card>
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-xs flex items-center gap-1.5"><Camera className="h-3.5 w-3.5" /> Photos ({media.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      {estimateDbId ? (
                        <MediaUploader folder="estimates" onUploaded={async (url: string, caption: string) => {
                          const { supabase } = await import('@/integrations/supabase/client');
                          const { data: { user } } = await supabase.auth.getUser();
                          if (user && estimateDbId) {
                            await supabase.from('estimate_media').insert({
                              estimate_id: estimateDbId,
                              user_id: user.id,
                              media_id: crypto.randomUUID(),
                              file_url: url,
                              caption: caption || '',
                              include_in_internal_pdf: true,
                              include_in_public_pdf: false,
                            } as any);
                          }
                          onMediaChange();
                          updateArea('uploaded_photo_count', (selectedArea.uploaded_photo_count || 0) + 1);
                        }} />
                      ) : (
                        <p className="text-xs text-muted-foreground">Save estimate first.</p>
                      )}
                      {media.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {media.slice(0, 6).map(m => (
                            <div key={m.id} className="w-12 h-12 rounded border overflow-hidden">
                              <img src={m.file_url} alt={m.caption} className="w-full h-full object-cover" />
                            </div>
                          ))}
                          {media.length > 6 && <span className="text-xs text-muted-foreground self-center">+{media.length - 6}</span>}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Quick Tags */}
                  <Card>
                    <CardContent className="py-3 px-3 space-y-2">
                      <Label className="text-xs font-medium">Quick Tags</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_TAGS_EXTENDED.map(tag => (
                          <Badge
                            key={tag}
                            variant={currentAreaTags.includes(tag) ? 'default' : 'outline'}
                            className="text-xs cursor-pointer select-none py-1 px-2"
                            onClick={() => toggleAreaTag(tag)}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* ─── Structured Area Findings ─── */}
                  {selectedArea.voice_analysis_status === 'Complete' && selectedArea.latest_ai_summary && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> Area Findings</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-2">
                        <FindingSection content={selectedArea.latest_ai_summary} />

                        {selectedArea.visible_findings && (
                          <div>
                            <SectionHeader id={`af-vis-${selectedArea.id}`} icon={Eye} title="Visible Facts" />
                            {expandedSections.has(`af-vis-${selectedArea.id}`) && <FindingSection content={selectedArea.visible_findings} />}
                          </div>
                        )}
                        {selectedArea.likely_scope_items && (
                          <div>
                            <SectionHeader id={`af-scope-${selectedArea.id}`} icon={Wrench} title="Likely Inferences" />
                            {expandedSections.has(`af-scope-${selectedArea.id}`) && <FindingSection content={selectedArea.likely_scope_items} />}
                          </div>
                        )}
                        {selectedArea.possible_hidden_risks && (
                          <div>
                            <SectionHeader id={`af-risk-${selectedArea.id}`} icon={Shield} title="Needs Verification / Risks" />
                            {expandedSections.has(`af-risk-${selectedArea.id}`) && <FindingSection content={selectedArea.possible_hidden_risks} />}
                          </div>
                        )}
                        {selectedArea.ai_detected_trades && (
                          <div>
                            <SectionHeader id={`af-trades-${selectedArea.id}`} icon={Wrench} title="Detected Trades" />
                            {expandedSections.has(`af-trades-${selectedArea.id}`) && (
                              <div className="flex flex-wrap gap-1.5">
                                {selectedArea.ai_detected_trades.split(',').map((t, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">{t.trim()}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {selectedArea.missing_info_questions && (
                          <div>
                            <SectionHeader id={`af-q-${selectedArea.id}`} icon={FileQuestion} title="Missing Info / Questions" />
                            {expandedSections.has(`af-q-${selectedArea.id}`) && <FindingSection content={selectedArea.missing_info_questions} />}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* ─── Area Queue Preview ─── */}
                  {(() => {
                    const areaSuggestions = suggestions.filter(s => (s as any).area_id === selectedArea.id);
                    const areaPending = areaSuggestions.filter(s => s.status === 'pending');
                    if (areaSuggestions.length === 0) return null;
                    return (
                      <Card>
                        <CardHeader className="py-2 px-3">
                          <CardTitle className="text-xs flex items-center gap-1.5">
                            <Send className="h-3.5 w-3.5" /> Area Queue
                            {areaPending.length > 0 && <Badge variant="secondary" className="text-xs">{areaPending.length} pending</Badge>}
                            <Badge variant="outline" className="text-xs">{areaSuggestions.length} total</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 space-y-1.5">
                          {areaSuggestions.slice(0, 5).map(s => (
                            <div key={s.id} className="flex items-center gap-2 text-xs border rounded p-1.5">
                              <Badge variant="outline" className="text-xs shrink-0">
                                {SUGGESTION_TYPE_LABELS[s.suggestion_type as SuggestionType] || s.suggestion_type}
                              </Badge>
                              <span className="flex-1 truncate">{s.suggested_value}</span>
                              {confidenceBadge(s.confidence as AIConfidence)}
                              <Badge variant="outline" className={`text-xs shrink-0 ${SUGGESTION_STATUS_COLORS[s.status as keyof typeof SUGGESTION_STATUS_COLORS] || ''}`}>
                                {s.status}
                              </Badge>
                            </div>
                          ))}
                          {areaSuggestions.length > 5 && (
                            <p className="text-xs text-muted-foreground">+{areaSuggestions.length - 5} more</p>
                          )}
                          <Button size="sm" variant="outline" className="text-xs h-7 w-full mt-1" onClick={() => { setQueueAreaFilter(selectedArea.id!); setActiveTab('queue'); }}>
                            View All Area Suggestions →
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-1.5 sticky bottom-0 bg-background py-2">
                    <Button size="sm" onClick={saveCurrentArea} disabled={loading} variant="outline" className="text-xs h-9">
                      <CheckCircle className="h-3 w-3 mr-1" />Save Area
                    </Button>
                    <Button size="sm" onClick={analyzeArea} disabled={loading || (!selectedArea.voice_transcript_raw.trim() && !selectedArea.notes_text.trim())} className="text-xs h-9">
                      <Sparkles className="h-3 w-3 mr-1" />{loading ? 'Analyzing…' : 'Analyze Voice Walkthrough'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      updateArea('site_visit_flag', !selectedArea.site_visit_flag);
                    }} className={`text-xs h-9 ${selectedArea.site_visit_flag ? 'bg-red-50 border-red-300 text-red-700' : ''}`}>
                      <MapPin className="h-3 w-3 mr-1" />{selectedArea.site_visit_flag ? 'Site Visit ✓' : 'Mark Site Visit'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ═══ PHOTOS TAB (Patch 5) ═══ */}
        <TabsContent value="photos" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {isApproved && (
                <Card className="border-amber-300 bg-amber-50">
                  <CardContent className="py-2 px-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-800">Approved estimate — photo analysis is advisory only.</p>
                  </CardContent>
                </Card>
              )}

              {/* Area context */}
              {selectedArea && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Home className="h-3.5 w-3.5" />
                  <span>Area: <strong>{selectedArea.area_name || selectedArea.area_type}</strong></span>
                  {selectedArea.photo_analysis_status !== 'Not Run' && (
                    <Badge variant="outline" className="text-xs">{selectedArea.photo_analysis_status}</Badge>
                  )}
                </div>
              )}

              {/* Photo Upload */}
              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5" /> Photos ({media.length})
                    {selectedArea && <Badge variant="outline" className="text-xs">{selectedArea.uploaded_photo_count} uploaded</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  {estimateDbId ? (
                    <MediaUploader folder="estimates" onUploaded={async (url: string, caption: string) => {
                      // Save estimate_media record so parent can track it
                      const { supabase } = await import('@/integrations/supabase/client');
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user && estimateDbId) {
                        await supabase.from('estimate_media').insert({
                          estimate_id: estimateDbId,
                          user_id: user.id,
                          media_id: crypto.randomUUID(),
                          file_url: url,
                          caption: caption || '',
                          include_in_internal_pdf: true,
                          include_in_public_pdf: false,
                        } as any);
                      }
                      onMediaChange();
                      if (selectedArea) updateArea('uploaded_photo_count', selectedArea.uploaded_photo_count + 1);
                    }} />
                  ) : (
                    <p className="text-xs text-muted-foreground">Save estimate first.</p>
                  )}
                  {media.length > 0 && (
                    <div className="mt-2 grid grid-cols-4 gap-1.5">
                      {media.map(m => (
                        <div key={m.id} className="aspect-square rounded border overflow-hidden">
                          <img src={m.file_url} alt={m.caption} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Analyze Button */}
              <Button
                onClick={analyzePhotos}
                disabled={photoAnalysisLoading || media.length === 0}
                className="w-full text-xs h-9"
              >
                <Camera className="h-3 w-3 mr-1" />
                {photoAnalysisLoading ? 'Analyzing Photos…' : `Analyze ${media.length} Photo${media.length !== 1 ? 's' : ''}`}
              </Button>

              {/* Status bar */}
              {selectedArea && selectedArea.photo_analysis_status !== 'Not Run' && (
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  <span>Status: <strong>{selectedArea.photo_analysis_status}</strong></span>
                  {selectedArea.latest_photo_batch_id && (
                    <span>Batch: <code className="text-xs">{selectedArea.latest_photo_batch_id.slice(0, 8)}</code></span>
                  )}
                  {selectedArea.updated_at && (
                    <span>Updated: {new Date(selectedArea.updated_at).toLocaleTimeString()}</span>
                  )}
                </div>
              )}

              {/* Structured Results */}
              {photoAnalysisResult && (
                <div className="space-y-3">
                  {/* Summary */}
                  {photoAnalysisResult.photo_summary && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5" /> Photo Summary
                          {confidenceBadge(photoAnalysisResult.image_confidence || 'Medium')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <p className="text-xs text-foreground">{photoAnalysisResult.photo_summary}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Low Confidence Warning */}
                  {photoAnalysisResult.image_confidence === 'Low' && (
                    <Card className="border-amber-300 bg-amber-50">
                      <CardContent className="py-2 px-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        <p className="text-xs text-amber-800"><strong>Low confidence.</strong> Visual evidence is insufficient for reliable scope extraction. Suggestions remain in queue only.</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Site Visit Recommendation */}
                  {photoAnalysisResult.site_visit_recommended && (
                    <Card className="border-red-300 bg-red-50">
                      <CardContent className="py-2 px-3 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-red-600 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-red-800"><strong>Site visit recommended</strong></p>
                          {photoAnalysisResult.site_visit_reason && (
                            <p className="text-xs text-red-700 mt-0.5">{photoAnalysisResult.site_visit_reason}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Visible Facts */}
                  {photoAnalysisResult.visible_facts && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> Visible Facts</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <FindingSection content={photoAnalysisResult.visible_facts} />
                      </CardContent>
                    </Card>
                  )}

                  {/* Probable Scope Items */}
                  {photoAnalysisResult.probable_scope_items && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> Probable Scope Items</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <FindingSection content={photoAnalysisResult.probable_scope_items} />
                      </CardContent>
                    </Card>
                  )}

                  {/* Probable Hidden Risks */}
                  {photoAnalysisResult.probable_hidden_risks && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Probable Hidden Risks</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <FindingSection content={photoAnalysisResult.probable_hidden_risks} />
                      </CardContent>
                    </Card>
                  )}

                  {/* Trade Detection */}
                  {photoAnalysisResult.trade_detection && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> Detected Trades</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <div className="flex flex-wrap gap-1.5">
                          {photoAnalysisResult.trade_detection.split(',').map((t: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">{t.trim()}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Missing Visual Information */}
                  {photoAnalysisResult.missing_visual_information && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5"><FileQuestion className="h-3.5 w-3.5" /> Missing Visual Information</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <FindingSection content={photoAnalysisResult.missing_visual_information} />
                      </CardContent>
                    </Card>
                  )}

                  {/* Queue Suggestions Preview */}
                  {photoAnalysisResult.review_queue_items?.length > 0 && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5">
                          <Send className="h-3.5 w-3.5" /> Queue Suggestions
                          <Badge variant="secondary" className="text-xs">{photoAnalysisResult.review_queue_items.length} created</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <ul className="space-y-1.5">
                          {photoAnalysisResult.review_queue_items.map((item: any, i: number) => (
                            <li key={i} className="text-xs border rounded p-2 flex items-start gap-2">
                              <Badge variant="outline" className="text-xs shrink-0">{SUGGESTION_TYPE_LABELS[item.suggestion_type as SuggestionType] || item.suggestion_type}</Badge>
                              <span className="text-foreground flex-1">{item.suggested_value}</span>
                              {confidenceBadge(item.confidence || 'Medium')}
                            </li>
                          ))}
                        </ul>
                        <Button size="sm" variant="outline" className="text-xs h-7 mt-2 w-full" onClick={() => setActiveTab('queue')}>
                          View in Review Queue →
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Empty state */}
              {!photoAnalysisResult && !photoAnalysisLoading && (
                <div className="text-center py-6">
                  <Camera className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">Upload photos above and click "Analyze Photos" to extract structured findings.</p>
                  <p className="text-xs text-muted-foreground mt-1">The AI identifies visible conditions, probable scope, risks, and trades — no pricing or quantities.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ═══ MERGE TAB (Patch 6) ═══ */}
        <TabsContent value="merge" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {/* Upstream inputs status */}
              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Merge Inputs</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={selectedArea?.notes_text?.trim() ? 'text-green-600' : 'text-muted-foreground'}>
                      {selectedArea?.notes_text?.trim() ? <CheckCircle className="h-3 w-3 inline" /> : <Square className="h-3 w-3 inline" />}
                    </span>
                    Typed Intake
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={selectedArea?.voice_analysis_status === 'Complete' ? 'text-green-600' : 'text-muted-foreground'}>
                      {selectedArea?.voice_analysis_status === 'Complete' ? <CheckCircle className="h-3 w-3 inline" /> : <Square className="h-3 w-3 inline" />}
                    </span>
                    Voice Walkthrough
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={selectedArea?.photo_analysis_status === 'Complete' ? 'text-green-600' : 'text-muted-foreground'}>
                      {selectedArea?.photo_analysis_status === 'Complete' ? <CheckCircle className="h-3 w-3 inline" /> : <Square className="h-3 w-3 inline" />}
                    </span>
                    Photo Analysis
                  </div>
                </CardContent>
              </Card>

              {/* Action */}
              <Button
                size="sm"
                className="w-full"
                disabled={mergeAnalysisLoading || !selectedArea}
                onClick={analyzeMerge}
              >
                {mergeAnalysisLoading ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Merging…</> : <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Run Merge Analysis</>}
              </Button>

              {/* Status */}
              {selectedArea?.merged_analysis_status && selectedArea.merged_analysis_status !== 'Not Run' && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{selectedArea.merged_analysis_status}</Badge>
                  {selectedArea.merged_last_updated_at && <span>Updated {new Date(selectedArea.merged_last_updated_at).toLocaleString()}</span>}
                  {selectedArea.latest_merge_batch_id && <span className="font-mono text-[9px]">Batch: {selectedArea.latest_merge_batch_id.slice(0, 8)}</span>}
                </div>
              )}

              {/* Confidence */}
              {(mergeAnalysisResult?.merged_confidence || selectedArea?.merged_confidence) && (
                <Badge variant={
                  (mergeAnalysisResult?.merged_confidence || selectedArea?.merged_confidence) === 'High' ? 'default' :
                  (mergeAnalysisResult?.merged_confidence || selectedArea?.merged_confidence) === 'Low' ? 'destructive' : 'secondary'
                } className="text-xs">
                  Confidence: {mergeAnalysisResult?.merged_confidence || selectedArea?.merged_confidence}
                </Badge>
              )}

              {/* Conflict summary */}
              {(mergeAnalysisResult?.conflict_summary || selectedArea?.conflict_summary) && (
                <Card className="border-yellow-500/50 bg-yellow-500/5">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs flex items-center gap-1.5 text-yellow-700"><AlertTriangle className="h-3.5 w-3.5" /> Conflict Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <FindingSection content={mergeAnalysisResult?.conflict_summary || selectedArea?.conflict_summary} />
                  </CardContent>
                </Card>
              )}

              {/* Merged results */}
              {(() => {
                const r = mergeAnalysisResult || (selectedArea?.merged_scope_summary ? {
                  merged_scope_summary: selectedArea.merged_scope_summary,
                  merged_visible_facts: selectedArea.merged_visible_facts,
                  merged_inferences: selectedArea.merged_inferences,
                  merged_needs_verification: selectedArea.merged_needs_verification,
                  merged_risks: selectedArea.merged_risks,
                  merged_trade_detection: selectedArea.merged_trade_detection,
                  merged_missing_questions: selectedArea.merged_missing_questions,
                } : null);
                if (!r) return null;
                return (
                  <div className="space-y-2">
                    {r.merged_scope_summary && <Card><CardHeader className="py-2 px-3"><CardTitle className="text-xs flex items-center gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Merged Scope Summary</CardTitle></CardHeader><CardContent className="px-3 pb-3"><FindingSection content={r.merged_scope_summary} /></CardContent></Card>}
                    {r.merged_visible_facts && <Card><CardHeader className="py-2 px-3"><CardTitle className="text-xs flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> Merged Visible Facts</CardTitle></CardHeader><CardContent className="px-3 pb-3"><FindingSection content={r.merged_visible_facts} /></CardContent></Card>}
                    {r.merged_inferences && <Card><CardHeader className="py-2 px-3"><CardTitle className="text-xs flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Merged Inferences</CardTitle></CardHeader><CardContent className="px-3 pb-3"><FindingSection content={r.merged_inferences} /></CardContent></Card>}
                    {r.merged_needs_verification && <Card className="border-orange-500/50"><CardHeader className="py-2 px-3"><CardTitle className="text-xs flex items-center gap-1.5"><HelpCircle className="h-3.5 w-3.5 text-orange-600" /> Needs Verification</CardTitle></CardHeader><CardContent className="px-3 pb-3"><FindingSection content={r.merged_needs_verification} /></CardContent></Card>}
                    {r.merged_risks && <Card><CardHeader className="py-2 px-3"><CardTitle className="text-xs flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Merged Risks</CardTitle></CardHeader><CardContent className="px-3 pb-3"><FindingSection content={r.merged_risks} /></CardContent></Card>}
                    {r.merged_trade_detection && <Card><CardHeader className="py-2 px-3"><CardTitle className="text-xs flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> Merged Trade Detection</CardTitle></CardHeader><CardContent className="px-3 pb-3"><FindingSection content={r.merged_trade_detection} /></CardContent></Card>}
                    {r.merged_missing_questions && <Card><CardHeader className="py-2 px-3"><CardTitle className="text-xs flex items-center gap-1.5"><FileQuestion className="h-3.5 w-3.5" /> Merged Missing Questions</CardTitle></CardHeader><CardContent className="px-3 pb-3"><FindingSection content={r.merged_missing_questions} /></CardContent></Card>}
                  </div>
                );
              })()}

              {/* Site visit recommendation */}
              {(mergeAnalysisResult?.site_visit_recommended || selectedArea?.site_visit_flag) && (
                <Card className="border-red-500/50 bg-red-500/5">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs flex items-center gap-1.5 text-red-700"><MapPin className="h-3.5 w-3.5" /> Site Visit Recommended</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <FindingSection content={selectedArea?.site_visit_reason || 'Low confidence or unresolved conflicts require on-site verification.'} />
                  </CardContent>
                </Card>
              )}

              {/* Queue preview */}
              {mergeAnalysisResult?.review_queue_items?.length > 0 && (
                <Card>
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs">Queue Suggestions ({mergeAnalysisResult.review_queue_items.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-1">
                    {mergeAnalysisResult.review_queue_items.slice(0, 5).map((item: any, i: number) => (
                      <div key={i} className="text-xs flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px]">{item.suggestion_type}</Badge>
                        <span className="truncate">{item.suggested_value || item.reason_for_suggestion}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ═══ QUESTIONS TAB (Patch 7) ═══ */}
        <TabsContent value="questions" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {/* Current state summary */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Confidence: </span>
                <Badge variant={
                  (selectedArea?.merged_confidence || selectedArea?.confidence) === 'High' ? 'default' :
                  (selectedArea?.merged_confidence || selectedArea?.confidence) === 'Low' ? 'destructive' : 'secondary'
                } className="text-[10px]">
                  {selectedArea?.merged_confidence || selectedArea?.confidence || 'Unknown'}
                </Badge>
                {selectedArea?.site_visit_flag && (
                  <Badge variant="destructive" className="text-[10px]"><MapPin className="h-2.5 w-2.5 mr-0.5" /> Site Visit</Badge>
                )}
              </div>

              {/* Action */}
              <Button
                size="sm"
                className="w-full"
                disabled={missingInfoLoading || !selectedArea}
                onClick={generateMissingInfoQuestions}
              >
                {missingInfoLoading ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Generating…</> : <><HelpCircle className="h-3.5 w-3.5 mr-1.5" /> Generate Missing Info Questions</>}
              </Button>

              {/* Results */}
              {missingInfoResult && (
                <div className="space-y-3">
                  {/* Completeness note */}
                  {missingInfoResult.overall_completeness_note && (
                    <Card>
                      <CardContent className="px-3 py-2">
                        <p className="text-xs text-muted-foreground">{missingInfoResult.overall_completeness_note}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Block warning */}
                  {missingInfoResult.block_if_unanswered && (
                    <Card className="border-red-500/50 bg-red-500/5">
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5 text-red-700"><AlertTriangle className="h-3.5 w-3.5" /> Blocks Approval If Unanswered</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <p className="text-xs">{missingInfoResult.block_reason}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Questions list */}
                  {missingInfoResult.top_priority_questions?.length > 0 ? (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5"><HelpCircle className="h-3.5 w-3.5" /> Top Priority Questions ({missingInfoResult.top_priority_questions.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-3">
                        {missingInfoResult.top_priority_questions.map((q: any, i: number) => (
                          <div key={i} className="border-l-2 border-primary/30 pl-2.5 space-y-0.5">
                            <p className="text-xs font-medium">{q.priority_rank}. {q.question}</p>
                            <p className="text-[10px] text-muted-foreground">{q.why_it_matters}</p>
                            <Badge variant="outline" className="text-[9px]">{q.impact_area}</Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="px-3 py-3">
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-600" /> No high-priority questions remain. Intake appears sufficiently complete.</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Site visit recommendation */}
                  {missingInfoResult.site_visit_recommended && (
                    <Card className="border-red-500/50 bg-red-500/5">
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5 text-red-700"><MapPin className="h-3.5 w-3.5" /> Site Visit Recommended</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <p className="text-xs">{missingInfoResult.site_visit_reason || 'Missing information materially affects estimate reliability.'}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Queue preview */}
                  {missingInfoResult.review_queue_items?.length > 0 && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs">Queued Suggestions ({missingInfoResult.review_queue_items.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-1">
                        {missingInfoResult.review_queue_items.slice(0, 5).map((item: any, i: number) => (
                          <div key={i} className="text-xs flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[9px]">{item.suggestion_type}</Badge>
                            <span className="truncate">{item.suggested_value || item.reason_for_suggestion}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Show existing questions if no fresh result */}
              {!missingInfoResult && selectedArea?.missing_info_questions && (
                <Card>
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs flex items-center gap-1.5"><HelpCircle className="h-3.5 w-3.5" /> Previous Questions</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <FindingSection content={selectedArea.missing_info_questions} />
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ═══ COMPLETENESS CHECK TAB (Patch 8) ═══ */}
        <TabsContent value="check" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {/* Action Button */}
              <Button
                size="sm"
                className="w-full"
                disabled={completenessLoading || areas.length === 0}
                onClick={runCompletenessCheck}
              >
                {completenessLoading ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Running Check…</> : <><Shield className="h-3.5 w-3.5 mr-1.5" /> Run Completeness Check</>}
              </Button>

              {areas.length === 0 && (
                <Card><CardContent className="px-3 py-3"><p className="text-xs text-muted-foreground">Add areas and run intake analysis before checking completeness.</p></CardContent></Card>
              )}

              {/* Results */}
              {completenessResult && (
                <div className="space-y-3">
                  {/* Score + Warning */}
                  <Card>
                    <CardContent className="px-3 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">Completeness:</span>
                          <span className="text-lg font-bold">{completenessResult.completeness_score}%</span>
                        </div>
                        <Badge variant={
                          completenessResult.warning_level === 'High' ? 'destructive' :
                          completenessResult.warning_level === 'Medium' ? 'secondary' : 'default'
                        } className="text-xs">
                          {completenessResult.warning_level} Warning
                        </Badge>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            completenessResult.completeness_score >= 80 ? 'bg-emerald-500' :
                            completenessResult.completeness_score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(completenessResult.completeness_score, 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">Confidence:</span>
                        {confidenceBadge(completenessResult.confidence_rollup || 'Medium')}
                        {completenessResult.site_visit_recommended && (
                          <Badge variant="destructive" className="text-[10px]"><MapPin className="h-2.5 w-2.5 mr-0.5" /> Site Visit</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Summary */}
                  {completenessResult.completeness_summary && (
                    <Card><CardContent className="px-3 py-2"><p className="text-xs text-muted-foreground">{completenessResult.completeness_summary}</p></CardContent></Card>
                  )}

                  {/* BLOCKING REASON - must be prominent */}
                  {completenessResult.block_approval && (
                    <Card className="border-red-500 bg-red-500/5">
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5 text-red-700"><AlertTriangle className="h-3.5 w-3.5" /> Review Blocked</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-2">
                        <p className="text-xs font-medium">{completenessResult.blocking_reason}</p>
                        {completenessResult.human_fix_required && (
                          <Badge variant="destructive" className="text-[10px]">Human Fix Required</Badge>
                        )}
                        {completenessResult.override_allowed && (
                          <div className="space-y-1.5 pt-1 border-t border-red-200">
                            <p className="text-[10px] text-muted-foreground">Override is available. {completenessResult.override_reason_required ? 'A typed reason is required.' : ''}</p>
                            {completenessResult.override_reason_required && (
                              <Textarea
                                value={overrideReason}
                                onChange={e => setOverrideReason(e.target.value)}
                                placeholder="Type override reason…"
                                className="text-xs min-h-[40px]"
                              />
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 border-red-300 text-red-700 hover:bg-red-50"
                              disabled={completenessResult.override_reason_required && !overrideReason.trim()}
                              onClick={() => {
                                onUpdate({
                                  override_reason: overrideReason || 'Manual override',
                                } as any);
                                toast({ title: 'Override applied', description: 'Review block overridden. Reason recorded.' });
                              }}
                            >
                              Override Block
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Missing Scope Categories */}
                  {completenessResult.missing_scope_categories?.length > 0 && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5"><FileQuestion className="h-3.5 w-3.5" /> Missing Scope Categories ({completenessResult.missing_scope_categories.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-2">
                        {completenessResult.missing_scope_categories.map((cat: any, i: number) => (
                          <div key={i} className="border-l-2 border-primary/30 pl-2.5 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-medium">{cat.category}</p>
                              <Badge variant={cat.severity === 'High' ? 'destructive' : cat.severity === 'Medium' ? 'secondary' : 'outline'} className="text-[9px]">{cat.severity}</Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{cat.reason}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Mismatches */}
                  {completenessResult.mismatches?.length > 0 && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Evidence Mismatches ({completenessResult.mismatches.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-2">
                        {completenessResult.mismatches.map((m: any, i: number) => (
                          <div key={i} className="border-l-2 border-amber-400 pl-2.5 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <Badge variant={m.severity === 'High' ? 'destructive' : m.severity === 'Medium' ? 'secondary' : 'outline'} className="text-[9px]">{m.severity}</Badge>
                            </div>
                            <p className="text-xs"><strong>Evidence:</strong> {m.finding}</p>
                            <p className="text-xs text-muted-foreground"><strong>Gap:</strong> {m.estimate_gap}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Site Visit */}
                  {completenessResult.site_visit_recommended && completenessResult.site_visit_reason && (
                    <Card className="border-red-500/50 bg-red-500/5">
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5 text-red-700"><MapPin className="h-3.5 w-3.5" /> Site Visit Recommended</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <p className="text-xs">{completenessResult.site_visit_reason}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Queue preview */}
                  {completenessResult.review_queue_items?.length > 0 && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs">Queued Suggestions ({completenessResult.review_queue_items.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-1">
                        {completenessResult.review_queue_items.slice(0, 5).map((item: any, i: number) => (
                          <div key={i} className="text-xs flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[9px]">{item.suggestion_type}</Badge>
                            <span className="truncate">{item.suggested_value || item.reason_for_suggestion}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* No block - all clear */}
                  {!completenessResult.block_approval && completenessResult.completeness_score >= 80 && (
                    <Card className="border-emerald-300 bg-emerald-50">
                      <CardContent className="px-3 py-3">
                        <p className="text-xs flex items-center gap-1.5 text-emerald-800"><CheckCircle className="h-3.5 w-3.5" /> Estimate appears ready for review. No material gaps or blocks detected.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ═══ REVIEW QUEUE TAB ═══ */}
        <TabsContent value="queue" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {/* Filters */}
              <div className="flex flex-wrap gap-2">
                <Select value={queueFilter} onValueChange={setQueueFilter}>
                  <SelectTrigger className="w-[120px] h-7 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Status</SelectItem>
                    <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                    <SelectItem value="approved" className="text-xs">Approved</SelectItem>
                    <SelectItem value="edited" className="text-xs">Edited</SelectItem>
                    <SelectItem value="rejected" className="text-xs">Rejected</SelectItem>
                    <SelectItem value="applied" className="text-xs">Applied</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={queueAreaFilter} onValueChange={setQueueAreaFilter}>
                  <SelectTrigger className="w-[120px] h-7 text-xs"><SelectValue placeholder="Area" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Areas</SelectItem>
                    <SelectItem value="no-area" className="text-xs">No Area</SelectItem>
                    {areas.map(a => (
                      <SelectItem key={a.id} value={a.id!} className="text-xs">{a.area_name || a.area_type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Apply button */}
              {approvedCount > 0 && (
                <Button onClick={applyApprovedSuggestions} disabled={loading} className="w-full text-xs h-8">
                  <CheckCircle className="h-3 w-3 mr-1" />Apply {approvedCount} Approved
                </Button>
              )}

              {filteredSuggestions.length === 0 && (
                <div className="text-center py-8">
                  <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">No suggestions match filters.</p>
                </div>
              )}

              {/* Group by area then type */}
              {Object.entries(
                filteredSuggestions.reduce<Record<string, AISuggestion[]>>((acc, s) => {
                  const areaId = (s as any).area_id;
                  const areaName = areaId ? (areas.find(a => a.id === areaId)?.area_name || 'Unknown Area') : 'Estimate Level';
                  const group = `${areaName} — ${SUGGESTION_TYPE_LABELS[s.suggestion_type as SuggestionType] || s.suggestion_type}`;
                  (acc[group] = acc[group] || []).push(s);
                  return acc;
                }, {})
              ).map(([group, items]) => (
                <Card key={group}>
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs flex items-center gap-2">
                      {group}
                      <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-2">
                    {items.map(s => (
                      <div key={s.id} className="border rounded p-2 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs text-foreground flex-1">
                            {editingSuggestionId === s.id ? (
                              <Textarea value={editValue} onChange={e => setEditValue(e.target.value)} className="text-xs min-h-[40px]" />
                            ) : (
                              s.edited_value || s.suggested_value
                            )}
                          </p>
                          <Badge variant="outline" className={`text-xs shrink-0 ${SUGGESTION_STATUS_COLORS[s.status as keyof typeof SUGGESTION_STATUS_COLORS] || ''}`}>
                            {s.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">{s.source_type}</Badge>
                          {confidenceBadge(s.confidence as AIConfidence)}
                          {(s as any).priority_level === 'High' && <Badge className="bg-red-100 text-red-800 text-xs">High Priority</Badge>}
                        </div>
                        {s.evidence_summary && <p className="text-xs text-muted-foreground">{s.evidence_summary.slice(0, 100)}</p>}
                        {s.status === 'pending' && (
                          <div className="flex gap-1 pt-1">
                            <Button size="sm" variant="outline" onClick={() => handleApproveSuggestion(s)} className="text-xs h-7 px-2">
                              <ThumbsUp className="h-3 w-3 mr-1" />Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleEditSuggestion(s)} className="text-xs h-7 px-2">
                              <Edit className="h-3 w-3 mr-1" />Edit
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleRejectSuggestion(s)} className="text-xs h-7 px-2">
                              <ThumbsDown className="h-3 w-3 mr-1" />Reject
                            </Button>
                          </div>
                        )}
                        {editingSuggestionId === s.id && (
                          <div className="flex gap-1 pt-1">
                            <Button size="sm" onClick={() => handleSaveEdit(s)} className="text-xs h-7 px-2">Save Edit</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingSuggestionId(null)} className="text-xs h-7 px-2">Cancel</Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ═══ APPLY TAB (Patch 9) ═══ */}
        <TabsContent value="apply" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {/* Status bar */}
              <Card>
                <CardContent className="px-3 py-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Status: <strong>{estimate.status || 'Draft'}</strong></span>
                    <span className="text-muted-foreground">Version: <strong>{estimate.version || 'v1.0'}</strong></span>
                    <span className="text-muted-foreground">Approved: <strong>{approvedCount}</strong></span>
                  </div>
                </CardContent>
              </Card>

              {/* Generate button */}
              <Button
                size="sm"
                className="w-full"
                disabled={writePlanLoading || approvedCount === 0}
                onClick={generateAndStageWritePlan}
              >
                {writePlanLoading ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Generating…</> : <><ClipboardList className="h-3.5 w-3.5 mr-1.5" /> Generate Write Plan ({approvedCount} approved)</>}
              </Button>

              {approvedCount === 0 && (
                <Card><CardContent className="px-3 py-3"><p className="text-xs text-muted-foreground">Approve suggestions in the Queue tab first. Only approved items are included in the write plan.</p></CardContent></Card>
              )}

              {/* Write Plan Preview */}
              {writePlan && (() => {
                const fields: WritePlanFieldUpdate[] = JSON.parse(writePlan.fields_to_update || '[]');
                const lineItems: WritePlanLineItem[] = JSON.parse(writePlan.line_items_to_add_or_edit || '[]');
                const exclusions: string[] = JSON.parse(writePlan.exclusions_to_append || '[]');
                const allowances: string[] = JSON.parse(writePlan.allowances_to_append || '[]');
                const assumptions: string[] = JSON.parse(writePlan.assumptions_to_append || '[]');
                const riskNotes: string[] = JSON.parse(writePlan.risk_notes_to_append || '[]');
                const audits: WritePlanAuditEntry[] = JSON.parse(writePlan.audit_entries_to_create || '[]');

                return (
                  <div className="space-y-3">
                    {/* Summary */}
                    <Card>
                      <CardContent className="px-3 py-2">
                        <p className="text-xs">{writePlan.summary}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={writePlan.apply_status === 'applied' ? 'default' : writePlan.apply_status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">
                            {writePlan.apply_status}
                          </Badge>
                          {writePlan.requires_reapproval && (
                            <Badge variant="destructive" className="text-[10px]">Requires Reapproval</Badge>
                          )}
                          {!writePlan.requires_reapproval && (
                            <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700">No Reapproval</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Fields to update */}
                    {fields.length > 0 && (
                      <Card>
                        <CardHeader className="py-2 px-3">
                          <CardTitle className="text-xs">Fields To Update ({fields.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 space-y-1.5">
                          {fields.map((f, i) => (
                            <div key={i} className="border-l-2 border-primary/30 pl-2.5 text-xs">
                              <span className="font-medium">{f.field}</span>
                              <Badge variant="outline" className="text-[9px] ml-1">{f.action}</Badge>
                              <p className="text-muted-foreground truncate">{f.value}</p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Line items */}
                    {lineItems.length > 0 && (
                      <Card>
                        <CardHeader className="py-2 px-3">
                          <CardTitle className="text-xs">Line Items To Add ({lineItems.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 space-y-1.5">
                          {lineItems.map((li, i) => (
                            <div key={i} className="border-l-2 border-primary/30 pl-2.5 text-xs">
                              <Badge variant="outline" className="text-[9px]">{li.action}</Badge>
                              <span className="ml-1 font-medium">{li.description}</span>
                              {li.phase && <span className="text-muted-foreground ml-1">({li.phase})</span>}
                              {li.qty != null && <span className="text-muted-foreground ml-1">qty: {li.qty}</span>}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Append sections */}
                    {exclusions.length > 0 && (
                      <Card>
                        <CardHeader className="py-2 px-3"><CardTitle className="text-xs">Exclusions To Append ({exclusions.length})</CardTitle></CardHeader>
                        <CardContent className="px-3 pb-3 space-y-1">{exclusions.map((e, i) => <p key={i} className="text-xs border-l-2 border-primary/30 pl-2.5">• {e}</p>)}</CardContent>
                      </Card>
                    )}
                    {allowances.length > 0 && (
                      <Card>
                        <CardHeader className="py-2 px-3"><CardTitle className="text-xs">Allowances To Append ({allowances.length})</CardTitle></CardHeader>
                        <CardContent className="px-3 pb-3 space-y-1">{allowances.map((a, i) => <p key={i} className="text-xs border-l-2 border-primary/30 pl-2.5">• {a}</p>)}</CardContent>
                      </Card>
                    )}
                    {assumptions.length > 0 && (
                      <Card>
                        <CardHeader className="py-2 px-3"><CardTitle className="text-xs">Assumptions To Append ({assumptions.length})</CardTitle></CardHeader>
                        <CardContent className="px-3 pb-3 space-y-1">{assumptions.map((a, i) => <p key={i} className="text-xs border-l-2 border-primary/30 pl-2.5">• {a}</p>)}</CardContent>
                      </Card>
                    )}
                    {riskNotes.length > 0 && (
                      <Card>
                        <CardHeader className="py-2 px-3"><CardTitle className="text-xs">Risk Notes To Append ({riskNotes.length})</CardTitle></CardHeader>
                        <CardContent className="px-3 pb-3 space-y-1">{riskNotes.map((r, i) => <p key={i} className="text-xs border-l-2 border-primary/30 pl-2.5">• {r}</p>)}</CardContent>
                      </Card>
                    )}

                    {/* Audit preview */}
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs">Audit Entries ({audits.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <p className="text-xs text-muted-foreground">{audits.length} audit records will be created to trace each applied suggestion.</p>
                      </CardContent>
                    </Card>

                    {/* Execute button */}
                    {writePlan.apply_status === 'staged' && !executionResult && (
                      <Button
                        size="sm"
                        className="w-full"
                        variant="gold"
                        disabled={writePlanLoading}
                        onClick={executeWritePlanControlled}
                      >
                        {writePlanLoading ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Executing…</> : <><CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Execute Write Plan</>}
                      </Button>
                    )}

                    {/* Execution Result Display (Patch 10) */}
                    {executionResult && (
                      <Card className={
                        executionResult.execution_status === 'success' ? 'border-emerald-300 bg-emerald-50' :
                        executionResult.execution_status === 'partial_success' ? 'border-amber-300 bg-amber-50' :
                        executionResult.execution_status === 'blocked' ? 'border-orange-300 bg-orange-50' :
                        'border-destructive bg-destructive/10'
                      }>
                        <CardHeader className="py-2 px-3">
                          <CardTitle className="text-xs flex items-center gap-1.5">
                            {executionResult.execution_status === 'success' && <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />}
                            {executionResult.execution_status === 'partial_success' && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                            {executionResult.execution_status === 'blocked' && <Shield className="h-3.5 w-3.5 text-orange-600" />}
                            {executionResult.execution_status === 'failed' && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                            Execution: {executionResult.execution_status.replace('_', ' ')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 space-y-2">
                          <p className="text-xs">{executionResult.summary}</p>
                          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                            <div>Version check: <Badge variant={executionResult.version_check_passed ? 'outline' : 'destructive'} className="text-[9px]">{executionResult.version_check_passed ? 'Passed' : 'Failed'}</Badge></div>
                            <div>Idempotency: <Badge variant={executionResult.idempotency_check_passed ? 'outline' : 'destructive'} className="text-[9px]">{executionResult.idempotency_check_passed ? 'Passed' : 'Failed'}</Badge></div>
                            <div>Fields applied: <strong>{executionResult.applied_fields.filter(f => f.result === 'applied').length}</strong></div>
                            <div>Fields skipped: <strong>{executionResult.applied_fields.filter(f => f.result === 'skipped_duplicate').length}</strong></div>
                            <div>Line items: <strong>{executionResult.applied_line_items.filter(l => l.result === 'applied').length}</strong></div>
                            <div>Audit entries: <strong>{executionResult.created_audit_entries.length}</strong></div>
                            <div>Reapproval: <Badge variant={executionResult.requires_reapproval_applied ? 'default' : 'outline'} className="text-[9px]">{executionResult.requires_reapproval_applied ? 'Yes' : 'No'}</Badge></div>
                          </div>
                          {executionResult.status_updates.length > 0 && (
                            <div className="text-[10px] space-y-0.5">
                              <p className="font-medium">Status changes:</p>
                              {executionResult.status_updates.map((su, i) => (
                                <p key={i}>{su.field}: {su.old_value} → {su.new_value}</p>
                              ))}
                            </div>
                          )}
                          {executionResult.errors.length > 0 && (
                            <div className="text-[10px] text-destructive space-y-0.5">
                              <p className="font-medium">Errors:</p>
                              {executionResult.errors.map((err, i) => (
                                <p key={i}>• {err}</p>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {writePlan.apply_status === 'applied' && !executionResult && (
                      <Card className="border-emerald-300 bg-emerald-50">
                        <CardContent className="px-3 py-3">
                          <p className="text-xs flex items-center gap-1.5 text-emerald-800">
                            <CheckCircle className="h-3.5 w-3.5" /> Write plan applied successfully. {audits.length} audit entries created.
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {/* ─── Post-Write Health Recheck (Patch 11) ─── */}
                    {(writePlan.apply_status === 'applied' || executionResult) && (
                      <Card className="border-dashed">
                        <CardHeader className="py-2 px-3">
                          <CardTitle className="text-xs flex items-center gap-1.5">
                            <BarChart3 className="h-3.5 w-3.5" /> Post-Write Health Recheck
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 space-y-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs h-7"
                            disabled={recheckLoading}
                            onClick={runRecheck}
                          >
                            {recheckLoading
                              ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Rechecking…</>
                              : <><RefreshCw className="h-3 w-3 mr-1" /> Run Post-Write Health Recheck</>}
                          </Button>

                          {recheckResult && (
                            <div className="space-y-2 mt-2">
                              <div className={`rounded p-2 text-xs ${
                                recheckResult.health_status === 'Good' ? 'bg-emerald-50 border border-emerald-200' :
                                recheckResult.health_status === 'Review Needed' ? 'bg-amber-50 border border-amber-200' :
                                'bg-red-50 border border-red-200'
                              }`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium">Health: {recheckResult.health_status}</span>
                                  <Badge variant="outline" className="text-[9px]">{recheckResult.completeness_score}%</Badge>
                                </div>
                                <p className="text-muted-foreground">{recheckResult.resolution_summary}</p>
                              </div>

                              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                <div>Warning: <Badge variant={recheckResult.warning_level === 'High' ? 'destructive' : 'outline'} className="text-[9px]">{recheckResult.warning_level}</Badge></div>
                                <div>Confidence: <Badge variant="outline" className="text-[9px]">{recheckResult.confidence_rollup}</Badge></div>
                                <div>Blocked: <Badge variant={recheckResult.block_approval ? 'destructive' : 'outline'} className="text-[9px]">{recheckResult.block_approval ? 'Yes' : 'No'}</Badge></div>
                                <div>Site Visit: <Badge variant={recheckResult.site_visit_recommended ? 'destructive' : 'outline'} className="text-[9px]">{recheckResult.site_visit_recommended ? 'Yes' : 'No'}</Badge></div>
                                <div>Fix Required: <Badge variant={recheckResult.human_fix_required ? 'destructive' : 'outline'} className="text-[9px]">{recheckResult.human_fix_required ? 'Yes' : 'No'}</Badge></div>
                                <div>Queue Items: <strong>{recheckResult.queue_items_created}</strong></div>
                              </div>

                              {recheckResult.missing_scope_categories.length > 0 && (
                                <div className="text-[10px]">
                                  <p className="font-medium mb-0.5">Missing Categories:</p>
                                  {recheckResult.missing_scope_categories.map((c, i) => (
                                    <Badge key={i} variant="outline" className="text-[9px] mr-1 mb-0.5">{c}</Badge>
                                  ))}
                                </div>
                              )}

                              {recheckResult.mismatches.length > 0 && (
                                <div className="text-[10px]">
                                  <p className="font-medium mb-0.5">Remaining Issues:</p>
                                  {recheckResult.mismatches.map((m, i) => (
                                    <p key={i} className="text-muted-foreground">• {m}</p>
                                  ))}
                                </div>
                              )}

                              {recheckResult.blocking_reason && (
                                <div className="text-[10px] text-destructive">
                                  <p className="font-medium">Block Reason: {recheckResult.blocking_reason}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                );
              })()}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ═══ SUMMARY TAB ═══ */}
        <TabsContent value="summary" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {/* Estimate Health Card */}
              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Estimate AI Health</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-xs"><span className="text-muted-foreground">Areas:</span> <strong>{rollup?.area_count ?? 0}</strong></div>
                    <div className="text-xs"><span className="text-muted-foreground">Pending:</span> <strong>{rollup?.ai_pending_suggestions_count ?? 0}</strong></div>
                    <div className="text-xs"><span className="text-muted-foreground">Health:</span> {rollup && healthBadge(rollup.ai_estimate_health_status)}</div>
                    <div className="text-xs"><span className="text-muted-foreground">Confidence:</span> {rollup && confidenceBadge(rollup.estimate_confidence_rollup)}</div>
                    <div className="text-xs"><span className="text-muted-foreground">Revision:</span> <Badge variant="outline" className="text-xs">{rollup?.ai_revision_review_status ?? 'N/A'}</Badge></div>
                    <div className="text-xs"><span className="text-muted-foreground">Site Visit:</span> {rollup?.estimate_site_visit_recommended ? <Badge className="bg-red-100 text-red-800 text-xs">Recommended</Badge> : <Badge variant="outline" className="text-xs">Not needed</Badge>}</div>
                  </div>
                  {rollup?.ai_estimate_rollup_summary && (
                    <p className="text-xs text-muted-foreground mt-2">{rollup.ai_estimate_rollup_summary}</p>
                  )}
                  <Button size="sm" variant="outline" onClick={updateEstimateRollup} className="text-xs h-7 w-full mt-2">
                    <RefreshCw className="h-3 w-3 mr-1" />Update Estimate Rollup
                  </Button>
                </CardContent>
              </Card>

              {/* Area Breakdown */}
              {areas.length > 0 && (
                <Card>
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs">Area Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-2">
                    {areas.map(area => (
                      <div key={area.id} className="flex items-center justify-between border rounded p-2">
                        <div className="flex items-center gap-2">
                          <Home className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium">{area.area_name || area.area_type}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {confidenceBadge(area.confidence)}
                          {area.site_visit_flag && <MapPin className="h-3 w-3 text-red-500" />}
                          {area.revision_status !== 'Original' && (
                            <Badge variant="outline" className="text-xs">{area.revision_status}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Top risks and missing info across all areas */}
              {areas.some(a => a.possible_hidden_risks) && (
                <Card>
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> All Area Risks</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    {areas.filter(a => a.possible_hidden_risks).map(a => (
                      <div key={a.id} className="mb-2">
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">{a.area_name || a.area_type}:</p>
                        <FindingSection content={a.possible_hidden_risks} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {areas.some(a => a.missing_info_questions) && (
                <Card>
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs flex items-center gap-1.5"><FileQuestion className="h-3.5 w-3.5" /> All Missing Info</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    {areas.filter(a => a.missing_info_questions).map(a => (
                      <div key={a.id} className="mb-2">
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">{a.area_name || a.area_type}:</p>
                        <FindingSection content={a.missing_info_questions} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
