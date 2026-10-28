import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CoherentStore } from '../desktop/coherent-store';
import { CoherentController } from '../desktop/coherent-controller';
import { addSource } from '../src/domain/coherent/workspace';
import cases from '../fixtures/public/rc3-regression.json';
const executable = process.env.COMPOST_TEST_EXE,
  models = process.env.COMPOST_TEST_MODELS;
if (!executable || !models) throw new Error('Explicit existing runtime required; no downloads.');
await mkdir('.local', { recursive: true });
const registryPath = '.local/rc3-regression-runs.json';
const registry = (await readFile(registryPath, 'utf8')
  .then(JSON.parse)
  .catch((e: NodeJS.ErrnoException) => {
    if (e.code !== 'ENOENT') throw e;
    return { capVariants: 2, capCalls: 36, runs: [] };
  })) as { capVariants: number; capCalls: number; runs: unknown[] };
if (registry.runs.length >= 2)
  throw new Error('Both frozen regression variants are spent; no hidden re-run or third variant.');
const output = await mkdtemp(path.resolve('.local/rc3-regression-'));
registry.runs.push({
  directory: output,
  startedAt: new Date().toISOString(),
  maxCalls: cases.maxCalls,
});
await writeFile(registryPath, JSON.stringify(registry, null, 2));
const rows: unknown[] = [];
let total = 0;
for (const item of cases.cases) {
  const s = new CoherentStore(path.join(output, item.id));
  s.change((w) => {
    w.runtime = { executable, models, model: 'gemma3:4b' };
    w.settings.language = item.language as 'ru' | 'en';
    w.settings.calls = 3;
    w.settings.attempts = 1;
    w.settings.candidates = 1;
    const g = w.gardens[0]!;
    g.profile = 'game';
    g.objective =
      item.language === 'ru' ? 'Понятная игровая механика.' : 'A clear playable mechanic.';
    addSource(w, g.id, 'Fictional A', item.a, true, Date.now());
    addSource(w, g.id, 'Fictional B', item.b, true, Date.now());
    g.background = item.trigger === 'scheduled';
    w.paused = item.trigger !== 'scheduled';
    g.nextAt = Date.now() + 1000;
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
  let timer: ReturnType<typeof setInterval> | undefined;
  try {
    if (item.trigger === 'eureka')
      await c.command({
        op: 'eureka',
        garden: s.state.gardens[0]!.id,
        requestId: 'rc3-' + item.id,
      });
    else timer = setInterval(() => c.tick(), 5000);
    while ((!s.state.jobs.length || c.view().busy) && Date.now() - start < 550000)
      await new Promise((r) => setTimeout(r, 500));
    if (!s.state.jobs.length || c.view().busy) throw new Error('Bounded regression timed out.');
  } finally {
    if (timer) clearInterval(timer);
    await c.pause();
  }
  total += s.state.calls.length;
  if (total > cases.maxCalls) throw new Error('Frozen call cap exceeded.');
  const j = s.state.jobs[0]!;
  const row = {
    id: item.id,
    trigger: item.trigger,
    compatible: item.compatible,
    calls: s.state.calls.length,
    stage: j.stage,
    decision: j.assessment?.decision,
    reason: j.primaryFailure,
    repairRefusal: j.repairRefusal,
    cards: s.state.nodes.length,
    credits: s.state.gardens[0]!.credits.balance,
    durationMs: Date.now() - start,
    dispatches: j.dispatches?.map((d) => ({
      stage: d.stage,
      prompt: d.promptTokensObserved,
      output: d.outputTokensObserved,
      doneReason: d.doneReason,
    })),
    released: !c.runtime.running,
  };
  rows.push(row);
  await writeFile(
    path.join(output, item.id, 'evidence.private.json'),
    JSON.stringify(s.envelope(), null, 2),
  );
  await c.close();
  console.log(JSON.stringify({ output, ...row }));
  await writeFile(
    path.join(output, 'summary.json'),
    JSON.stringify(
      { format: cases.format, totalCalls: total, maxCalls: cases.maxCalls, rows },
      null,
      2,
    ),
  );
}
