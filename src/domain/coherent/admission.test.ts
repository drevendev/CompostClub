import { describe, it, expect } from 'vitest';
import { candidate, fixture, NOW } from '../../../tests/coherent-fixtures';
import {
  compactContext,
  compactDraft,
  draftLimits,
  FORMAT_REPAIR,
  planAdmission,
  TEMPLATE_RESERVE,
} from './admission';
import { generationPrompt, parseDraft, screeningPrompt, schemaForJob } from './contract';
import { bytes, canonical, hash } from './hash';
import { prepareJob, dispatch, pause, makeGarden, plan, selection } from './workspace';
import { validate } from './validate';

describe('whole-job admission · fictional deterministic diagnostics', () => {
  it('candidate-3 schema jointly bounds multilingual/escaped prose, including the repair checker', () => {
    const w = fixture(),
      j = prepareJob(w, w.gardens[0]!.id, 'blend', NOW);
    expect(j.promptVersion).toBe('coherent-6');
    const limits = draftLimits(j),
      schema = schemaForJob(j);
    const props = schema.oneOf[0]!.properties as Record<string, { maxLength?: number }>;
    for (const char of ['ю', '界', '😀', '"', '\\', '\n']) {
      const d = candidate(j);
      for (const [field, length] of Object.entries(limits)) {
        if (field === 'contribution') continue;
        (d as unknown as Record<string, unknown>)[field] = char.repeat(length);
        expect(props[field]!.maxLength).toBe(length);
      }
      d.contributions.forEach((c) => {
        c.text = char.repeat(limits.contribution!);
        c.evidence = c.evidence.slice(0, 1);
      });
      d.references = [];
      d.unknowns = [];
      d.nextQuestion = '';
      j.draft = d;
      expect(bytes(compactDraft(j))).toBeLessThanOrEqual(j.admission!.maxDraftBytes);
      expect(
        bytes(screeningPrompt(j, j.admission!.repairInstruction)) +
          512 +
          j.admission!.screeningTokens,
      ).toBeLessThanOrEqual(4096);
    }
  });
  it.each(['ru', 'en'] as const)(
    'admits the largest accepted serialized %s draft through checker and either repair',
    (language) => {
      const w = fixture(),
        g = w.gardens[0]!;
      w.settings.language = language;
      const j = prepareJob(w, g.id, 'blend', NOW),
        d = candidate(j),
        a = j.admission!;
      const one = language === 'ru' ? 'ю' : 'z';
      while (bytes(compactDraft(j, d)) + bytes(one) <= a.maxDraftBytes && d.core.length < 700)
        d.core += one;
      j.draft = parseDraft(JSON.stringify(d), j);
      expect(
        bytes(generationPrompt(j, FORMAT_REPAIR)) + a.generationTokens + TEMPLATE_RESERVE,
      ).toBeLessThanOrEqual(4096);
      expect(
        bytes(screeningPrompt(j, FORMAT_REPAIR)) + a.screeningTokens + TEMPLATE_RESERVE,
      ).toBeLessThanOrEqual(4096);
      expect(a.counting).toBe('utf8-byte-upper-bound');
      expect(a.tokenizer).toBeNull();
      expect(compactDraft(j)).toContain(d.core);
      validate(w);
    },
  );
  it('counts escaped strings and preserves all selected reference facts and long evidence IDs', () => {
    const w = fixture(),
      j = prepareJob(w, w.gardens[0]!.id, 'blend', NOW);
    const d = candidate(j);
    j.pack.evidence[0]!.id = 'e'.repeat(128);
    j.pack.evidence[0]!.text = 'A quoted "rule" and \\ path';
    const payload = JSON.parse(j.pack.payload) as Record<string, unknown>;
    payload.evidence = j.pack.evidence;
    j.pack.payload = canonical(payload);
    j.pack.hash = hash(j.pack.payload);
    j.pack.inputUpperBound = bytes(j.pack.payload);
    j.admission = planAdmission(j);
    d.contributions[0]!.evidence = [j.pack.evidence[0]!.id];
    expect(parseDraft(JSON.stringify(d), j).outcome).toBe('candidate');
    expect(compactContext(j)).toContain('e'.repeat(128));
    expect(compactContext(j)).toContain('quoted');
    d.contributions[0]!.evidence = ['wrong'];
    expect(() => parseDraft(JSON.stringify(d), j)).toThrow('Citation');
  });
  it('rejects before an attempt, slot, pair or call is charged; originals are untouched', () => {
    const w = fixture(),
      original = canonical(w.sources);
    w.gardens[0]!.objective = 'ю'.repeat(1000);
    expect(() => prepareJob(w, w.gardens[0]!.id, 'blend', NOW)).toThrow('admission:');
    expect(w.calls).toHaveLength(0);
    expect(w.jobs).toHaveLength(0);
    expect(w.consumed).toHaveLength(0);
    expect(w.gardens[0]!.credits.balance).toBe(3);
    expect(canonical(w.sources)).toBe(original);
  });
  it('checks an old exact draft before admission and keeps historical contracts explicit', () => {
    const w = fixture(),
      j = prepareJob(w, w.gardens[0]!.id, 'blend', NOW),
      d = candidate(j);
    const a = planAdmission({ ...j, operation: 'check' }, d);
    expect(a.exactDraftHash).toBe(hash(canonical(d)));
    d.core = 'Ю'.repeat(700);
    d.example = 'Ж'.repeat(500);
    expect(() => planAdmission({ ...j, operation: 'check' }, d)).toThrow('admission:');
  });
  it('a pause invalidates a one-off permit before another stage can dispatch', () => {
    const w = fixture(),
      j = prepareJob(w, w.gardens[0]!.id, 'blend', NOW, { manual: true, probabilistic: true });
    dispatch(w, j.id, 'generating', NOW);
    j.draft = candidate(j);
    pause(w, NOW + 1);
    expect(() => dispatch(w, j.id, 'screening', NOW + 2)).toThrow('cancelled');
    expect(w.calls).toHaveLength(1);
    expect(w.gardens[0]!.credits.balance).toBe(3);
  });
  it.each([0, 10, 100])(
    'freezes the %s%% route across refresh without hidden local fallback',
    (probability) => {
      const w = fixture(),
        g = w.gardens[0]!;
      g.policy.probability = probability;
      const p = plan(w, g.id, 1, false),
        route = p.route;
      expect(plan(w, g.id, 0xffffffff, false).id).toBe(p.id);
      expect(plan(w, g.id, 123, false).route).toBe(route);
      if (route === 'cross') expect(selection(w, p)).toEqual([]);
      expect(w.calls).toHaveLength(0);
      w.gardens.push(makeGarden('Other', 'game', NOW));
      expect(plan(w, g.id, 0, false).route).toBe(route);
    },
  );
});
