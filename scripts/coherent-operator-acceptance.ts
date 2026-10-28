// Exact native EXE control through the authenticated local pipe, without any
// browser/UI automation or injected Electron hooks. Fictional data only.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import assert from 'node:assert/strict';
import type { CoherentView, CoherentCommand } from '../desktop/coherent-types';
const candidate = process.argv[2];
if (!candidate) throw new Error('Provide exact portable directory.');
await mkdir('.local', { recursive: true });
const output = await mkdtemp(path.resolve('.local/operator-native-')),
  data = path.join(output, 'data');
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const launch = () =>
  spawn(
    path.join(path.resolve(candidate), 'CompostClub.exe'),
    ['--compost-data-dir=' + data, '--compost-start-hidden'],
    {
      cwd: path.resolve(candidate),
      windowsHide: true,
      stdio: 'pipe',
      env: { ...process.env, COMPOST_ACCEPTANCE: '', COMPOST_DATA_DIR: '' },
    },
  );
async function connect(pid: number) {
  for (let i = 0; i < 150; i++) {
    try {
      const c = JSON.parse(
        await readFile(path.join(data, 'operator-connection.private.json'), 'utf8'),
      ) as { pid: number; token: string; address: string };
      if (c.pid === pid) return c;
    } catch {}
    await wait(100);
  }
  throw new Error('Operator endpoint did not become ready.');
}
type Connection = Awaited<ReturnType<typeof connect>>;
async function command(c: Connection, command: CoherentCommand, confirm = false) {
  return await new Promise<{ ok: boolean; view?: CoherentView; error?: string }>(
    (resolve, reject) => {
      const s = net.createConnection(c.address),
        parts: Buffer[] = [];
      s.setTimeout(10000, () => s.destroy(new Error('Operator timeout')));
      s.once('error', reject);
      s.once('connect', () =>
        s.write(JSON.stringify({ version: 1, token: c.token, command, confirm }) + '\n'),
      );
      s.on('data', (p) => parts.push(Buffer.isBuffer(p) ? p : Buffer.from(p)));
      s.once('end', () => resolve(JSON.parse(Buffer.concat(parts).toString('utf8'))));
    },
  );
}
async function exit(child: ReturnType<typeof launch>, c: Connection) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const exited = new Promise<number | null>((r) => child.once('exit', (code) => r(code)));
  const at = Date.now();
  const ack = await command(c, { op: 'exit' });
  assert.equal(ack.ok, true);
  try {
    assert.equal(
      await Promise.race([
        exited,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Native operator Exit timeout')), 10000);
        }),
      ]),
      0,
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
  return Date.now() - at;
}
let child = launch();
let errors = '';
child.stderr?.on('data', (p) => {
  errors += String(p);
});
try {
  const c = await connect(child.pid!);
  const s = await command(c, { op: 'snapshot' });
  assert.equal(s.view!.workspace.paused, true);
  const id = s.view!.workspace.gardens[0]!.id;
  let v = await command(c, { op: 'operatorCredits', id, cap: 10, balance: 10 }, true);
  assert.equal(v.view!.workspace.gardens[0]!.credits.cap, 10);
  assert.equal(v.view!.workspace.gardens[0]!.credits.balance, 10);
  v = await command(c, { op: 'createGarden', name: 'Fictional operator orchard', profile: 'game' });
  assert.equal(v.ok, true);
  const donor = v.view!.workspace.gardens[1]!.id;
  await command(
    c,
    { op: 'exchange', id: donor, probability: 10, donors: [id], donate: true },
    true,
  );
  v = await command(
    c,
    { op: 'exchange', id, probability: 10, donors: [donor], donate: true },
    true,
  );
  assert.equal(v.view!.workspace.gardens[0]!.policy.probability, 10);
  const elapsedMs = await exit(child, c);
  child = launch();
  child.stderr?.on('data', (p) => {
    errors += String(p);
  });
  const next = await connect(child.pid!);
  const reopened = await command(next, { op: 'snapshot' });
  assert.equal(reopened.view!.workspace.paused, true);
  assert.equal(reopened.view!.workspace.gardens[0]!.credits.cap, 10);
  assert.equal(reopened.view!.workspace.gardens[0]!.policy.probability, 10);
  assert.ok(reopened.view!.workspace.lifecycle.some((e) => e.kind === 'shutdown prepared'));
  await exit(child, next);
  assert.doesNotMatch(errors, /Object has been destroyed|Uncaught Exception/);
  const identity = JSON.parse(
    await readFile(path.join(candidate, 'PACKAGE-IDENTITY.json'), 'utf8'),
  ) as { sha256: string };
  const result = {
    packageSha256: identity.sha256,
    control: 'authenticated local named pipe; no UI automation or injected hooks',
    nativePidEqualsObservedChild: true,
    tenCreditsPersisted: true,
    mutualTenPercentExchange: true,
    exitCode: 0,
    exitMs: elapsedMs,
    nextLaunchPaused: true,
    uncaughtDestroyedWebContents: false,
  };
  await writeFile(path.join(output, 'acceptance.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ output, result }));
} finally {
  if (child.exitCode === null) child.kill();
}
