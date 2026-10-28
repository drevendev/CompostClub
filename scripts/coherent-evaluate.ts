import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CoherentStore } from '../desktop/coherent-store';
import { CoherentController } from '../desktop/coherent-controller';
import { OwnedOllama } from '../desktop/runtime';
import { hash } from '../src/domain/coherent/hash';
import { current, identity } from '../src/domain/coherent/prepare';
import { prompt, schemaFor, parseOutput } from '../src/inference/contract';
import type { Language } from '../src/inference/contract';
import { appendFileSync } from 'node:fs';
import evaluation from '../fixtures/public/coherent-evaluation.json';

const executable = process.env.COMPOST_TEST_EXE,
  models = process.env.COMPOST_TEST_MODELS;
if (!executable || !models)
  throw new Error(
    'Set explicitly installed COMPOST_TEST_EXE and COMPOST_TEST_MODELS; no downloads.',
  );
await mkdir('.local', { recursive: true });
const fixtureHash = hash(await readFile('fixtures/public/coherent-evaluation.json')),
  contractHash = hash(await readFile('src/domain/coherent/contract.ts'));
const registryPath = '.local/coherent-evaluation-registry.json';
const registry: {
  fixture: string;
  cases: { id: string; hash: string }[];
  at: string;
  purpose: string;
}[] = await readFile(registryPath, 'utf8')
  .then(JSON.parse)
  .catch((e: NodeJS.ErrnoException) => {
    if (e.code !== 'ENOENT') throw e;
    return [];
  });
// Existing successful runs predate the registry. Import their seen status before
// allowing another dispatch; a rerun must never describe these cases as holdout.
for (const dir of await readdir('.local', { withFileTypes: true })) {
  if (!dir.isDirectory() || !dir.name.startsWith('coherent-evaluation-')) continue;
  const previous = await readFile(path.join('.local', dir.name, 'results.json'), 'utf8')
    .then(JSON.parse)
    .catch((e: NodeJS.ErrnoException) => {
      if (e.code !== 'ENOENT') throw e;
      return null;
    });
  if (
    previous?.freeze?.fixtureHash === fixtureHash &&
    !registry.some((r) => r.fixture === fixtureHash)
  )
    registry.push({
      fixture: fixtureHash,
      cases: evaluation.cases.map((c) => ({ id: c.id, hash: hash(JSON.stringify(c)) })),
      at: previous.freeze.frozenAt,
      purpose: 'Previously observed evaluation; imported seen registry',
    });
}
const seenBefore = evaluation.cases
  .filter((c) =>
    registry.some((r) =>
      r.cases.some((old) => old.id === c.id || old.hash === hash(JSON.stringify(c))),
    ),
  )
  .map((c) => c.id);
const repeatPurpose =
  process.argv
    .find((a) => a.startsWith('--repeat-purpose='))
    ?.slice('--repeat-purpose='.length)
    .trim() ?? '';
await writeFile(registryPath, JSON.stringify(registry, null, 2) + '\n');
if (seenBefore.length && !repeatPurpose)
  throw new Error(
    'These cases are already seen: ' +
      seenBefore.join(', ') +
      '. A disclosed new --repeat-purpose=... is required. This cannot renew a holdout claim.',
  );
