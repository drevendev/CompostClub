import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { hash } from '../src/domain/coherent/hash';
import type { CoherentCommand, CoherentView } from '../desktop/coherent-types';

const executable = process.env.COMPOST_TEST_EXE,
  models = process.env.COMPOST_TEST_MODELS;
if (!executable || !models)
  throw new Error(
    'Select installed runtime/model paths explicitly; this test never downloads anything.',
  );
await mkdir('.local', { recursive: true });
const output = await mkdtemp(path.resolve('.local/coherent-background-')),
  data = path.join(output, 'data');
const build: Record<string, string> = {};
async function identify(root: string) {
  for (const e of await readdir(root, { withFileTypes: true })) {
    const file = path.join(root, e.name);
    if (e.isDirectory()) await identify(file);
    else build[file.replaceAll('\\', '/')] = hash(await readFile(file));
  }
}
await identify('dist-desktop');
await identify('dist-desktop-ui');
const sourceHash = hash(await readFile('desktop/coherent-controller.ts'));
const port = await new Promise<number>((resolve, reject) => {
  const s = createServer();
  s.once('error', reject);
  s.listen(0, '127.0.0.1', () => {
    const a = s.address();
    if (!a || typeof a === 'string') return reject(new Error('No shared-service test port.'));
    s.close((e) => (e ? reject(e) : resolve(a.port)));
  });
});
const shared = spawn(executable, ['serve'], {
  windowsHide: true,
  stdio: 'ignore',
  env: {
    ...process.env,
    OLLAMA_HOST: `127.0.0.1:${port}`,
    OLLAMA_MODELS: models,
    OLLAMA_NO_CLOUD: '1',
    OLLAMA_KEEP_ALIVE: '0',
  },
});
const alive = (pid: number | undefined) => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
};
const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let app: ElectronApplication | undefined, page: Page | undefined;
const errors: string[] = [],
  observed: Record<string, unknown>[] = [];
