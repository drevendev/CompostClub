import { parseOutput, type Language } from './contract';
import type { Request } from '../domain/garden';
import { MODELS, type ModelKey } from './models';
import recordings from '../../fixtures/public/recordings.json';
import { generateWithEvidence } from './generate';

export interface Recording {
  a: string;
  b: string;
  language: Language;
  raw: string;
  model: string;
  revision: string;
  receipt: string;
}
export const replays: Recording[] = recordings as Recording[];
export function findReplay(a: string, b: string, language: Language): Recording | undefined {
  return replays.find((r) => r.a === a && r.b === b && r.language === language);
}
export function replay(request: Request): string {
  const record = findReplay(request.parents[0].text, request.parents[1].text, request.language);
  if (!record)
    throw new Error(
      'There is no recorded model result for these exact scraps and language. Use local AI for your own ideas.',
    );
  parseOutput(record.raw, record.a, record.b);
  return record.raw;
}
export class BrowserAI {
  private worker: Worker | null = null;
  private rejectPending: ((reason: Error) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  loaded: ModelKey | null = null;
  private call(
    message: object,
    onProgress: (value: number, label: string) => void,
    timeout: number,
  ): Promise<Record<string, unknown>> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error('The model is not loaded.'));
    return new Promise((resolve, reject) => {
      this.rejectPending = reject;
      const timer = setTimeout(() => {
        reject(new Error('The local model timed out. Your slot is still available.'));
        this.cancel();
      }, timeout);
      this.timer = timer;
      worker.onmessage = (e: MessageEvent<Record<string, unknown>>) => {
        const data = e.data;
        if (data.type === 'progress') {
          const p = data.progress as { status: string; progress?: number; file?: string };
          if (p.status === 'progress_total') onProgress(p.progress ?? 0, 'Downloading model files');
          else if (p.status === 'done') onProgress(100, 'Preparing model on your GPU');
          return;
        }
        clearTimeout(timer);
        this.timer = null;
        this.rejectPending = null;
        if (data.type === 'error') {
          reject(new Error(String(data.message)));
          return;
        }
        resolve(data);
      };
      worker.onerror = (e) => {
        clearTimeout(timer);
        this.timer = null;
        this.rejectPending = null;
        reject(new Error(e.message || 'The model worker stopped.'));
      };
      worker.postMessage(message);
    });
  }
  async load(key: ModelKey, onProgress: (value: number, label: string) => void): Promise<void> {
    const gpu = (
      navigator as Navigator & {
        gpu?: { requestAdapter: () => Promise<{ features: Set<string> } | null> };
      }
    ).gpu;
    if (!gpu)
      throw new Error(
        'This browser does not provide WebGPU. Try the sample garden or local Ollama.',
      );
    const adapter = await gpu.requestAdapter();
    if (!adapter || !adapter.features.has('shader-f16'))
      throw new Error('The GPU needs WebGPU with shader-f16 support for this model.');
    this.cancel();
    this.worker = new Worker(new URL('./browser.worker.ts', import.meta.url), { type: 'module' });
    await this.call({ type: 'load', model: key }, onProgress, 600000);
    this.loaded = key;
  }
  async generate(
    request: Request,
    signal: AbortSignal,
    checkpoint: (raw: string) => Promise<void>,
  ): Promise<string> {
    const abort = () => this.cancel();
    signal.addEventListener('abort', abort, { once: true });
    try {
      return await generateWithEvidence(
        request,
        signal,
        async (repair) => {
          const result = await this.call(
            {
              type: 'generate',
              model: this.loaded,
              a: request.parents[0].text,
              b: request.parents[1].text,
              language: request.language,
              repair,
            },
            () => {},
            120000,
          );
          if (typeof result.raw !== 'string')
            throw new Error('The worker returned no model response.');
          return result.raw;
        },
        checkpoint,
      );
    } finally {
      signal.removeEventListener('abort', abort);
    }
  }
  cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.worker?.terminate();
    this.worker = null;
    this.loaded = null;
    this.rejectPending?.(new Error('Cancelled. Your slot has not been used.'));
    this.rejectPending = null;
  }
}
export const browserAI = new BrowserAI();
export async function ollamaHealth(): Promise<{
  token: string;
  model: string;
  digest: string;
  monitoring?: boolean;
}> {
  const r = await fetch('./api/health', { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error('Local AI needs the loopback server. See How it works → Run locally.');
  return r.json() as Promise<{
    token: string;
    model: string;
    digest: string;
    monitoring?: boolean;
  }>;
}
export async function ollamaGenerate(
  r: Request,
  token: string,
  signal: AbortSignal,
  checkpoint: (raw: string) => Promise<void>,
): Promise<string> {
  return generateWithEvidence(
    r,
    signal,
    async (repair) => {
      const response = await fetch('./api/ferment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Compost-Token': token },
        body: JSON.stringify({
          a: r.parents[0].text,
          b: r.parents[1].text,
          language: r.language,
          requestId: r.id,
          repair,
        }),
        signal,
      });
      const data = (await response.json()) as {
        raw?: string;
        error?: string;
        digest?: string;
        upstreamError?: string | null;
      };
      if (!response.ok || typeof data.raw !== 'string')
        throw new Error(data.error ?? 'Local model unavailable.');
      // A model replacement is a transport/provenance error, but its original output
      // must still reach the journal before being rejected.
      if (data.digest !== r.modelRevision || data.upstreamError) {
        await checkpoint(data.raw);
        throw new Error(
          data.upstreamError ??
            `The installed model changed from ${r.modelRevision} to ${data.digest ?? 'unknown'}. Reconnect local AI and retry.`,
        );
      }
      return data.raw;
    },
    checkpoint,
  );
}
export { MODELS };
