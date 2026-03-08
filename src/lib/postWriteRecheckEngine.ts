import { supabase } from '@/integrations/supabase/client';
import { saveHealthCheck, type EstimateHealthCheck, type WarningLevel, type ConfidenceRollup } from './healthCheckStore';
import { insertSuggestions, type AISuggestion } from './suggestionStore';

const getUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
};

// ─── Types ───

export interface PostWriteRecheckInput {
  estimate_id: string;
  estimate_version: string;
  current_status: string;
  related_execution_id: string;
  related_write_plan_id: string;
  // Current estimate content
  current_line_items_count: number;
  current_exclusions: string;
  current_allowances: string;
  current_assumptions: string;
  current_risk_notes: string;
  current_missing_info: string;
  // Merged evidence
  merged_scope_summary: string;
  merged_visible_facts: string;
  merged_inferences: string;
  merged_needs_verification: string;
  merged_risks: string;
  merged_trade_detection: string;
  current_confidence: string;
  // Prior state
  prior_health_check_id: string;
  prior_blocking_reason: string;
  prior_completeness_score: number;
  // Site visit
  site_visit_required: boolean;
}

export interface PostWriteRecheckResult {
  completeness_score: number;
  missing_scope_categories: string[];
  mismatches: string[];
  warning_level: WarningLevel;
  block_approval: boolean;
  blocking_reason: string;
  human_fix_required: boolean;
  override_allowed: boolean;
  override_reason_required: boolean;
  site_visit_recommended: boolean;
  resolution_summary: string;
  health_status: 'Good' | 'Review Needed' | 'High Risk';
  queue_items_created: number;
  confidence_rollup: ConfidenceRollup;
}

// ─── Deterministic recheck logic ───