const result: Record<string, unknown> = {
  label:
    'Genuine local inference on independently authored fictional sources. Real wall clock; no accelerated timers. Automated acceptance choices are not owner usefulness judgments.',
  buildSha256: hash(JSON.stringify(build)),
  build,
  sourceHash,
  startedAt: new Date().toISOString(),
  intervalMinutes: 15,
  sharedServiceSurvival: [],
  resources: [],
  lifecycle: [],
  status: 'running',
};
async function launch() {
  app = await electron.launch({
    args: [path.resolve('dist-desktop/main.cjs'), '--compost-data-dir=' + data],
    cwd: process.cwd(),
    env: { ...process.env, COMPOST_ACCEPTANCE: '1', COMPOST_DATA_DIR: '' },
  });
  page = await app.firstWindow();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForSelector('.coherent-app');
  const s = await invoke({ op: 'snapshot' });
  assert.equal(s.workspace.paused, true);
  return s;
}
async function invoke(c: CoherentCommand): Promise<CoherentView> {
  if (!page) throw new Error('No test window.');
  const s = await page.evaluate((c) => window.compost.invoke(c), c);
  if (s.error) throw new Error(s.error);
  return s;
}
async function memory(pid: number | undefined) {
  if (!pid) return null;
  const script =
    'Get-Process -Id ([int]$env:COMPOST_MEASURE_PID) -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64,PeakWorkingSet64,CPU | ConvertTo-Json -Compress';
  const r = await promisify(execFile)(
    path.join(process.env.SystemRoot!, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(script, 'utf16le').toString('base64'),
    ],
    {
      windowsHide: true,
      env: { ...process.env, COMPOST_MEASURE_PID: String(pid) },
      timeout: 10000,
    },
  );
  return r.stdout.trim() ? (JSON.parse(r.stdout) as unknown) : null;
}
async function save() {
  await writeFile(path.join(output, 'acceptance.json'), JSON.stringify(result, null, 2) + '\n');
}
async function awaitStage(target: 'generating' | 'screening', command: CoherentCommand) {
  await invoke(command);
  const until = Date.now() + 240000;
  while (Date.now() < until) {
    const s = await invoke({ op: 'snapshot' }),
      j = s.workspace.jobs.find((j) => j.id === s.activeJob);
    if (j?.stage === target) return s;
    if (!s.busy) return null;
    await pause(100);
  }
  throw new Error('Timed out awaiting genuine ' + target);
}
try {
  let s = await launch(),
    g = s.workspace.gardens[0]!.id;
  await invoke({
    op: 'gardenSettings',
    id: g,
    profile: 'game',
    objective:
      'Design a short turn-based evacuation puzzle for one player. Goal: bring two miners to the surface in six turns. Connect the supplied source actions into one proposed mechanism; new rules are creative proposals.',
    interval: 15,
  });
  await app!.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [file] });
  }, executable);
  await invoke({ op: 'pickExecutable' });
  await app!.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [file] });
  }, models);
  await invoke({ op: 'pickModels' });
  const texts = [
    'Fictional game: open a steam valve to lift one elevator, reducing pressure in the other shaft.',
    'Fictional game: move a counterweight to save steam, but block one landing for a turn.',
    'Fictional game: a miner carries a warning lamp; lighting a shaft reveals its next obstacle while the other shaft stays dark.',
    'Fictional game: spend a repair token to hold one cracked beam, but lose an action for that miner next turn.',
    'Fictional game: a cart can take a shortcut only after unloading a crate, reducing the final rescue reward.',
    'Fictional game: rotate one rail switch to bring a cart to a safe platform while delaying the second cart.',
  ];
  for (const [i, text] of texts.entries())
    await invoke({
      op: 'add',
      garden: g,
      title: 'Fictional acceptance source ' + (i + 1),
      text,
      participating: true,
    });
  await invoke({ op: 'background', id: g, enabled: true });
  s = await invoke({ op: 'resume' });
  const enabledAt = Date.now();
  result.enabledAt = new Date(enabledAt).toISOString();
  result.firstDue = s.workspace.gardens[0]!.nextAt;
  await app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
  assert.equal(
    await app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isVisible()),
    false,
  );
  result.windowClosedToTray = true;
  let lastResource = 0,
    lastCount = 0;
  const deadline = enabledAt + 60 * 60000;
  while (Date.now() < deadline) {
    s = await invoke({ op: 'snapshot' });
    const jobs = s.workspace.jobs.filter((j) => !j.plan.manual && j.attemptCharged);
    if (jobs.length !== lastCount) {
      lastCount = jobs.length;
      console.log(
        JSON.stringify({
          scheduledDispatches: lastCount,
          at: new Date().toISOString(),
          stage: jobs.at(-1)?.stage,
        }),
      );
      result.scheduled = jobs.map((j) => ({
        id: j.id,
        stage: j.stage,
        entry: j.entry.at,
        calls: s.workspace.calls.filter((c) => c.job === j.id),
        history: j.history,
      }));
      await save();
    }
    if (
      Date.now() - lastResource >= 60000 ||
      (s.busy &&
        !(result.resources as Record<string, unknown>[]).some((r) => r.pid === s.model.pid))
    ) {
      lastResource = Date.now();
      (result.resources as Record<string, unknown>[]).push({
        at: Date.now(),
        busy: s.busy,
        pid: s.model.pid ?? null,
        model: await memory(s.model.pid),
        electron: await app!.evaluate(({ app }) =>
          app
            .getAppMetrics()
            .map((m) => ({ pid: m.pid, type: m.type, cpu: m.cpu, memory: m.memory })),
        ),
      });
      await save();
    }
    if (jobs.length >= 3 && !s.busy) break;
    if (s.status === 'attention' || s.workspace.paused)
      throw new Error('Real background run stopped for attention: ' + s.reason);
    await pause(1000);
  }
  const scheduled = s.workspace.jobs.filter((j) => !j.plan.manual && j.attemptCharged);
  assert.equal(scheduled.length, 3, 'Three real scheduled dispatches required.');
  const times = scheduled.map((j) => s.workspace.calls.find((c) => c.job === j.id)!.at);
  assert.ok(times[0]! >= enabledAt + 900000);
  assert.ok(times[1]! - times[0]! >= 900000);
  assert.ok(times[2]! - times[1]! >= 900000);
  result.realSpacingMs = [times[1]! - times[0]!, times[2]! - times[1]!];
  result.scheduledOutcomes = scheduled.map((j) => ({
    stage: j.stage,
    generationCalls: s.workspace.calls.filter(
      (c) => c.job === j.id && c.stage.startsWith('generating'),
    ).length,
    screeningCalls: s.workspace.calls.filter(
      (c) => c.job === j.id && c.stage.startsWith('screening'),
    ).length,
  }));
  await invoke({ op: 'pause' });
  assert.ok(alive(shared.pid));
  for (const target of ['generating', 'screening'] as const) {
    s = await invoke({ op: 'snapshot' });
    const draft = s.workspace.jobs.find(
      (j) =>
        j.draft?.outcome === 'candidate' &&
        ['needs_revision', 'needs_context', 'interrupted'].includes(j.stage),
    );
    const command: CoherentCommand =
      target === 'generating'
        ? { op: 'run', garden: g }
        : draft
          ? { op: 'check', id: draft.id }
          : { op: 'run', garden: g };
    const active = await awaitStage(target, command);
    if (!active) {
      observed.push({ target, status: 'not reached; original model outcome retained' });
      continue;
    }
    const owned = active.model.pid,
      at = Date.now();
    s = await invoke({ op: 'pause' });
    assert.equal(s.busy, false);
    assert.equal(s.model.connected, false);
    assert.equal(alive(owned), false);
    assert.ok(alive(shared.pid));
    observed.push({
      target,
      status: 'pause confirmed',
      elapsedMs: Date.now() - at,
      ownedProcessAbsent: true,
      sharedProcessSurvived: true,
    });
  }
  result.pauseDuringStages = observed;
  // Externally observe idle Exit. Other stage exits use the same authoritative
  // pause/drain/release path and are separately exercised by the lifecycle suite.
  const child = app!.process(),
    exitAt = Date.now();
  await app!.evaluate(({ app }) => app.quit());
  if (child.exitCode === null)
    await Promise.race([
      new Promise<void>((r) => child.once('exit', () => r())),
      pause(30000).then(() => {
        throw new Error('Electron did not exit.');
      }),
    ]);
  assert.notEqual(child.exitCode, null);
  result.externalExit = {
    code: child.exitCode,
    observedAt: Date.now(),
    elapsedMs: Date.now() - exitAt,
  };
  app = undefined;
  page = undefined;
  s = await launch();
  assert.equal(s.workspace.paused, true);
  assert.equal(s.model.connected, false);
  result.nextLaunchPaused = true;
  result.lifecycle = s.workspace.lifecycle;
  result.sharedServiceSurvived = alive(shared.pid);
  result.errors = errors;
  assert.deepEqual(errors, []);
  result.status = 'completed; usefulness gate separate';
} catch (e) {
  result.status = 'failed';
  result.error = e instanceof Error ? e.message : String(e);
  throw e;
} finally {
  if (app) await app.close();
  if (alive(shared.pid)) shared.kill();
  await save();
  console.log(JSON.stringify({ output, status: result.status, error: result.error ?? null }));
}
