import { useState, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles, Camera, HelpCircle, RefreshCw, CheckCircle, AlertTriangle,
  ChevronDown, ChevronRight, Eye, Shield, Wrench, FileQuestion, MapPin,
  Mic, MicOff, Send, ClipboardList, ListChecks, X, Edit, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { MediaUploader } from '@/components/MediaUploader';
import type { Estimate, EstimateMedia, AIConfidence } from '@/lib/types';
import {
  getSuggestions, insertSuggestions, updateSuggestionStatus, insertAppliedAudit,
  type AISuggestion, type SuggestionType, type SuggestionSourceType,
  SUGGESTION_TYPE_LABELS, SUGGESTION_STATUS_COLORS,
} from '@/lib/suggestionStore';
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

const QUICK_TAGS = ['Demo', 'Plumbing', 'Electrical', 'Paint', 'Flooring', 'Structural', 'Water Damage', 'Unknown'];

// Map findings sections to suggestion types and apply targets
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

export function AIIntakePanel({ estimate, estimateDbId, media, onUpdate, onSave, onMediaChange }: AIIntakePanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [findings, setFindings] = useState<IntakeFindings | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary', 'findings', 'questions']));
  const [intakeLog, setIntakeLog] = useState<Array<{ role: 'user' | 'system'; text: string }>>([]);
  const [activeTab, setActiveTab] = useState('intake');

  // Voice state
  const [voiceTranscript, setVoiceTranscript] = useState(estimate.voice_transcript_raw || '');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // Review queue state
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const isApproved = estimate.status === 'Accepted';

  // Load suggestions when estimateDbId changes
  useEffect(() => {
    if (estimateDbId) {
      getSuggestions(estimateDbId).then(setSuggestions).catch(console.error);
    }
  }, [estimateDbId]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const determineWorkflow = (): string => {
    const hasExistingData = (estimate.subtotal ?? 0) > 0 || (estimate.ai_intake_summary ?? '').length > 0;
    const hasNewPhotos = media.length > (estimate.photo_count ?? 0);
    if (hasExistingData && hasNewPhotos) return 'revision_check';
    if (hasExistingData) return 'completeness_check';
    return 'intake_fresh';
  };

  const callIntakeAI = useCallback(async (workflow?: string) => {
    setLoading(true);
    const mode = workflow || determineWorkflow();
    const combinedInput = [
      userInput.trim(),
      voiceTranscript.trim() ? `\n\n[Voice Transcript]:\n${voiceTranscript.trim()}` : '',
      selectedTags.size > 0 ? `\n\n[Quick Tags]: ${Array.from(selectedTags).join(', ')}` : '',
    ].filter(Boolean).join('');

    if (combinedInput) {
      setIntakeLog(prev => [...prev, { role: 'user', text: combinedInput.slice(0, 200) + (combinedInput.length > 200 ? '…' : '') }]);
    }

    try {
      const photoAnalyses = media.map(m => ({ caption: m.caption, url: m.file_url }));

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'intake',
          data: {
            workflow: mode,
            project_type: estimate.project_type || '',
            description: estimate.project_name || '',
            notes: estimate.internal_notes || '',
            sqft: estimate.sqft || 0,
            fixture_count: estimate.fixture_count || 0,
            finish_level: estimate.finish_level || 'Basic',
            photo_analyses: photoAnalyses,
            existing_estimate: mode !== 'intake_fresh' ? {
              total_low: estimate.total_low,
              total_high: estimate.total_high,
              line_items_json: estimate.line_items_json,
              assumptions_rich: estimate.assumptions_rich,
              risk_table_json: estimate.risk_table_json,
              ai_intake_summary: estimate.ai_intake_summary,
            } : null,
            user_input: combinedInput || null,
            voice_transcript: voiceTranscript.trim() || null,
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

      setFindings(parsed);
      setIntakeLog(prev => [...prev, { role: 'system', text: `Analysis complete (${parsed.confidence} confidence). ${parsed.intake_summary}` }]);
      setUserInput('');

      // Update estimate with findings (draft fields only)
      const voiceUpdates: Partial<Estimate> = {};
      if (voiceTranscript.trim()) {
        (voiceUpdates as any).voice_transcript_raw = voiceTranscript;
        (voiceUpdates as any).voice_transcript_cleaned = voiceTranscript; // simplified for V1
        (voiceUpdates as any).voice_last_updated_at = new Date().toISOString();
      }

      onUpdate({
        ai_intake_summary: parsed.intake_summary || '',
        visible_findings: parsed.visible_findings || '',
        likely_scope_items: parsed.likely_scope_items || '',
        possible_hidden_risks: parsed.possible_hidden_risks || '',
        missing_info_questions: parsed.missing_info_questions || '',
        suggested_allowances: parsed.suggested_allowances || '',
        suggested_exclusions: parsed.suggested_exclusions || '',
        suggested_assumptions: parsed.suggested_assumptions || '',
        suggested_line_items: parsed.suggested_line_items || '',
        ai_detected_trades: parsed.suggested_trades || '',
        site_visit_required: parsed.site_visit_required ?? false,
        ai_scope_confidence: parsed.confidence || 'Medium',
        photo_count: media.length,
        intake_last_updated_at: new Date().toISOString(),
        revision_needed_warning: mode === 'revision_check' && parsed.confidence !== 'High',
        ...voiceUpdates,
      } as any);

      toast({ title: 'Intake analysis complete', description: `Confidence: ${parsed.confidence}` });
    } catch (e: any) {
      toast({ title: 'Intake analysis failed', description: e.message, variant: 'destructive' });
      setIntakeLog(prev => [...prev, { role: 'system', text: `Error: ${e.message}. You can still proceed with manual intake.` }]);
    } finally {
      setLoading(false);
    }
  }, [estimate, media, userInput, voiceTranscript, selectedTags, onUpdate, toast]);

  // ─── Send to Review Queue ───
  const sendToReviewQueue = async () => {
    if (!findings || !estimateDbId) {
      toast({ title: 'Cannot send to queue', description: 'Run analysis first and save the estimate.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const sourceType: SuggestionSourceType = voiceTranscript.trim()
        ? (media.length > 0 ? 'merged' : 'voice')
        : (media.length > 0 ? 'photo' : 'text');

      const newSuggestions: any[] = [];

      for (const mapping of FINDINGS_TO_SUGGESTIONS) {
        const value = findings[mapping.findingsKey];
        if (typeof value === 'string' && value.trim()) {
          // Split bullet items into individual suggestions
          const items = value.split(/\n/).filter(l => l.trim().startsWith('-') || l.trim().startsWith('•') || l.trim().match(/^\d+\./));
          if (items.length > 0) {
            for (const item of items) {
              const cleanItem = item.replace(/^[-•\d.)\s]+/, '').trim();
              if (!cleanItem) continue;
              newSuggestions.push({
                suggestion_id: crypto.randomUUID(),
                estimate_id: estimateDbId,
                source_type: sourceType,
                suggestion_type: mapping.type,
                confidence: findings.confidence,
                evidence_summary: findings.intake_summary || '',
                reason_for_suggestion: `AI Intake (${sourceType}) — ${mapping.type}`,
                suggested_value: cleanItem,
                apply_target: mapping.target,
                status: 'pending',
                reviewer_notes: '',
                approved_by: '',
                edited_value: '',
              });
            }
          } else {
            // Single block value
            newSuggestions.push({
              suggestion_id: crypto.randomUUID(),
              estimate_id: estimateDbId,
              source_type: sourceType,
              suggestion_type: mapping.type,
              confidence: findings.confidence,
              evidence_summary: findings.intake_summary || '',
              reason_for_suggestion: `AI Intake (${sourceType}) — ${mapping.type}`,
              suggested_value: value.trim(),
              apply_target: mapping.target,
              status: 'pending',
              reviewer_notes: '',
              approved_by: '',
              edited_value: '',
            });
          }
        }
      }

      // Site visit recommendation
      if (findings.site_visit_required) {
        newSuggestions.push({
          suggestion_id: crypto.randomUUID(),
          estimate_id: estimateDbId,
          source_type: sourceType,
          suggestion_type: 'site_visit_recommendation',
          confidence: findings.confidence,
          evidence_summary: findings.intake_summary || '',
          reason_for_suggestion: 'AI confidence is low or hidden conditions are likely.',
          suggested_value: 'Site visit recommended before finalizing scope.',
          apply_target: 'site_visit_required',
          status: 'pending',
          reviewer_notes: '',
          approved_by: '',
          edited_value: '',
        });
      }

      await insertSuggestions(newSuggestions);
      const updated = await getSuggestions(estimateDbId);
      setSuggestions(updated);
      setActiveTab('queue');
      toast({ title: 'Sent to review queue', description: `${newSuggestions.length} suggestions queued for review.` });
    } catch (e: any) {
      toast({ title: 'Queue error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Apply Approved Suggestions ───
  const applyApprovedSuggestions = async () => {
    if (!estimateDbId) return;

    const approvable = suggestions.filter(s => s.status === 'approved' || s.status === 'edited');
    if (approvable.length === 0) {
      toast({ title: 'Nothing to apply', description: 'Approve or edit suggestions first.', variant: 'destructive' });
      return;
    }

    if (isApproved) {
      toast({
        title: 'Approved Estimate — Review Required',
        description: 'Suggestions saved as advisory. They will NOT overwrite approved values.',
        variant: 'destructive',
      });
    }

    setLoading(true);
    try {
      const updates: Partial<Estimate> = {};
      const auditEntries: any[] = [];

      for (const s of approvable) {
        const value = s.status === 'edited' && s.edited_value ? s.edited_value : s.suggested_value;
        const target = s.apply_target;

        // Map to estimate support fields — never overwrite pricing
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

        // Mark as applied
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
        });
      }

      updates.ai_apply_status = 'Draft Applied' as any;
      onUpdate(updates);

      if (auditEntries.length > 0) {
        await insertAppliedAudit(auditEntries);
      }

      await onSave();
      const updated = await getSuggestions(estimateDbId);
      setSuggestions(updated);
      toast({ title: 'Applied', description: `${approvable.length} suggestions applied to estimate support fields. Audit trail created.` });
    } catch (e: any) {
      toast({ title: 'Apply failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
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

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  };

  const confidenceBadge = (level: AIConfidence) => {
    const colors: Record<AIConfidence, string> = {
      High: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      Medium: 'bg-amber-100 text-amber-800 border-amber-300',
      Low: 'bg-red-100 text-red-800 border-red-300',
    };
    return <Badge variant="outline" className={`${colors[level]} text-xs`}>{level} Confidence</Badge>;
  };

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
    return (
      <div className="prose prose-sm max-w-none text-foreground text-xs">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  };

  const pendingCount = suggestions.filter(s => s.status === 'pending').length;
  const approvedCount = suggestions.filter(s => s.status === 'approved' || s.status === 'edited').length;

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
            {findings && confidenceBadge(findings.confidence)}
            {pendingCount > 0 && (
              <Badge variant="secondary" className="text-xs">{pendingCount} pending</Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          AI suggestions are draft recommendations. All changes go through review queue before applying.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2 grid grid-cols-3 h-8">
          <TabsTrigger value="intake" className="text-xs">Intake</TabsTrigger>
          <TabsTrigger value="queue" className="text-xs">
            Queue {pendingCount > 0 && `(${pendingCount})`}
          </TabsTrigger>
          <TabsTrigger value="findings" className="text-xs">Findings</TabsTrigger>
        </TabsList>

        {/* ═══ INTAKE TAB ═══ */}
        <TabsContent value="intake" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Warnings */}
              {isApproved && (
                <Card className="border-amber-300 bg-amber-50">
                  <CardContent className="py-2 px-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-800">This estimate is Approved. AI findings are advisory only.</p>
                  </CardContent>
                </Card>
              )}

              {findings?.site_visit_required && (
                <Card className="border-red-300 bg-red-50">
                  <CardContent className="py-2 px-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-red-600 flex-shrink-0" />
                    <p className="text-xs text-red-800"><strong>Site visit recommended.</strong> Confidence too low for reliable remote scope assessment.</p>
                  </CardContent>
                </Card>
              )}

              {/* Photo Upload */}
              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5" /> Photos ({media.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  {estimateDbId ? (
                    <MediaUploader
                      folder="estimates"
                      onUploaded={async () => {
                        onMediaChange();
                        onUpdate({ photo_count: (estimate.photo_count ?? 0) + 1 });
                      }}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">Save the estimate first to enable photo upload.</p>
                  )}
                  {media.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {media.slice(0, 6).map(m => (
                        <div key={m.id} className="w-12 h-12 rounded border overflow-hidden">
                          <img src={m.file_url} alt={m.caption} className="w-full h-full object-cover" />
                        </div>
                      ))}
                      {media.length > 6 && <span className="text-xs text-muted-foreground self-center">+{media.length - 6} more</span>}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Text Input */}
              <Card>
                <CardContent className="py-3 px-3 space-y-2">
                  <Label className="text-xs font-medium">Typed Notes</Label>
                  <Textarea
                    value={userInput}
                    onChange={e => setUserInput(e.target.value)}
                    placeholder="Describe the project, paste client notes, room-by-room details..."
                    className="text-xs min-h-[60px]"
                    disabled={loading}
                  />
                </CardContent>
              </Card>

              {/* Voice Transcript Area */}
              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <Mic className="h-3.5 w-3.5" /> Voice Transcript
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  <Textarea
                    value={voiceTranscript}
                    onChange={e => setVoiceTranscript(e.target.value)}
                    placeholder="Paste or dictate your walkthrough transcript here. Future: live recording will be added."
                    className="text-xs min-h-[80px]"
                    disabled={loading}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setVoiceTranscript('')} disabled={loading || !voiceTranscript} className="text-xs h-7">
                      <X className="h-3 w-3 mr-1" />Clear
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Paste walkthrough transcript or voice dictation output. Recording support coming soon.</p>
                </CardContent>
              </Card>

              {/* Quick Tags */}
              <Card>
                <CardContent className="py-3 px-3 space-y-2">
                  <Label className="text-xs font-medium">Quick Tags</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_TAGS.map(tag => (
                      <Badge
                        key={tag}
                        variant={selectedTags.has(tag) ? 'default' : 'outline'}
                        className="text-xs cursor-pointer select-none"
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" onClick={() => callIntakeAI()} disabled={loading} className="text-xs h-8">
                  <Sparkles className="h-3 w-3 mr-1" />{loading ? 'Analyzing…' : 'Analyze'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => callIntakeAI('intake_fresh')} disabled={loading} className="text-xs h-8">
                  <HelpCircle className="h-3 w-3 mr-1" />Ask Questions
                </Button>
                <Button size="sm" variant="outline" onClick={() => callIntakeAI('completeness_check')} disabled={loading} className="text-xs h-8">
                  <RefreshCw className="h-3 w-3 mr-1" />Check Completeness
                </Button>
                <Button size="sm" variant="outline" onClick={sendToReviewQueue} disabled={loading || !findings} className="text-xs h-8">
                  <Send className="h-3 w-3 mr-1" />Send to Queue
                </Button>
                <Button size="sm" variant="outline" onClick={() => onUpdate({ site_visit_required: true })} className="text-xs h-8">
                  <MapPin className="h-3 w-3 mr-1" />Mark Site Visit
                </Button>
              </div>

              {/* Intake Log */}
              {intakeLog.length > 0 && (
                <Card>
                  <CardHeader className="py-2 px-3"><CardTitle className="text-xs">Intake Log</CardTitle></CardHeader>
                  <CardContent className="px-3 pb-3 space-y-1.5 max-h-[150px] overflow-y-auto">
                    {intakeLog.map((entry, i) => (
                      <div key={i} className={`text-xs p-1.5 rounded ${entry.role === 'user' ? 'bg-primary/10 ml-4' : 'bg-muted mr-4'}`}>
                        {entry.text}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ═══ REVIEW QUEUE TAB ═══ */}
        <TabsContent value="queue" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {/* Apply button */}
              {approvedCount > 0 && (
                <Button onClick={applyApprovedSuggestions} disabled={loading} className="w-full text-xs h-8">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Apply {approvedCount} Approved Suggestion{approvedCount !== 1 ? 's' : ''}
                </Button>
              )}

              {suggestions.length === 0 && (
                <div className="text-center py-8">
                  <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">No suggestions in queue. Run Analyze then Send to Queue.</p>
                </div>
              )}

              {/* Group by type */}
              {Object.entries(
                suggestions.reduce<Record<string, AISuggestion[]>>((acc, s) => {
                  (acc[s.suggestion_type] = acc[s.suggestion_type] || []).push(s);
                  return acc;
                }, {})
              ).map(([type, items]) => (
                <Card key={type}>
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs flex items-center gap-2">
                      {SUGGESTION_TYPE_LABELS[type as SuggestionType] || type}
                      <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-2">
                    {items.map(s => (
                      <div key={s.id} className="border rounded p-2 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs text-foreground flex-1">
                            {editingSuggestionId === s.id ? (
                              <Textarea
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                className="text-xs min-h-[40px]"
                              />
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
                        </div>
                        {s.status === 'pending' && (
                          <div className="flex gap-1 pt-1">
                            <Button size="sm" variant="outline" onClick={() => handleApproveSuggestion(s)} className="text-xs h-6 px-2">
                              <ThumbsUp className="h-3 w-3 mr-1" />Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleEditSuggestion(s)} className="text-xs h-6 px-2">
                              <Edit className="h-3 w-3 mr-1" />Edit
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleRejectSuggestion(s)} className="text-xs h-6 px-2">
                              <ThumbsDown className="h-3 w-3 mr-1" />Reject
                            </Button>
                          </div>
                        )}
                        {editingSuggestionId === s.id && (
                          <div className="flex gap-1 pt-1">
                            <Button size="sm" onClick={() => handleSaveEdit(s)} className="text-xs h-6 px-2">Save Edit</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingSuggestionId(null)} className="text-xs h-6 px-2">Cancel</Button>
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

        {/* ═══ FINDINGS TAB ═══ */}
        <TabsContent value="findings" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {findings ? (
                <>
                  <div>
                    <SectionHeader id="summary" icon={Sparkles} title="Summary" badge={confidenceBadge(findings.confidence)} />
                    {expandedSections.has('summary') && (
                      <Card className="mt-1"><CardContent className="py-2 px-3">
                        <FindingSection content={findings.intake_summary} />
                      </CardContent></Card>
                    )}
                  </div>
                  <div>
                    <SectionHeader id="findings" icon={Eye} title="Visible Findings" />
                    {expandedSections.has('findings') && (
                      <Card className="mt-1"><CardContent className="py-2 px-3">
                        <FindingSection content={findings.visible_findings} />
                      </CardContent></Card>
                    )}
                  </div>
                  <div>
                    <SectionHeader id="scope" icon={Wrench} title="Likely Scope Items" />
                    {expandedSections.has('scope') && (
                      <Card className="mt-1"><CardContent className="py-2 px-3">
                        <FindingSection content={findings.likely_scope_items} />
                      </CardContent></Card>
                    )}
                  </div>
                  <div>
                    <SectionHeader id="risks" icon={Shield} title="Possible Hidden Risks" />
                    {expandedSections.has('risks') && (
                      <Card className="mt-1"><CardContent className="py-2 px-3">
                        <FindingSection content={findings.possible_hidden_risks} />
                      </CardContent></Card>
                    )}
                  </div>
                  <div>
                    <SectionHeader id="questions" icon={FileQuestion} title="Missing Information" />
                    {expandedSections.has('questions') && (
                      <Card className="mt-1"><CardContent className="py-2 px-3">
                        <FindingSection content={findings.missing_info_questions} />
                      </CardContent></Card>
                    )}
                  </div>
                  {findings.suggested_trades && (
                    <div>
                      <SectionHeader id="trades" icon={Wrench} title="Suggested Trades" />
                      {expandedSections.has('trades') && (
                        <Card className="mt-1"><CardContent className="py-2 px-3">
                          <div className="flex flex-wrap gap-1">
                            {findings.suggested_trades.split(',').map((t, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{t.trim()}</Badge>
                            ))}
                          </div>
                        </CardContent></Card>
                      )}
                    </div>
                  )}
                  <div>
                    <SectionHeader id="inserts" icon={Sparkles} title="Suggested Items / Allowances / Exclusions" />
                    {expandedSections.has('inserts') && (
                      <Card className="mt-1"><CardContent className="py-2 px-3 space-y-2">
                        {findings.suggested_line_items && <div><p className="text-xs font-medium text-muted-foreground mb-1">Line Items (Draft)</p><FindingSection content={findings.suggested_line_items} /></div>}
                        {findings.suggested_allowances && <div><p className="text-xs font-medium text-muted-foreground mb-1">Allowances</p><FindingSection content={findings.suggested_allowances} /></div>}
                        {findings.suggested_exclusions && <div><p className="text-xs font-medium text-muted-foreground mb-1">Exclusions</p><FindingSection content={findings.suggested_exclusions} /></div>}
                        {findings.suggested_assumptions && <div><p className="text-xs font-medium text-muted-foreground mb-1">Assumptions</p><FindingSection content={findings.suggested_assumptions} /></div>}
                      </CardContent></Card>
                    )}
                  </div>

                  {/* Site Visit Toggle */}
                  <div className="flex items-center gap-2 py-2">
                    <Switch
                      checked={estimate.site_visit_required ?? findings.site_visit_required}
                      onCheckedChange={v => onUpdate({ site_visit_required: v })}
                    />
                    <Label className="text-xs">Mark: Site Visit Required</Label>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Upload photos, enter notes or voice transcript, then click <strong>Analyze</strong>.
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
