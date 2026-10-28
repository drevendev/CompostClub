import { afterEach, expect, it, vi } from 'vitest';
import { BrowserAI } from './provider';
afterEach(() => vi.unstubAllGlobals());
it('diagnostic: cancellation while awaiting a GPU adapter cannot create a late Worker or download', async () => {
  let resolveAdapter!: (v: { features: Set<string> }) => void;
  const adapter = new Promise<{ features: Set<string> }>((resolve) => {
    resolveAdapter = resolve;
  });
  const worker = vi.fn();
  vi.stubGlobal('Worker', worker);
  vi.stubGlobal('navigator', { gpu: { requestAdapter: () => adapter } });
  const ai = new BrowserAI(),
    load = ai.load('1b', () => {});
  ai.cancel();
  resolveAdapter({ features: new Set(['shader-f16']) });
  await expect(load).rejects.toThrow('cancelled before worker');
  expect(worker).not.toHaveBeenCalled();
  expect(ai.loaded).toBeNull();
});
it('diagnostic: a superseded adapter cannot cancel or replace a newer load', async () => {
  const adapters: ((v: { features: Set<string> }) => void)[] = [];
  vi.stubGlobal('navigator', {
    gpu: {
      requestAdapter: () =>
        new Promise<{ features: Set<string> }>((resolve) => adapters.push(resolve)),
    },
  });
  let created = 0;
  class DiagnosticWorker {
    onmessage: ((e: { data: { type: string } }) => void) | null = null;
    onerror: unknown;
    constructor() {
      created++;
    }
    postMessage() {
      queueMicrotask(() => this.onmessage?.({ data: { type: 'loaded' } }));
    }
    terminate() {}
  }
  vi.stubGlobal('Worker', DiagnosticWorker);
  const ai = new BrowserAI(),
    first = ai.load('270m', () => {}),
    second = ai.load('1b', () => {});
  adapters[1]!({ features: new Set(['shader-f16']) });
  await second;
  adapters[0]!({ features: new Set(['shader-f16']) });
  await expect(first).rejects.toThrow('cancelled before worker');
  expect(created).toBe(1);
  expect(ai.loaded).toBe('1b');
  ai.cancel();
});
