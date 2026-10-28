import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DesktopStore } from '../desktop/store';
import { CoherentStore } from '../desktop/coherent-store';
import { addScrap } from '../src/domain/garden';
import { hash } from '../src/domain/coherent/hash';
import type { CoherentCommand } from '../desktop/coherent-types';

const args = process.argv.slice(2),
  option = (name: string) => {
    const i = args.indexOf(name);
    return i < 0 ? '' : (args[i + 1] ?? '');
  };
const packaged = option('--package');
const packageIdentity = packaged
  ? (JSON.parse(await readFile(path.join(packaged, 'PACKAGE-IDENTITY.json'), 'utf8')) as {
      sha256: string;
      files: Record<string, string>;
    })
  : null;
async function verifyPackage() {
  if (!packageIdentity) return;
  assert.equal(hash(JSON.stringify(packageIdentity.files)), packageIdentity.sha256);
  const observed: string[] = [];
  async function walk(relative = '') {
    for (const entry of await readdir(path.join(packaged, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative, entry.name);
      assert.equal(entry.isSymbolicLink(), false);
      if (entry.isDirectory()) await walk(name);
      else if (name !== 'PACKAGE-IDENTITY.json') {
        observed.push(name);
        assert.equal(
          hash(await readFile(path.join(packaged, name))),
          packageIdentity!.files[name],
          name,
        );
      }
    }
  }
  await walk();
  assert.deepEqual(observed.sort(), Object.keys(packageIdentity.files).sort());
}
await verifyPackage();
await mkdir('.local', { recursive: true });
const output = await mkdtemp(path.resolve('.local/coherent-native-')),
  data = path.join(output, 'data');
const old = new DesktopStore(data),
  original =
    'Fictional migration source: open a tide gate to route a boat; one gate must stay closed.';
old.change((w) => {
  w.garden = addScrap(w.garden, original, Date.now());
  const s = w.garden.scraps[0]!;
  w.sources[s.id] = {
    title: 'Migration original',
    tags: ['fictional'],
    participating: true,
    origin: 'Authored public diagnostic',
  };
});
old.close();
const errors: string[] = [],
  network: string[] = [];
const started = Date.now();
const build: Record<string, string> = {};
async function identify(root: string, relative = '') {
  for (const e of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = path.posix.join(relative, e.name);
    if (e.isDirectory()) await identify(root, name);
    else
      build[root.replaceAll('\\', '/') + '/' + name] = hash(await readFile(path.join(root, name)));
  }
}
await identify(packaged ? path.join(packaged, 'resources/app/dist-desktop') : 'dist-desktop');
await identify(packaged ? path.join(packaged, 'resources/app/dist-desktop-ui') : 'dist-desktop-ui');
console.log(JSON.stringify({ output, phase: 'launching', packaged: Boolean(packaged) }));
const app = await electron.launch({
  ...(packaged
    ? {
        executablePath: path.join(path.resolve(packaged), 'CompostClub.exe'),
        args: ['--compost-data-dir=' + data],
      }
    : { args: [path.resolve('dist-desktop/main.cjs'), '--compost-data-dir=' + data] }),
  cwd: packaged ? path.resolve(packaged) : process.cwd(),
  env: { ...process.env, COMPOST_ACCEPTANCE: '1', COMPOST_DATA_DIR: '' },
  timeout: 30000,
});
const child = app.process(),
  pid = child.pid;
let result: Record<string, unknown> = {};
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  console.log(JSON.stringify({ phase: 'window', url: page.url() }));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (req) => {
    if (/^https?:/.test(req.url())) network.push(req.url());
  });
  await page.waitForSelector('.coherent-app');
  assert.equal(await page.locator('.global-toolbar button').count(), 2);
  assert.equal(await page.getByRole('button', { name: 'Продолжить', exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Эврика', exact: true }).count(), 1);
  console.log(JSON.stringify({ phase: 'renderer ready' }));
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]!;
    window.webContents.setBackgroundThrottling(false);
    window.showInactive();
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const invoke = async (c: CoherentCommand) => {
    const v = await page.evaluate((c) => window.compost.invoke(c), c);
    if (v.error) throw new Error(v.error);
    return v;
  };
  let state = await invoke({ op: 'snapshot' });
  assert.equal(state.workspace.schemaVersion, 3);
  assert.equal(state.status, 'paused');
  assert.equal(state.workspace.sources[0]!.revisions[0]!.text, original);
  assert.equal(state.workspace.sources[0]!.participating, true);
  assert.ok(state.backups.some((b) => b.reason.startsWith('Before schema-3')));
  const migrated = state.workspace.gardens[0]!.id;
  await invoke({
    op: 'gardenSettings',
    id: migrated,
    profile: 'game',
    objective: 'Authored fictional native acceptance only.',
    interval: 15,
  });
  await page
    .getByLabel('Полный текст идеи', { exact: true })
    .fill('Unsubmitted draft survives garden switching.');
  state = await invoke({ op: 'createGarden', name: 'Fictional orchard', profile: 'game' });
  const receiver = state.workspace.gardens[1]!.id;
  await page.getByLabel('Ваши сады', { exact: true }).selectOption(receiver);
  await page.getByLabel('Ваши сады', { exact: true }).selectOption(migrated);
  assert.equal(
    await page.getByLabel('Полный текст идеи', { exact: true }).inputValue(),
    'Unsubmitted draft survives garden switching.',
  );
  await page
    .getByRole('button', { name: 'Читать оригинал и контекст', exact: true })
    .first()
    .click();
  await page
    .getByRole('dialog')
    .getByText(original, { exact: true })
    .first()
    .waitFor({ state: 'visible' });
  assert.ok(
    await page.getByRole('dialog').getByText(original, { exact: true }).first().isVisible(),
  );
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    'Читать оригинал и контекст',
  );
  await invoke({
    op: 'add',
    garden: receiver,
    title: 'Same title',
    text: 'Fictional game: route mail boats through gates before a tide marker fills.',
    participating: true,
  });
  await invoke({
    op: 'add',
    garden: receiver,
    title: 'Same title',
    text: 'Fictional game: spend a forecast token to delay one marked gate closure.',
    participating: true,
  });
  state = await invoke({ op: 'snapshot' });
  assert.equal(state.workspace.sources.filter((s) => s.garden === receiver).length, 2);
  const donor = (await invoke({ op: 'createGarden', name: 'Fictional donor', profile: 'game' }))
    .workspace.gardens[2]!.id;
  await invoke({
    op: 'add',
    garden: donor,
    title: 'Borrowed clock',
    text: 'Fictional game: borrow a clock tick to act now and lose one action next turn.',
    participating: true,
  });
  // Dialog responses are automated test consent for this isolated fictional
  // workspace, never an owner usefulness decision or production authorization.
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = () => Promise.resolve({ response: 1, checkboxChecked: false });
  });
  await invoke({ op: 'exchange', id: donor, probability: 0, donors: [], donate: true });
  state = await invoke({
    op: 'exchange',
    id: receiver,
    probability: 10,
    donors: [donor],
    donate: false,
  });
  assert.equal(state.workspace.gardens[1]!.policy.probability, 10);
  await page.getByLabel('Ваши сады', { exact: true }).selectOption(receiver);
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]!.setSize(430, 900);
  });
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  assert.ok(await page.getByLabel('Вызовов в день, 1–96').isVisible());
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  await page.screenshot({ path: path.join(output, 'native-430.png'), fullPage: true });
  const toolbar = await page.locator('.global-toolbar').boundingBox();
  assert.ok(toolbar && toolbar.y >= 0 && toolbar.y + toolbar.height <= 900);
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Эврика', exact: true }).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle),
    'solid',
  );
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Эврика');
  await page.screenshot({ path: path.join(output, 'native-forced-colors.png'), fullPage: true });
  await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'reduce' });
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]!.setSize(1200, 1000);
    BrowserWindow.getAllWindows()[0]!.webContents.setZoomFactor(2);
  });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  assert.ok(await page.getByRole('button', { name: 'Сохранить границы', exact: true }).isVisible());
  await page.screenshot({ path: path.join(output, 'native-200-percent.png'), fullPage: true });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]!.webContents.setZoomFactor(1),
  );
  await page.getByRole('button', { name: 'Исходные идеи', exact: true }).click();
  await page.screenshot({ path: path.join(output, 'native-gardens.png'), fullPage: true });
  // A real no-dispatch preflight must reach both operator state and the visible
  // toolbar immediately, even if the next scheduled interval is still ahead.
  await invoke({
    op: 'gardenSettings',
    id: receiver,
    profile: 'game',
    objective: 'Ю'.repeat(1000),
    interval: 15,
  });
  await invoke({ op: 'background', id: receiver, enabled: true });
  state = await invoke({ op: 'eureka', garden: receiver, requestId: 'native-oversized-context' });
  assert.equal(state.workspace.calls.length, 0);
  assert.match(state.workspace.gardens.find((g) => g.id === receiver)!.plan!.reason, /admission:/);
  state = await invoke({ op: 'resume' });
  assert.match(state.reason, /admission:/);
  await page.waitForFunction(() =>
    document
      .querySelector('.global-toolbar [role="status"]')
      ?.textContent?.includes('Не удалось подготовить запрос'),
  );
  await page.screenshot({ path: path.join(output, 'native-admission-reason.png'), fullPage: true });
  state = await invoke({ op: 'pause' });
  assert.equal(state.workspace.calls.length, 0);
  result = {
    nativeUi: 'passed',
    live: 'separate genuine evaluation/lifecycle/background suites',
    background: 'separate real-time suite',
  };
  assert.deepEqual(errors, []);
  assert.deepEqual(network, []);
  result = {
    ...result,
    startedAt: new Date(started).toISOString(),
    buildSha256: hash(JSON.stringify(build)),
    files: build,
    migration: 'v2 to v3, original and participation retained',
    width430: true,
    text200percent: true,
    twoGlobalCommands: true,
    blockedAdmissionReasonVisible: true,
    forcedColors: true,
    tabShiftTabVisibleFocus: true,
    focusEscape: true,
    duplicateTitles: true,
    consent10percent: true,
    networkRequests: network.length,
    errors,
    automatedConsent: 'Isolated fictional acceptance; no owner quality scores supplied',
    pid,
    packageSha256: packageIdentity?.sha256 ?? null,
  };
} finally {
  if (!Object.keys(result).length) {
    const page = await app.firstWindow();
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
    await writeFile(path.join(output, 'failure.html'), await page.content());
    console.error(JSON.stringify({ output, errors, body: await page.locator('body').innerText() }));
  }
  if (child.exitCode === null) await app.close();
  await writeFile(path.join(output, 'acceptance.json'), JSON.stringify(result, null, 2) + '\n');
}
assert.notEqual(child.exitCode, null, 'Externally observed Electron process must terminate.');
await verifyPackage();
const reopened = new CoherentStore(data);
assert.equal(reopened.state.paused, true);
const prepared = reopened.state.lifecycle.some((e) => e.kind === 'shutdown prepared');
reopened.close();
console.log(
  JSON.stringify({ output, externalExit: child.exitCode, shutdownPrepared: prepared, result }),
);
