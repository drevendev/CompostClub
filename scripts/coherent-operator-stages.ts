// Genuine model-stage Exit through the local operator, with no UI automation.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import net from 'node:net';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { CoherentStore } from '../desktop/coherent-store';
import { addSource } from '../src/domain/coherent/workspace';
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
for (const action of process.argv.includes('--only-recheck')
  ? ['recheck' as const]
  : process.argv.includes('--only-exit-screening') || process.argv.includes('--only-exit')
    ? ['exit' as const]
    : ['pause' as const, 'exit' as const])
  for (const target of ['generating', 'screening'] as const) {
    if (process.argv.includes('--only-exit-screening') && target !== 'screening') continue;
    if (action === 'recheck' && target === 'generating') continue;
    const data = path.join(output, action + '-' + target),
      store = new CoherentStore(data);
    store.restore(await readFile(backup, 'utf8'));
    store.change((w) => {
      w.runtime = { executable, models, model: 'gemma3:4b' };
      w.exportDirectory = '';
      w.settings.calls = 96;
      w.settings.attempts = 48;
      w.settings.candidates = 48;
      w.settings.backlog = 20;
      // This closed fictional profile committed its one initial credit. Give
      // lifecycle probes their own explicit allowance; owner data is never used.
      w.gardens[0]!.credits = { cap: 3, balance: 3, at: Date.now() };
      if (target === 'generating') {
        addSource(
          w,
          w.gardens[0]!.id,
          'Fictional operator tide',
          'Fictional game: open a tide gate to route a boat but flood another channel.',
          true,
          Date.now(),
        );
        addSource(
          w,
          w.gardens[0]!.id,
          'Fictional operator debt',
          'Fictional game: borrow a signal now, then repay by closing a gate next turn.',
          true,
          Date.now(),
        );
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
      const idleCalls = s.workspace.calls.length;
      for (let i = 0; i < 3; i++) {
        const idle = await invoke({ op: 'snapshot' });
        assert.equal(idle.model.connected, false);
        assert.equal(idle.workspace.calls.length, idleCalls);
      }
      const draft = s.workspace.jobs.find((j) => j.draft?.outcome === 'candidate')!;
      assert.ok(draft);
      const existing = s.workspace.nodes.find((n) => n.job === draft.id);
      const oldRaw = JSON.stringify(draft.raw),
        oldNodes = s.workspace.nodes.length,
        oldConsumed = s.workspace.consumed.length,
        oldCredits = s.workspace.gardens[0]!.credits.balance;
      await invoke(
        target === 'generating'
          ? {
              op: 'eureka',
              garden: s.workspace.gardens[0]!.id,
              requestId: 'native-' + action + '-' + target,
            }
          : action !== 'recheck' && existing
            ? { op: 'checkNode', id: existing.id }
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
      const baselineCalls = JSON.parse(await readFile(backup, 'utf8')).workspace.calls
        .length as number;
      assert.ok(calls - baselineCalls <= 1, 'Each lifecycle probe may dispatch only one new call.');
      if (action === 'pause') {
        const stopped = await invoke({ op: 'pause' });
        assert.equal(stopped.status, 'paused');
        assert.equal(stopped.busy, false);
        assert.equal(stopped.model.connected, false);
        assert.equal(stopped.workspace.calls.length, calls);
        assert.equal(alive(owned), false);
        await delay(300);
        const later = await invoke({ op: 'snapshot' });
        assert.equal(later.workspace.calls.length, calls);
      }
      if (action === 'recheck') {
        const jobId = s.activeJob;
        const until = Date.now() + 210000;
        while (s.busy && Date.now() < until) {
          await delay(200);
          s = await invoke({ op: 'snapshot' });
          if (s.workspace.calls.length - baselineCalls > 2)
            throw new Error('Recheck exceeded its two-call allowance.');
        }
        assert.equal(s.busy, false);
        assert.equal(s.model.connected, false);
        assert.equal(JSON.stringify(s.workspace.jobs.find((j) => j.id === draft.id)!.raw), oldRaw);
        assert.equal(s.workspace.nodes.length, oldNodes);
        assert.equal(s.workspace.consumed.length, oldConsumed);
        assert.equal(s.workspace.gardens[0]!.credits.balance, oldCredits);
        assert.ok(
          s.workspace.jobs.find((j) => j.id === jobId)!.assessment,
          'Actual recheck must retain a dated model assessment.',
        );
      }
      const exitRequestedAt = Date.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const exited = new Promise<number | null>((r) => child.once('exit', (code) => r(code)));
      await invoke({ op: 'exit' });
      try {
        assert.equal(
          await Promise.race([
            exited,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error('Model-stage native Exit timeout')), 35000);
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
      assert.equal(
        reopened.state.calls.length,
        action === 'recheck' ? s.workspace.calls.length : calls,
      );
      assert.ok(reopened.state.lifecycle.some((e) => e.kind === 'shutdown prepared'));
      reopened.close();
      rows.push({
        action,
        newCalls: reopened.state.calls.length - baselineCalls,
        target,
        exitCode: 0,
        exitMs: Date.now() - exitRequestedAt,
        scenarioMs: Date.now() - at,
        ownedModelProcessAbsent: true,
        dispatchedCallsRetained: true,
        nextStoreOpenPaused: true,
        uncaughtDestroyedWebContents: false,
      });
      await writeFile(path.join(output, 'progress.private.json'), JSON.stringify(rows, null, 2));
    } catch (error) {
      await writeFile(
        path.join(output, 'failure.private.json'),
        JSON.stringify(
          {
            action,
            target,
            error: String(error),
            pid: child.pid,
            exitCode: child.exitCode,
            stderr,
          },
          null,
          2,
        ),
      );
      throw error;
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
