import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import {
  prompt,
  schemaFor,
  parseOutput,
  PROMPT_VERSION,
  type Language,
} from '../src/inference/contract';

const base = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11743';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error('Evaluation must stay on loopback.');
const model = process.env.EVAL_MODEL ?? 'gemma3:1b';
const fixtures = JSON.parse(await readFile('fixtures/public/scraps.json', 'utf8')) as {
  scraps: { id: string; text: string }[];
};
const cases = JSON.parse(await readFile('fixtures/public/eval-cases.json', 'utf8')) as {
  cases: {
    id: string;
    a: string;
    b: string;
    repetitions: number;
    outputLanguage: Language;
    split: string;
  }[];
};
await mkdir('evidence/model', { recursive: true });
const session = new Date().toISOString().replaceAll(':', '-');
const log = `evidence/model/ollama-${model.replace(':', '-')}-${session}.jsonl`;
const version = (await fetch(base + '/api/version').then((r) => r.json())) as unknown;
const tags = (await fetch(base + '/api/tags').then((r) => r.json())) as {
  models: { name: string; digest: string; details: unknown }[];
};
const identity = tags.models.find((m) => m.name === model);
if (!identity) throw new Error(`Install ${model} first.`);
await writeFile(
  log,
  JSON.stringify({
    type: 'session',
    date: session,
    version,
    model: identity,
    promptVersion: PROMPT_VERSION,
    hardware: { cpu: os.cpus()[0]?.model, ram: os.totalmem(), os: os.release(), arch: os.arch() },
  }) + '\n',
);
let valid = 0,
  total = 0,
  repairs = 0;
for (const c of cases.cases) {
  const a = fixtures.scraps.find((s) => s.id === c.a)?.text,
    b = fixtures.scraps.find((s) => s.id === c.b)?.text;
  if (!a || !b) throw new Error('Fixture missing');
  for (let rep = 0; rep < c.repetitions; rep++) {
    total++;
    let repair = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) repairs++;
      const input = prompt(a, b, c.outputLanguage, repair),
        start = performance.now();
      const response = (await fetch(base + '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: input,
          format: schemaFor(a, b),
          stream: false,
          keep_alive: '60s',
          options: { num_ctx: 4096, num_predict: 384, temperature: 0.6, seed: rep + 42 },
        }),
        signal: AbortSignal.timeout(120000),
      }).then((r) => r.json())) as {
        response?: string;
        error?: string;
        total_duration?: number;
        load_duration?: number;
        eval_count?: number;
      };
      let output: unknown;
      let error = '';
      try {
        if (response.error) throw new Error(response.error);
        output = parseOutput(response.response ?? '', a, b);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
      const record = {
        type: 'call',
        case: c.id,
        split: c.split,
        rep,
        attempt,
        language: c.outputLanguage,
        a,
        b,
        inputSha256: createHash('sha256').update(input).digest('hex'),
        raw: response.response ?? '',
        latencyMs: performance.now() - start,
        loadMs: (response.load_duration ?? 0) / 1e6,
        tokens: response.eval_count ?? 0,
        output: output ?? null,
        error,
      };
      await appendFile(log, JSON.stringify(record) + '\n');
      console.log(
        JSON.stringify({
          case: c.id,
          rep,
          attempt,
          latencyMs: Math.round(record.latencyMs),
          valid: !error,
          error,
        }),
      );
      if (!error) {
        valid++;
        break;
      }
      repair = error;
    }
  }
}
console.log(JSON.stringify({ log, total, valid, repairs }));
