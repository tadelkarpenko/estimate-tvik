import { describe, expect, it } from 'vitest';
import { analyzeScopeMismatch, type ScopeMismatchInput, type ScopeMismatchLineItem } from './scopeMismatchEngine';

const deckEstimate: ScopeMismatchInput = {
  project_category: 'Exterior Renovation',
  scope_class: 'Single-Trade Scope',
  project_name: 'Deck staining and refinishing',
};

const windowsDoorsEstimate: ScopeMismatchInput = {
  project_category: 'Windows / Doors',
  scope_class: 'Replacement / Install',
  project_name: 'Replace windows and exterior door',
};

function item(description: string, phase = 'Other'): ScopeMismatchLineItem {
  return { description, phase, source: 'CostLibrary' };
}

describe('analyzeScopeMismatch', () => {
  it('warns when deck staining includes unrelated trades', () => {
    const warnings = analyzeScopeMismatch(deckEstimate, [
      item('HVAC rough-in', 'HVAC'),
      item('Plumbing relocation', 'Plumbing'),
      item('Drywall patch and finish', 'Drywall'),
      item('Electrical outlets', 'Electrical'),
      item('Framing repairs', 'Framing'),
      item('Flooring Labor', 'Flooring'),
    ]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].service).toBe('deck_staining');
    expect(warnings[0].mismatchedTrades).toEqual(expect.arrayContaining([
      'HVAC',
      'Plumbing',
      'Drywall',
      'Electrical',
      'Framing',
      'Flooring',
    ]));
  });

  it('does not warn when deck staining includes expected scope only', () => {
    const warnings = analyzeScopeMismatch(deckEstimate, [
      item('Power wash deck surface'),
      item('Sanding and surface prep'),
      item('Stain and sealer application'),
      item('Masking and protection'),
      item('Cleanup'),
    ]);

    expect(warnings).toEqual([]);
  });

  it('warns when windows or doors include unrelated trades', () => {
    const warnings = analyzeScopeMismatch(windowsDoorsEstimate, [
      item('HVAC duct relocation', 'HVAC'),
      item('Plumbing rough-in', 'Plumbing'),
      item('Flooring underlayment', 'Flooring'),
      item('Full drywall install', 'Drywall'),
    ]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].service).toBe('windows_doors');
    expect(warnings[0].mismatchedTrades).toEqual(expect.arrayContaining([
      'HVAC',
      'Plumbing',
      'Flooring',
      'Full drywall',
    ]));
  });

  it('does not warn when windows or doors include expected scope only', () => {
    const warnings = analyzeScopeMismatch(windowsDoorsEstimate, [
      item('Interior trim and casing'),
      item('Flashing tape at rough opening'),
      item('Caulk exterior perimeter'),
      item('Low-expansion foam insulation'),
      item('Disposal of existing window units'),
    ]);

    expect(warnings).toEqual([]);
  });

  it('does not warn for clear full rehab estimates with broad trades', () => {
    const warnings = analyzeScopeMismatch({
      project_type: 'Full Rehab',
      project_category: 'Full Renovation',
      scope_class: 'Full-Scope Multi-Trade',
      job_complexity: 'Full Project',
      project_name: 'Full interior rehab',
    }, [
      item('HVAC replacement', 'HVAC'),
      item('Plumbing rough-in', 'Plumbing'),
      item('Electrical rough-in', 'Electrical'),
    ]);

    expect(warnings).toEqual([]);
  });

  it('does not warn when there are no line items', () => {
    expect(analyzeScopeMismatch(deckEstimate, [])).toEqual([]);
  });
});
