import { expect, it } from 'vitest';
import {
  addScrap,
  availablePairs,
  beginRequest,
  createGarden,
  editScrap,
  failRequest,
  importGarden,
  INTERVAL,
  MAX_ATTEMPTS,
  pairKey,
  reconcile,
  retryablePairs,
  serializeGarden,
} from './garden';

function planted(count: number) {
  let g = createGarden('personal', 100, 'cap');
  for (let i = 0; i < count; i++)
    g = addScrap(g, `Fictional source number ${i}.`, 100, { id: i.toString(36).padStart(2, '0') });
  return g;
}

it.each([2, 3, 200])(
  'separates accrued slots from exhausted combinations for %i scraps across reload',
  (count) => {
    let g = planted(count);
    const pairs = availablePairs(g);
    expect(pairs).toHaveLength((count * (count - 1)) / 2);
    // Synthetic pairing-index fixture only; no generated output or model claim.
    g = {
      ...g,
      readySlots: 0,
      attempts: pairs.map((parents, i) => ({
        key: pairKey(parents),
        status: 'failed',
        requestId: i.toString(36),
      })),
    };
    const restored = reconcile(importGarden(serializeGarden(g)), 100 + INTERVAL);
    expect(restored.readySlots).toBe(1);
    expect(availablePairs(restored)).toHaveLength(0);
    expect(retryablePairs(restored)).toHaveLength(pairs.length);
    expect(() =>
      beginRequest(restored, 100 + INTERVAL, 'ollama', 'test-only', 'test-only', 'en'),
    ).toThrow('Every pairing');
    const edited = editScrap(restored, restored.scraps[0]!.id, 'A new fictional ingredient.');
    expect(availablePairs(edited)).toHaveLength(count - 1);
    expect(edited.readySlots).toBe(1);
  },
);

it('preserves selection order while excluding attempted pairs and keeping failed retries explicit', () => {
  const g = planted(12),
    all = availablePairs(g);
  g.attempts = all
    .filter((_, i) => i % 3 === 0)
    .map((parents) => ({ key: pairKey(parents), status: 'failed', requestId: 'x' }));
  expect(availablePairs(g)).toEqual(all.filter((_, i) => i % 3 !== 0));
  expect(retryablePairs(g)).toHaveLength(g.attempts.length);
  expect(availablePairs(structuredClone(g))).toEqual(availablePairs(g));
});

it('indexes 19,900 attempts once, with a bounded key-read budget independent of machine speed', () => {
  const g = planted(200),
    pairs = availablePairs(g);
  g.attempts = pairs.map((parents, i) => ({
    key: pairKey(parents),
    status: 'failed',
    requestId: i.toString(36),
  }));
  expect(g.attempts).toHaveLength(MAX_ATTEMPTS);
  expect(importGarden(serializeGarden(g)).attempts).toHaveLength(MAX_ATTEMPTS);
  let reads = 0;
  for (const attempt of g.attempts) {
    const key = attempt.key;
    Object.defineProperty(attempt, 'key', {
      get() {
        if (++reads > MAX_ATTEMPTS * 10)
          throw new Error('Multiplicative attempt scan exceeded the generous key-read budget.');
        return key;
      },
    });
  }
  expect(availablePairs(g)).toHaveLength(0);
  expect(reads).toBeLessThanOrEqual(MAX_ATTEMPTS * 10);
});
it('reserves pairing-index capacity before starting a new request but permits retries at the cap', () => {
  let g = planted(200);
  g.attempts = availablePairs(g).map((parents, i) => ({
    key: pairKey(parents),
    status: 'failed',
    requestId: i.toString(36),
  }));
  g = editScrap(g, g.scraps[0]!.id, 'A revised fictional source at index capacity.');
  const before = serializeGarden(g);
  expect(() => beginRequest(g, 100, 'ollama', 'test-only', 'test-only', 'en')).toThrow(
    '19,900 records',
  );
  expect(serializeGarden(g)).toBe(before);
  expect(g.pending).toBeNull();
  const retry = beginRequest(
    g,
    100,
    'ollama',
    'test-only',
    'test-only',
    'en',
    retryablePairs(g)[0],
  );
  const failed = failRequest(retry, retry.pending!.id, 'Test-only cancellation.', true);
  expect(failed.attempts).toHaveLength(MAX_ATTEMPTS);
  expect(importGarden(serializeGarden(failed)).readySlots).toBe(1);
});
