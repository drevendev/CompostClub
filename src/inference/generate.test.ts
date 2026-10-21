import { expect, it, vi } from 'vitest';
import { generateWithEvidence } from './generate';
import {
  addScrap,
  beginRequest,
  completeRequest,
  createGarden,
  failRequest,
  importGarden,
  recordResponse,
  serializeGarden,
} from '../domain/garden';
import { MAX_GENERATIONS } from '../domain/generation';
import { GardenStorage } from '../application/storage';

// Controlled transport responses, not model receipts or creative-quality evidence.
function pending() {
  let g = createGarden('personal', 100);
  g = addScrap(g, 'A fictional library of little clouds.', 100);
  g = addScrap(g, 'A fictional robot collects lost words.', 100);
  return beginRequest(g, 100, 'ollama', 'gemma3:1b', 'test-only-digest', 'en');
}
const noBlend = JSON.stringify({
  outcome: 'no_blend',
  title: '',
  concept: 'Test-only no blend.',
  fromA: '',
  fromB: '',
});
it('journals invalid primary and repair exactly, survives reload, and retains earlier retries', async () => {
  let g = pending();
  const r = g.pending!;
  const outputs = ['TEST-ONLY invalid primary 🌱\r\n', 'TEST-ONLY invalid repair'];
  const generate = vi.fn().mockResolvedValueOnce(outputs[0]).mockResolvedValueOnce(outputs[1]);
  await expect(
    generateWithEvidence(r, new AbortController().signal, generate, (raw) => {
      g = recordResponse(g, r.id, raw);
      expect(g.generations![0]!.responses.at(-1)!.raw).toBe(raw);
      return Promise.resolve();
    }),
  ).rejects.toThrow();
  g = failRequest(g, r.id, 'Diagnostic validation failure.');
  g = importGarden(serializeGarden(g));
  expect(g.readySlots).toBe(1);
  expect(g.generations![0]!.responses.map((s) => s.raw)).toEqual(outputs);
  expect(g.generations![0]!.parents).toEqual(r.parents);
  g = beginRequest(g, 101, r.backend, r.model, r.modelRevision, r.language, r.parents);
  expect(g.generations).toHaveLength(2);
  expect(g.generations![0]!.responses.map((s) => s.raw)).toEqual(outputs);
});
it('preserves a failed primary when a repair succeeds and spends the slot atomically with the sprout', async () => {
  let g = pending();
  const r = g.pending!;
  const repaired = JSON.stringify({
    outcome: 'sprout',
    title: 'TEST-ONLY schema payload',
    concept: 'A diagnostic payload for state testing, not a model result.',
    fromA: r.parents[0].text,
    fromB: r.parents[1].text,
  });
  const generate = vi
    .fn()
    .mockResolvedValueOnce('TEST-ONLY invalid primary')
    .mockResolvedValueOnce(repaired);
  const raw = await generateWithEvidence(r, new AbortController().signal, generate, (value) => {
    g = recordResponse(g, r.id, value);
    return Promise.resolve();
  });
  const done = importGarden(serializeGarden(completeRequest(g, r.id, raw, 101)));
  expect(done.readySlots).toBe(0);
  expect(done.attempts[0]!.status).toBe('success');
  expect(done.sprouts[0]!.rawOutput).toBe(repaired);
  expect(done.generations![0]!.status).toBe('success');
  expect(done.generations![0]!.responses.map((s) => s.raw)).toEqual([
    'TEST-ONLY invalid primary',
    repaired,
  ]);
  expect(completeRequest(done, r.id, raw, 102)).toEqual(done);
});
it('keeps no_blend raw and reason, with no spent credit', async () => {
  let g = pending();
  const r = g.pending!;
  const generate = vi.fn().mockResolvedValue(noBlend);
  const raw = await generateWithEvidence(r, new AbortController().signal, generate, (value) => {
    g = recordResponse(g, r.id, value);
    return Promise.resolve();
  });
  expect(() => completeRequest(g, r.id, raw, 101)).toThrow('No blend');
  g = importGarden(
    serializeGarden(failRequest(g, r.id, 'No blend this time: Test-only no blend.')),
  );
  expect(g.generations![0]!.status).toBe('no_blend');
  expect(g.generations![0]!.responses[0]!.raw).toBe(noBlend);
  expect(g.readySlots).toBe(1);
  expect(generate).toHaveBeenCalledTimes(1);
});
it('keeps a primary before cancelled repair and distinguishes no-response transport failure', async () => {
  let g = pending();
  const r = g.pending!,
    abort = new AbortController();
  const generate = vi.fn().mockResolvedValue('TEST-ONLY invalid primary');
  await expect(
    generateWithEvidence(r, abort.signal, generate, (raw) => {
      g = recordResponse(g, r.id, raw);
      abort.abort();
      return Promise.resolve();
    }),
  ).rejects.toThrow('Cancelled');
  const cancelled = importGarden(serializeGarden(failRequest(g, r.id, 'Cancelled.', true)));
  expect(cancelled.generations![0]!.status).toBe('cancelled');
  expect(cancelled.generations![0]!.responses).toHaveLength(1);
  expect(generate).toHaveBeenCalledTimes(1);
  const transport = pending();
  expect(
    failRequest(transport, transport.pending!.id, 'Connection refused.').generations![0]!.status,
  ).toBe('transport_error');
});
it('stops before a repair if the response checkpoint cannot save', async () => {
  const g = pending();
  const generate = vi.fn().mockResolvedValue('TEST-ONLY invalid primary');
  await expect(
    generateWithEvidence(g.pending!, new AbortController().signal, generate, () =>
      Promise.reject(new Error('Storage unavailable.')),
    ),
  ).rejects.toThrow('Storage unavailable');
  expect(generate).toHaveBeenCalledTimes(1);
});
it('blocks new inference at its explicit history/backup limits without modifying the garden', () => {
  const g = pending(),
    r = g.pending!;
  const failed = failRequest(g, r.id);
  failed.generations = Array.from({ length: MAX_GENERATIONS }, (_, i) => ({
    ...failed.generations![0]!,
    id: `old-${i}`,
  }));
  const before = serializeGarden(failed);
  expect(() =>
    beginRequest(failed, 100, r.backend, r.model, r.modelRevision, r.language, r.parents),
  ).toThrow('100 runs');
  expect(serializeGarden(failed)).toBe(before);
  const full = { ...failRequest(g, r.id), seed: 'x'.repeat(1900000) };
  expect(() =>
    beginRequest(full, 100, r.backend, r.model, r.modelRevision, r.language, r.parents),
  ).toThrow('192 KiB');
});
it('retains an unexpectedly oversized response separately without making the garden unreadable', async () => {
  const store = new GardenStorage();
  const g = await store.save(pending(), 0);
  const next = recordResponse(g, g.pending!.id, 'TEST-ONLY oversize ' + 'x'.repeat(2097152));
  await expect(store.save(next, g.revision)).rejects.toThrow('2 MiB');
  await store.retainInference('personal', next.generations![0]!);
  expect((await store.inferenceRecovery('personal'))!.responses[0]!.raw).toBe(
    next.generations![0]!.responses[0]!.raw,
  );
  expect((await store.load('personal')).readySlots).toBe(1);
});
