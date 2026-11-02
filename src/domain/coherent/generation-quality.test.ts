import { describe, it, expect } from 'vitest';
import { fixture, candidate, NOW } from '../../../tests/coherent-fixtures';
import { prepareJob } from './workspace';
import { parseDraft, parseAssessment } from './contract';
import { canonical, hash } from './hash';

describe('observed generation contract defects · authored diagnostics', () => {
  it('rejects fresh instruction echoes without rewriting historical or human text', () => {
    const w = fixture(),
      j = prepareJob(w, w.gardens[0]!.id, 'blend', NOW);
    for (const [field, value] of [
      ['core', 'rule'],
      ['example', 'action, alternative, consequence'],
      ['experience', 'context-tuple-2'],
    ]) {
      const raw = JSON.stringify({ ...candidate(j), [field!]: value });
      expect(() => parseDraft(raw, j, 'generated')).toThrow('Instruction placeholder');
      expect(parseDraft(raw, j)).toEqual(JSON.parse(raw));
    }
  });
  it('accepts schema-valid empty limitations, binding the untouched raw response to this draft', () => {
    const w = fixture(),
      j = prepareJob(w, w.gardens[0]!.id, 'blend', NOW);
    j.draft = candidate(j);
    const raw = '{"decision":"pass","findings":[],"limitations":""}';
    const a = parseAssessment(raw, j, NOW);
    expect(a.raw).toBe(raw);
    expect(a.revisionHash).toBe(hash(canonical(j.draft)));
    expect(a.contextHash).toBe(j.pack.hash);
    expect(a.limitations).toBe('');
  });
  it('still rejects a pass with findings and a refusal without a concrete finding', () => {
    const w = fixture(),
      j = prepareJob(w, w.gardens[0]!.id, 'blend', NOW);
    j.draft = candidate(j);
    const finding = {
      field: 'core',
      issue: 'Changes the source rule.',
      evidence: ['e0'],
      missing: '',
    };
    expect(() =>
      parseAssessment(
        JSON.stringify({ decision: 'pass', findings: [finding], limitations: '' }),
        j,
        NOW,
      ),
    ).toThrow('unresolved findings');
    expect(() =>
      parseAssessment(
        JSON.stringify({ decision: 'needs_revision', findings: [], limitations: '' }),
        j,
        NOW,
      ),
    ).toThrow('concrete finding');
  });
});
