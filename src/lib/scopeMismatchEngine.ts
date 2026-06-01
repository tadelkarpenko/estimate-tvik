import type { EstimateLineItem, ProjectCategory, ProjectType, ScopeClass, JobComplexity } from './types';

export type ScopeMismatchService = 'deck_staining' | 'windows_doors';

export interface ScopeMismatchInput {
  project_type?: ProjectType | string | null;
  project_category?: ProjectCategory | string | null;
  scope_class?: ScopeClass | string | null;
  job_complexity?: JobComplexity | string | null;
  project_name?: string | null;
  public_notes?: string | null;
  internal_notes?: string | null;
  ai_intake_summary?: string | null;
  likely_scope_items?: string | null;
  voice_detected_scope?: string | null;
}

export interface ScopeMismatchLineItem {
  phase?: string | null;
  description?: string | null;
  source?: string | null;
  evidence_source?: string | null;
  notes?: string | null;
}

export interface ScopeMismatchWarning {
  service: ScopeMismatchService;
  serviceLabel: string;
  message: string;
  mismatchedTrades: string[];
  lineItems: Array<{
    description: string;
    phase?: string | null;
    matchedTrades: string[];
  }>;
}

const SERVICE_LABELS: Record<ScopeMismatchService, string> = {
  deck_staining: 'deck staining / refinishing',
  windows_doors: 'windows / doors',
};

const DECK_STAINING_PATTERNS: Array<[string, RegExp]> = [
  ['HVAC', /\b(hvac|duct|furnace|air\s*condition|condenser|thermostat)\b/i],
  ['Plumbing', /\b(plumbing|plumber|pipe|pex|drain|supply\s+line|valve|toilet|faucet)\b/i],
  ['Drywall', /\b(drywall|sheetrock|tape\s+and\s+mud|mud\s+and\s+tape)\b/i],
  ['Electrical', /\b(electrical|electrician|outlet|switch|circuit|panel|breaker|gfci|receptacle)\b/i],
  ['Flooring', /\b(flooring|underlayment|lvp|laminate|carpet|hardwood|floor\s+labor)\b/i],
  ['Framing', /\b(framing|studs?|joists?|wall\s+frame|rough\s+framing)\b/i],
  ['Cabinets', /\b(cabinet|cabinetry|countertop)\b/i],
  ['Tile', /\b(tile|grout|thinset)\b/i],
];

const WINDOWS_DOORS_PATTERNS: Array<[string, RegExp]> = [
  ['HVAC', /\b(hvac|duct|furnace|air\s*condition|condenser|thermostat)\b/i],
  ['Plumbing', /\b(plumbing|plumber|pipe|pex|drain|supply\s+line|valve|toilet|faucet)\b/i],
  ['Flooring', /\b(flooring|underlayment|lvp|laminate|carpet|hardwood|floor\s+labor)\b/i],
  ['Full drywall', /\b(drywall|sheetrock|tape\s+and\s+mud|mud\s+and\s+tape)\b/i],
  ['Broad electrical', /\b(electrical|electrician|outlet|switch|circuit|panel|breaker|gfci|receptacle)\b/i],
  ['Roofing', /\b(roof|roofing|shingle|siding|gutter)\b/i],
  ['Cabinets', /\b(cabinet|cabinetry|countertop)\b/i],
  ['Tile', /\b(tile|grout|thinset)\b/i],
  ['Full framing package', /\b(framing|studs?|joists?|wall\s+frame|rough\s+framing)\b/i],
];

function compactText(values: Array<unknown>): string {
  return values.filter(Boolean).join(' ').toLowerCase();
}

function inferService(input: ScopeMismatchInput): ScopeMismatchService | null {
  const category = String(input.project_category || '').toLowerCase();
  const text = compactText([
    input.project_category,
    input.scope_class,
    input.project_name,
    input.public_notes,
    input.internal_notes,
    input.ai_intake_summary,
    input.likely_scope_items,
    input.voice_detected_scope,
  ]);

  if (/\b(deck|porch)\b/.test(text) && /\b(stain|staining|refinish|refinishing|sealer|seal|power\s*wash|pressure\s*wash)\b/.test(text)) {
    return 'deck_staining';
  }

  if (isClearlyFullRehab(input)) {
    return null;
  }

  if (category === 'windows / doors' || /\b(window|windows|door|doors)\b/.test(text)) {
    return 'windows_doors';
  }

  return null;
}

function isClearlyFullRehab(input: ScopeMismatchInput): boolean {
  return input.project_type === 'Full Rehab'
    && input.project_category === 'Full Renovation'
    && input.scope_class === 'Full-Scope Multi-Trade';
}

function lineItemText(lineItem: ScopeMismatchLineItem): string {
  return compactText([
    lineItem.phase,
    lineItem.description,
    lineItem.source,
    lineItem.evidence_source,
    lineItem.notes,
  ]);
}

function findMismatches(service: ScopeMismatchService, lineItems: ScopeMismatchLineItem[]) {
  const patterns = service === 'deck_staining' ? DECK_STAINING_PATTERNS : WINDOWS_DOORS_PATTERNS;

  return lineItems.flatMap(lineItem => {
    const text = lineItemText(lineItem);
    const matchedTrades = patterns
      .filter(([, pattern]) => pattern.test(text))
      .map(([trade]) => trade);

    if (matchedTrades.length === 0) return [];

    return [{
      description: lineItem.description || lineItem.phase || 'Unnamed line item',
      phase: lineItem.phase,
      matchedTrades,
    }];
  });
}

export function analyzeScopeMismatch(
  estimate: ScopeMismatchInput,
  lineItems: Array<ScopeMismatchLineItem | EstimateLineItem>,
): ScopeMismatchWarning[] {
  if (!lineItems.length) return [];

  const service = inferService(estimate);
  if (!service) return [];

  const mismatchedItems = findMismatches(service, lineItems);
  if (!mismatchedItems.length) return [];

  const mismatchedTrades = Array.from(new Set(mismatchedItems.flatMap(item => item.matchedTrades))).sort();
  const serviceLabel = SERVICE_LABELS[service];

  return [{
    service,
    serviceLabel,
    message: `Review warning: This estimate appears to be ${serviceLabel}, but it includes line items that may belong to other trades. Review before using this in a client proposal.`,
    mismatchedTrades,
    lineItems: mismatchedItems,
  }];
}
