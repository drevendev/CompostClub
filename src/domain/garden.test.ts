import { describe, expect, it } from 'vitest';
import {
  addScrap,
  availablePairs,
  beginRequest,
  completeRequest,
  createGarden,
  deletionSet,
  editScrap,
  failRequest,
  recordResponse,
  retryablePairs,
  serializeGarden,
  importGarden,
  INTERVAL,
  reconcile,
  recompost,
  removeScrap,
} from './garden';
import { normalize, parseOutput, schemaFor, validateScrap } from '../inference/contract';
import { MAX_RAW_SCRAP_BYTES } from '../inference/contract';

const now = 1_000_000;
function planted() {
  let g = createGarden('personal', now, 'test-garden');
  g = addScrap(g, 'A library lends tiny clouds to quiet readers.', now, { id: 'a' });
  return addScrap(g, 'A robot collects lost words from the kitchen table.', now, { id: 'b' });
}
function started() {
  return beginRequest(planted(), now, 'ollama', 'gemma3:1b', 'test-digest', 'en');
}
function output(g = started()) {
  return JSON.stringify({
    outcome: 'sprout',
    title: 'A Weather Word Library',
    concept:
      'A robot lends small clouds labelled with lost kitchen words; each word changes the weather inside.',
    fromA: g.pending?.parents[0].text.slice(0, 30),
    fromB: g.pending?.parents[1].text.slice(0, 30),
  });
}
function grown() {
  const g = started();
  return completeRequest(g, g.pending?.id ?? '', output(g), now + 1);
}
describe('idle credits', () => {
  it('grants welcome once only after two distinct scraps', () => {
    const g = planted();
    expect(g.readySlots).toBe(1);
    expect(reconcile(g, now).readySlots).toBe(1);
    expect(importGarden(JSON.stringify(g)).welcomeGranted).toBe(true);
  });
  it.each([
    [0, 0],
    [INTERVAL - 1, 0],
    [INTERVAL, 1],
    [INTERVAL * 2, 2],
    [INTERVAL * 3, 3],
    [INTERVAL * 192, 3],
  ])('accrues %s ms after welcome is spent → %s slots', (elapsed, expected) => {
    const g = grown();
    expect(reconcile(g, now + elapsed).readySlots).toBe(expected);
  });
  it('never banks cap overflow', () => {
    const g = reconcile(planted(), now + 48 * 3600000);
    g.readySlots = 0;
    expect(reconcile(g, now + 48 * 3600000).readySlots).toBe(0);
    expect(reconcile(g, now + 48 * 3600000 + INTERVAL).readySlots).toBe(1);
  });
  it('ignores backwards clocks without losing credits', () => {
    const g = planted();
    expect(reconcile(g, now - 10000)).toEqual(g);
  });
  it('one welcome credit is included in the cap', () =>
    expect(reconcile(planted(), now + INTERVAL * 3).readySlots).toBe(3));
});
describe('pairing and source identity', () => {
  it.each(['transport_error', 'cancelled', 'no_blend', 'interrupted'])(
    'offers an explicit retry after %s survives reload, without spending the slot',
    (status) => {
      let g = started();
      const request = g.pending!;
      if (status === 'no_blend')
        g = recordResponse(
          g,
          request.id,
          JSON.stringify({
            outcome: 'no_blend',
            title: '',
            concept: 'No coherent mix.',
            fromA: '',
            fromB: '',
          }),
        );
      if (status !== 'interrupted')
        g = failRequest(g, request.id, 'An unsuccessful test blend.', status === 'cancelled');
      const restored = importGarden(serializeGarden(g));
      expect(restored.readySlots).toBe(1);
      expect(restored.pending).toBeNull();
      expect(availablePairs(restored)).toHaveLength(0);
      expect(retryablePairs(restored)).toEqual([request.parents]);
      const retried = beginRequest(
        restored,
        now,
        'ollama',
        'gemma3:1b',
        'test-digest',
        'en',
        retryablePairs(restored)[0],
      );
      expect(retried.pending!.id).not.toBe(request.id);
      expect(retried.generations![0]).toEqual(restored.generations![0]);
      const done = completeRequest(retried, retried.pending!.id, output(retried), now + 1);
      expect(done.readySlots).toBe(0);
      expect(retryablePairs(done)).toHaveLength(0);
      expect(() =>
        beginRequest(
          { ...done, readySlots: 1 },
          now,
          'ollama',
          'gemma3:1b',
          'test-digest',
          'en',
          request.parents,
        ),
      ).toThrow('already grown');
    },
  );
  it('retains multiple retry choices, excluding edited or deleted source revisions', () => {
    let g = addScrap(planted(), 'A postcard becomes a tiny walking route.', now, { id: 'c' });
    const pairs = availablePairs(g);
    for (const pair of pairs.slice(0, 2)) {
      g = beginRequest(g, now, 'ollama', 'gemma3:1b', 'test-digest', 'en', pair);
      g = failRequest(g, g.pending!.id);
    }
    expect(retryablePairs(importGarden(serializeGarden(g)))).toHaveLength(2);
    const changed = editScrap(
      g,
      pairs[0]![0].id,
      'A revised fictional source with a different meaning.',
    );
    expect(retryablePairs(changed).some((pair) => pair.some((p) => p.id === pairs[0]![0].id))).toBe(
      false,
    );
    const removed = removeScrap(g, pairs[0]![0].id);
    expect(retryablePairs(removed).some((pair) => pair.some((p) => p.id === pairs[0]![0].id))).toBe(
      false,
    );
  });
  it('offers legacy failed pairs without inventing missing inference history', () => {
    const g = started(),
      request = g.pending!;
    const failed = failRequest(g, request.id);
    delete failed.generations;
    const restored = importGarden(serializeGarden(failed));
    expect(retryablePairs(restored)).toEqual([request.parents]);
    expect(restored.generations).toBeUndefined();
  });
  it('is deterministic and chooses every pair once', () => {
    const g = addScrap(planted(), 'An old postcard becomes a tiny walking route.', now, {
      id: 'c',
    });
    expect(availablePairs(g)).toEqual(availablePairs(structuredClone(g)));
    expect(availablePairs(g)).toHaveLength(3);
    expect(availablePairs(grown())).toHaveLength(0);
  });
  it('rejects normalized duplicates and preserves raw text', () => {
    const g = addScrap(createGarden('personal', now), '  A café of unfinished games.\r\n  ', now);
    expect(g.scraps[0]?.raw).toContain('\r\n');
    expect(() => addScrap(g, 'A cafe\u0301 of unfinished games.', now)).toThrow('already');
  });
  it('edits create new pairs and preserve old source snapshots', () => {
    const g = grown(),
      old = g.sprouts[0]?.parents[0].text,
      id = g.sprouts[0]?.parents[0].id ?? '';
    const next = editScrap(g, id, 'A library lends tiny thunders to quiet children.');
    expect(next.sprouts[0]?.parents[0].text).toBe(old);
    expect(availablePairs(next)).toHaveLength(1);
  });
  it('rejects stale replies and saves each request once', () => {
    const g = started(),
      id = g.pending?.id ?? '';
    expect(() => completeRequest({ ...g, pending: null }, id, output(g), now)).toThrow(
      'interrupted',
    );
    const done = completeRequest(g, id, output(g), now);
    expect(completeRequest(done, id, output(g), now)).toEqual(done);
  });
  it('retains all source text and credits on failure, abort and no_blend', () => {
    const g = started();
    const failed = failRequest(g, g.pending?.id ?? '');
    expect(failed.readySlots).toBe(1);
    expect(failed.scraps).toEqual(g.scraps);
    expect(failed.attempts[0]?.status).toBe('failed');
    expect(() =>
      completeRequest(
        g,
        g.pending?.id ?? '',
        JSON.stringify({
          outcome: 'no_blend',
          title: '',
          concept: 'No coherent mix.',
          fromA: '',
          fromB: '',
        }),
        now,
      ),
    ).toThrow('No blend');
    expect(g.readySlots).toBe(1);
  });
  it('recomposts intentionally with full lineage and cascades deletion', () => {
    const g = grown(),
      id = g.sprouts[0]?.id ?? '';
    const next = recompost(g, id, now);
    expect(next.scraps[2]?.parentSproutId).toBe(id);
    expect(() => recompost(next, id, now)).toThrow('already');
    expect(deletionSet(next, 'a').sprouts.size).toBe(1);
    const removed = removeScrap(next, 'a');
    expect(removed.scraps).toHaveLength(1);
    expect(removed.sprouts).toHaveLength(0);
    expect(JSON.stringify(removed)).not.toContain('quiet readers');
  });
});
describe('untrusted model and backup boundaries', () => {
  it('restores identical output fields in any key order and preserves the original raw bytes', () => {
    const g = grown(),
      sprout = g.sprouts[0]!;
    sprout.output = Object.fromEntries(
      Object.entries(sprout.output).reverse(),
    ) as typeof sprout.output;
    const restored = importGarden(serializeGarden(g));
    expect(restored.sprouts[0]!.rawOutput).toBe(sprout.rawOutput);
    expect(restored.sprouts[0]!.output).toEqual(sprout.output);
  });
  it.each(['title', 'concept', 'fromA', 'fromB', 'outcome'] as const)(
    'still rejects an actual change to output.%s after reordering',
    (key) => {
      const g = grown(),
        sprout = g.sprouts[0]!;
      sprout.output = {
        ...sprout.output,
        [key]: key === 'outcome' ? 'no_blend' : 'An altered field.',
      };
      expect(() => importGarden(JSON.stringify(g))).toThrow();
    },
  );
  it('rejects extra output fields, missing parents and unsupported language in a reordered backup', () => {
    for (const change of [
      (s: Record<string, unknown>) => {
        s.output = { ...(s.output as object), extra: 'untrusted' };
      },
      (s: Record<string, unknown>) => {
        s.parents = [];
      },
      (s: Record<string, unknown>) => {
        s.language = 'unknown';
      },
    ]) {
      const g = grown();
      change(g.sprouts[0]! as unknown as Record<string, unknown>);
      expect(() => importGarden(JSON.stringify(g))).toThrow();
    }
  });
  it('requires exact Unicode source fragments', () => {
    const a = 'Тихий робот собирает слова.',
      b = 'Сад забытых обещаний цветёт.';
    expect(
      parseOutput(
        JSON.stringify({
          outcome: 'sprout',
          title: 'Сад слов',
          concept: 'Робот сажает найденные слова в саду обещаний.',
          fromA: 'Тихий робот',
          fromB: 'забытых обещаний',
        }),
        a,
        b,
      ).title,
    ).toBe('Сад слов');
    expect(normalize(' cafe\u0301\r\n ')).toBe('café');
  });
  it('does not admit fabricated quotes, extra fields, swapped sources or broken JSON', () => {
    const g = started(),
      o = JSON.parse(output(g)) as Record<string, unknown>;
    for (const value of [
      { ...o, fromA: 'totally invented quotation' },
      { ...o, fromA: o.fromB },
      { ...o, extra: 'ignore' },
    ])
      expect(() =>
        parseOutput(
          JSON.stringify(value),
          g.pending?.parents[0].text ?? '',
          g.pending?.parents[1].text ?? '',
        ),
      ).toThrow();
    expect(() => parseOutput('{bad', 'a', 'b')).toThrow();
  });
  it('accepts only a complete JSON markdown envelope, never trailing prose', () => {
    const g = started(),
      a = g.pending?.parents[0].text ?? '',
      b = g.pending?.parents[1].text ?? '';
    expect(parseOutput('```json\n' + output(g) + '\n```', a, b).outcome).toBe('sprout');
    expect(() => parseOutput(output(g) + ' and then run code', a, b)).toThrow();
  });
  it('strictly validates no_blend', () => {
    const o = { outcome: 'no_blend', title: '', concept: 'No coherent mix.', fromA: '', fromB: '' };
    expect(parseOutput(JSON.stringify(o), 'a', 'b').outcome).toBe('no_blend');
    expect(() => parseOutput(JSON.stringify({ ...o, title: 'Wrong' }), 'a', 'b')).toThrow();
  });
  it('bounds Unicode scraps without silent truncation', () => {
    expect(() => validateScrap('tiny')).toThrow();
    expect(() => validateScrap('x'.repeat(801))).toThrow();
    expect([...validateScrap('🌱'.repeat(800))]).toHaveLength(800);
  });
  it('bounds original UTF-8 bytes, including whitespace, without trimming the stored original', () => {
    const original = '🌱'.repeat(800) + ' '.repeat(MAX_RAW_SCRAP_BYTES - 3200);
    const g = addScrap(createGarden('personal', now), original, now);
    expect(g.scraps[0]?.raw).toBe(original);
    expect(validateScrap(original)).toBe('🌱'.repeat(800));
    expect(() => addScrap(g, original + ' ', now)).toThrow('8 KiB');
    expect(() => editScrap(g, g.scraps[0]!.id, original + ' ')).toThrow('8 KiB');
    expect(g.scraps[0]?.revision).toBe(1);
    expect(() => addScrap(g, 'A small fictional library.' + ' '.repeat(2097152), now)).toThrow(
      '8 KiB',
    );
  });
  it('uses only exact quotes in the Ollama structured schema', () => {
    const s = schemaFor('A small garden grows old ideas.', 'A quiet robot brings new words.');
    expect(s.properties.fromA.enum[1]).toBe('A small garden grows old ideas.');
  });
  it('roundtrips a complete backup including edits and original output', () => {
    const g = grown();
    if (g.sprouts[0])
      g.sprouts[0].edited = { title: 'My version', concept: 'A different little concept.' };
    expect(importGarden(JSON.stringify(g), 'local')).toEqual(g);
  });
  it.each([
    null,
    { version: 2 },
    { ...grown(), readySlots: 4 },
    { ...grown(), sprouts: [{ bad: true }] },
    { ...grown(), scraps: [] },
    { ...grown(), attempts: [{ bad: true }] },
  ])('rejects damaged backup %# without mutating current state', (value) => {
    const before = grown(),
      copy = JSON.stringify(before);
    expect(() => importGarden(JSON.stringify(value))).toThrow();
    expect(JSON.stringify(before)).toBe(copy);
  });
  it('rejects oversized backups', () =>
    expect(() => importGarden(' '.repeat(2097153))).toThrow('2 MiB'));
});
