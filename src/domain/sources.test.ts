import { expect, it } from 'vitest';
import {
  addScrap,
  createGarden,
  editScrap,
  importGarden,
  serializeGarden,
  sourceRevisions,
  MAX_SOURCE_REVISIONS,
  exportMarkdown,
  deletionSet,
  removeScrap,
  type Scrap,
} from './garden';

const original = '  A fictional cafe\u0301 of clockwork plants.\r\n  ';
function planted() {
  return addScrap(createGarden('personal', 100), original, 100, { id: 'source' });
}

it('retains exact original Unicode/whitespace before any sprout and through later edits and exports', () => {
  const first = planted();
  const second = editScrap(first, 'source', 'A revised fictional café of clockwork plants.');
  const third = editScrap(second, 'source', 'A third fictional café for small clockwork plants.');
  expect(first.scraps[0]!.raw).toBe(original);
  expect(second.scraps[0]!.history).toEqual([
    { raw: original, text: original.normalize('NFC').trim(), revision: 1, origin: 'user' },
  ]);
  const restored = importGarden(serializeGarden(third));
  expect(sourceRevisions(restored.scraps[0]!)).toEqual([
    { raw: original, text: original.normalize('NFC').trim(), revision: 1, origin: 'user' },
    { raw: second.scraps[0]!.raw, text: second.scraps[0]!.text, revision: 2, origin: 'user' },
    { raw: third.scraps[0]!.raw, text: third.scraps[0]!.text, revision: 3, origin: 'user' },
  ]);
  expect(exportMarkdown(restored)).toContain(JSON.stringify(original));
  expect(restored.sprouts).toHaveLength(0);
  expect(editScrap(third, 'source', third.scraps[0]!.raw)).toEqual(third);
});

it('preserves legacy records without inventing missing earlier text', () => {
  const g = planted();
  delete g.scraps[0]!.history;
  g.scraps[0]!.revision = 7;
  const restored = importGarden(serializeGarden(g));
  expect(restored.scraps[0]!.history).toBeUndefined();
  const edited = editScrap(restored, 'source', 'An eighth fictional source revision.');
  expect(edited.scraps[0]!.history!.map((r) => r.revision)).toEqual([7]);
  expect(edited.scraps[0]!.history![0]!.raw).toBe(original);
  expect(exportMarkdown(edited)).toContain('Earlier revisions were not present');
  expect(importGarden(serializeGarden(edited))).toEqual(edited);
});

it('bounds source histories without trimming and counts them in cascade deletion', () => {
  let g = planted();
  for (let i = 2; i <= MAX_SOURCE_REVISIONS; i++)
    g = editScrap(g, 'source', `A fictional clockwork revision number ${i}.`);
  expect(sourceRevisions(g.scraps[0]!)).toHaveLength(100);
  expect(() => editScrap(g, 'source', 'An overflowing fictional source revision.')).toThrow(
    '100 saved text revisions',
  );
  expect(g.scraps[0]!.history![0]!.raw).toBe(original);
  expect(importGarden(serializeGarden(g))).toEqual(g);
  expect(deletionSet(g, 'source').revisions).toBe(100);
  expect(removeScrap(g, 'source').scraps).toHaveLength(0);
});

it.each([
  (s: Scrap) => {
    s.history![0]!.raw = ' '.repeat(8193);
  },
  (s: Scrap) => {
    s.history![0]!.text = 'A changed normalized original.';
  },
  (s: Scrap) => {
    s.history![0]!.revision = s.revision;
  },
  (s: Scrap) => {
    s.history!.push(s.history![0]!);
  },
  (s: Scrap) => {
    s.history = Array.from({ length: 100 }, () => s.history![0]!);
  },
])('rejects invalid, oversized or reordered source history %#', (change) => {
  const g = editScrap(planted(), 'source', 'A revised fictional greenhouse.');
  change(g.scraps[0]!);
  expect(() => importGarden(JSON.stringify(g))).toThrow();
});
