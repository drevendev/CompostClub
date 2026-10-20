/// <reference lib="webworker" />
import { pipeline, env } from '@huggingface/transformers';
import { MODELS, type ModelKey } from './models';
import { prompt, type Language } from './contract';

env.allowLocalModels = false;
// Runtime files are bundled and served from the app origin; only model files use the disclosed CDN.
let generator: Awaited<ReturnType<typeof pipeline<'text-generation'>>> | undefined;
let activeKey: ModelKey | undefined;
self.onmessage = async (
  event: MessageEvent<{
    type: 'load' | 'generate';
    model: ModelKey;
    a?: string;
    b?: string;
    language?: Language;
    repair?: string;
  }>,
) => {
  try {
    const data = event.data;
    if (data.type === 'load') {
      const model = MODELS[data.model];
      if (generator && activeKey !== data.model) {
        await generator.dispose();
        generator = undefined;
      }
      const start = performance.now();
      generator ??= await pipeline('text-generation', model.id, {
        revision: model.revision,
        device: 'webgpu',
        dtype: 'q4f16',
        progress_callback: (p) => self.postMessage({ type: 'progress', progress: p }),
      });
      activeKey = data.model;
      self.postMessage({ type: 'loaded', ms: performance.now() - start });
    } else {
      if (!generator) throw new Error('Load a model first.');
      const start = performance.now();
      const result = await generator(
        [
          {
            role: 'user',
            content: prompt(data.a ?? '', data.b ?? '', data.language ?? 'en', data.repair),
          },
        ],
        { max_new_tokens: 300, do_sample: false, return_full_text: false },
      );
      const first = result[0];
      const text = first && 'generated_text' in first ? first.generated_text : '';
      self.postMessage({
        type: 'result',
        raw: typeof text === 'string' ? text : (text.at(-1)?.content ?? ''),
        ms: performance.now() - start,
      });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
