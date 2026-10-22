import { expect, it } from 'vitest';
import {
  addScrap,
  beginRequest,
  completeRequest,
  createGarden,
  deletionSet,
  exportSproutCard,
  importGarden,
  removeScrap,
  serializeGarden,
} from './garden';
import {
  beginGrowth,
  decideGrowth,
  DIRECTIONS,
  parseGrowth,
  proposeGrowth,
  recordGrowth,
  stopGrowth,
} from './growth';
import recordings from '../../fixtures/public/recordings.json';
function seed() {
  const r = recordings[0]!;
  let g = addScrap(createGarden('personal', 100), r.a, 100, { id: 'a' });
  g = addScrap(g, r.b, 100, { id: 'b' });
  g = beginRequest(g, 100, 'replay', r.model, r.revision, 'en');
  g = completeRequest(g, g.pending!.id, r.raw, 100);
  g.sprouts[0]!.kept = true;
  g.readySlots = 3;
  return g;
}
const raw = JSON.stringify({
  outcome: 'growth',
  title: 'Fictional library trial',
  concept: 'Try one shelf for a week.',
  experiment: 'Ask three readers to find a misplaced book.',
});
function start(g = seed()) {
  const s = g.sprouts[0]!;
  return beginGrowth(
    g,
    { kind: 'sprout', id: s.id, title: s.output.title, concept: s.output.concept },
    DIRECTIONS[3],
    'gemma3:4b',
    'test-digest',
    101,
  );
}
it('accepts branches atomically, preserves evidence and parents through restore and cascades', () => {
  let g = start();
  const id = g.growth![0]!.id;
  g = proposeGrowth(recordGrowth(g, id, raw), id);
  expect(g.readySlots).toBe(3);
  const parent = structuredClone(g.sprouts[0]);
  g = decideGrowth(g, id, true);
  expect(g.readySlots).toBe(2);
  expect(g.sprouts[0]).toEqual(parent);
  expect(() => decideGrowth(g, id, true)).toThrow();
  const n = g.growth![0]!;
  g = beginGrowth(
    g,
    { kind: 'growth', id, title: n.output!.title, concept: n.output!.concept },
    DIRECTIONS[2],
    'gemma3:4b',
    'test-digest',
    102,
  );
  const child = g.growth!.at(-1)!.id;
  g = decideGrowth(proposeGrowth(recordGrowth(g, child, raw), child), child, true);
  expect(importGarden(serializeGarden(g))).toEqual(g);
  expect(deletionSet(g, 'a').growth.size).toBe(2);
  expect(removeScrap(g, 'a').growth).toEqual([]);
});
it('keeps slots and failed originals across cancellation, rejection, no_growth and reload', () => {
  const g = start(),
    id = g.growth![0]!.id;
  const failed = recordGrowth(g, id, 'original invalid answer 🌱');
  expect(importGarden(serializeGarden(failed)).growth![0]!.status).toBe('cancelled');
  expect(stopGrowth(failed, id, false, 'Invalid JSON').growth![0]!.responses).toEqual([
    'original invalid answer 🌱',
  ]);
  expect(stopGrowth(failed, id, true, 'Cancelled').readySlots).toBe(3);
  expect(decideGrowth(proposeGrowth(recordGrowth(g, id, raw), id), id, false).readySlots).toBe(3);
  const no = raw.replace('"growth"', '"no_growth"');
  expect(proposeGrowth(recordGrowth(g, id, no), id).growth![0]!.status).toBe('no_growth');
});
it('rejects orphan/cyclic/tampered evidence, bound violations and double operations', () => {
  const g = start(),
    id = g.growth![0]!.id;
  expect(() => start(g)).toThrow();
  expect(() => beginRequest(g, 102, 'ollama', 'gemma3:4b', 'digest', 'en')).toThrow();
  expect(() => recordGrowth(g, id, 'x'.repeat(65537))).toThrow();
  const proposed = proposeGrowth(recordGrowth(g, id, raw), id);
  const tampered = structuredClone(proposed);
  tampered.growth![0]!.output!.title = 'Changed';
  expect(() => importGarden(JSON.stringify(tampered))).toThrow();
  const cycle = structuredClone(proposed);
  cycle.growth![0]!.parent = { ...cycle.growth![0]!.parent, kind: 'growth', id };
  expect(() => serializeGarden(cycle)).toThrow();
  expect(() => parseGrowth('{"outcome":"growth"}')).toThrow();
  const malformedId = seed();
  malformedId.scraps[0]!.id = 'a|b';
  expect(() => serializeGarden(malformedId)).toThrow();
});
it('single-sprout cards exclude transcript and all growth data by default; evidence is explicit', () => {
  const g = start(),
    s = g.sprouts[0]!;
  expect(exportSproutCard(g, s)).not.toContain('## Inference history');
  expect(exportSproutCard(g, s)).not.toContain(s.rawOutput);
  expect(exportSproutCard(g, s, true)).toContain(JSON.stringify(s.rawOutput));
  expect(exportSproutCard(g, s)).not.toContain(g.growth![0]!.id);
});

it('requires human correction of an unfinished experiment before accepting, keeping the original', () => {
  let g = start();
  const id = g.growth![0]!.id;
  const unfinished = JSON.stringify({ ...JSON.parse(raw), experiment: 'An unfinished experiment' });
  g = proposeGrowth(recordGrowth(g, id, unfinished), id);
  expect(() => decideGrowth(g, id, true)).toThrow('unfinished');
  expect(g.readySlots).toBe(3);
  const accepted = decideGrowth(g, id, true, {
    ...g.growth![0]!.output!,
    experiment: 'Ask one reader to test a paper mock-up.',
  });
  expect(accepted.growth![0]!.responses).toEqual([unfinished]);
  expect(accepted.readySlots).toBe(2);
});
