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
import type { VoiceCaptureStatus, VoiceAnalysisStatus, PhotoAnalysisStatus } from '@/lib/areaStore';
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
  onSave: () => Promise<void>;
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
    if (!estimateDbId) {
      toast({ title: 'Save estimate first', variant: 'destructive' });
      return;
    }
    const newArea = createDefaultArea(estimateDbId, areaType, areas.length);
    try {
      const id = await saveEstimateArea(newArea);
      const updated = await getEstimateAreas(estimateDbId);
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
    if (!estimateDbId) {
      toast({ title: 'Save estimate first', variant: 'destructive' });
      return;
    }
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
          estimate_id: estimateDbId,
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
          idempotency_key: `initial-${estimateDbId}-${crypto.randomUUID().slice(0, 8)}`,
        }));
        await insertSuggestions(queueItems);
        const updated = await getSuggestions(estimateDbId);
        setSuggestions(updated);
      }

      toast({ title: 'Initial Intake complete', description: `${structured.confidence} confidence` });
    } catch (e: any) {
      toast({ title: 'Initial Intake failed', description: e.message, variant: 'destructive' });
    } finally {
      setInitialIntakeLoading(false);
    }
  }, [estimateDbId, initialIntakeDesc, initialIntakeGoal, initialIntakeUrgency, estimate, isApproved, toast, onUpdate]);

  // ─── Area-Level AI Analysis ───
  const analyzeArea = useCallback(async () => {
    if (!selectedArea || !estimateDbId) return;
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
                estimate_id: estimateDbId,
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
            estimate_id: estimateDbId,
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
          const updated = await getSuggestions(estimateDbId);
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

  // ─── Send Area to Review Queue ───
  const sendAreaToQueue = async () => {
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

  // ─── Apply Approved Suggestions ───
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
        <TabsList className="mx-4 mt-2 grid grid-cols-5 h-8">
          <TabsTrigger value="initial" className="text-xs">Intake</TabsTrigger>
          <TabsTrigger value="areas" className="text-xs">Areas</TabsTrigger>
          <TabsTrigger value="capture" className="text-xs">Capture</TabsTrigger>
          <TabsTrigger value="queue" className="text-xs">Queue {pendingCount > 0 && `(${pendingCount})`}</TabsTrigger>
          <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
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
                        <MediaUploader folder="estimates" onUploaded={async () => { onMediaChange(); updateArea('uploaded_photo_count', selectedArea.uploaded_photo_count + 1); }} />
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
