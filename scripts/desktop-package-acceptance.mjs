import { _electron as electron } from '@playwright/test';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

// Inspect and run the already packaged bytes. This harness never rebuilds a candidate.
const candidate = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Provide the exact packaged desktop directory.');
const hash = (raw) => createHash('sha256').update(raw).digest('hex');
const identityBytes = await readFile(path.join(candidate, 'PACKAGE-IDENTITY.json'));
const identity = JSON.parse(identityBytes);
async function verifyPackage() {
  assert.equal(
    hash(await readFile(path.join(candidate, 'PACKAGE-IDENTITY.json'))),
    hash(identityBytes),
  );
  assert.equal(hash(JSON.stringify(identity.files)), identity.sha256);
  const observed = [];
  async function walk(relative = '') {
    for (const e of await readdir(path.join(candidate, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative, e.name);
      if (e.isSymbolicLink()) throw new Error('Unexpected link in package: ' + name);
      if (e.isDirectory()) await walk(name);
      else if (name !== 'PACKAGE-IDENTITY.json') {
        observed.push(name);
        assert.equal(hash(await readFile(path.join(candidate, name))), identity.files[name], name);
      }
    }
  }
  await walk();
  assert.deepEqual(observed.sort(), Object.keys(identity.files).sort());
}
await verifyPackage();
const data = await mkdtemp(path.join(tmpdir(), 'compost-packaged-'));
const output = path.resolve('.local', 'packaged-acceptance-' + Date.now());
await mkdir(output);
const errors = [];
const app = await electron.launch({
  executablePath: path.join(candidate, 'CompostClub.exe'),
  args: ['--compost-data-dir=' + data],
  cwd: candidate,
  env: { ...process.env, COMPOST_ACCEPTANCE: '1', COMPOST_DATA_DIR: '' },
});
let receipt;
try {
  const page = await app.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForSelector('.desktop-app');
  const state = await page.evaluate(() => window.compost.invoke({ op: 'snapshot' }));
  assert.equal(state.status, 'paused');
  assert.equal(state.dataDirectory, data);
  assert.equal(state.workspace.garden.scraps.length, 0);
  await page.getByRole('button', { name: 'Об авторе', exact: true }).click();
  const author = page.getByRole('region', { name: 'Об авторе', exact: true });
  assert.match(await author.innerText(), /Aleksei Bogun/);
  assert.deepEqual(await author.locator('a').evaluateAll((links) => links.map((a) => a.href)), [
    'https://github.com/drevendev',
    'https://t.me/Drevenoise',
    'https://drevengames.itch.io/',
    'https://x.com/drevendev',
    'https://dev.to/drevendev',
  ]);
  await page.getByRole('button', { name: /^✿ Мой сад/ }).click();
  await page
    .locator('#idea-text')
    .fill('A fictional garden library keeps maps of imaginary weather.');
  await page.getByRole('button', { name: 'Добавить идею', exact: true }).click();
  await page.waitForFunction(
    async () =>
      (await window.compost.invoke({ op: 'snapshot' })).workspace.garden.scraps.length === 1,
  );
  await page.reload();
  await page.waitForSelector('.desktop-app');
  const saved = await page.evaluate(() => window.compost.invoke({ op: 'snapshot' }));
  assert.equal(saved.workspace.garden.scraps.length, 1);
  assert.equal(saved.status, 'paused');
  assert.deepEqual(errors, []);
  receipt = {
    date: new Date().toISOString(),
    kind: 'exact packaged Windows EXE acceptance; no rebuild',
    candidate,
    packageSha256: identity.sha256,
    packageIdentitySha256: hash(identityBytes),
    harnessSha256: hash(await readFile(new URL(import.meta.url))),
    runtime: await app.evaluate(() => ({
      electron: process.versions.electron,
      node: process.versions.node,
      chromium: process.versions.chrome,
      platform: process.platform,
      arch: process.arch,
    })),
    checks: [
      'all package file hashes before and after native execution',
      'fresh packaged executable starts paused with disposable data',
      'author identity and five local account links',
      'fictional input commits and survives renderer reload',
      'explicit quit',
    ],
    errors,
    liveInference: 'not-run',
    limitations: [
      'Physical sleep, external browser launch, macOS and long-use quality pilot not covered. Source-build Electron acceptance separately tests navigation policy with OS launch stubbed.',
    ],
  };
} catch (error) {
  await writeFile(
    path.join(output, 'failure.json'),
    JSON.stringify({ candidate, error: String(error), errors }, null, 2),
  );
  throw error;
} finally {
  await app.close();
}
await verifyPackage();
await writeFile(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ output, ...receipt }));
