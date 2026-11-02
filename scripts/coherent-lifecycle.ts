// Actual Windows Electron/Ollama Exit acceptance. The input must be a retained
// fictional evaluation backup; it never supplies synthetic model responses.
import { _electron as electron } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { CoherentStore } from '../desktop/coherent-store';
import { addSource } from '../src/domain/coherent/workspace';
import type { CoherentCommand, CoherentView } from '../desktop/coherent-types';
const executable = process.env.COMPOST_TEST_EXE,
  models = process.env.COMPOST_TEST_MODELS;
const backup = process.argv[process.argv.indexOf('--fictional-backup') + 1];
if (!executable || !models || !process.argv.includes('--fictional-backup') || !backup)
  throw new Error('Explicit installed runtime/models and --fictional-backup are required.');
await mkdir('.local', { recursive: true });
const output = await mkdtemp(path.resolve('.local/coherent-lifecycle-'));
const port = await new Promise<number>((resolve, reject) => {
  const s = createServer();
  s.once('error', reject);
  s.listen(0, '127.0.0.1', () => {
    const a = s.address();
    if (!a || typeof a === 'string') return reject(new Error('No port'));
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
  },
});
const alive = (pid: number | undefined) => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code !== 'ESRCH';
  }
};
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const results: Record<string, unknown>[] = [];
try {
  for (const target of ['generating', 'screening', 'idle'] as const) {
    const data = path.join(output, target),
      store = new CoherentStore(data);
    store.restore(await readFile(backup, 'utf8'));
    store.change((w) => {
      w.runtime = { executable, models, model: 'gemma3:4b' };
      w.exportDirectory = '';
      w.settings.calls = 96;
      w.settings.attempts = 48;
      w.settings.candidates = 48;
      w.settings.backlog = 20;
      if (target === 'generating') {
        addSource(
          w,
          w.gardens[0]!.id,
          'Fictional Exit source C',
          'Fictional game: open a tide gate to route a boat, then close its adjacent gate next turn.',
          true,
          Date.now(),
        );
        addSource(
          w,
          w.gardens[0]!.id,
          'Fictional Exit source D',
          'Fictional game: borrow one signal token to move now and repay by skipping a later move.',
          true,
          Date.now(),
        );
      }
    });
    store.close();
    const app = await electron.launch({
      args: [path.resolve('dist-desktop/main.cjs'), '--compost-data-dir=' + data],
      cwd: process.cwd(),
      env: { ...process.env, COMPOST_ACCEPTANCE: '1', COMPOST_DATA_DIR: '' },
    });
    const child = app.process();
    try {
      const page = await app.firstWindow();
      await page.waitForSelector('.coherent-app');
      const invoke = async (c: CoherentCommand): Promise<CoherentView> => {
        const s = await page.evaluate((c) => window.compost.invoke(c), c);
        if (s.error) throw new Error(s.error);
        return s;
      };
      let state = await invoke({ op: 'snapshot' });
      assert.equal(state.workspace.paused, true);
      if (target !== 'idle') {
        const draft = state.workspace.jobs.find((j) => j.draft?.outcome === 'candidate');
        assert.ok(draft, 'A genuine retained evaluation draft is required.');
        await invoke(
          target === 'screening'
            ? { op: 'check', id: draft.id }
            : { op: 'run', garden: state.workspace.gardens[0]!.id },
        );
        const deadline = Date.now() + 240000;
        while (Date.now() < deadline) {
          state = await invoke({ op: 'snapshot' });
          const job = state.workspace.jobs.find((j) => j.id === state.activeJob);
          if (job?.stage === target && state.model.connected && state.model.pid) break;
          if (!state.busy)
            throw new Error('Genuine stage ended before Exit observation: ' + state.reason);
          await delay(50);
        }
        assert.equal(state.workspace.jobs.find((j) => j.id === state.activeJob)?.stage, target);
        assert.ok(state.model.pid);
      }
      const owned = state.model.pid,
        callsBefore = state.workspace.calls.length,
        exitAt = Date.now();
      await app.evaluate(({ app }) => app.quit());
      if (child.exitCode === null)
        await Promise.race([
          new Promise<void>((r) => child.once('exit', () => r())),
          delay(30000).then(() => {
            throw new Error('Exit timed out');
          }),
        ]);
      assert.notEqual(child.exitCode, null);
      assert.equal(alive(owned), false);
      assert.equal(alive(shared.pid), true);
      const reopened = new CoherentStore(data);
      assert.equal(reopened.state.paused, true);
      assert.equal(
        reopened.state.jobs.some((j) =>
          ['generating', 'screening', 'prepared', 'draft retained'].includes(j.stage),
        ),
        false,
      );
      assert.equal(reopened.state.calls.length, callsBefore);
      assert.ok(reopened.state.lifecycle.some((e) => e.kind === 'shutdown prepared'));
      const row = {
        target,
        callsBefore,
        exitCode: child.exitCode,
        elapsedMs: Date.now() - exitAt,
        ownedProcessAbsent: true,
        sharedProcessSurvived: true,
        nextStoreOpenPaused: true,
        lifecycle: reopened.state.lifecycle,
      };
      reopened.close();
      // Check a genuine second Electron launch, not just the persisted flag.
      const next = await electron.launch({
        args: [path.resolve('dist-desktop/main.cjs'), '--compost-data-dir=' + data],
        cwd: process.cwd(),
        env: { ...process.env, COMPOST_ACCEPTANCE: '1', COMPOST_DATA_DIR: '' },
      });
      try {
        const p = await next.firstWindow();
        await p.waitForSelector('.coherent-app');
        const s = await p.evaluate(() => window.compost.invoke({ op: 'snapshot' }));
        assert.equal(s.workspace.paused, true);
        assert.equal(s.model.connected, false);
      } finally {
        await next.close();
      }
      results.push({ ...row, nextElectronLaunchPaused: true });
      await writeFile(
        path.join(output, 'acceptance.json'),
        JSON.stringify(
          {
            label:
              'Actual Exit on fictional retained genuine model draft; no owner quality decision',
            results,
          },
          null,
          2,
        ) + '\n',
      );
    } finally {
      if (child.exitCode === null) await app.close();
    }
  }
} finally {
  if (alive(shared.pid)) shared.kill();
}
console.log(JSON.stringify({ output, results }));
