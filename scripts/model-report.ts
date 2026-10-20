import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseOutput, prompt, outputSchema, PROMPT_VERSION } from '../src/inference/contract';
const files = (await readdir('evidence/model'))
  .filter((f) => f.startsWith('ollama-') && f.endsWith('.jsonl'))
  .sort();
const summary = [];
for (const file of files) {
  const records = (await readFile('evidence/model/' + file, 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  const calls = records.slice(1) as unknown as {
    case: string;
    rep: number;
    attempt: number;
    raw: string;
    a: string;
    b: string;
    latencyMs: number;
    loadMs: number;
    error: string;
  }[];
  const latencies = calls.map((c) => c.latencyMs).sort((a, b) => a - b);
  const finalValid = calls.filter((c) => {
    try {
      parseOutput(c.raw, c.a, c.b);
      return true;
    } catch {
      return false;
    }
  });
  const pairs = new Set(finalValid.map((c) => c.case + '/' + c.rep));
  summary.push({
    file,
    session: records[0],
    calls: calls.length,
    primaryCalls: calls.filter((c) => c.attempt === 0).length,
    repairCalls: calls.filter((c) => c.attempt === 1).length,
    originalValidatorValid: calls.filter((c) => !c.error).length,
    finalValidatorValidCalls: finalValid.length,
    finalValidatorSuccessfulRuns: pairs.size,
    medianMs: latencies[Math.floor(latencies.length / 2)],
    maxMs: latencies.at(-1),
    firstLoadMs: calls[0]?.loadMs,
    allLoadMs: calls.map((c) => c.loadMs),
  });
}
await writeFile('evidence/model/summary.json', JSON.stringify(summary, null, 2) + '\n');
await mkdir('prompts', { recursive: true });
await writeFile('prompts/model-output.schema.json', JSON.stringify(outputSchema, null, 2) + '\n');
await writeFile(
  'prompts/README.md',
  `# Model contract\n\nCurrent prompt version: ${PROMPT_VERSION}. The canonical executable prompt and dynamic quote schema are in src/inference/contract.ts. schemaFor constrains quote fields to an empty no_blend value or the exact deterministic source fragment. The app validates all five fields again, exact parent substrings, Unicode lengths and control characters. A complete JSON markdown fence may be unwrapped; no other prose is accepted.\n\nExample prompt rendering (authored neutral test inputs):\n\n\x60\x60\x60text\n${prompt('A tiny library lends pocket clouds.', 'A robot finds forgotten kitchen words.', 'en')}\n\x60\x60\x60\n\nModel output is always retained unchanged before parsing. Application IDs, clocks, model identity and lineage are assigned by code. A quote is not proof of a good blend.\n`,
);
console.log(
  JSON.stringify(
    summary.map((s) => ({
      file: s.file,
      calls: s.calls,
      primary: s.primaryCalls,
      repair: s.repairCalls,
      validFinal: s.finalValidatorSuccessfulRuns,
      medianMs: Math.round(s.medianMs ?? 0),
      maxMs: Math.round(s.maxMs ?? 0),
    })),
    null,
    2,
  ),
);
