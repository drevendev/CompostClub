// Genuine model-stage Exit through the local operator, with no UI automation.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import net from 'node:net';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { CoherentStore } from '../desktop/coherent-store';
import { addSource } from '../src/domain/coherent/workspace';
import { identity } from '../src/domain/coherent/prepare';
import type { CoherentCommand, CoherentView } from '../desktop/coherent-types';
const [candidate, backup] = process.argv.slice(2),
  executable = process.env.COMPOST_TEST_EXE,
  models = process.env.COMPOST_TEST_MODELS;
if (!candidate || !backup || !executable || !models)
  throw new Error(
    'Provide exact portable, retained fictional genuine backup, and explicitly installed runtime paths.',
  );
await mkdir('.local', { recursive: true });
const output = await mkdtemp(path.resolve('.local/operator-stages-')),
  rows: unknown[] = [];
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const alive = (pid: number | undefined) => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code !== 'ESRCH';
  }
};
for (const target of ['generating', 'screening'] as const) {
  const data = path.join(output, target),
    store = new CoherentStore(data);
  store.restore(await readFile(backup, 'utf8'));
  let parents: ReturnType<typeof identity>[] = [];
  store.change((w) => {
    w.runtime = { executable, models, model: 'gemma3:4b' };
    w.exportDirectory = '';
    w.settings.calls = 96;
    w.settings.attempts = 48;
    w.settings.candidates = 48;
    w.settings.backlog = 20;
    if (target === 'generating') {
      const a = addSource(
        w,
        w.gardens[0]!.id,
        'Fictional operator tide',
        'Fictional game: open a tide gate to route a boat but flood another channel.',
        true,
        Date.now(),
      );
      const b = addSource(
        w,
        w.gardens[0]!.id,
        'Fictional operator debt',
        'Fictional game: borrow a signal now, then repay by closing a gate next turn.',
        true,
        Date.now(),
      );
      parents = [
        identity(w.sources.find((s) => s.id === a)!),
        identity(w.sources.find((s) => s.id === b)!),
      ];
    }
  });
  store.close();
  const child: ChildProcessWithoutNullStreams = spawn(
    path.join(path.resolve(candidate), 'CompostClub.exe'),
    ['--compost-data-dir=' + data, '--compost-start-hidden'],
    {
      windowsHide: true,
      stdio: 'pipe',
      env: { ...process.env, COMPOST_ACCEPTANCE: '', COMPOST_DATA_DIR: '' },
    },
  );
  let stderr = '';
  child.stderr?.on('data', (p) => {
    stderr += String(p);
  });
  type Connection = { pid: number; address: string; token: string };
  let c: Connection | undefined;
  for (let i = 0; i < 150; i++) {
    try {
      c = JSON.parse(
        await readFile(path.join(data, 'operator-connection.private.json'), 'utf8'),
      ) as Connection;
      if (c.pid === child.pid) break;
    } catch {}
    await delay(100);
  }
  assert.equal(c?.pid, child.pid);
  const invoke = async (command: CoherentCommand) =>
    await new Promise<CoherentView>((resolve, reject) => {
      const s = net.createConnection(c!.address),
        parts: Buffer[] = [];
      s.setTimeout(15000, () => s.destroy(new Error('Operator stage response timeout')));
      s.once('error', reject);
      s.once('connect', () =>
        s.write(JSON.stringify({ version: 1, token: c!.token, command }) + '\n'),
      );
      s.on('data', (p) => parts.push(Buffer.isBuffer(p) ? p : Buffer.from(p)));
      s.once('end', () => {
        const r = JSON.parse(Buffer.concat(parts).toString('utf8')) as {
          ok: boolean;
          error: string;
          view: CoherentView;
        };
        if (!r.ok) reject(new Error(r.error));
        else resolve(r.view);
      });
    });
  try {
    let s = await invoke({ op: 'snapshot' });
    const draft = s.workspace.jobs.find((j) => j.draft?.outcome === 'candidate')!;
    assert.ok(draft);
    await invoke(
      target === 'generating'
        ? { op: 'run', garden: s.workspace.gardens[0]!.id, parents }
        : { op: 'check', id: draft.id },
    );
    const deadline = Date.now() + 180000;
    let reached = false;
    while (Date.now() < deadline) {
      s = await invoke({ op: 'snapshot' });
      if (s.workspace.jobs.find((j) => j.id === s.activeJob)?.stage === target && s.model.pid) {
        reached = true;
        break;
      }
      if (!s.busy) throw new Error('Original model stage ended before the requested Exit.');
      await delay(50);
    }
    assert.ok(reached);
    const owned = s.model.pid,
      calls = s.workspace.calls.length,
      at = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const exited = new Promise<number | null>((r) => child.once('exit', (code) => r(code)));
    await invoke({ op: 'exit' });
    try {
      assert.equal(
        await Promise.race([
          exited,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Model-stage native Exit timeout')), 15000);
          }),
        ]),
        0,
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
    assert.equal(alive(owned), false);
    assert.doesNotMatch(stderr, /Object has been destroyed|Uncaught Exception/);
    const reopened = new CoherentStore(data);
    assert.equal(reopened.state.paused, true);
    assert.equal(reopened.state.calls.length, calls);
    assert.ok(reopened.state.lifecycle.some((e) => e.kind === 'shutdown prepared'));
    reopened.close();
    rows.push({
      target,
      exitCode: 0,
      exitMs: Date.now() - at,
      ownedModelProcessAbsent: true,
      dispatchedCallsRetained: true,
      nextStoreOpenPaused: true,
      uncaughtDestroyedWebContents: false,
    });
  } finally {
    if (child.exitCode === null) child.kill();
  }
}
const identityFile = JSON.parse(
  await readFile(path.join(candidate, 'PACKAGE-IDENTITY.json'), 'utf8'),
) as { sha256: string };
await writeFile(
  path.join(output, 'acceptance.json'),
  JSON.stringify(
    {
      packageSha256: identityFile.sha256,
      control:
        'Actual native EXE and authenticated local pipe; genuine model calls on retained fictional evidence; no UI automation',
      rows,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify({ output, rows }));
