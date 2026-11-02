import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CoherentController } from '../desktop/coherent-controller';
import { CoherentStore } from '../desktop/coherent-store';
import { addSource } from '../src/domain/coherent/workspace';
import { hash } from '../src/domain/coherent/hash';
import evaluation from '../fixtures/public/generation-fix-evaluation.json';

const executable = process.env.COMPOST_TEST_EXE,
  models = process.env.COMPOST_TEST_MODELS;
if (!executable || !models)
  throw new Error('Explicit installed executable/model directory required; no downloads.');
await mkdir('.local', { recursive: true });
const registryFile = '.local/generation-fix-evaluation-registry.json';
const registry = (await readFile(registryFile, 'utf8')
  .then(JSON.parse)
  .catch((e: NodeJS.ErrnoException) => {
    if (e.code !== 'ENOENT') throw e;
    return [];
  })) as { variant: number; at: string; output: string; contract: string }[];
const variant = Number(process.argv.find((a) => a.startsWith('--variant='))?.split('=')[1] ?? 1);
if (![1, 2].includes(variant)) throw new Error('Exactly two variants maximum.');
for (const r of registry.filter((r) => r.variant === variant)) {
  if (!process.argv.includes('--resume-infrastructure'))
    throw new Error('Variant already started; no repeated model response permitted.');
  for (const item of evaluation.cases) {
    let db: DatabaseSync | undefined;
    try {
      db = new DatabaseSync(path.join(r.output, item.id, 'garden.sqlite'), { readOnly: true });
      const w = JSON.parse(
        (db.prepare('SELECT payload FROM workspace').get() as { payload: string }).payload,
      ) as { calls: unknown[] };
      if (w.calls.length)
        throw new Error('A model dispatch exists; infrastructure retry prohibited.');
    } catch (e) {
      if (!String(e).includes('unable to open database')) throw e;
    } finally {
      db?.close();
    }
  }
}
const output = await mkdtemp(path.resolve('.local/generation-fix-evaluation-'));
const freeze = {
  variant,
  at: new Date().toISOString(),
  output,
  contract: hash(await readFile('src/domain/coherent/contract.ts')),
  admission: hash(await readFile('src/domain/coherent/admission.ts')),
  fixture: hash(await readFile('fixtures/public/generation-fix-evaluation.json')),
  maxCalls: 30,
  maxComparisonCalls: 60,
  denominator: { compatible: 8, controls: 2, ru: 4, en: 4 },
  seen: registry.length > 0,
  usefulness: 'unknown; no owner decisions created',
  rubric: evaluation.rubric,
};
registry.push(freeze);
await writeFile(registryFile, JSON.stringify(registry, null, 2));
await writeFile(path.join(output, 'freeze.json'), JSON.stringify(freeze, null, 2));
let totalCalls = 0;
const cases: Record<string, unknown>[] = [];
for (const item of evaluation.cases) {
  const s = new CoherentStore(path.join(output, item.id));
  s.change((w) => {
    w.runtime = { executable, models, model: 'gemma3:4b' };
    w.settings = {
      ...w.settings,
      calls: Math.min(3, 30 - totalCalls),
      attempts: 1,
      candidates: 1,
      backlog: 1,
      language: item.language as 'ru' | 'en',
    };
    const g = w.gardens[0]!;
    g.name = 'Fictional ' + item.id;
    g.profile = 'game';
    g.objective =
      item.language === 'ru'
        ? 'Предложить понятную игровую механику.'
        : 'Propose a clear playable mechanic.';
    addSource(w, g.id, 'Fictional A', item.a, true, Date.now());
    addSource(w, g.id, 'Fictional B', item.b, true, Date.now());
  });
  const c = new CoherentController(
    s,
    {
      pick: async () => [],
      saveBackup: async () => true,
      confirm: async () => false,
      openDirectory: async () => {},
      autostart: () => {},
    },
    [],
  );
  const start = Date.now();
  let error = '';
  try {
    await c.command({
      op: 'eureka',
      garden: s.state.gardens[0]!.id,
      requestId: 'fixed-' + variant + '-' + item.id,
    });
    while (c.view().busy && Date.now() - start < 570000)
      await new Promise((r) => setTimeout(r, 500));
    if (c.view().busy) throw new Error('Fixed job timeout');
  } catch (e) {
    error = String(e);
  }
  await c.pause();
  const envelope = s.envelope();
  totalCalls += s.state.calls.length;
  if (totalCalls > 30) throw new Error('Comparison allowance exceeded');
  const result = {
    id: item.id,
    language: item.language,
    compatible: item.compatible,
    calls: s.state.calls.length,
    durationMs: Date.now() - start,
    cards: s.state.nodes.length,
    stage: s.state.jobs[0]?.stage,
    reason: s.state.jobs[0]?.primaryFailure || s.state.requests?.[0]?.reason || error,
    decision: s.state.jobs[0]?.assessment?.decision,
    released: !c.runtime.running,
  };
  cases.push(result);
  await writeFile(path.join(output, item.id + '.json'), JSON.stringify(envelope, null, 2));
  await writeFile(
    path.join(output, 'summary.json'),
    JSON.stringify({ freeze, totalCalls, cases }, null, 2),
  );
  console.log(JSON.stringify(result));
  await c.close();
}
console.log(
  JSON.stringify({
    output,
    totalCalls,
    technicalRuEn: ['ru', 'en'].every((l) => cases.some((c) => c.language === l && c.cards)),
    controlsHonest: cases.filter((c) => !c.compatible).every((c) => !c.cards),
  }),
);
