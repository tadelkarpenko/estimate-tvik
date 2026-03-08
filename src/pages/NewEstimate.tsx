import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import type {
  Estimate, EstimateStatus, ProjectType, FinishLevel, EstimateLineItem,
  EstimateMedia, EstimateChatThread, EstimateChatMessage, EstimateMediaAnalysis,
  SuggestedChanges, SuggestedAction, AIConfidence, Phase, LineItemUnit,
  ProjectCategory, ScopeClass, JobComplexity,
} from '@/lib/types';
import { PROJECT_CATEGORIES, SCOPE_CLASSES, JOB_COMPLEXITIES, categoryToLegacyType } from '@/lib/types';
import type { Contract, PaymentMilestone } from '@/lib/contractTypes';
import { PAYMENT_TEMPLATES } from '@/lib/contractTypes';
import {
  getEstimate, saveEstimate, nextEstimateId, uid, getCostLibrary, getRiskLibrary,
  getRevisionLogs, saveRevisionLog, updateEstimateStatus, initStore, getEstimateDbId,
  getEstimateLineItems, upsertEstimateLineItems, deleteCostLibraryLineItems,
  getEstimateMedia, saveEstimateMedia, deleteEstimateMedia,
  getChatThreads, createChatThread, getChatMessages, saveChatMessage,
} from '@/lib/store';
import {
  saveContract, logAuditEntry, linkLineItemsToContract,
} from '@/lib/contractStore';
import { runCostEngine } from '@/lib/costEngine';
import { runRiskEngine } from '@/lib/riskEngine';
import { generateAssumptions, generateTimeline, generateScopeAI, generateAuditAI } from '@/lib/generators';
import { generatePublicPDF, generateInternalPDF } from '@/lib/pdfGenerator';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ChevronDown, Copy, FileDown, Send, CheckCircle, XCircle, Plus, Trash2, ImagePlus, MessageSquare, Lock, Unlock, AlertTriangle, Camera, Sparkles, Briefcase, ShieldCheck, Gauge, Clock, Target, HardHat, ClipboardList } from 'lucide-react';
import { MediaUploader } from '@/components/MediaUploader';
import { fitEstimateToBudget, type BudgetFitScenario } from '@/lib/budgetFitEngine';
import { useToast } from '@/hooks/use-toast';
import type { EstimateRevisionLog } from '@/lib/types';
import { computeCompletenessScore, evaluateApprovalGate, computeCalcStatus, type CompletenessChecklist, type ApprovalGateResult } from '@/lib/reliabilityEngine';
import { Progress } from '@/components/ui/progress';
import { AIIntakePanel } from '@/components/AIIntakePanel';

const defaultEst: Partial<Estimate> = {
  status: 'Draft', created_by: 'TVIK', state: 'IL', project_type: 'Full Rehab',
  project_category: 'Full Renovation', scope_class: 'Full-Scope Multi-Trade', job_complexity: 'Standard Scope',
  finish_level: 'Basic', finish_materials_included: false, overhead_pct: 0.10,
  profit_pct: 0.20, contingency_pct: 0.10, sqft: 0, fixture_count: 0, labor_hours: 0, version: 'v1.0',
  client_name: '', client_email: '', client_phone: '', project_address: '', city: '', zip: '',
  project_name: '', labor_subtotal: 0, material_subtotal: 0, subtotal: 0, risk_cost_low: 0,
  risk_cost_high: 0, overall_risk_level: 'Low', total_low: 0, total_high: 0,
  assumptions_rich: '', timeline_rich: '', ai_scope: '', ai_price_audit_summary: '',
  cost_structure_json: '[]', line_items_json: '[]', risk_table_json: '[]',
  public_pdf_url: '', internal_pdf_url: '', last_revision_summary: '',
  crew_size: 2, hours_per_day: 8, subtotal_labor_hours: 0, estimated_duration_days: 0,
  internal_notes: '', public_notes: '',
  clarification_answers_json: '[]', ai_suggestions_last_json: '[]',
  // AI Intake defaults
  ai_intake_summary: '', photo_analysis_summary: '', visible_findings: '',
  likely_scope_items: '', possible_hidden_risks: '', missing_info_questions: '',
  suggested_allowances: '', suggested_exclusions: '', suggested_assumptions: '',
  suggested_line_items: '', ai_detected_trades: '', site_visit_required: false,
  ai_scope_confidence: 'Medium', photo_count: 0, intake_last_updated_at: null,
  revision_needed_warning: false, ai_apply_status: 'Not Applied',
  // Voice intake defaults
  voice_transcript_raw: '', voice_transcript_cleaned: '', voice_detected_scope: '',
  voice_detected_risks: '', voice_detected_rooms: '', voice_detected_material_preferences: '',
  voice_last_updated_at: null,
} as any;

const FINISH_MULTS: Record<FinishLevel, number> = { Basic: 1.00, Mid: 1.15, High: 1.30, Luxury: 1.55 };

function parseSuggestedChanges(text: string): SuggestedChanges | null {
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    const raw = jsonMatch ? jsonMatch[1] : text;
    const parsed = JSON.parse(raw);
    
    // Normalize: support both { SuggestedChanges: [...] } and { actions: [...] } formats
    if (parsed.SuggestedChanges) {
      return {
        actions: parsed.SuggestedChanges.map((s: any) => ({
          type: s.type || 'ADD_LINE_ITEM',
          trade: s.phase || s.trade || 'Other',
          description: s.description || '',
          unit: s.unit || 'ea',
          qty: s.qty || 1,
          labor_unit_cost: s.labor_unit_cost ?? null,
          material_unit_cost: s.material_unit_cost ?? null,
          confidence: s.confidence || 'Medium',
          evidence_source: s.evidence_source || 'Chat',
          rationale: s.notes || s.rationale || '',
          requires_confirmation: true,
          pending_confirmation: true,
        })),
      };
    }
    if (parsed.actions) return parsed;
    return null;
  } catch { return null; }
}

