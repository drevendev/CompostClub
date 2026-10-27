import { describe, it, expect } from 'vitest';
import { fixture, candidate, NOW } from '../../../tests/coherent-fixtures';
import {
  prepareJob,
  revalidate,
  admissionConditions,
  dispatch,
  makeGarden,
  addSource,
} from './workspace';
import { parseAssessment, parseDraft, schemaForJob } from './contract';
import { providerSnapshot, validProvider, GROQ_ENDPOINT } from './provider';
import { validate } from './validate';
import { planAdmission } from './admission';

describe('provider contract · authored diagnostics, no live model', () => {
  it('counts schema string lengths in Unicode code points, preserving exact raw and UTF-8 budget', () => {
    const w = fixture(),
      j = prepareJob(w, w.gardens[0]!.id, 'blend', NOW);
    j.draft = candidate(j);
    for (const text of ['😀'.repeat(160), 'ю'.repeat(160), 'a\u0301'.repeat(80)]) {
      const raw = JSON.stringify({ decision: 'pass', findings: [], limitations: text });
      expect(parseAssessment(raw, j, NOW).raw).toBe(raw);
    }
    expect(() =>
      parseAssessment(
        JSON.stringify({ decision: 'pass', findings: [], limitations: '😀'.repeat(161) }),
        j,
        NOW,
      ),
    ).toThrow('limit 160');
    expect(schemaForJob(j).oneOf[1]!.properties.reason).toMatchObject({ minLength: 1 });
    expect(() => parseDraft('{"outcome":"no_blend","reason":"","missing":[]}', j)).toThrow();
  });
  it('keeps local 4096 and separately admits a provider-qualified two-stage contract', () => {
    const w = fixture(),
      local = prepareJob(w, w.gardens[0]!.id, 'blend', NOW);
    expect(local.admission!.contextLimit).toBe(4096);
    w.jobs = [];
    w.provider = { kind: 'groq', revision: 1 };
    const j = prepareJob(w, w.gardens[0]!.id, 'blend', NOW);
    expect(j.provider!.endpoint).toBe(GROQ_ENDPOINT);
    expect(j.provider!.seed).toBe(false);
    expect(j.admission!.contextLimit).toBe(16384);
    expect(j.admission!.screeningUpperBound).toBeLessThanOrEqual(16384);
    expect(j.promptVersion).toBe('provider-1');
    validate(w);
  });
  it('refuses unsupported profile/config and changed provider before dispatch', () => {
    expect(() =>
      validProvider({
        ...providerSnapshot({ kind: 'groq', revision: 1 }, ''),
        endpoint: 'https://other.invalid',
      }),
    ).toThrow();
    const w = fixture();
    w.provider = { kind: 'groq', revision: 1 };
    const j = prepareJob(w, w.gardens[0]!.id, 'blend', NOW);
    w.provider.revision++;
    expect(() => revalidate(w, j, NOW)).toThrow('Provider');
    expect(w.calls).toHaveLength(0);
    expect(() => planAdmission({ ...j, provider: { ...j.provider!, contextLimit: 1 } })).toThrow(
      'admission',
    );
  });
  it('new provider invalidates admission fingerprint without redrawing selection', () => {
    const w = fixture();
    const before = admissionConditions(w, w.gardens[0]!.id);
    w.provider = { kind: 'groq', revision: 1 };
    expect(admissionConditions(w, w.gardens[0]!.id)).not.toBe(before);
  });
  it.each([0, 10, 100])(
    'freezes the %s%% remote route, with no fallback after consent/participation changes',
    (probability) => {
      const w = fixture(),
        g = w.gardens[0]!,
        d = makeGarden('Donor', 'game', NOW);
      w.gardens.push(d);
      d.policy.donate = true;
      g.policy = { revision: 2, probability, donors: [d.id], donate: true };
      addSource(w, d.id, 'Fictional donor', 'A bell must recharge for two turns.', true, NOW);
      w.provider = { kind: 'groq', revision: 1 };
      const j = prepareJob(w, g.id, 'blend', NOW, { probabilistic: true, seed: 1 });
      const frozen = JSON.stringify(j.plan);
      if (probability === 0) expect(j.pack.payload).not.toContain('bell must');
      dispatch(w, j.id, 'generating', NOW);
      w.sources.find((s) => s.id === j.parents[0]!.id)!.participating = false;
      expect(() => revalidate(w, j, NOW)).toThrow();
      expect(JSON.stringify(j.plan)).toBe(frozen);
      expect(w.calls).toHaveLength(1);
      expect(g.credits.balance).toBe(3);
    },
  );
  it('refuses unevidenced and nonexistent-field findings without inventing citations', () => {
    const w = fixture();
    w.provider = { kind: 'groq', revision: 1 };
    const j = prepareJob(w, w.gardens[0]!.id, 'blend', NOW);
    j.draft = candidate(j);
    for (const finding of [
      { field: 'core', issue: 'Changed mandatory cost', evidence: [], missing: '' },
      {
        field: 'nonexistent',
        issue: 'Changed rule',
        evidence: [j.pack.evidence[0]!.id],
        missing: '',
      },
    ]) {
      expect(() =>
        parseAssessment(
          JSON.stringify({ decision: 'needs_revision', findings: [finding], limitations: '' }),
          j,
          NOW,
        ),
      ).toThrow('finding');
    }
    const raw = JSON.stringify({
      decision: 'needs_revision',
      findings: [
        {
          field: 'core',
          issue: 'Changes mandatory turn repayment into optional points',
          evidence: [j.pack.evidence[0]!.id],
          missing: '',
        },
      ],
      limitations: '',
    });
    expect(parseAssessment(raw, j, NOW).raw).toBe(raw);
  });
});
