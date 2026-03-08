import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Sparkles, Camera, HelpCircle, RefreshCw, CheckCircle, AlertTriangle,
  ChevronDown, ChevronRight, X, Eye, Shield, Wrench, FileQuestion, MapPin,
} from 'lucide-react';
import { MediaUploader } from '@/components/MediaUploader';
import type { Estimate, EstimateMedia, AIConfidence } from '@/lib/types';
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

export function AIIntakePanel({ estimate, estimateDbId, media, onUpdate, onSave, onMediaChange }: AIIntakePanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [findings, setFindings] = useState<IntakeFindings | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary', 'findings', 'questions']));
  const [intakeLog, setIntakeLog] = useState<Array<{ role: 'user' | 'system'; text: string }>>([]);

  const isApproved = estimate.status === 'Accepted';

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

    if (userInput.trim()) {
      setIntakeLog(prev => [...prev, { role: 'user', text: userInput }]);
    }

    try {
      // Gather photo analyses if available
      const photoAnalyses = media.map(m => ({
        caption: m.caption,
        url: m.file_url,
      }));

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
            user_input: userInput.trim() || null,
          },
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const { content } = await resp.json();

      // Parse JSON response
      let parsed: IntakeFindings;
      try {
        // Try to extract JSON from possible markdown wrapping
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        const raw = jsonMatch ? jsonMatch[1] : content;
        parsed = JSON.parse(raw);
      } catch {
        // Fallback: treat entire response as summary
        parsed = {
          visible_findings: '',
          likely_scope_items: '',
          possible_hidden_risks: '',
          missing_info_questions: '',
          suggested_trades: '',
          suggested_allowances: '',
          suggested_exclusions: '',
          suggested_assumptions: '',
          suggested_line_items: '',
          site_visit_required: false,
          confidence: 'Medium',
          intake_summary: content,
        };
      }

      setFindings(parsed);
      setIntakeLog(prev => [...prev, { role: 'system', text: `Analysis complete (${parsed.confidence} confidence). ${parsed.intake_summary}` }]);
      setUserInput('');

      // Update estimate with findings (draft fields only)
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
      });

      toast({ title: 'Intake analysis complete', description: `Confidence: ${parsed.confidence}` });
    } catch (e: any) {
      toast({ title: 'Intake analysis failed', description: e.message, variant: 'destructive' });
      setIntakeLog(prev => [...prev, { role: 'system', text: `Error: ${e.message}. You can still proceed with manual intake.` }]);
    } finally {
      setLoading(false);
    }
  }, [estimate, media, userInput, onUpdate, toast]);

  const handleApplyToEstimate = async () => {
    if (!findings) return;

    if (isApproved) {
      toast({
        title: 'Approved Estimate — Review Required',
        description: 'AI findings have been saved as draft suggestions. They will NOT overwrite approved values. Review manually before making changes.',
        variant: 'destructive',
      });
    }

    onUpdate({
      ai_apply_status: 'Draft Applied',
      // Map to support fields only — not final pricing
      assumptions_rich: estimate.assumptions_rich
        ? `${estimate.assumptions_rich}\n\n--- AI Suggested Assumptions (Draft) ---\n${findings.suggested_assumptions}`
        : `--- AI Suggested Assumptions (Draft) ---\n${findings.suggested_assumptions}`,
      internal_notes: estimate.internal_notes
        ? `${estimate.internal_notes}\n\n--- AI Intake Findings (Draft) ---\n${findings.visible_findings}\n\nHidden Risks: ${findings.possible_hidden_risks}`
        : `--- AI Intake Findings (Draft) ---\n${findings.visible_findings}\n\nHidden Risks: ${findings.possible_hidden_risks}`,
    });

    try {
      await onSave();
      toast({ title: 'Applied to estimate', description: 'Draft findings mapped to support fields. Review before finalizing.' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">AI Intake Assistant</span>
            <Badge variant="outline" className="text-xs">Draft Only</Badge>
          </div>
          {findings && confidenceBadge(findings.confidence)}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          AI suggestions are draft recommendations requiring human review.
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Warnings */}
          {isApproved && (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="py-2 px-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-800">This estimate is Approved. AI findings are advisory only and will not overwrite approved values.</p>
              </CardContent>
            </Card>
          )}

          {findings?.site_visit_required && (
            <Card className="border-red-300 bg-red-50">
              <CardContent className="py-2 px-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-red-600 flex-shrink-0" />
                <p className="text-xs text-red-800"><strong>Site visit recommended.</strong> Confidence is too low for reliable remote scope assessment.</p>
              </CardContent>
            </Card>
          )}

          {estimate.revision_needed_warning && (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="py-2 px-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-800">New information may require estimate revision. Review findings carefully.</p>
              </CardContent>
            </Card>
          )}

          {/* Photo Upload Area */}
          <Card>
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5" /> Photos ({media.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {estimateDbId ? (
                <MediaUploader
                  entityId={estimateDbId}
                  entityType="estimates"
                  onUploadComplete={() => {
                    onMediaChange();
                    onUpdate({ photo_count: media.length + 1 });
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

          {/* Input Area */}
          <Card>
            <CardContent className="py-3 px-3 space-y-2">
              <Textarea
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                placeholder="Describe the project, paste client notes, or ask a question..."
                className="text-xs min-h-[60px]"
                disabled={loading}
              />
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="default" onClick={() => callIntakeAI()} disabled={loading} className="text-xs h-7">
                  <Sparkles className="h-3 w-3 mr-1" />{loading ? 'Analyzing…' : 'Analyze'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => callIntakeAI('intake_fresh')} disabled={loading} className="text-xs h-7">
                  <HelpCircle className="h-3 w-3 mr-1" />Ask Questions
                </Button>
                <Button size="sm" variant="outline" onClick={() => callIntakeAI('completeness_check')} disabled={loading} className="text-xs h-7">
                  <RefreshCw className="h-3 w-3 mr-1" />Check Completeness
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Intake Log */}
          {intakeLog.length > 0 && (
            <Card>
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs">Intake Log</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-1.5 max-h-[150px] overflow-y-auto">
                {intakeLog.map((entry, i) => (
                  <div key={i} className={`text-xs p-1.5 rounded ${entry.role === 'user' ? 'bg-primary/10 ml-4' : 'bg-muted mr-4'}`}>
                    {entry.text}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Findings */}
          {findings && (
            <>
              {/* Summary */}
              <div>
                <SectionHeader id="summary" icon={Sparkles} title="Summary" badge={confidenceBadge(findings.confidence)} />
                {expandedSections.has('summary') && (
                  <Card className="mt-1"><CardContent className="py-2 px-3">
                    <FindingSection content={findings.intake_summary} />
                  </CardContent></Card>
                )}
              </div>

              {/* Visible Findings */}
              <div>
                <SectionHeader id="findings" icon={Eye} title="Visible Findings" />
                {expandedSections.has('findings') && (
                  <Card className="mt-1"><CardContent className="py-2 px-3">
                    <FindingSection content={findings.visible_findings} />
                  </CardContent></Card>
                )}
              </div>

              {/* Scope Items */}
              <div>
                <SectionHeader id="scope" icon={Wrench} title="Likely Scope Items" />
                {expandedSections.has('scope') && (
                  <Card className="mt-1"><CardContent className="py-2 px-3">
                    <FindingSection content={findings.likely_scope_items} />
                  </CardContent></Card>
                )}
              </div>

              {/* Hidden Risks */}
              <div>
                <SectionHeader id="risks" icon={Shield} title="Possible Hidden Risks" />
                {expandedSections.has('risks') && (
                  <Card className="mt-1"><CardContent className="py-2 px-3">
                    <FindingSection content={findings.possible_hidden_risks} />
                  </CardContent></Card>
                )}
              </div>

              {/* Missing Info */}
              <div>
                <SectionHeader id="questions" icon={FileQuestion} title="Missing Information" />
                {expandedSections.has('questions') && (
                  <Card className="mt-1"><CardContent className="py-2 px-3">
                    <FindingSection content={findings.missing_info_questions} />
                  </CardContent></Card>
                )}
              </div>

              {/* Trades */}
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

              {/* Suggested Inserts */}
              <div>
                <SectionHeader id="inserts" icon={Sparkles} title="Suggested Line Items / Allowances / Exclusions" />
                {expandedSections.has('inserts') && (
                  <Card className="mt-1"><CardContent className="py-2 px-3 space-y-2">
                    {findings.suggested_line_items && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Line Items (Draft)</p>
                        <FindingSection content={findings.suggested_line_items} />
                      </div>
                    )}
                    {findings.suggested_allowances && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Allowances</p>
                        <FindingSection content={findings.suggested_allowances} />
                      </div>
                    )}
                    {findings.suggested_exclusions && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Exclusions</p>
                        <FindingSection content={findings.suggested_exclusions} />
                      </div>
                    )}
                    {findings.suggested_assumptions && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Assumptions</p>
                        <FindingSection content={findings.suggested_assumptions} />
                      </div>
                    )}
                  </CardContent></Card>
                )}
              </div>

              {/* Site Visit */}
              <div className="flex items-center gap-2 py-2">
                <Switch
                  checked={estimate.site_visit_required ?? findings.site_visit_required}
                  onCheckedChange={v => onUpdate({ site_visit_required: v })}
                />
                <Label className="text-xs">Mark: Site Visit Required</Label>
              </div>

              {/* Apply Button */}
              <div className="space-y-2">
                <Button
                  onClick={handleApplyToEstimate}
                  disabled={loading}
                  className="w-full text-xs h-8"
                  variant={isApproved ? 'outline' : 'default'}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {isApproved ? 'Save Findings (Advisory Only)' : 'Apply to Estimate (Draft)'}
                </Button>
                {estimate.ai_apply_status === 'Draft Applied' && (
                  <p className="text-xs text-center text-muted-foreground">✓ Draft findings applied — awaiting review</p>
                )}
              </div>
            </>
          )}

          {!findings && !loading && (
            <div className="text-center py-6">
              <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">
                Upload photos, enter project notes, then click <strong>Analyze</strong> to generate structured intake findings.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
