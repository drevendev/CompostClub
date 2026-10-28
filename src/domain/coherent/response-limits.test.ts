import { describe, it, expect } from 'vitest';
import { fixture, candidate, NOW } from '../../../tests/coherent-fixtures';
import { prepareJob } from './workspace';
import { parseDraft, schemaForJob, generationPrompt } from './contract';
import {
  boundedRepairFeedback,
  responseLimitIssues,
  REMOTE_REPAIR_MAX_BYTES,
} from './response-limits';
import { planAdmission } from './admission';
import { canonical, hash } from './hash';
function prepared() {
  const w = fixture();
  w.provider = { kind: 'claude', revision: 1, model: 'sonnet' };
  return prepareJob(w, w.gardens[0]!.id, 'blend', NOW);
}
describe('provider-2 response limits · authored diagnostics, no model', () => {
  it('reports every observed length/count violation without including any content', () => {
    const j = prepared(),
      c = candidate(j);
    c.summary = 'X'.repeat(385);
    c.interaction = 'Y'.repeat(294);
    c.contributions.push({ ...c.contributions[0]! });
    const raw = JSON.stringify({ ...c, PRIVATE_SENTINEL_KEY: 'PRIVATE_SENTINEL_VALUE' });
    const issues = responseLimitIssues(JSON.parse(raw), schemaForJob(j));
    expect(issues).toEqual(
      expect.arrayContaining([
        { path: '$.summary', rule: 'maxLength', actual: 385, limit: 360 },
        { path: '$.interaction', rule: 'maxLength', actual: 294, limit: 240 },
        { path: '$.contributions', rule: 'maxItems', actual: 3, limit: 2 },
      ]),
    );
    const repair = boundedRepairFeedback(raw, schemaForJob(j));
    expect(repair).toContain('$.interaction maxLength 294/240');
    expect(repair).toContain('$.contributions maxItems 3/2');
    expect(repair).not.toContain('PRIVATE_SENTINEL');
    expect(new TextEncoder().encode(repair).length).toBeLessThanOrEqual(REMOTE_REPAIR_MAX_BYTES);
  });
  it('uses Unicode lengths and refuses repeated invalid repair shapes without changing the original', () => {
    const j = prepared(),
      c = candidate(j);
    c.interaction = '🌱'.repeat(266);
    const raw = JSON.stringify(c),
      original = raw;
    expect(() => parseDraft(raw, j, 'generated')).toThrow('$.interaction maxLength 266/240');
    expect(raw).toBe(original);
    expect(boundedRepairFeedback('{"PRIVATE_SENTINEL":"unfinished', schemaForJob(j))).not.toContain(
      'PRIVATE_SENTINEL',
    );
    expect(generationPrompt(j)).toContain('interaction<=240');
    expect(generationPrompt(j)).toContain('exactly 2 entries');
  });
  it('versions the full repair reserve and retains historical provider-1 contracts', () => {
    const j = prepared();
    expect(j.admission!.repairMaxBytes).toBe(1024);
    expect(j.admission!.version).toBe('provider-admission-2');
    expect(j.admission!.screeningUpperBound).toBeLessThanOrEqual(16384);
    const legacy = {
      ...j,
      promptVersion: 'provider-1' as const,
      schemaVersion: 'candidate-4' as const,
    };
    legacy.admission = planAdmission(legacy);
    const before = hash(canonical(legacy));
    const c = candidate(legacy);
    c.summary = 'X'.repeat(385);
    expect(() => parseDraft(JSON.stringify(c), legacy)).toThrow('Invalid text field (limit 360)');
    expect(legacy.admission!.version).toBe('provider-admission-1');
    expect(legacy.admission!.repairMaxBytes).toBeUndefined();
    expect(hash(canonical(legacy))).toBe(before);
  });
});