registry.push({
  fixture: fixtureHash,
  cases: evaluation.cases.map((c) => ({ id: c.id, hash: hash(JSON.stringify(c)) })),
  at: new Date().toISOString(),
  purpose: repeatPurpose || 'First fixed comparison',
});
// Persist before any call, so interrupted runs are conservatively seen too.
await writeFile(registryPath, JSON.stringify(registry, null, 2) + '\n');
const output = await mkdtemp(path.resolve('.local/coherent-evaluation-'));
const freeze = {
  frozenAt: new Date().toISOString(),
  fixtureHash,
  contractHash,
  pipeline:
    'coherent-2; candidate-1; UTF-8 byte upper bound; actual matching tokenizer unavailable',
  model: 'gemma3:4b',
  allowedCalls: 96,
  allowedAttempts: 48,
  caseIds: evaluation.cases.map((c) => c.id),
  compatibleDenominator: 12,
  controls: 4,
  languages: '6 RU + 6 EN compatible cases',
  baseline:
    'Existing splice-1 short-output contract, original two texts and up to one format repair; no semantic checker or added objective/reference preparation.',
  newPipeline:
    'Full prepared source/context/reference facts, explicit objective, rich contract and bounded checker. Distinct preparation and call costs are reported.',
  seen: seenBefore.length > 0,
  seenBefore,
  repeatPurpose,
  ownerScores: 'pending; never inferred from model screening',
  rubric: [
    'clear player action/choice/consequence',
    'recognizable contributions from both parents',
    'interacting mechanism',
    'coherent constraints',
    'source-supported reference attributions',
    'requested language',
    'Keep / Develop / Reject with reason',
  ],
};
await writeFile(path.join(output, 'freeze.json'), JSON.stringify(freeze, null, 2));
const cases: Record<string, unknown>[] = [];
let totalCalls = 0;
const latencies: number[] = [];
const escaped = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
for (const item of evaluation.cases) {
  const refId = 'reference' in item ? item.reference : undefined,
    ref = evaluation.referenceFacts.find((r) => r.id === refId);
  const baselineFile = path.join(output, item.id + '-baseline.jsonl');
  const baseline: {
    raw: string[];
    transports: string[];
    calls: { at: number; durationMs: number; promptHash: string; error: string }[];
    error: string;
    output: unknown;
  } = { raw: [], transports: [], calls: [], error: '', output: null };
  const runtime = new OwnedOllama(),
    settings = { executable, models, model: 'gemma3:4b' as const };
  try {
    await runtime.start(settings);
    let repair = '';
    for (let i = 0; i < 2; i++) {
      if (totalCalls >= 96) throw new Error('Fixed evaluation call limit reached.');
      const started = Date.now(),
        p = prompt(item.a, item.b, item.language as Language, repair);
      let error = '';
      try {
        const raw = await runtime.generate(
          p,
          schemaFor(item.a, item.b),
          parseInt(hash(item.id).slice(0, 8), 16),
          AbortSignal.timeout(180000),
          (body) => {
            baseline.transports.push(body);
            appendFileSync(
              baselineFile,
              JSON.stringify({ at: Date.now(), phase: 'transport', raw: body }) + '\n',
            );
          },
          () => {
            totalCalls++;
            appendFileSync(
              baselineFile,
              JSON.stringify({
                at: Date.now(),
                phase: 'dispatch',
                prompt: p,
                schema: schemaFor(item.a, item.b),
                model: runtime.model,
                digest: runtime.digest,
              }) + '\n',
            );
          },
        );
        appendFileSync(
          baselineFile,
          JSON.stringify({ at: Date.now(), phase: 'model', raw }) + '\n',
        );
        baseline.raw.push(raw);
        try {
          baseline.output = parseOutput(raw, item.a, item.b);
          break;
        } catch (e) {
          repair = e instanceof Error ? e.message : String(e);
          baseline.error = repair;
          if (i) throw e;
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        baseline.error = error;
        if (i === 1 || !repair) break;
      } finally {
        const ms = Date.now() - started;
        latencies.push(ms);
        baseline.calls.push({ at: started, durationMs: ms, promptHash: hash(p), error });
      }
    }
  } catch (e) {
    baseline.error = e instanceof Error ? e.message : String(e);
  } finally {
    await runtime.release();
  }
  const s = new CoherentStore(path.join(output, item.id));
  s.change((w) => {
    w.runtime = settings;
    w.settings.language = item.language as Language;
    w.settings.calls = Math.max(1, 96 - totalCalls);
    w.settings.attempts = 48;
    w.settings.candidates = 48;
    w.settings.backlog = 20;
    const g = w.gardens[0]!;
    g.profile = 'game';
    g.objective = item.objective;
  });
  const c = new CoherentController(
      s,
      {
        pick: () => Promise.resolve([]),
        confirm: () => Promise.resolve(false),
        saveBackup: () => Promise.resolve(false),
        openDirectory: () => Promise.resolve(),
        autostart: () => {},
      },
      [],
    ),
    g = s.state.gardens[0]!.id;
  let preflight = '';
  try {
    let sourceA = item.a;
    if (ref)
      sourceA +=
        '\n\nSupplied primary-source reference description: ' + ref.name + ': ' + ref.property;
    await c.command({
      op: 'add',
      garden: g,
      title: item.id + ' A',
      text: sourceA,
      participating: true,
    });
    await c.command({
      op: 'add',
      garden: g,
      title: item.id + ' B',
      text: item.b,
      participating: true,
    });
    if (ref) {
      const source = s.state.sources[0]!;
      await c.command({
        op: 'reference',
        source: source.id,
        name: ref.name,
        url: ref.url,
        property: ref.property,
        differ:
          'All fictional setting and additional mechanics are new proposals, not claims about the reference.',
        status: 'source-supported property',
        essential: false,
        spans: [current(source).spans.at(-1)!.id],
      });
    }
    if ('essentialReference' in item && item.essentialReference)
      await c.command({
        op: 'reference',
        source: s.state.sources[0]!.id,
        name: 'The Quiet Province',
        url: 'https://example.invalid/quiet-province',
        property: '',
        differ: 'Unknown',
        status: 'uninspected link',
        essential: true,
        spans: [],
      });
    if (totalCalls + 2 > 96)
      throw new Error('Fixed evaluation call allowance cannot reserve a two-stage job.');
    await c.command({ op: 'run', garden: g, parents: s.state.sources.map(identity) });
    while (c.view().busy) await new Promise((r) => setTimeout(r, 250));
  } catch (e) {
    preflight = e instanceof Error ? e.message : String(e);
  }
  const job = s.state.jobs[0] ?? null;
  totalCalls += s.state.calls.length;
  const newPipeline = {
    preflight,
    stage: job?.stage ?? 'preflight needs_context',
    calls: s.state.calls.length,
    draft: job?.draft ?? null,
    assessment: job?.assessment ?? null,
    raw: job?.raw ?? [],
    primaryFailure: job?.primaryFailure ?? '',
    repairRefusal: job?.repairRefusal ?? '',
    stages: job?.history ?? [],
    dispatches: job?.dispatches ?? [],
    jobLatencyMs: job ? job.history.at(-1)!.at - job.entry.at : null,
  };
  await writeFile(
    path.join(output, item.id, 'full-private-evidence.json'),
    JSON.stringify(s.envelope(), null, 2),
  );
  cases.push({
    id: item.id,
    kind: item.kind,
    language: item.language,
    input: {
      a: item.a,
      b: item.b,
      objective: item.objective,
      intendedContributions: item.contributions,
      reference: ref ?? null,
    },
    baseline,
    newPipeline,
    humanReview: {
      rawDraftDecision: null,
      displayableDecision: null,
      reason: '',
      unsupportedAttribution: null,
      screeningFalsePositive: null,
      screeningFalseNegative: null,
    },
  });
  await c.close();
  await writeFile(
    path.join(output, 'results.json'),
    JSON.stringify(
      {
        freeze: { ...freeze, seen: true },
        totalCalls,
        cases,
        ownerScores: 'pending',
        promotion: 'not certified; all profiles remain experimental',
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      id: item.id,
      baselineCalls: baseline.calls.length,
      stage: newPipeline.stage,
      newCalls: newPipeline.calls,
      totalCalls,
    }),
  );
}
const sample = (p: number) =>
  latencies.length
    ? latencies.slice().sort((a, b) => a - b)[
        Math.min(latencies.length - 1, Math.ceil(p * latencies.length) - 1)
      ]
    : null;
const summary = {
  fixtureHash,
  contractHash,
  cases: cases.length,
  compatibleDenominator: 12,
  controls: 4,
  totalCalls,
  baselineStageLatencyMs: { median: sample(0.5), p95: sample(0.95), max: sample(1) },
  newStageLatency:
    'Exact durable dispatch/history timings in results.json; provider prompt/eval token observations preserved. No heuristic token counts are presented as observed.',
  humanReview: 'pending',
  qualityGate:
    'Not promoted. Owner Keep/Develop thresholds, false positives/negatives and reference attribution review require actual human decisions.',
  runtimeRelease:
    'Owned runtime awaited after every case; native lifecycle/resource evidence is separate.',
  sourceMaterial:
    'All inputs fictional and public; primary-source reference facts separately attributed in fixture. No owner data used.',
};
await writeFile(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Coherent Gardens owner review</title><style>body{font:17px/1.5 system-ui;max-width:1100px;margin:auto;padding:24px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eee;padding:12px}article{border-top:2px solid #ccc;margin-top:32px}textarea{width:100%;min-height:90px}</style><h1>Owner review: every draft, including filtered failures</h1><p>Fictional fixed evaluation. This set is now seen. No automated Keep/Develop scores. Review action/choice/consequence, contributions, interaction, constraints, reference facts and language. At least 4/12 compatible Keep or Develop, including both languages, is only one of the required promotion gates.</p>${cases.map((c, i) => `<article><h2>${escaped(String(c.id))}</h2><pre>${escaped(JSON.stringify(c, null, 2))}</pre><label>Your raw-draft decision <select data-case="${i}"><option>Unreviewed</option><option>Keep</option><option>Develop</option><option>Reject</option></select></label><label>Reason and screening/reference observations<textarea data-note="${i}"></textarea></label></article>`).join('')}<button id="save">Save my actual reviews</button><script>document.querySelector('#save').onclick=()=>{const reviews=[...document.querySelectorAll('select[data-case]')].map(s=>({caseIndex:Number(s.dataset.case),decision:s.value,note:document.querySelector('[data-note="'+s.dataset.case+'"]').value}));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({reviewedAt:new Date().toISOString(),reviews},null,2)],{type:'application/json'}));a.download='owner-reviews.json';a.click();};</script></html>`;
await writeFile(path.join(output, 'owner-review.html'), html);
console.log(JSON.stringify({ output, summary }));
