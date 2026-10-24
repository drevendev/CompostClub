import { _electron as electron } from '@playwright/test';
import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const directory = await mkdtemp(path.join(tmpdir(), 'compost-native-regression-')),
  data = path.join(directory, 'data'),
  exports = path.join(directory, 'exports');
await mkdir(exports);
const output = path.resolve('.local', 'desktop-regression-' + Date.now());
await mkdir(output, { recursive: true });
const recording = JSON.parse(await readFile('fixtures/public/recordings.json', 'utf8'))[0],
  now = Date.now(),
  request = {
    id: 'exact-public-recording',
    key: 'a@1|b@1',
    parents: [
      { id: 'a', text: recording.a, revision: 1 },
      { id: 'b', text: recording.b, revision: 1 },
    ],
    backend: 'replay',
    model: recording.model,
    modelRevision: recording.revision,
    language: recording.language,
    promptVersion: 'splice-2',
  };
const fixture = {
  version: 1,
  id: 'native-recorded-fixture',
  kind: 'personal',
  revision: 0,
  seed: 'native-recorded-fixture',
  scraps: request.parents.map((p) => ({
    ...p,
    raw: p.text,
    origin: 'fixture',
    createdAt: now,
    history: [],
  })),
  sprouts: [
    {
      ...request,
      output: JSON.parse(recording.raw),
      rawOutput: recording.raw,
      createdAt: now,
      kept: false,
      recomposted: false,
    },
  ],
  attempts: [{ key: request.key, requestId: request.id, status: 'success' }],
  generations: [
    {
      ...request,
      createdAt: now,
      status: 'success',
      responses: [{ phase: 'primary', raw: recording.raw, validationError: null }],
      error: null,
    },
  ],
  pending: null,
  welcomeGranted: true,
  readySlots: 2,
  lastAccrualAt: now,
  demoOffset: 0,
};
const restore = path.join(directory, 'restore.json'),
  backup = path.join(directory, 'backup.json');
await writeFile(restore, JSON.stringify(fixture));
const env = { ...process.env, COMPOST_ACCEPTANCE: '1', COMPOST_DATA_DIR: data };
let app = await electron.launch({
  args: [path.resolve('dist-desktop/main.cjs')],
  env,
  cwd: process.cwd(),
});
const checks = [],
  errors = [];
