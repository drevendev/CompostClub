// Exact-package Windows launch regression on a disposable fictional profile.
// Electron APIs here control the test application's own window; no owner app is closed.
import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { CoherentStore } from '../desktop/coherent-store';
import { fixture } from '../tests/coherent-fixtures';
import { canonical, hash } from '../src/domain/coherent/hash';

const index = process.argv.indexOf('--package'),
  candidate = path.resolve(process.argv[index + 1] ?? ''),
  legacy = process.argv.includes('--legacy');
if (index < 0 || process.platform !== 'win32')
  throw new Error('Supply --package with an exact Windows portable directory.');
const identity = JSON.parse(
  await readFile(path.join(candidate, 'PACKAGE-IDENTITY.json'), 'utf8'),
) as { sha256: string; files: Record<string, string> };
assert.equal(hash(JSON.stringify(identity.files)), identity.sha256);
for (const [file, sha] of Object.entries(identity.files))
  assert.equal(hash(await readFile(path.join(candidate, file))), sha, file);
await mkdir('.local', { recursive: true });
const output = await mkdtemp(path.resolve('.local/windows-launch-')),
  data = path.join(output, 'fictional profile'),
  exe = path.join(candidate, 'CompostClub.exe'),
  powershell = path.join(process.env.SystemRoot!, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
  run = promisify(execFile),
  initial = new CoherentStore(data);
initial.save(fixture(Date.now()), false);
const originals = canonical(initial.state.sources);
initial.close();
const env: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  ),
  COMPOST_ACCEPTANCE: '',
  COMPOST_DATA_DIR: '',
};
delete env.ELECTRON_RUN_AS_NODE;
const request = async (op: string) => {
  const connection = JSON.parse(
    await readFile(path.join(data, 'operator-connection.private.json'), 'utf8'),
  ) as { pid: number; address: string; token: string };
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const socket = net.createConnection(connection.address),
      parts: Buffer[] = [];
    socket.setTimeout(10000, () => socket.destroy(new Error('Operator timeout.')));
    socket.once('error', reject);
    socket.once('connect', () =>
      socket.write(JSON.stringify({ version: 1, token: connection.token, command: { op } }) + '\n'),
    );
    socket.on('data', (p: Buffer) => parts.push(p));
    socket.once('end', () => resolve(JSON.parse(Buffer.concat(parts).toString('utf8'))));
  });
};
const launch = () =>
  run(
    powershell,
    [
      '-NoProfile',
      '-NonInteractive',
      '-File',
      path.join(candidate, 'Start-CompostClub.ps1'),
      '-DataDirectory',
      data,
    ],
    { env, windowsHide: true, timeout: 40000 },
  );
const application = await electron.launch({
  executablePath: exe,
  args: ['--compost-data-dir=' + data],
  env,
  timeout: 30000,
});
const events: unknown[] = [];
try {
  const page = await application.firstWindow();
  await page.locator('.desktop-app').waitFor();
  const pid = await application.evaluate(() => process.pid);
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.minimize());
  await page.waitForTimeout(500);
  assert.equal(
    await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]!.isMinimized(),
    ),
    true,
  );
  const repeated = await run(exe, ['--compost-data-dir=' + data], {
    env,
    windowsHide: true,
    timeout: 15000,
  });
  await writeFile(path.join(output, 'direct-repeat.stderr.log'), repeated.stderr);
  await page.waitForTimeout(500);
  const directWindow = await application.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]!;
    return { minimized: w.isMinimized(), visible: w.isVisible(), pid: process.pid };
  });
  events.push({ kind: 'direct repeat after minimize', ...directWindow, stderr: repeated.stderr });
  if (!legacy) {
    assert.equal(directWindow.minimized, false);
    assert.equal(directWindow.visible, true);
    for (const state of ['minimized', 'tray-hidden']) {
      await application.evaluate(({ BrowserWindow }, action) => {
        const w = BrowserWindow.getAllWindows()[0]!;
        if (action === 'minimized') w.minimize();
        else w.close(); // The product's close handler keeps it in the tray.
      }, state);
      await page.waitForTimeout(300);
      const before = await application.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows()[0]!;
        return { visible: w.isVisible(), minimized: w.isMinimized() };
      });
      assert.equal(state === 'minimized' ? before.minimized : !before.visible, true);
      const result = await launch();
      assert.equal(result.stderr, '');
      const ready = await request('showWindow');
      assert.equal(ready.ok, true);
      const window = ready.window as {
        pid: number;
        visible: boolean;
        minimized: boolean;
        ready: boolean;
      };
      assert.equal(window.pid, pid);
      assert.equal(window.visible, true);
      assert.equal(window.minimized, false);
      assert.equal(window.ready, true);
      assert.match(result.stdout, new RegExp('PID: ' + pid));
      events.push({ kind: 'launcher restores ' + state, ready: ready.window });
    }
    const concurrent = await Promise.all([launch(), launch()]);
    for (const result of concurrent) {
      assert.equal(result.stderr, '');
      assert.match(result.stdout, new RegExp('PID: ' + pid));
    }
    events.push({ kind: 'concurrent launchers reuse writer', pid });
  }
} finally {
  await application.close();
}

if (!legacy) {
  // Real ordinary PowerShell launch, without Playwright/debugging startup flags.
  const cold = await launch();
  assert.equal(cold.stderr, '');
  const ready = await request('showWindow');
  assert.equal(ready.ok, true);
  events.push({ kind: 'ordinary cold launch', ready: ready.window });
  const connection = JSON.parse(
    await readFile(path.join(data, 'operator-connection.private.json'), 'utf8'),
  ) as { pid: number };
  assert.match(cold.stdout, new RegExp('PID: ' + connection.pid));
  const shortcut = path.join(output, 'Open fictional preview.lnk');
  await run(
    powershell,
    [
      '-NoProfile',
      '-NonInteractive',
      '-File',
      path.join(candidate, 'Create-Shortcut.ps1'),
      '-PackageDirectory',
      candidate,
      '-DataDirectory',
      data,
      '-ShortcutPath',
      shortcut,
    ],
    { windowsHide: true, env },
  );
  // Follow the actual Windows shortcut. This is an ordinary GUI launch, not a copied command.
  await run(
    powershell,
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Start-Process -FilePath $env:COMPOST_TEST_SHORTCUT',
    ],
    { windowsHide: true, env: { ...env, COMPOST_TEST_SHORTCUT: shortcut } },
  );
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const reused = await request('showWindow');
  assert.equal((reused.window as { pid: number }).pid, connection.pid);
  events.push({ kind: 'actual shortcut reuses writer', ready: reused.window });
  await request('exit');
  for (let i = 0; i < 50; i++) {
    try {
      process.kill(connection.pid, 0);
    } catch {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.throws(() => process.kill(connection.pid, 0));
  for (const file of await readdir(path.join(data, 'launch-logs'))) {
    const raw = await readFile(path.join(data, 'launch-logs', file), 'utf8');
    events.push({ kind: 'retained startup log', file, raw });
    assert.doesNotMatch(
      raw,
      /Unable to move the cache|Unable to create cache|Gpu Cache Creation failed/,
    );
  }
}
const saved = new CoherentStore(data);
assert.equal(canonical(saved.state.sources), originals);
assert.equal(saved.state.calls.length, 0);
assert.equal(saved.state.jobs.length, 0);
assert.equal(saved.state.paused, true);
saved.close();
const receipt = {
  packageSha256: identity.sha256,
  legacy,
  creativeCalls: 0,
  originalsPreserved: true,
  events,
};
await writeFile(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ output, ...receipt }));