export default function NewEstimate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<Estimate>>({ ...defaultEst });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [advOpen, setAdvOpen] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [revisions, setRevisions] = useState<EstimateRevisionLog[]>([]);
  const [dbLineItems, setDbLineItems] = useState<EstimateLineItem[]>([]);
  const [media, setMedia] = useState<EstimateMedia[]>([]);
  const [mediaAnalyses, setMediaAnalyses] = useState<Record<string, EstimateMediaAnalysis>>({});
  const [chatThreads, setChatThreads] = useState<EstimateChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<EstimateChatThread | null>(null);
  const [chatMessages, setChatMessages] = useState<EstimateChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatStreaming, setChatStreaming] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [estimateDbId, setEstimateDbId] = useState<string | undefined>();
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [confirmModal, setConfirmModal] = useState(false);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [analyzingMedia, setAnalyzingMedia] = useState<string | null>(null);
  const [convertingMedia, setConvertingMedia] = useState<string | null>(null);
  const [pendingSuggestions, setPendingSuggestions] = useState<SuggestedChanges | null>(null);
  const [applyingChanges, setApplyingChanges] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [budgetTarget, setBudgetTarget] = useState<number | ''>('');
  const [budgetScenarios, setBudgetScenarios] = useState<BudgetFitScenario[] | null>(null);
  const [manualItem, setManualItem] = useState({
    phase: 'Other' as Phase, description: '', unit: 'ea' as LineItemUnit,
    qty: 0, labor_unit_cost: 0, material_unit_cost: 0, labor_hours_per_unit: 0, notes: '',
  });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const isEdit = !!id;

  useEffect(() => {
    (async () => {
      await initStore();
      if (id) {
        const existing = await getEstimate(id);
        if (existing) {
          setForm(existing);
          const [revs, dbId] = await Promise.all([getRevisionLogs(id), getEstimateDbId(id)]);
          setRevisions(revs);
          if (dbId) {
            setEstimateDbId(dbId);
            const [items, med, threads] = await Promise.all([
              getEstimateLineItems(dbId), getEstimateMedia(dbId), getChatThreads(dbId),
            ]);
            setDbLineItems(items);
            setMedia(med);
            setChatThreads(threads);
          }
        } else {
          navigate('/estimates', { replace: true });
        }
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const update = (updates: Partial<Estimate>) => {
    // Auto-sync legacy project_type when project_category changes
    if (updates.project_category) {
      updates.project_type = categoryToLegacyType(updates.project_category as ProjectCategory);
    }
    setForm(prev => ({ ...prev, ...updates }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.project_category) errs.project_category = 'Project category required';
    const legacyType = categoryToLegacyType(form.project_category as ProjectCategory || 'Custom Scope');
    if (legacyType !== 'Small Job' && (!form.sqft || form.sqft <= 0)) errs.sqft = 'Square footage required';
    if ((legacyType === 'Bath' || legacyType === 'Kitchen') && (!form.fixture_count || form.fixture_count <= 0))
      errs.fixture_count = 'Fixture count required';
    if (form.job_complexity === 'Quick Repair' && (!form.labor_hours || form.labor_hours <= 0))
      errs.labor_hours = 'Labor hours required for Quick Repair jobs';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveDraft = async () => {
    const estId = form.estimate_id || await nextEstimateId();
    const est: Estimate = {
      ...defaultEst, ...form,
      estimate_id: estId,
      created_at: form.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Estimate;
    await saveEstimate(est);
    update({ estimate_id: est.estimate_id, created_at: est.created_at });
    const dbId = await getEstimateDbId(estId);
    if (dbId) setEstimateDbId(dbId);
    toast({ title: 'Draft saved', description: est.estimate_id });
  };

  const generate = async () => {
    if (!validate()) { toast({ title: 'Validation failed', variant: 'destructive' }); return; }
    setGenerating(true);
    try {
      const estId = form.estimate_id || await nextEstimateId();
      const preEst: Estimate = {
        ...defaultEst, ...form, estimate_id: estId,
        created_at: form.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Estimate;
      await saveEstimate(preEst);
      const dbId = await getEstimateDbId(estId);
      if (!dbId) throw new Error('Could not resolve estimate DB id');
      setEstimateDbId(dbId);

      const costLib = await getCostLibrary();
      const riskLib = await getRiskLibrary();
      await deleteCostLibraryLineItems(dbId);

      const costResult = runCostEngine({
        project_type: form.project_type as ProjectType, sqft: form.sqft!,
        fixture_count: form.fixture_count || 0, labor_hours: form.labor_hours || 0,
        finish_level: form.finish_level as FinishLevel,
        finish_materials_included: form.finish_materials_included!,
        costLibrary: costLib, estimate_db_id: dbId,
        crew_size: form.crew_size || 2, hours_per_day: form.hours_per_day || 8,
      });

      await upsertEstimateLineItems(costResult.line_items);

      // Also keep any existing Manual/AI lines
      const allItems = await getEstimateLineItems(dbId);
      setDbLineItems(allItems);

      const riskResult = runRiskEngine({ project_type: form.project_type as ProjectType, subtotal: costResult.subtotal, riskLibrary: riskLib });
      const marginMult = (1 + (form.overhead_pct || 0.1)) * (1 + (form.profit_pct || 0.2)) * (1 + (form.contingency_pct || 0.1));
      const total_low = Math.round((costResult.subtotal + riskResult.risk_cost_low) * marginMult * 100) / 100;
      const total_high = Math.round((costResult.subtotal + riskResult.risk_cost_high) * marginMult * 100) / 100;

      const partial: Partial<Estimate> = {
        labor_subtotal: costResult.labor_subtotal, material_subtotal: costResult.material_subtotal,
        subtotal: costResult.subtotal, subtotal_labor_hours: costResult.subtotal_labor_hours,
        estimated_duration_days: costResult.estimated_duration_days,
        line_items_json: JSON.stringify(costResult.legacy_line_items),
        cost_structure_json: JSON.stringify(costResult.cost_structure),
        risk_cost_low: riskResult.risk_cost_low, risk_cost_high: riskResult.risk_cost_high,
        overall_risk_level: riskResult.overall_risk_level,
        risk_table_json: JSON.stringify(riskResult.risk_table),
        total_low, total_high,
      };
      const merged = { ...form, ...partial, estimate_id: estId };
      merged.assumptions_rich = generateAssumptions(merged);
      merged.timeline_rich = generateTimeline(merged);
      merged.created_at = merged.created_at || new Date().toISOString();
      merged.status = 'Ready' as EstimateStatus;
      // Compute and save reliability metrics
      const { score } = computeCompletenessScore(form.project_type as ProjectType || 'Full Rehab', costResult.line_items);
      (merged as any).completeness_score = score;
      (merged as any).calc_status = 'Fresh';

      toast({ title: 'Running AI analysis...' });
      const [scope, audit] = await Promise.all([generateScopeAI(merged), generateAuditAI({ ...merged, estimate_id: estId })]);
      merged.ai_scope = scope;
      merged.ai_price_audit_summary = audit;

      const est: Estimate = { ...defaultEst, ...merged, updated_at: new Date().toISOString() } as Estimate;
      await saveEstimate(est);
      setForm(est);
      toast({ title: 'Estimate generated', description: `${est.estimate_id} — $${est.total_low.toLocaleString()} – $${est.total_high.toLocaleString()}` });
    } catch (e) {
      console.error('Generate error:', e);
      toast({ title: 'Generation error', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally { setGenerating(false); }
  };

  // ─── Deterministic recompute from current line items ───
  const recomputeFromLineItems = async (items: EstimateLineItem[]) => {
    const labor_subtotal = Math.round(items.reduce((s, l) => s + l.labor_total, 0) * 100) / 100;
    const material_subtotal = Math.round(items.reduce((s, l) => s + l.material_total, 0) * 100) / 100;
    const subtotal = Math.round((labor_subtotal + material_subtotal) * 100) / 100;
    const subtotal_labor_hours = Math.round(items.reduce((s, l) => s + l.labor_hours_total, 0) * 100) / 100;
    const crewSize = form.crew_size || 2;
    const hoursPerDay = form.hours_per_day || 8;
    const estimated_duration_days = subtotal_labor_hours > 0 ? Math.ceil(subtotal_labor_hours / (crewSize * hoursPerDay)) : 0;

    const riskLib = await getRiskLibrary();
    const riskResult = runRiskEngine({ project_type: form.project_type as ProjectType, subtotal, riskLibrary: riskLib });
    const marginMult = (1 + (form.overhead_pct || 0.1)) * (1 + (form.profit_pct || 0.2)) * (1 + (form.contingency_pct || 0.1));
    const total_low = Math.round((subtotal + riskResult.risk_cost_low) * marginMult * 100) / 100;
    const total_high = Math.round((subtotal + riskResult.risk_cost_high) * marginMult * 100) / 100;

    const updates: Partial<Estimate> = {
      labor_subtotal, material_subtotal, subtotal, subtotal_labor_hours, estimated_duration_days,
      risk_cost_low: riskResult.risk_cost_low, risk_cost_high: riskResult.risk_cost_high,
      overall_risk_level: riskResult.overall_risk_level, risk_table_json: JSON.stringify(riskResult.risk_table),
      total_low, total_high,
    };
    const est: Estimate = { ...defaultEst, ...form, ...updates, updated_at: new Date().toISOString() } as Estimate;
    await saveEstimate(est);
    setForm(est);
    return est;
  };

  const createRevision = async (summary?: string) => {
    const changeSummary = summary || prompt('Change summary (required):');
    if (!changeSummary) return;
    const prevVersion = form.version || 'v1.0';
    const parts = prevVersion.replace('v', '').split('.');
    const newVersion = `v${parts[0]}.${parseInt(parts[1] || '0') + 1}`;
    await saveRevisionLog({
      id: uid(), estimate_id: form.estimate_id!, created_at: new Date().toISOString(),
      version: prevVersion, change_summary: changeSummary, snapshot_json: JSON.stringify(form),
      delta_low: 0, delta_high: 0,
    });
    update({ version: newVersion, last_revision_summary: changeSummary });
    const revs = await getRevisionLogs(form.estimate_id);
    setRevisions(revs);
    return newVersion;
  };

  const duplicate = async () => {
    const newId = await nextEstimateId();
    const dup: Estimate = { ...defaultEst, ...form, estimate_id: newId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: 'Draft', version: 'v1.0' } as Estimate;
    await saveEstimate(dup);
    navigate(`/estimates/${newId}`);
    toast({ title: 'Estimate duplicated', description: newId });
  };

  const setStatus = async (status: EstimateStatus) => {
    if (!form.estimate_id) return;
    await updateEstimateStatus(form.estimate_id, status);
    update({ status });

    // CONTRACT LOCK WORKFLOW: When status → Accepted, create contract
    if (status === 'Accepted' && estimateDbId) {
      try {
        const marginMult = (1 + (form.overhead_pct || 0.1)) * (1 + (form.profit_pct || 0.2)) * (1 + (form.contingency_pct || 0.1));
        const baselineValue = form.total_high || 0;
        const baselineMargin = baselineValue > 0 ? ((form.profit_pct || 0.2)) : 0;
        const template = 'Standard-3Pay' as const;
        const milestones = PAYMENT_TEMPLATES[template];
        const contractId = `CTR-${form.estimate_id}`;

        const contract: Contract = {
          contract_id: contractId,
          estimate_id: estimateDbId,
          contract_status: 'Active',
          baseline_contract_value: baselineValue,
          baseline_margin_pct: baselineMargin,
          baseline_risk_exposure: form.risk_cost_high || 0,
          signed_date: new Date().toISOString().split('T')[0],
          locked: true,
          net_contract_value: baselineValue,
          earned_revenue: 0,
          percent_complete: 0,
          projected_final_cost: (form.subtotal || 0) + (form.risk_cost_high || 0),
          projected_final_profit: baselineValue - ((form.subtotal || 0) + (form.risk_cost_high || 0)),
          margin_current_pct: baselineMargin,
          profit_fade_flag: false,
          payment_terms_template: template,
          payment_schedule_json: JSON.stringify(milestones),
          cash_forecast_30: Math.round(baselineValue * 0.3 * 100) / 100,
          cash_forecast_60: 0,
          cash_forecast_90: Math.round(baselineValue * 0.4 * 100) / 100,
        };

        const contractDbId = await saveContract(contract);
        await linkLineItemsToContract(estimateDbId, contractDbId);

        // Create revision log for contract lock
        await saveRevisionLog({
          id: uid(), estimate_id: form.estimate_id, created_at: new Date().toISOString(),
          version: form.version || 'v1.0', change_summary: 'Contract Lock — Estimate accepted',
          snapshot_json: JSON.stringify(form), delta_low: 0, delta_high: 0,
        });

        await logAuditEntry({
          contract_id: contractDbId, action_type: 'Contract Created',
          old_value: '', new_value: `${contractId}: ${fmt(baselineValue)}`,
          reason: 'Estimate accepted → Contract locked',
        });

        toast({ title: 'Contract created', description: `${contractId} locked at ${fmt(baselineValue)}` });
      } catch (e) {
        console.error('Contract creation error:', e);
        toast({ title: 'Contract creation failed', description: e instanceof Error ? e.message : 'Unknown', variant: 'destructive' });
      }
    }

    toast({ title: `Marked as ${status}` });
  };

  // ─── Media handlers ───
  const addMedia = async () => {
    if (!mediaUrl || !estimateDbId) return;
    const m: EstimateMedia = {
      media_id: uid(), estimate_id: estimateDbId,
      file_url: mediaUrl, caption: mediaCaption,
      include_in_internal_pdf: true, include_in_public_pdf: false,
    };
    await saveEstimateMedia(m);
    setMedia(prev => [...prev, m]);
    setMediaUrl(''); setMediaCaption('');
    toast({ title: 'Media added' });
  };

  const removeMedia = async (mediaId: string) => {
    await deleteEstimateMedia(mediaId);
    setMedia(prev => prev.filter(m => m.media_id !== mediaId));
  };

  const analyzePhoto = async (m: EstimateMedia) => {
    setAnalyzingMedia(m.media_id);
    try {
      const { data, error } = await supabase.functions.invoke('estimate-ai', {
        body: { action: 'photo_analyze', data: { image_url: m.file_url, caption: m.caption, project_type: form.project_type } },
      });
      if (error) throw error;
      const content = data?.content || '';
      // Parse JSON from response
      let parsed: any = {};
      try {
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content);
      } catch { parsed = { observed_conditions: content, suggested_scope_impacts: '', risk_flags: '', recommended_allowance_range: '', ai_confidence: 'Medium', questions_needed: [] }; }

      const analysis: EstimateMediaAnalysis = {
        analysis_id: uid(), media_id: m.id || m.media_id,
        observed_conditions: parsed.observed_conditions || '',
        suggested_scope_impacts: parsed.suggested_scope_impacts || '',
        risk_flags: parsed.risk_flags || '',
        recommended_allowance_range: parsed.recommended_allowance_range || '',
        ai_confidence: parsed.ai_confidence || 'Medium',
        questions_needed_json: JSON.stringify(parsed.questions_needed || []),
      };

      // Save to DB
      const userId = (await supabase.auth.getUser()).data.user?.id;
      await supabase.from('estimate_media_analysis').upsert({
        analysis_id: analysis.analysis_id, media_id: analysis.media_id,
        user_id: userId, observed_conditions: analysis.observed_conditions,
        suggested_scope_impacts: analysis.suggested_scope_impacts,
        risk_flags: analysis.risk_flags, recommended_allowance_range: analysis.recommended_allowance_range,
        ai_confidence: analysis.ai_confidence, questions_needed_json: analysis.questions_needed_json,
      }, { onConflict: 'analysis_id' });

      setMediaAnalyses(prev => ({ ...prev, [m.media_id]: analysis }));
      toast({ title: 'Photo analyzed' });
    } catch (e) {
      console.error('Photo analysis error:', e);
      toast({ title: 'Analysis failed', description: e instanceof Error ? e.message : 'Unknown', variant: 'destructive' });
    } finally { setAnalyzingMedia(null); }
  };

  const convertPhotoToSuggestions = async (m: EstimateMedia) => {
    const analysis = mediaAnalyses[m.media_id];
    if (!analysis) { toast({ title: 'Analyze photo first', variant: 'destructive' }); return; }
    setConvertingMedia(m.media_id);
    try {
      const { data, error } = await supabase.functions.invoke('estimate-ai', {
        body: {
          action: 'photo_convert', data: {
            analysis, clarification_answers: form.clarification_answers_json ? JSON.parse(form.clarification_answers_json) : [],
            project_type: form.project_type, sqft: form.sqft, fixture_count: form.fixture_count,
            finish_level: form.finish_level,
            existing_items_summary: dbLineItems.map(li => `${li.description} (${li.qty} ${li.unit})`).join(', '),
          },
        },
      });
      if (error) throw error;
      const suggestions = parseSuggestedChanges(data?.content || '');
      if (suggestions) { setPendingSuggestions(suggestions); toast({ title: 'Suggestions ready — review & apply' }); }
      else toast({ title: 'Could not parse suggestions', variant: 'destructive' });
    } catch (e) {
      toast({ title: 'Conversion failed', description: e instanceof Error ? e.message : 'Unknown', variant: 'destructive' });
    } finally { setConvertingMedia(null); }
  };

  // ─── Chat handlers (streaming) ───
  const loadThread = useCallback(async (thread: EstimateChatThread) => {
    setActiveThread(thread);
    if (thread.id) {
      const msgs = await getChatMessages(thread.id);
      setChatMessages(msgs);
    }
  }, []);

  const newThread = async () => {
    if (!estimateDbId) return;
    const title = 'Estimator Assistant';
    const thread: EstimateChatThread = { thread_id: uid(), estimate_id: estimateDbId, title };
    const dbId = await createChatThread(thread);
    thread.id = dbId;
    setChatThreads(prev => [...prev, thread]);
    loadThread(thread);
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || !activeThread?.id || chatStreaming) return;
    const userMsg: EstimateChatMessage = {
      message_id: uid(), thread_id: activeThread.id, role: 'user', content: chatInput, suggested_changes_json: '',
    };
    await saveChatMessage(userMsg);
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatStreaming(true);

    const context = {
      project_type: form.project_type, sqft: form.sqft, fixture_count: form.fixture_count,
      finish_level: form.finish_level, labor_subtotal: form.labor_subtotal,
      material_subtotal: form.material_subtotal, subtotal: form.subtotal,
      total_low: form.total_low, total_high: form.total_high,
      line_items: dbLineItems.map(li => ({ description: li.description, qty: li.qty, unit: li.unit, line_total: li.line_total, source: li.source })),
    };

    const allMsgs = [...chatMessages, userMsg].map(m => ({ role: m.role, content: m.content }));

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ action: 'chat', data: { messages: allMsgs, context } }),
      });

      if (!resp.ok || !resp.body) throw new Error('Stream failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';
      const assistantMsgId = uid();

      // Create initial assistant message
      setChatMessages(prev => [...prev, { message_id: assistantMsgId, thread_id: activeThread.id!, role: 'assistant', content: '', suggested_changes_json: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '' || !line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setChatMessages(prev => prev.map(m => m.message_id === assistantMsgId ? { ...m, content: assistantContent } : m));
            }
          } catch { /* partial json, skip */ }
        }
      }

      // Parse suggestions from response
      const suggestions = parseSuggestedChanges(assistantContent);
      const suggestionsJson = suggestions ? JSON.stringify(suggestions) : '';

      // Save assistant message to DB
      const assistantMsg: EstimateChatMessage = {
        message_id: assistantMsgId, thread_id: activeThread.id!, role: 'assistant',
        content: assistantContent, suggested_changes_json: suggestionsJson,
      };
      await saveChatMessage(assistantMsg);
      setChatMessages(prev => prev.map(m => m.message_id === assistantMsgId ? assistantMsg : m));

      if (suggestions) setPendingSuggestions(suggestions);
    } catch (e) {
      console.error('Chat error:', e);
      toast({ title: 'Chat error', description: e instanceof Error ? e.message : 'Unknown', variant: 'destructive' });
    } finally { setChatStreaming(false); }
  };

  // ─── Apply Suggestions (CRITICAL) ───
  const applySuggestions = async () => {
    if (!pendingSuggestions || !estimateDbId) return;
    setApplyingChanges(true);
    try {
      // 1. Create revision log snapshot
      await createRevision('AI suggestions applied');

      const newItems: EstimateLineItem[] = [];

      for (const action of pendingSuggestions.actions) {
        if (action.type === 'ADD_LINE_ITEM' || action.type === 'ADD_ALLOWANCE') {
          const isAllowance = action.type === 'ADD_ALLOWANCE';
          const laborCost = action.labor_unit_cost ?? 0;
          const matCost = action.material_unit_cost ?? (isAllowance ? ((action.allowance_low || 0) + (action.allowance_high || 0)) / 2 : 0);
          const qty = isAllowance ? 1 : (action.qty || 1);
          const labor_total = Math.round(qty * laborCost * 100) / 100;
          const material_total = Math.round(qty * matCost * 100) / 100;
          const laborHoursPerUnit = laborCost > 0 ? Math.round((laborCost / 80) * 10000) / 10000 : 0;

          let notes = action.rationale || '';
          if (isAllowance && (action.allowance_low || action.allowance_high)) {
            notes += ` [Allowance range: $${action.allowance_low || 0} – $${action.allowance_high || 0}]`;
          }
          if (laborCost === 0 && matCost === 0) notes += ' [TBD allowance — costs unknown]';

          newItems.push({
            line_id: `AI-${uid()}`,
            estimate_id: estimateDbId,
            phase: 'Other',
            description: isAllowance ? `Allowance: ${action.description}` : action.description,
            unit: isAllowance ? 'lump_sum' : (action.unit || 'ea'),
            qty,
            labor_unit_cost: laborCost,
            material_unit_cost: matCost,
            labor_hours_per_unit: laborHoursPerUnit,
            labor_hours_total: Math.round(qty * laborHoursPerUnit * 100) / 100,
            labor_total, material_total,
            line_total: Math.round((labor_total + material_total) * 100) / 100,
            source: action.evidence_source === 'Photo' ? 'PhotoAI' : 'AI Draft',
            locked: true,
            pending_confirmation: true,
            confidence: action.confidence || 'Medium',
            evidence_source: action.evidence_source || 'Chat',
            notes,
            include_in_public_pdf: (action as any).include_in_public_pdf !== false,
            include_in_internal_pdf: true,
            created_by: 'AI',
          } as any);
        }
        // MODIFY_QTY / MODIFY_UNIT_COST: create proposed change row instead of editing existing
        if (action.type === 'MODIFY_QTY' || action.type === 'MODIFY_UNIT_COST') {
          newItems.push({
            line_id: `AI-${uid()}`,
            estimate_id: estimateDbId,
            phase: 'Other',
            description: `[Proposed Change] ${action.description}`,
            unit: action.unit || 'ea',
            qty: action.qty || 0,
            labor_unit_cost: action.labor_unit_cost ?? 0,
            material_unit_cost: action.material_unit_cost ?? 0,
            labor_hours_per_unit: 0,
            labor_hours_total: 0,
            labor_total: 0, material_total: 0, line_total: 0,
            source: 'AI Draft', locked: true, pending_confirmation: true,
            confidence: action.confidence || 'Medium',
            evidence_source: action.evidence_source || 'Chat',
            notes: `${action.type}: ${action.rationale || ''}`,
          });
        }
      }

      if (newItems.length > 0) {
        await upsertEstimateLineItems(newItems);
        const allItems = await getEstimateLineItems(estimateDbId);
        setDbLineItems(allItems);
        await recomputeFromLineItems(allItems);
      }

      // Save suggestions to estimate
      update({ ai_suggestions_last_json: JSON.stringify(pendingSuggestions) });

      setPendingSuggestions(null);
      toast({ title: `${newItems.length} line items added`, description: 'Locked rows — confirm to unlock.' });
    } catch (e) {
      toast({ title: 'Apply failed', description: e instanceof Error ? e.message : 'Unknown', variant: 'destructive' });
    } finally { setApplyingChanges(false); }
  };

  // ─── Row confirmation ───
  const toggleRowSelection = (lineId: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId); else next.add(lineId);
      return next;
    });
  };

  const confirmSelectedRows = async () => {
    if (!estimateDbId || selectedRows.size === 0) return;
    const updatedItems = dbLineItems.map(li => {
      if (selectedRows.has(li.line_id)) {
        return { ...li, pending_confirmation: false, locked: false, notes: li.notes ? `${li.notes} | Confirmed: ${confirmNotes}` : `Confirmed: ${confirmNotes}` };
      }
      return li;
    });
    await upsertEstimateLineItems(updatedItems.filter(li => selectedRows.has(li.line_id)));
    setDbLineItems(updatedItems);
    setSelectedRows(new Set());
    setConfirmModal(false);
    setConfirmNotes('');
    await recomputeFromLineItems(updatedItems);
    toast({ title: `${selectedRows.size} rows confirmed` });
  };

  const addManualLineItem = async () => {
    if (!estimateDbId || !manualItem.description.trim()) {
      toast({ title: 'Description required', variant: 'destructive' }); return;
    }
    const qty = manualItem.qty || 0;
    const labor_total = Math.round(qty * manualItem.labor_unit_cost * 100) / 100;
    const material_total = Math.round(qty * manualItem.material_unit_cost * 100) / 100;
    const labor_hours_total = Math.round(qty * manualItem.labor_hours_per_unit * 100) / 100;
    const newItem: EstimateLineItem = {
      line_id: `MAN-${uid()}`, estimate_id: estimateDbId,
      phase: manualItem.phase, description: manualItem.description,
      unit: manualItem.unit, qty,
      labor_unit_cost: manualItem.labor_unit_cost,
      material_unit_cost: manualItem.material_unit_cost,
      labor_hours_per_unit: manualItem.labor_hours_per_unit,
      labor_hours_total, labor_total, material_total,
      line_total: Math.round((labor_total + material_total) * 100) / 100,
      source: 'Manual', locked: false, pending_confirmation: false,
      confidence: 'High', evidence_source: 'Manual', notes: manualItem.notes,
    };
    await upsertEstimateLineItems([newItem]);
    const allItems = await getEstimateLineItems(estimateDbId);
    setDbLineItems(allItems);
    await recomputeFromLineItems(allItems);
    setManualItem({ phase: 'Other', description: '', unit: 'ea', qty: 0, labor_unit_cost: 0, material_unit_cost: 0, labor_hours_per_unit: 0, notes: '' });
    setShowManualForm(false);
    toast({ title: 'Manual line item added' });
  };

  const costStructure = form.cost_structure_json ? JSON.parse(form.cost_structure_json) : [];
  const riskTable = form.risk_table_json ? JSON.parse(form.risk_table_json) : [];
  const fmt = (n?: number) => '$' + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const hasPendingRows = dbLineItems.some(li => li.pending_confirmation);

  // ─── Reliability computations ───
  const approvalGate = evaluateApprovalGate(form, dbLineItems);
  const { score: completenessScore, checklist: completenessChecklist } = computeCompletenessScore(
    (form.project_type as ProjectType) || 'Full Rehab', dbLineItems
  );
  const calcStatus = computeCalcStatus(form);
  const marginMult = (1 + (form.overhead_pct || 0.1)) * (1 + (form.profit_pct || 0.2)) * (1 + (form.contingency_pct || 0.1));
  const effectiveMarginPct = marginMult > 0 ? Math.round((1 - 1/marginMult) * 10000) / 100 : 0;
  const materialVolatility = (form as any).material_volatility_flag || false;
  const volatilityReviewed = (form as any).volatility_reviewed || false;

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{isEdit ? `Edit ${form.estimate_id}` : 'New Estimate'}</h1>
          {form.estimate_id && <Badge>{form.status}</Badge>}
        </div>
        <Button
          variant="outline"
          onClick={() => setIntakeOpen(true)}
          className="border-primary/30 hover:bg-primary/5 gap-1.5 sm:gap-2 h-10 sm:h-9 px-3 min-w-0"
        >
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium hidden sm:inline">AI Intake Assistant</span>
          <span className="text-sm font-medium sm:hidden">AI Intake</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
            {form.ai_apply_status === 'Draft Applied' ? 'Good' : form.ai_apply_status === 'Reviewed' ? 'Review Needed' : 'Draft Only'}
          </Badge>
        </Button>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Project Classification</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="font-semibold">Project Category *</Label>
              <p className="text-xs text-muted-foreground mb-1">High-level project type</p>
              <Select value={form.project_category || 'Custom Scope'} onValueChange={v => update({ project_category: v as ProjectCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.project_category && <p className="text-xs text-destructive mt-1">{errors.project_category}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-semibold">Scope Class</Label>
                <p className="text-xs text-muted-foreground mb-1">Internal estimating logic</p>
                <Select value={form.scope_class || 'Full-Scope Multi-Trade'} onValueChange={v => update({ scope_class: v as ScopeClass })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCOPE_CLASSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-semibold">Job Size / Complexity</Label>
                <p className="text-xs text-muted-foreground mb-1">Expected scope scale</p>
                <Select value={form.job_complexity || 'Standard Scope'} onValueChange={v => update({ job_complexity: v as JobComplexity })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {JOB_COMPLEXITIES.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Finish Level</Label>
                <Select value={form.finish_level} onValueChange={v => update({ finish_level: v as FinishLevel })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Basic">Basic</SelectItem><SelectItem value="Mid">Mid</SelectItem><SelectItem value="High">High</SelectItem><SelectItem value="Luxury">Luxury</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Project Name</Label><Input value={form.project_name || ''} onChange={e => update({ project_name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {form.project_type !== 'Small Job' && (
                <div>
                  <Label>Square Footage *</Label>
                  <Input type="number" value={form.sqft || ''} onChange={e => update({ sqft: Number(e.target.value) })} />
                  {errors.sqft && <p className="text-xs text-destructive mt-1">{errors.sqft}</p>}
                </div>
              )}
              {(form.project_type === 'Bath' || form.project_type === 'Kitchen') && (
                <div>
                  <Label>Fixture Count *</Label>
                  <Input type="number" value={form.fixture_count || ''} onChange={e => update({ fixture_count: Number(e.target.value) })} />
                  {errors.fixture_count && <p className="text-xs text-destructive mt-1">{errors.fixture_count}</p>}
                </div>
              )}
              {form.job_complexity === 'Quick Repair' && (
                <div>
                  <Label>Labor Hours *</Label>
                  <Input type="number" value={form.labor_hours || ''} onChange={e => update({ labor_hours: Number(e.target.value) })} />
                  {errors.labor_hours && <p className="text-xs text-destructive mt-1">{errors.labor_hours}</p>}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Crew Size</Label><Input type="number" value={form.crew_size || 2} onChange={e => update({ crew_size: Number(e.target.value) })} /></div>
              <div><Label>Hours/Day</Label><Input type="number" value={form.hours_per_day || 8} onChange={e => update({ hours_per_day: Number(e.target.value) })} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.finish_materials_included} onCheckedChange={v => update({ finish_materials_included: v })} />
              <Label>Finish Materials Included</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Client Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Name</Label><Input value={form.client_name || ''} onChange={e => update({ client_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input value={form.client_email || ''} onChange={e => update({ client_email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.client_phone || ''} onChange={e => update({ client_phone: e.target.value })} /></div>
            </div>
            <div><Label>Address</Label><Input value={form.project_address || ''} onChange={e => update({ project_address: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>City</Label><Input value={form.city || ''} onChange={e => update({ city: e.target.value })} /></div>
              <div><Label>State</Label><Input value={form.state || ''} onChange={e => update({ state: e.target.value })} /></div>
              <div><Label>Zip</Label><Input value={form.zip || ''} onChange={e => update({ zip: e.target.value })} /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Internal Notes</CardTitle></CardHeader>
          <CardContent><Textarea rows={3} value={form.internal_notes || ''} onChange={e => update({ internal_notes: e.target.value })} placeholder="Internal team notes..." /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Public Notes</CardTitle></CardHeader>
          <CardContent><Textarea rows={3} value={form.public_notes || ''} onChange={e => update({ public_notes: e.target.value })} placeholder="Notes visible to client..." /></CardContent>
        </Card>
      </div>

      {/* Advanced */}
      <Collapsible open={advOpen} onOpenChange={setAdvOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm"><ChevronDown className={`mr-1 h-4 w-4 transition-transform ${advOpen ? 'rotate-180' : ''}`} />Advanced (Internal Margins)</Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2">
            <CardContent className="pt-4 grid grid-cols-3 gap-4">
              <div><Label>Overhead %</Label><Input type="number" step="0.01" value={form.overhead_pct} onChange={e => update({ overhead_pct: Number(e.target.value) })} /></div>
              <div><Label>Profit %</Label><Input type="number" step="0.01" value={form.profit_pct} onChange={e => update({ profit_pct: Number(e.target.value) })} /></div>
              <div><Label>Contingency %</Label><Input type="number" step="0.01" value={form.contingency_pct} onChange={e => update({ contingency_pct: Number(e.target.value) })} /></div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={saveDraft}>Save Draft</Button>
        <Button onClick={generate} disabled={generating}>{generating ? 'Generating...' : 'Generate'}</Button>
        {form.subtotal! > 0 && (
          <>
            <Button variant="outline" onClick={() => {
              if ((form as any).calc_status !== 'Fresh') {
                toast({ title: 'Recompute required', description: 'Regenerate estimate before exporting PDF.', variant: 'destructive' });
                return;
              }
              generatePublicPDF(form as Estimate, dbLineItems);
            }}><FileDown className="mr-1 h-4 w-4" />Public PDF</Button>
            <Button variant="outline" onClick={() => generateInternalPDF(form as Estimate, dbLineItems)}><FileDown className="mr-1 h-4 w-4" />Internal PDF</Button>
            <Button variant="outline" onClick={() => createRevision()}>Create Revision</Button>
            <Button variant="outline" onClick={duplicate}><Copy className="mr-1 h-4 w-4" />Duplicate</Button>
          </>
        )}
      </div>

      {/* Pricing Health Panel */}
      {form.subtotal! > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Gauge className="h-4 w-4" />Estimate Health</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <MiniCard label="Total Range" value={`${fmt(form.total_low)} – ${fmt(form.total_high)}`} />
              <MiniCard label="Margin" value={`${effectiveMarginPct}%`} />
              <MiniCard label="Completeness" value={`${completenessScore}%`} />
              <MiniCard label="Calc Status" value={calcStatus} />
              <MiniCard label="Validity" value={`${(form as any).validity_days || 14} days`} />
              <MiniCard label="Volatility" value={materialVolatility ? '⚠ Flagged' : 'Normal'} />
            </div>
            <div className="flex items-center gap-2">
              <Progress value={completenessScore} className="flex-1 h-2" />
              <span className="text-xs font-mono">{completenessScore}%</span>
              {completenessScore < 80 && <Badge variant="destructive" className="text-xs">Below 80%</Badge>}
              {completenessScore >= 80 && <Badge className="text-xs">Ready</Badge>}
            </div>
            {completenessScore < 100 && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p className="font-medium">Missing scope items:</p>
                {completenessChecklist.filter(c => !c.present).map(c => (
                  <span key={c.label} className="inline-block mr-2">• {c.label}</span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Validity (days)</Label>
                <Input type="number" className="w-20 h-7 text-sm" value={(form as any).validity_days || 14}
                  onChange={e => update({ validity_days: Number(e.target.value) } as any)} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={materialVolatility}
                  onCheckedChange={v => update({ material_volatility_flag: v } as any)} />
                <Label className="text-xs">Material Volatility Flag</Label>
              </div>
              {materialVolatility && (
                <div className="flex items-center gap-2">
                  <Switch checked={volatilityReviewed}
                    onCheckedChange={v => update({ volatility_reviewed: v } as any)} />
                  <Label className="text-xs">Volatility Reviewed</Label>
                </div>
              )}
            </div>

            {/* Budget-Fit Controls */}
            <div className="flex items-end gap-2 p-3 bg-muted/50 rounded-lg">
              <div>
                <Label className="text-xs flex items-center gap-1"><Target className="h-3 w-3" />Budget Target ($)</Label>
                <Input type="number" className="w-32 h-8 text-sm" value={budgetTarget} placeholder="e.g. 3500"
                  onChange={e => setBudgetTarget(e.target.value ? Number(e.target.value) : '')} />
              </div>
              <Button size="sm" variant="outline" disabled={!budgetTarget || dbLineItems.length === 0}
                onClick={() => {
                  if (!budgetTarget) return;
                  const scenarios = fitEstimateToBudget(
                    dbLineItems, form.subtotal || 0, budgetTarget,
                    form.overhead_pct || 0.1, form.profit_pct || 0.2, form.contingency_pct || 0.1,
                  );
                  setBudgetScenarios(scenarios);
                }}>
                <Target className="h-3 w-3 mr-1" />Fit to Budget
              </Button>
              {budgetScenarios && <Button size="sm" variant="ghost" onClick={() => setBudgetScenarios(null)}>Dismiss</Button>}
            </div>

            {/* Budget Scenarios */}
            {budgetScenarios && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {budgetScenarios.map(s => (
                  <Card key={s.name} className={s.name === 'Balanced' ? 'border-primary/50 ring-1 ring-primary/20' : ''}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        {s.name}
                        {s.name === 'Balanced' && <Badge className="text-xs">Recommended</Badge>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                      <p className="text-lg font-bold">{fmt(s.projected_total)}</p>
                      {s.delta > 0 && <Badge variant="secondary" className="text-xs">Saves {fmt(s.delta)}</Badge>}
                      {s.changes.length > 0 && (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {s.changes.slice(0, 5).map((c, i) => (
                            <div key={i} className="text-xs flex items-center gap-1">
                              <Badge variant={c.action === 'KEEP' ? 'default' : c.action === 'REMOVE' ? 'destructive' : 'secondary'} className="text-xs shrink-0">
                                {c.action}
                              </Badge>
                              <span className="truncate">{c.description}</span>
                            </div>
                          ))}
                          {s.changes.length > 5 && <p className="text-xs text-muted-foreground">+{s.changes.length - 5} more</p>}
                        </div>
                      )}
                      {s.name !== 'Premium' && s.changes.length > 0 && (
                        <Button size="sm" variant="outline" className="w-full" onClick={async () => {
                          toast({ title: `Applying ${s.name} scenario...` });
                          setBudgetScenarios(null);
                          // For now, show what would change - full apply would modify line items
                          toast({ title: `${s.name} scenario`, description: `Would adjust ${s.changes.length} items to reach ${fmt(s.projected_total)}. Apply in chat for precise control.` });
                        }}>Apply {s.name}</Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status Workflow Buttons */}
      {form.estimate_id && form.status !== 'Draft' && (
        <div className="space-y-2">
          {/* Approval Gate warnings */}
          {!approvalGate.canSend && form.status !== 'Sent' && form.status !== 'Accepted' && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
              <ShieldCheck className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-amber-800">Send Gate — Issues to resolve:</p>
                <ul className="text-xs text-amber-700 mt-1 space-y-0.5">
                  {approvalGate.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {form.status !== 'Sent' && (
              <Button variant="outline" onClick={() => {
                if (!approvalGate.canSend) {
                  toast({ title: 'Cannot send', description: approvalGate.reasons[0], variant: 'destructive' });
                  return;
                }
                setStatus('Sent');
              }} className={approvalGate.canSend ? 'text-blue-600 border-blue-300 hover:bg-blue-50' : 'opacity-50'}>
                <Send className="mr-1 h-4 w-4" />Mark as Sent
              </Button>
            )}
            {form.status !== 'Accepted' && <Button variant="outline" onClick={() => setStatus('Accepted')} className="text-green-600 border-green-300 hover:bg-green-50"><CheckCircle className="mr-1 h-4 w-4" />Mark as Accepted</Button>}
            {form.status !== 'Rejected' && <Button variant="outline" onClick={() => setStatus('Rejected')} className="text-red-600 border-red-300 hover:bg-red-50"><XCircle className="mr-1 h-4 w-4" />Mark as Rejected</Button>}
            {form.status === 'Accepted' && (
              <Button variant="outline" onClick={() => navigate('/contracts')} className="border-primary/50">
                <Briefcase className="mr-1 h-4 w-4" />View Contract
              </Button>
            )}
            {form.status === 'Accepted' && estimateDbId && (
              <JobButton estimateDbId={estimateDbId} estimate={form as Estimate} />
            )}
          </div>
        </div>
      )}

      {/* Output Panels */}
      {form.subtotal! > 0 && (
        <Tabs defaultValue="line-items" className="mt-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="line-items">Line Items</TabsTrigger>
            <TabsTrigger value="costs">Cost Summary</TabsTrigger>
            <TabsTrigger value="risks">Risk Analysis</TabsTrigger>
            <TabsTrigger value="scope">Scope & Assumptions</TabsTrigger>
            <TabsTrigger value="chat">Estimator Chat</TabsTrigger>
            <TabsTrigger value="media">Photos & Analysis</TabsTrigger>
            <TabsTrigger value="audit">Audit & History</TabsTrigger>
          </TabsList>

          {/* LINE ITEMS TAB */}
          <TabsContent value="line-items" className="space-y-4">
            {/* AI suggestion banner */}
            {hasPendingRows && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-amber-800">AI suggestions added as <strong>Locked</strong> rows until confirmed.</span>
              </div>
            )}

            {/* Pending suggestions to apply */}
            {pendingSuggestions && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" />AI Suggestions Ready ({pendingSuggestions.actions.length} actions)</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {pendingSuggestions.conditional_questions.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Questions to consider:</p>
                      {pendingSuggestions.conditional_questions.map((q, i) => (
                        <p key={i} className="text-sm">• {q.question} <span className="text-xs text-muted-foreground">({q.why_it_matters})</span></p>
                      ))}
                    </div>
                  )}
                  {pendingSuggestions.actions.map((a, i) => (
                    <div key={i} className="text-sm flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{a.type}</Badge>
                      <span>{a.description}</span>
                      <Badge variant={a.confidence === 'High' ? 'default' : a.confidence === 'Low' ? 'destructive' : 'secondary'} className="text-xs">{a.confidence}</Badge>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={applySuggestions} disabled={applyingChanges}>
                      {applyingChanges ? 'Applying...' : 'Review & Apply Suggestions'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPendingSuggestions(null)}>Dismiss</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <MiniCard label="Labor" value={fmt(form.labor_subtotal)} />
              <MiniCard label="Materials" value={fmt(form.material_subtotal)} />
              <MiniCard label="Labor Hours" value={String(form.subtotal_labor_hours || 0)} />
              <MiniCard label="Est. Duration" value={`${form.estimated_duration_days || 0} days`} />
              <MiniCard label="Range" value={`${fmt(form.total_low)} – ${fmt(form.total_high)}`} />
            </div>

            {/* Row actions */}
            {selectedRows.size > 0 && (
              <div className="flex gap-2 items-center">
                <Badge variant="secondary">{selectedRows.size} selected</Badge>
                <Button size="sm" onClick={() => setConfirmModal(true)}><CheckCircle className="mr-1 h-3 w-3" />Confirm Selected</Button>
              </div>
            )}

            <Card>
              <CardHeader><CardTitle className="text-sm">Estimate Line Items</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Phase</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">Labor $/u</TableHead>
                        <TableHead className="text-right">Mat $/u</TableHead>
                        <TableHead className="text-right">Hrs Total</TableHead>
                        <TableHead className="text-right">Labor $</TableHead>
                        <TableHead className="text-right">Mat $</TableHead>
                        <TableHead className="text-right">Line Total</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>PDF</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dbLineItems.map((li, i) => (
                        <TableRow key={li.line_id || i} className={li.pending_confirmation ? 'bg-amber-50/50' : ''}>
                          <TableCell>
                            {(li.pending_confirmation || li.locked) && (
                              <Checkbox checked={selectedRows.has(li.line_id)} onCheckedChange={() => toggleRowSelection(li.line_id)} />
                            )}
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{li.phase}</Badge></TableCell>
                          <TableCell className="font-medium">
                            {li.description}
                            {li.notes && <p className="text-xs text-muted-foreground mt-0.5">{li.notes}</p>}
                          </TableCell>
                          <TableCell className="text-right">{li.qty}</TableCell>
                          <TableCell>{li.unit}</TableCell>
                          <TableCell className="text-right">{fmt(li.labor_unit_cost)}</TableCell>
                          <TableCell className="text-right">{fmt(li.material_unit_cost)}</TableCell>
                          <TableCell className="text-right">{li.labor_hours_total.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{fmt(li.labor_total)}</TableCell>
                          <TableCell className="text-right">{fmt(li.material_total)}</TableCell>
                          <TableCell className="text-right font-bold">{fmt(li.line_total)}</TableCell>
                          <TableCell>
                            <SourcePill source={li.source} confidence={li.confidence} evidenceSource={li.evidence_source} />
                          </TableCell>
                          <TableCell>
                            <Checkbox 
                              checked={(li as any).include_in_public_pdf !== false} 
                              onCheckedChange={async (checked) => {
                                const updated = { ...li, include_in_public_pdf: !!checked } as any;
                                await upsertEstimateLineItems([updated]);
                                setDbLineItems(prev => prev.map(item => item.line_id === li.line_id ? updated : item));
                              }} 
                            />
                          </TableCell>
                          <TableCell>
                            {li.locked && <Lock className="h-3 w-3 text-amber-600 inline mr-1" />}
                            {li.pending_confirmation && <Badge variant="destructive" className="text-xs">Pending</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                      {dbLineItems.length === 0 && (
                        <TableRow><TableCell colSpan={13} className="text-center py-6 text-muted-foreground">No line items. Click Generate to create from Cost Library.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Manual Line Item Form */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowManualForm(!showManualForm)}>
                <Plus className="h-3 w-3 mr-1" />{showManualForm ? 'Cancel' : 'Add Manual Line Item'}
              </Button>
            </div>
            {showManualForm && (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <Label>Phase</Label>
                      <Select value={manualItem.phase} onValueChange={v => setManualItem(p => ({ ...p, phase: v as Phase }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['Demo','Framing','Drywall','Paint','Flooring','Electrical','Plumbing','HVAC','Kitchen','Bathroom','Permits/Fees','Cleanup/Trash','Other'].map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="lg:col-span-2">
                      <Label>Description *</Label>
                      <Input value={manualItem.description} onChange={e => setManualItem(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Custom cabinetry install" />
                    </div>
                    <div>
                      <Label>Unit</Label>
                      <Select value={manualItem.unit} onValueChange={v => setManualItem(p => ({ ...p, unit: v as LineItemUnit }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['ea','sf','lf','fixture','hr','day','lump_sum'].map(u => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div><Label>Qty</Label><Input type="number" value={manualItem.qty || ''} onChange={e => setManualItem(p => ({ ...p, qty: Number(e.target.value) }))} /></div>
                    <div><Label>Labor $/unit</Label><Input type="number" step="0.01" value={manualItem.labor_unit_cost || ''} onChange={e => setManualItem(p => ({ ...p, labor_unit_cost: Number(e.target.value) }))} /></div>
                    <div><Label>Material $/unit</Label><Input type="number" step="0.01" value={manualItem.material_unit_cost || ''} onChange={e => setManualItem(p => ({ ...p, material_unit_cost: Number(e.target.value) }))} /></div>
                    <div><Label>Labor hrs/unit</Label><Input type="number" step="0.01" value={manualItem.labor_hours_per_unit || ''} onChange={e => setManualItem(p => ({ ...p, labor_hours_per_unit: Number(e.target.value) }))} /></div>
                    <div><Label>Notes</Label><Input value={manualItem.notes} onChange={e => setManualItem(p => ({ ...p, notes: e.target.value }))} placeholder="Optional" /></div>
                  </div>
                  <Button size="sm" onClick={addManualLineItem} disabled={!manualItem.description.trim()}>
                    <Plus className="h-3 w-3 mr-1" />Add Line Item
                  </Button>
                </CardContent>
              </Card>
            )}

            <Collapsible open={traceOpen} onOpenChange={setTraceOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm"><ChevronDown className={`mr-1 h-4 w-4 transition-transform ${traceOpen ? 'rotate-180' : ''}`} />How totals were computed</Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="mt-2">
                  <CardContent className="pt-4 space-y-2 text-sm font-mono">
                    <p>Labor Subtotal: <strong>{fmt(form.labor_subtotal)}</strong> = Σ(line.qty × line.labor_unit_cost)</p>
                    <p>Material Subtotal: <strong>{fmt(form.material_subtotal)}</strong> = Σ(line.qty × line.material_unit_cost × finish_mult[{form.finish_level}={FINISH_MULTS[form.finish_level as FinishLevel] || 1}])</p>
                    <p>Subtotal: <strong>{fmt(form.subtotal)}</strong> = labor + material</p>
                    <hr className="my-2 border-border" />
                    <p>Risk Low: <strong>{fmt(form.risk_cost_low)}</strong> | Risk High: <strong>{fmt(form.risk_cost_high)}</strong></p>
                    <p>Overall Risk: <strong>{form.overall_risk_level}</strong></p>
                    <hr className="my-2 border-border" />
                    <p>Overhead: {((form.overhead_pct || 0) * 100).toFixed(0)}% | Profit: {((form.profit_pct || 0) * 100).toFixed(0)}% | Contingency: {((form.contingency_pct || 0) * 100).toFixed(0)}%</p>
                    <p>Margin Multiplier: <strong>{((1 + (form.overhead_pct || 0)) * (1 + (form.profit_pct || 0)) * (1 + (form.contingency_pct || 0))).toFixed(4)}</strong></p>
                    <hr className="my-2 border-border" />
                    <p>Total Low: <strong>{fmt(form.total_low)}</strong> = (subtotal + risk_low) × margin_mult</p>
                    <p>Total High: <strong>{fmt(form.total_high)}</strong> = (subtotal + risk_high) × margin_mult</p>
                    <hr className="my-2 border-border" />
                    <p>Labor Hours Total: <strong>{form.subtotal_labor_hours}</strong> hrs</p>
                    <p>Est. Duration: <strong>{form.estimated_duration_days}</strong> days = ⌈{form.subtotal_labor_hours} / ({form.crew_size} crew × {form.hours_per_day} hrs/day)⌉</p>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          {/* COSTS TAB */}
          <TabsContent value="costs" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MiniCard label="Labor" value={fmt(form.labor_subtotal)} />
              <MiniCard label="Materials" value={fmt(form.material_subtotal)} />
              <MiniCard label="Subtotal" value={fmt(form.subtotal)} />
              <MiniCard label="Range" value={`${fmt(form.total_low)} – ${fmt(form.total_high)}`} />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-sm">Cost Structure</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Trade</TableHead><TableHead className="text-right">Labor</TableHead><TableHead className="text-right">Material</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {costStructure.map((c: any, i: number) => (
                      <TableRow key={i}><TableCell>{c.trade}</TableCell><TableCell className="text-right">{fmt(c.labor)}</TableCell><TableCell className="text-right">{fmt(c.material)}</TableCell><TableCell className="text-right">{fmt(c.dollars)}</TableCell><TableCell className="text-right">{c.percent.toFixed(1)}%</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RISKS TAB */}
          <TabsContent value="risks" className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <MiniCard label="Risk Level" value={form.overall_risk_level || 'Low'} />
              <MiniCard label="Risk Low" value={fmt(form.risk_cost_low)} />
              <MiniCard label="Risk High" value={fmt(form.risk_cost_high)} />
            </div>
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader><TableRow><TableHead>Risk</TableHead><TableHead>Level</TableHead><TableHead className="text-right">Low</TableHead><TableHead className="text-right">High</TableHead><TableHead>Mitigation</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {riskTable.map((r: any, i: number) => (
                      <TableRow key={i}><TableCell>{r.risk_name}</TableCell><TableCell><Badge variant={r.level === 'High' ? 'destructive' : 'secondary'}>{r.level}</Badge></TableCell><TableCell className="text-right">{fmt(r.exposure_low)}</TableCell><TableCell className="text-right">{fmt(r.exposure_high)}</TableCell><TableCell className="text-sm">{r.mitigation_note}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SCOPE TAB */}
          <TabsContent value="scope" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Assumptions (editable)</CardTitle></CardHeader>
              <CardContent><Textarea rows={10} value={form.assumptions_rich || ''} onChange={e => update({ assumptions_rich: e.target.value })} /></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm">AI Scope</CardTitle><Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(form.ai_scope || '')}><Copy className="h-3 w-3 mr-1" />Copy</Button></CardHeader>
              <CardContent><div className="prose prose-sm max-w-none bg-muted p-4 rounded-md max-h-96 overflow-y-auto"><ReactMarkdown>{form.ai_scope || ''}</ReactMarkdown></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Timeline</CardTitle></CardHeader>
              <CardContent><Textarea rows={6} value={form.timeline_rich || ''} onChange={e => update({ timeline_rich: e.target.value })} /></CardContent>
            </Card>
          </TabsContent>

          {/* ESTIMATOR CHAT TAB */}
          <TabsContent value="chat" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Estimator Assistant</CardTitle>
                <Button variant="outline" size="sm" onClick={newThread} disabled={!estimateDbId}><Plus className="h-3 w-3 mr-1" />New Thread</Button>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 min-h-[400px]">
                  {/* Thread list */}
                  <div className="w-48 space-y-1 border-r pr-4">
                    {chatThreads.map(t => (
                      <Button key={t.thread_id} variant={activeThread?.thread_id === t.thread_id ? 'default' : 'ghost'} size="sm" className="w-full justify-start text-left" onClick={() => loadThread(t)}>
                        <MessageSquare className="h-3 w-3 mr-1 shrink-0" /><span className="truncate">{t.title}</span>
                      </Button>
                    ))}
                    {chatThreads.length === 0 && <p className="text-xs text-muted-foreground">No threads yet. Click "New Thread" to start.</p>}
                  </div>
                  {/* Messages */}
                  <div className="flex-1 flex flex-col">
                    {activeThread ? (
                      <>
                        <div className="flex-1 space-y-3 overflow-y-auto max-h-[360px] pr-2">
                          {chatMessages.map(m => (
                            <div key={m.message_id} className={`p-3 rounded-md text-sm ${m.role === 'user' ? 'bg-primary/10 ml-8' : m.role === 'assistant' ? 'bg-muted mr-4' : 'bg-muted/50 text-xs italic'}`}>
                              <span className="font-medium text-xs text-muted-foreground uppercase">{m.role}</span>
                              <div className="mt-1 prose prose-sm max-w-none">
                                <ReactMarkdown>{m.content}</ReactMarkdown>
                              </div>
                              {m.role === 'assistant' && m.suggested_changes_json && (() => {
                                const sc = parseSuggestedChanges(m.content);
                                return sc && sc.actions.length > 0 ? (
                                  <Button size="sm" variant="outline" className="mt-2" onClick={() => setPendingSuggestions(sc)}>
                                    <Sparkles className="h-3 w-3 mr-1" />Review {sc.actions.length} Suggestions
                                  </Button>
                                ) : null;
                              })()}
                            </div>
                          ))}
                          {chatMessages.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Ask the AI assistant about this estimate. It will suggest structured changes you can review and apply.</p>}
                          <div ref={chatEndRef} />
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask about scope, costs, missing items..." onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} disabled={chatStreaming} />
                          <Button onClick={sendMessage} disabled={!chatInput.trim() || chatStreaming}>{chatStreaming ? '...' : <Send className="h-4 w-4" />}</Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">Select or create a thread to start chatting</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PHOTOS & ANALYSIS TAB */}
          <TabsContent value="media" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Photos & Analysis</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {estimateDbId && (
                  <MediaUploader
                    folder="estimates"
                    onUploaded={async (url, cap) => {
                      await saveEstimateMedia({
                        media_id: uid(), estimate_id: estimateDbId,
                        file_url: url, caption: cap,
                        include_in_internal_pdf: true, include_in_public_pdf: false,
                      } as EstimateMedia);
                      const med = await getEstimateMedia(estimateDbId);
                      setMedia(med);
                    }}
                  />
                )}
                {media.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No photos attached yet.</p>}
                <div className="space-y-4">
                  {media.map(m => {
                    const analysis = mediaAnalyses[m.media_id];
                    const questions = analysis ? (() => { try { return JSON.parse(analysis.questions_needed_json); } catch { return []; } })() : [];
                    return (
                      <Card key={m.media_id}>
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex gap-4">
                            {m.file_url && (
                              <img src={m.file_url} alt={m.caption} className="w-40 h-28 object-cover rounded-md shrink-0" onError={e => (e.currentTarget.style.display = 'none')} />
                            )}
                            <div className="flex-1 space-y-2">
                              <p className="font-medium">{m.caption || 'No caption'}</p>
                              <div className="flex gap-2 text-xs">
                                <Badge variant={m.include_in_internal_pdf ? 'default' : 'outline'}>Internal PDF</Badge>
                                <Badge variant={m.include_in_public_pdf ? 'default' : 'outline'}>Public PDF</Badge>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => analyzePhoto(m)} disabled={analyzingMedia === m.media_id}>
                                  <Camera className="h-3 w-3 mr-1" />{analyzingMedia === m.media_id ? 'Analyzing...' : 'Analyze Photo'}
                                </Button>
                                {analysis && (
                                  <Button size="sm" variant="outline" onClick={() => convertPhotoToSuggestions(m)} disabled={convertingMedia === m.media_id}>
                                    <Sparkles className="h-3 w-3 mr-1" />{convertingMedia === m.media_id ? 'Converting...' : 'Convert to Line Items'}
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => removeMedia(m.media_id)}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            </div>
                          </div>

                          {analysis && (
                            <div className="border-t pt-3 space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <Badge variant={analysis.ai_confidence === 'High' ? 'default' : analysis.ai_confidence === 'Low' ? 'destructive' : 'secondary'}>
                                  Confidence: {analysis.ai_confidence}
                                </Badge>
                              </div>
                              {analysis.observed_conditions && <div><p className="text-xs font-medium text-muted-foreground">Observed Conditions</p><p>{analysis.observed_conditions}</p></div>}
                              {analysis.suggested_scope_impacts && <div><p className="text-xs font-medium text-muted-foreground">Scope Impacts</p><p>{analysis.suggested_scope_impacts}</p></div>}
                              {analysis.risk_flags && <div><p className="text-xs font-medium text-muted-foreground">Risk Flags</p><p>{analysis.risk_flags}</p></div>}
                              {analysis.recommended_allowance_range && <div><p className="text-xs font-medium text-muted-foreground">Allowance Range</p><p>{analysis.recommended_allowance_range}</p></div>}

                              {questions.length > 0 && (
                                <div className="border-t pt-2 space-y-2">
                                  <p className="text-xs font-medium text-muted-foreground">Clarification Checklist</p>
                                  {questions.map((q: any, qi: number) => (
                                    <div key={qi} className="flex items-start gap-2">
                                      <span className="text-xs text-muted-foreground mt-1">•</span>
                                      <div className="flex-1">
                                        <p className="text-sm">{q.question}</p>
                                        <p className="text-xs text-muted-foreground">{q.why_it_matters}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AUDIT TAB */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">AI Price Audit (Internal Only)</CardTitle></CardHeader>
              <CardContent><div className="prose prose-sm max-w-none bg-muted p-4 rounded-md max-h-96 overflow-y-auto"><ReactMarkdown>{form.ai_price_audit_summary || ''}</ReactMarkdown></div></CardContent>
            </Card>
            {revisions.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Revision History</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Version</TableHead><TableHead>Date</TableHead><TableHead>Summary</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {revisions.map(r => (
                        <TableRow key={r.id}><TableCell className="font-mono">{r.version}</TableCell><TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell><TableCell>{r.change_summary}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Confirm Modal */}
      <Dialog open={confirmModal} onOpenChange={setConfirmModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Selected Rows</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Confirming {selectedRows.size} row(s). This will unlock them and mark as verified.</p>
            <div>
              <Label>What did you verify?</Label>
              <Textarea value={confirmNotes} onChange={e => setConfirmNotes(e.target.value)} placeholder="e.g. Confirmed tile area measurements on-site" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmModal(false)}>Cancel</Button>
            <Button onClick={confirmSelectedRows} disabled={!confirmNotes.trim()}>Confirm & Unlock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Intake Assistant Sheet */}
      <Sheet open={intakeOpen} onOpenChange={setIntakeOpen}>
        <SheetContent side="right" className="w-full sm:w-[420px] md:w-[480px] p-0">
          <AIIntakePanel
            estimate={form}
            estimateDbId={estimateDbId}
            media={media}
            onUpdate={update}
            onSave={saveDraft}
            onMediaChange={async () => {
              if (estimateDbId) {
                const med = await getEstimateMedia(estimateDbId);
                setMedia(med);
              }
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Source Pill Component ───
function SourcePill({ source, confidence, evidenceSource }: { source: string; confidence?: string; evidenceSource?: string }) {
  const variant = source === 'CostLibrary' ? 'default' : source === 'Manual' ? 'secondary' : 'outline';
  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant={variant} className="text-xs">{source}</Badge>
      {(source === 'AI Draft' || source === 'PhotoAI') && (
        <span className="text-xs text-muted-foreground">{confidence} · {evidenceSource}</span>
      )}
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="pt-3 pb-2 px-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-base font-bold">{value}</p></CardContent></Card>
  );
}

function JobButton({ estimateDbId, estimate }: { estimateDbId: string; estimate: Estimate }) {
  const [existingJob, setExistingJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    import('@/lib/jobStore').then(({ getJobByEstimateId }) =>
      getJobByEstimateId(estimateDbId).then(j => { setExistingJob(j); setLoading(false); })
    );
  }, [estimateDbId]);

  if (loading) return null;

  if (existingJob) {
    return (
      <Button variant="outline" onClick={() => navigate(`/jobs/${existingJob.id}`)} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
        <HardHat className="mr-1 h-4 w-4" />Open Job
      </Button>
    );
  }

  return (
    <Button variant="outline" disabled={creating} onClick={async () => {
      setCreating(true);
      try {
        const { createJob } = await import('@/lib/jobStore');
        const job = await createJob({
          estimate_id: estimateDbId,
          job_title: `TVIK Job - ${estimate.client_name || estimate.project_address || estimate.estimate_id}`,
          property_address: estimate.project_address || '',
          client_name: estimate.client_name || '',
          client_email: estimate.client_email || '',
          client_phone: estimate.client_phone || '',
        });
        toast({ title: 'Job created', description: job.job_id });
        navigate(`/jobs/${job.id}`);
      } catch (e: any) {
        toast({ title: 'Error creating job', description: e.message, variant: 'destructive' });
        setCreating(false);
      }
    }} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
      <HardHat className="mr-1 h-4 w-4" />{creating ? 'Creating…' : 'Create Job'}
    </Button>
  );
}
