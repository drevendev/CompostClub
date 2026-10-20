import { useRef, useState } from 'react';
import { MODELS, type ModelKey } from './inference/models';
import { parseOutput } from './inference/contract';
import type { Language } from './inference/contract';
import scraps from '../fixtures/public/scraps.json';
export default function Experiment() {
  const worker = useRef<Worker | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [model, setModel] = useState<ModelKey>('270m');
  const [language, setLanguage] = useState<Language>('en');
  const [a, setA] = useState(scraps.scraps[0]?.text ?? '');
  const [b, setB] = useState(scraps.scraps[1]?.text ?? '');
  function log(data: unknown) {
    setLogs((l) => [...l.slice(-3), JSON.stringify(data)]);
  }
  function load() {
    setLogs([]);
    worker.current?.terminate();
    worker.current = new Worker(new URL('./inference/browser.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.current.onmessage = (e) => {
      const data = e.data as Record<string, unknown>;
      log(data);
      if (data.type === 'result') {
        try {
          log({ validation: parseOutput(String(data.raw), a, b) });
        } catch (error) {
          log({ validationError: String(error) });
        }
      }
    };
    worker.current.onerror = (e) => log({ error: e.message });
    worker.current.postMessage({ type: 'load', model });
  }
  return (
    <main style={{ padding: 30, maxWidth: 1100, margin: 'auto', fontFamily: 'system-ui' }}>
      <h1>Gemma feasibility lab</h1>
      <p>Local development experiment · public-safe fixtures only</p>
      <p>WebGPU: {'gpu' in navigator ? 'available API' : 'unavailable'}</p>
      <select
        aria-label="Model"
        value={model}
        onChange={(e) => setModel(e.target.value as ModelKey)}
      >
        <option value="270m">Gemma 3 270M</option>
        <option value="1b">Gemma 3 1B</option>
      </select>
      <select
        aria-label="Output language"
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
      >
        <option value="en">English</option>
        <option value="ru">Russian</option>
      </select>
      <p>
        {MODELS[model].id} · q4f16 · about {Math.ceil(MODELS[model].bytes / 1e6)} MB plus runtime
      </p>
      <button onClick={load}>Consent & load model</button>
      <p>
        <textarea
          aria-label="Input A"
          rows={4}
          cols={65}
          value={a}
          onChange={(e) => setA(e.target.value)}
        />
      </p>
      <p>
        <textarea
          aria-label="Input B"
          rows={4}
          cols={65}
          value={b}
          onChange={(e) => setB(e.target.value)}
        />
      </p>
      <button
        onClick={() => {
          setLogs([]);
          worker.current?.postMessage({ type: 'generate', a, b, language });
        }}
      >
        Generate real blend
      </button>
      <button
        onClick={() => {
          worker.current?.terminate();
          log({ cancelled: true });
        }}
      >
        Cancel
      </button>
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{logs.join('\n')}</pre>
    </main>
  );
}