try {
  let page = await app.firstWindow();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForSelector('.desktop-app');
  await app.evaluate(
    ({ dialog }, values) => {
      dialog.showOpenDialog = async (...args) => ({
        canceled: false,
        filePaths: [args.at(-1).title.includes('backup') ? values.restore : values.exports],
      });
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: values.backup });
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    },
    { restore, exports, backup },
  );
  const invoke = async (command) => {
    const result = await page.evaluate((c) => window.compost.invoke(c), command);
    if (result.error) throw new Error(result.error);
    return result;
  };
  const wait = async (predicate) => {
    for (let i = 0; i < 100; i++) {
      if (await predicate(await invoke({ op: 'snapshot' }))) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Native state did not reach the expected condition.');
  };
  await app.evaluate(({ app }) => {
    app.setLoginItemSettings = (settings) => {
      globalThis.__compostLogin = settings;
    };
    app.getLoginItemSettings = () => ({ openAtLogin: false });
  });
  await invoke({ op: 'autostart', enabled: true });
  const login = await app.evaluate(() => globalThis.__compostLogin);
  assert.ok(login.args.includes('--compost-data-dir=' + data));
  assert.equal(login.openAtLogin, true);
  await invoke({ op: 'autostart', enabled: false });
  checks.push(
    'controlled login registration retains the exact data directory; OS autostart not enabled',
  );
  await page.getByRole('button', { name: /Настройки/ }).click();
  await page.getByRole('button', { name: 'Восстановить с предпросмотром…', exact: true }).click();
  await wait((state) => state.workspace.garden.sprouts.length === 1);
  checks.push('native restore of exact labelled public recording; no model invocation');
  await page.getByRole('button', { name: 'Выбрать пустую папку экспорта…', exact: true }).click();
  await wait((state) => !!state.workspace.exportDirectory);
  await writeFile(
    path.join(exports, 'analysis', 'codex-note.md'),
    'Diagnostic Codex note: preserve this file, not an owner quality decision.',
  );
  await page.getByRole('button', { name: /Новые идеи/ }).click();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await wait((state) => state.exportStatus?.count === 1);
  const current = JSON.parse(await readFile(path.join(exports, 'CURRENT.json'), 'utf8')),
    manifest = JSON.parse(await readFile(path.join(exports, current.manifest), 'utf8'));
  assert.equal(manifest.cards.length, 1);
  const card = await readFile(
    path.join(exports, 'snapshots', current.generation, manifest.cards[0].file),
    'utf8',
  );
  assert.match(card, /Recorded demo — no live AI/);
  checks.push('real native Keep action publishes a recorded-labelled Codex card');
  await page.getByRole('button', { name: /Настройки/ }).click();
  await page.getByRole('button', { name: 'Сохранить полный бэкап…', exact: true }).click();
  for (let i = 0; i < 50; i++) {
    try {
      JSON.parse(await readFile(backup, 'utf8'));
      break;
    } catch {
      await page.waitForTimeout(100);
    }
  }
  const saved = JSON.parse(await readFile(backup, 'utf8'));
  assert.equal(saved.format, 'compost-desktop');
  assert.equal(saved.workspace.garden.sprouts[0].rawOutput, recording.raw);
  checks.push('staged private backup preserves exact original response');
  await writeFile(restore, JSON.stringify({ format: 'compost-desktop', schemaVersion: 999 }));
  await page.getByRole('button', { name: 'Восстановить с предпросмотром…', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert.equal((await invoke({ op: 'snapshot' })).workspace.garden.sprouts.length, 1);
  checks.push('future-version restore rejected without replacing active ideas');
  await app.evaluate(({ BrowserWindow, app }) => {
    const win = BrowserWindow.getAllWindows()[0];
    globalThis.__compostFocusRequests = 0;
    win.show = () => {
      globalThis.__compostFocusRequests++;
    };
    win.focus = () => {};
    globalThis.__compostSecondInstance = 0;
    app.once('second-instance', () => {
      globalThis.__compostSecondInstance++;
    });
  });
  const executable = await app.evaluate(() => process.execPath),
    child = spawn(executable, [path.resolve('dist-desktop/main.cjs')], {
      env,
      windowsHide: true,
      stdio: 'ignore',
    });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0);
  assert.equal((await invoke({ op: 'snapshot' })).workspace.garden.sprouts.length, 1);
  for (
    let i = 0;
    i < 40 && !(await app.evaluate(() => globalThis.__compostSecondInstance >= 1));
    i++
  )
    await new Promise((r) => setTimeout(r, 50));
  assert.ok(await app.evaluate(() => globalThis.__compostSecondInstance >= 1));
  checks.push('second process exits and requests existing window; no second writer');
  await app.evaluate(({ powerMonitor }) => powerMonitor.emit('resume'));
  await wait((state) => state.workspace.experiment.reason.includes('wake'));
  checks.push('controlled wake lifecycle event pauses; physical OS sleep not simulated as proof');
  await page.getByRole('button', { name: /Мой сад/ }).click();
  await page
    .locator('.desktop-source')
    .first()
    .getByRole('button', { name: 'Удалить…', exact: true })
    .click();
  await wait((state) => state.workspace.garden.scraps.length === 1);
  assert.equal((await invoke({ op: 'snapshot' })).workspace.garden.sprouts.length, 0);
  checks.push('confirmed source cascade removes result and consumed pair');
  await page.getByRole('button', { name: /Настройки/ }).click();
  await page
    .getByRole('button', { name: 'Просмотреть удаление старых снимков…', exact: true })
    .click();
  await page.waitForFunction(async () => !(await window.compost.invoke({ op: 'snapshot' })).error);
  await page.waitForTimeout(300);
  assert.equal(
    await readFile(path.join(exports, 'analysis', 'codex-note.md'), 'utf8'),
    'Diagnostic Codex note: preserve this file, not an owner quality decision.',
  );
  assert.equal((await readdir(path.join(exports, 'snapshots'))).length, 1);
  checks.push('reviewed snapshot cleanup preserves current generation and analysis note');
  await page.evaluate(() => window.dispatchEvent(new Event('compost:add-idea')));
  await page.locator('#idea-text').waitFor();
  await page.waitForFunction(() => document.activeElement?.id === 'idea-text');
  checks.push('tray add event opens composer from Settings and focuses input');
  const selectedFile = path.join(directory, 'fictional-ideas.md');
  const original =
    'Игра о картографах, которые собирают забытые маршруты.\n\nПроект библиотеки открыток с вымышленной погодой.';
  await writeFile(selectedFile, original, 'utf8');
  await app.evaluate(({ dialog }, selectedFile) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selectedFile] });
  }, selectedFile);
  await page.getByRole('button', { name: 'Из файлов…', exact: true }).click();
  await wait((state) => state.preview?.parts.length === 2);
  const preview = (await invoke({ op: 'snapshot' })).preview;
  await invoke({
    op: 'acceptImport',
    id: preview.id,
    texts: preview.parts.map((p) => p.text),
    tags: 'Игры',
    participating: false,
  });
  const imported = await invoke({ op: 'snapshot' });
  assert.equal(
    imported.workspace.files.at(-1).bytesBase64,
    Buffer.from(original).toString('base64'),
  );
  assert.equal(imported.workspace.garden.scraps.length, 3);
  checks.push('real UTF-8 file read, Cyrillic preview and original bytes retained');
  await page.screenshot({ path: path.join(output, 'settings.png'), fullPage: true });
  const exited = app.waitForEvent('close');
  await app.evaluate(() => {
    setTimeout(() => process.exit(23), 20);
  });
  await exited;
  app = await electron.launch({
    args: [path.resolve('dist-desktop/main.cjs'), '--compost-data-dir=' + data],
    env: { ...env, COMPOST_DATA_DIR: '' },
    cwd: process.cwd(),
  });
  page = await app.firstWindow();
  await page.waitForSelector('.desktop-app');
  const reopened = await page.evaluate(() => window.compost.invoke({ op: 'snapshot' }));
  assert.equal(reopened.status, 'paused');
  assert.equal(reopened.workspace.garden.scraps.length, 3);
  assert.equal(reopened.dataDirectory, data);
  checks.push(
    'abrupt native process exit followed by CLI-path cold restart retains committed WAL data and starts paused',
  );
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(output, 'receipt.json'),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        kind: 'real Electron controls; exact recorded fixture only; native dialogs controlled',
        liveInference: 'not-run',
        checks,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ output, checks, errors }));
} finally {
  await app.close();
}
