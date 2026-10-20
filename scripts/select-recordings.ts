import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseOutput } from '../src/inference/contract';
const file = 'evidence/model/ollama-gemma3-4b-2026-10-20T16-45-52.876Z.jsonl';
const lines = (await readFile(file, 'utf8'))
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line) as Record<string, unknown>);
const session = lines[0] as { model: { name: string; digest: string }; promptVersion: string };
const selected = [
  'development-01-02',
  'development-01-03',
  'development-02-04',
  'development-04-05',
  'development-05-06',
  'holdout-01-05',
  'holdout-02-05',
];
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const results = selected.map((id) => {
  const call = lines.find((l) => l.case === id && l.rep === 0 && l.attempt === 0) as {
    a: string;
    b: string;
    raw: string;
    language: string;
    error: string;
  };
  if (!call || call.error) throw new Error('Recording missing or failed: ' + id);
  parseOutput(call.raw, call.a, call.b);
  return {
    a: call.a,
    b: call.b,
    language: call.language,
    raw: call.raw,
    model: session.model.name,
    revision: session.model.digest,
    promptVersion: session.promptVersion,
    receipt: `${file}#${id}/rep0/attempt0`,
    aSha256: sha(call.a),
    bSha256: sha(call.b),
    rawSha256: sha(call.raw),
  };
});
await writeFile('fixtures/public/recordings.json', JSON.stringify(results, null, 2) + '\n');
console.log('Selected', results.length, 'unchanged, validated real model outputs.');
