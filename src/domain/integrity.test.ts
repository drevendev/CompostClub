import { expect, it } from 'vitest';
import { recordedPersonal } from '../../tests/garden-fixtures';
import { importGarden, serializeGarden, pairKey, exportMarkdown, editScrap } from './garden';
import { provenanceLabel } from './provenance';

it('rejects missing consumed pairs, contradictory evidence, duplicate pair records and source cycles', () => {
  const original = recordedPersonal(100);
  for (const corrupt of [
    (g: typeof original) => {
      g.attempts = [];
    },
    (g: typeof original) => {
      g.attempts.push(g.attempts[0]!);
    },
    (g: typeof original) => {
      g.generations![0]!.status = 'failed';
    },
    (g: typeof original) => {
      g.scraps[0]!.parentSproutId = g.sprouts[0]!.id;
    },
    (g: typeof original) => {
      g.sprouts[0]!.parents[0].revision = 999;
      g.sprouts[0]!.key = pairKey(g.sprouts[0]!.parents);
    },
  ]) {
    const g = structuredClone(original);
    corrupt(g);
    expect(() => importGarden(JSON.stringify(g))).toThrow();
  }
  const edited = editScrap(original, original.scraps[0]!.id, 'A new fictional garden source.');
  expect(importGarden(serializeGarden(edited)).sprouts[0]!.parents).toEqual(
    original.sprouts[0]!.parents,
  );
});

it('labels imported claims without upgrading forged replay output or changing exact recordings', () => {
  const recorded = recordedPersonal(100);
  expect(provenanceLabel(recorded.sprouts[0]!, recorded.sprouts[0]!.rawOutput)).toContain(
    'Recorded demo',
  );
  const s = recorded.sprouts[0]!;
  s.output.title = 'Forged claim';
  s.rawOutput = JSON.stringify(s.output);
  recorded.generations![0]!.responses[0]!.raw = s.rawOutput;
  const imported = importGarden(serializeGarden(recorded));
  expect(imported.sprouts[0]!.imported).toBe(true);
  expect(exportMarkdown(imported)).toContain('provenance not independently verified');
});