export async function runPostWriteRecheck(
  input: PostWriteRecheckInput,
): Promise<PostWriteRecheckResult> {
  const userId = await getUserId();
  const missingCategories: string[] = [];
  const mismatches: string[] = [];
  const unresolvedIssues: Array<{ type: string; value: string; reason: string }> = [];

  // 1. Check line items coverage
  if (input.current_line_items_count === 0) {
    missingCategories.push('Line Items');
    mismatches.push('No line items present despite merged scope evidence');
  }

  // 2. Check merged evidence vs current content
  if (input.merged_risks && !input.current_risk_notes) {
    missingCategories.push('Risk Notes');
    mismatches.push('Merged risks exist but no risk notes in estimate');
    unresolvedIssues.push({
      type: 'risk_note',
      value: 'Risk notes missing despite merged risk evidence',
      reason: 'Merged analysis identified risks but no risk notes exist on the estimate',
    });
  }

  if (input.merged_needs_verification && !input.current_assumptions) {
    missingCategories.push('Assumptions');
    mismatches.push('Items needing verification but no assumptions documented');
    unresolvedIssues.push({
      type: 'assumption',
      value: 'Assumptions needed for items requiring verification',
      reason: 'Merged analysis flagged items needing verification but no assumptions exist',
    });
  }

  if (input.merged_scope_summary && input.current_line_items_count < 3 && input.merged_scope_summary.length > 100) {
    missingCategories.push('Scope Coverage');
    mismatches.push('Detailed merged scope but very few line items');
  }

  if (input.merged_trade_detection && !input.current_exclusions) {
    missingCategories.push('Exclusions');
    unresolvedIssues.push({
      type: 'exclusion',
      value: 'No exclusions defined despite multi-trade detection',
      reason: 'Multiple trades detected but no exclusions documented to clarify scope boundaries',
    });
  }

  if (!input.current_allowances && input.merged_inferences) {
    missingCategories.push('Allowances');
  }

  if (input.current_missing_info && input.current_missing_info.length > 10) {
    missingCategories.push('Unanswered Questions');
    mismatches.push('Missing info questions still present');
  }

  // 3. Site visit recommendation
  const siteVisitRecommended = input.site_visit_required ||
    (input.merged_needs_verification && input.merged_needs_verification.length > 50) ||
    (input.merged_risks && input.merged_risks.toLowerCase().includes('water') && !input.current_risk_notes.toLowerCase().includes('water')) ||
    (input.merged_risks && input.merged_risks.toLowerCase().includes('structural') && !input.current_risk_notes.toLowerCase().includes('structural'));

  // 4. Completeness score
  const totalChecks = 7; // line items, risks, assumptions, exclusions, allowances, scope coverage, missing info
  const passedChecks = totalChecks - missingCategories.length;
  const completenessScore = Math.round((passedChecks / totalChecks) * 100);

  // 5. Resolution of prior issues
  let resolutionSummary = '';
  if (input.prior_blocking_reason) {
    if (mismatches.length === 0) {
      resolutionSummary = `Prior issue resolved: "${input.prior_blocking_reason}" — all checks now pass.`;
    } else if (completenessScore > input.prior_completeness_score) {
      resolutionSummary = `Partially resolved: "${input.prior_blocking_reason}" — score improved from ${input.prior_completeness_score}% to ${completenessScore}%. ${mismatches.length} issue(s) remain.`;
    } else {
      resolutionSummary = `Unresolved: "${input.prior_blocking_reason}" — ${mismatches.length} issue(s) remain.`;
    }
  } else {
    resolutionSummary = mismatches.length === 0
      ? 'Post-write check passed. No material issues detected.'
      : `Post-write check found ${mismatches.length} remaining issue(s).`;
  }

  // 6. Warning level & blocking
  let warningLevel: WarningLevel = 'Low';
  let blockApproval = false;
  let blockingReason = '';
  let humanFixRequired = false;

  if (missingCategories.length >= 4) {
    warningLevel = 'High';
    blockApproval = true;
    blockingReason = `${missingCategories.length} scope categories still missing: ${missingCategories.join(', ')}`;
    humanFixRequired = true;
  } else if (missingCategories.length >= 2) {
    warningLevel = 'Medium';
    blockingReason = `${missingCategories.length} scope categories need attention: ${missingCategories.join(', ')}`;
  }

  // 7. Health status
  let healthStatus: 'Good' | 'Review Needed' | 'High Risk' = 'Good';
  if (warningLevel === 'High') healthStatus = 'High Risk';
  else if (warningLevel === 'Medium') healthStatus = 'Review Needed';

  // 8. Confidence rollup
  let confidenceRollup: ConfidenceRollup = 'High';
  if (completenessScore < 60) confidenceRollup = 'Low';
  else if (completenessScore < 85) confidenceRollup = 'Medium';

  // 9. Save health check record
  const healthCheckId = crypto.randomUUID();
  await saveHealthCheck({
    health_check_id: healthCheckId,
    estimate_id: input.estimate_id,
    estimate_version: input.estimate_version,
    block_source: 'post_apply_check',
    warning_level: warningLevel,
    block_approval: blockApproval,
    blocking_reason: blockingReason,
    human_fix_required: humanFixRequired,
    override_allowed: true,
    override_reason_required: blockApproval,
    completeness_score: completenessScore,
    missing_scope_categories: JSON.stringify(missingCategories),
    mismatch_summary: mismatches.join('; '),
    site_visit_recommended: !!siteVisitRecommended,
    confidence_rollup: confidenceRollup,
    resolution_summary: resolutionSummary,
    prior_health_check_id: input.prior_health_check_id,
    related_execution_id: input.related_execution_id,
    related_write_plan_id: input.related_write_plan_id,
  } as any);

  // 10. Create queue items for unresolved material issues
  let queueItemsCreated = 0;
  if (unresolvedIssues.length > 0) {
    const batchId = crypto.randomUUID();
    const newSuggestions: any[] = unresolvedIssues.map(issue => ({
      estimate_id: input.estimate_id,
      user_id: userId,
      suggestion_type: issue.type as any,
      source_type: 'merged' as any,
      confidence: 'Medium' as any,
      evidence_summary: issue.reason,
      reason_for_suggestion: issue.reason,
      apply_target: issue.type,
      suggested_value: issue.value,
      status: 'pending',
      decision_state: 'pending',
      suggestion_batch_id: batchId,
      idempotency_key: `post_write_${input.related_execution_id}_${issue.type}`,
      estimate_version: input.estimate_version,
      block_name: 'post_write_recheck',
      schema_version: 'v1',
      severity_level: 'Medium',
      priority_level: 'Medium',
      queue_group: 'Post-Write Issues',
      source_refs: '',
      supersedes_suggestion_id: '',
      reviewer_notes: '',
      approved_by: '',
      edited_value: '',
      area_id: null,
      suggestion_id: crypto.randomUUID(),
      requires_reapproval_if_applied: true,
      source_timestamp: new Date().toISOString(),
    }));
    await insertSuggestions(newSuggestions);
    queueItemsCreated = newSuggestions.length;
  }

  // 11. Update estimate-level health fields
  await supabase
    .from('estimates')
    .update({
      ai_estimate_health_status: healthStatus,
      estimate_site_visit_recommended: !!siteVisitRecommended,
      estimate_confidence_rollup: confidenceRollup,
      estimate_completeness_summary: `Score: ${completenessScore}%. ${mismatches.length} issue(s). ${resolutionSummary}`,
      completeness_score: completenessScore,
      review_blocked: blockApproval,
      review_block_reason: blockingReason,
      override_required: humanFixRequired,
    })
    .eq('id', input.estimate_id);

  return {
    completeness_score: completenessScore,
    missing_scope_categories: missingCategories,
    mismatches,
    warning_level: warningLevel,
    block_approval: blockApproval,
    blocking_reason: blockingReason,
    human_fix_required: humanFixRequired,
    override_allowed: true,
    override_reason_required: blockApproval,
    site_visit_recommended: !!siteVisitRecommended,
    resolution_summary: resolutionSummary,
    health_status: healthStatus,
    queue_items_created: queueItemsCreated,
    confidence_rollup: confidenceRollup,
  };
}
