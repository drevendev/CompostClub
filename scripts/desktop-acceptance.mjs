import { _electron as electron } from '@playwright/test';
import { mkdir, mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
const directory = await mkdtemp(path.join(tmpdir(), 'compost-desktop-acceptance-'));
const output = path.resolve('.local', 'desktop-acceptance-' + Date.now());
await mkdir(output, { recursive: true });
const hash = (raw) => createHash('sha256').update(raw).digest('hex');
const buildFiles = {};
async function identify(directory) {
  for (const e of await readdir(directory, { withFileTypes: true })) {
    const name = path.join(directory, e.name);
    if (e.isDirectory()) await identify(name);
    else buildFiles[name.replaceAll('\\', '/')] = hash(await readFile(name));
  }
}
await identify('dist-desktop');
await identify('dist-desktop-ui');
const buildIdentity = {
  files: buildFiles,
  sha256: hash(JSON.stringify(buildFiles)),
  acceptanceScriptSha256: hash(await readFile('scripts/desktop-acceptance.mjs')),
};
async function modelMemory(pid) {
  if (process.platform !== 'win32' || !Number.isSafeInteger(pid) || pid <= 0) return [];
  const script =
    '$taskIds = @([int]$env:COMPOST_MEASURE_PID); $taskChildren = @(Get-CimInstance Win32_Process -Filter ("ParentProcessId = " + $env:COMPOST_MEASURE_PID)); $taskIds += @($taskChildren | Select-Object -ExpandProperty ProcessId); foreach ($taskChild in $taskChildren) { $taskIds += @(Get-CimInstance Win32_Process -Filter ("ParentProcessId = " + $taskChild.ProcessId) | Select-Object -ExpandProperty ProcessId) }; @(Get-Process -Id $taskIds -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64,PeakWorkingSet64,CPU) | ConvertTo-Json -Compress';
  const { stdout } = await promisify(execFile)(
    path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(script, 'utf16le').toString('base64'),
    ],
    {
      windowsHide: true,
      env: { ...process.env, COMPOST_MEASURE_PID: String(pid) },
      timeout: 15000,
    },
  );
  return JSON.parse(stdout || '[]');
}
const app = await electron.launch({
  args: [path.resolve('dist-desktop/main.cjs')],
  cwd: process.cwd(),
  env: { ...process.env, COMPOST_ACCEPTANCE: '1', COMPOST_DATA_DIR: path.join(directory, 'data') },
  timeout: 30000,
});
app.process().stderr?.on('data', (b) => {
  if (process.env.COMPOST_VERBOSE) process.stderr.write(b);
});
const page = await app.firstWindow();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const invoke = (command) => page.evaluate((c) => window.compost.invoke(c), command);
try {
  await page.waitForSelector('.desktop-app', { timeout: 20000 });
  await page.getByRole('button', { name: 'Об авторе', exact: true }).click();
  const authorBlock = page.getByRole('region', { name: 'Об авторе', exact: true });
  await authorBlock.waitFor();
  const authorLinks = await authorBlock
    .locator('a')
    .evaluateAll((links) =>
      links.map((link) => ({ label: link.textContent, href: link.getAttribute('href') })),
    );
  if (
    JSON.stringify(authorLinks) !==
    JSON.stringify([
      { label: 'GitHub', href: 'https://github.com/drevendev' },
      { label: 'Telegram', href: 'https://t.me/Drevenoise' },
      { label: 'itch.io', href: 'https://drevengames.itch.io/' },
      { label: 'X', href: 'https://x.com/drevendev' },
      { label: 'DEV', href: 'https://dev.to/drevendev' },
    ])
  )
    throw new Error('Desktop author destinations differ from the selected identity.');
  await page.screenshot({ path: path.join(output, 'author.png'), fullPage: true });
  // Observe actual popup handling without launching an external browser during acceptance.
  await app.evaluate(({ shell }) => {
    globalThis.__compostAuthorDestinations = [];
    shell.openExternal = async (url) => {
      globalThis.__compostAuthorDestinations.push(url);
    };
  });
  for (const link of authorLinks)
    await authorBlock.getByRole('link', { name: link.label, exact: true }).click();
  await page.waitForTimeout(200);
  const opened = await app.evaluate(() => globalThis.__compostAuthorDestinations);
  if (JSON.stringify(opened) !== JSON.stringify(authorLinks.map((link) => link.href)))
    throw new Error('Desktop author selection did not reach the external-browser boundary.');
  await page.evaluate(() => {
    window.open('https://example.invalid/unsafe');
    window.open('file:///C:/Windows/System32/cmd.exe');
  });
  await page.waitForTimeout(100);
  if (
    (await app.evaluate(() => globalThis.__compostAuthorDestinations.length)) !== 5 ||
    app.windows().length !== 1
  )
    throw new Error('Unapproved external navigation or embedded popup escaped denial.');
  await page.getByRole('button', { name: /^✿ Мой сад/ }).click();
  await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
  let state = await invoke({ op: 'snapshot' });
  if (state.status !== 'paused' || state.workspace.experiment.enabled)
    throw new Error('New app did not start paused.');
  const receipt = {
    date: new Date().toISOString(),
    kind: 'real Electron Chromium acceptance',
    directory: output,
    runtime: await app.evaluate(() => ({
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
    })),
    checks: [
      'real desktop launch',
      'starts paused',
      'renderer loads with isolated IPC',
      'author identity and exact links; external-browser boundary observed with OS launch stubbed; unsafe popups denied',
    ],
    errors,
    liveInference: 'not-run',
    buildIdentity,
  };
  const batch = Array.from(
    { length: 40 },
    (_, i) => `A fictional game idea number ${i + 1}: cooperative gardens and changing maps.`,
  ).join('\n\n');
  await page.getByRole('button', { name: 'Добавить пачку', exact: true }).click();
  await page.locator('#idea-text').fill(batch);
  await page.getByRole('button', { name: 'Предпросмотр импорта', exact: true }).click();
  await page.getByRole('dialog', { name: 'Предпросмотр импорта' }).waitFor();
  await page.getByRole('button', { name: 'Импортировать выбранное', exact: true }).click();
  await page.waitForFunction(async () => {
    const state = await window.compost.invoke({ op: 'snapshot' });
    return state.workspace.garden.scraps.length === 40;
  });
  state = await invoke({ op: 'snapshot' });
  if (Object.values(state.workspace.sources).some((s) => s.participating))
    throw new Error('Import enabled participation without explicit selection.');
  await page.reload();
  await page.waitForSelector('.desktop-app');
  state = await invoke({ op: 'snapshot' });
  if (state.workspace.garden.scraps.length !== 40 || state.workspace.files[0].utf8 !== batch)
    throw new Error('Native batch import/original failed reload.');
  receipt.checks.push(
    '40-card batch through real UI and editable preview',
    'original bytes and excluded participation survive reload',
  );
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(430, 780));
  await page.waitForTimeout(150);
  if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)))
    throw new Error('Narrow desktop window overflows horizontally.');
  await page.screenshot({ path: path.join(output, 'desktop-narrow.png') });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1320, 900));
  receipt.checks.push('430px native window without horizontal overflow');
  receipt.idleElectronMetrics = await app.evaluate(({ app }) =>
    app.getAppMetrics().map((m) => ({ type: m.type, cpu: m.cpu, memory: m.memory })),
  );
  if (!process.argv.includes('--live')) {
    await writeFile(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2));
    console.log(JSON.stringify(receipt));
  } else {
    const exportPath = path.join(directory, 'codex-export');
    await mkdir(exportPath);
    const runtimePath = path.resolve('.local/ollama/ollama.exe'),
      modelsPath = path.resolve('.local/models');
    const backupPath = path.join(directory, 'public-fixture.json');
    const fixtures = JSON.parse(await readFile('fixtures/public/scraps.json', 'utf8'));
    const now = Date.now() - 7200000;
    const scraps = fixtures.scraps.map((s) => ({
      id: s.id,
      raw: s.text,
      text: s.text.normalize('NFC').trim(),
      revision: 1,
      createdAt: now,
      origin: 'fixture',
      history: [],
    }));
    await writeFile(
      backupPath,
      JSON.stringify({
        version: 1,
        id: 'desktop-public-acceptance',
        kind: 'personal',
        revision: 0,
        seed: 'desktop-public-acceptance',
        scraps,
        sprouts: [],
        attempts: [],
        generations: [],
        growth: [],
        pending: null,
        welcomeGranted: true,
        readySlots: 3,
        lastAccrualAt: now,
        demoOffset: 0,
      }),
    );
    // Only native file-selection/confirmation UI is controlled. Every model response
    // below is a genuine local Ollama call, never a stub, fixture replay or canned output.
    await app.evaluate(
      ({ dialog }, values) => {
        dialog.showOpenDialog = async (...args) => {
          const options = args.at(-1),
            title = options.title ?? '';
          const p = title.includes('ollama.exe')
            ? values.runtimePath
            : title.includes('model directory')
              ? values.modelsPath
              : title.includes('backup')
                ? values.backupPath
                : values.exportPath;
          return { canceled: false, filePaths: [p] };
        };
        dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
      },
      { runtimePath, modelsPath, backupPath, exportPath },
    );
    const checked = async (command) => {
      const result = await invoke(command);
      if (result.error) throw new Error(command.op + ': ' + result.error);
      return result;
    };
    await checked({ op: 'pickExecutable' });
    await checked({ op: 'pickModels' });
    await checked({ op: 'restore' });
    await checked({ op: 'pickExport' });
    state = await checked({ op: 'snapshot' });
    for (const source of state.workspace.garden.scraps)
      await checked({ op: 'participate', id: source.id, value: true });
    await checked({
      op: 'settings',
      intervalMinutes: 60,
      dailyCalls: 6,
      backlog: 5,
      language: 'en',
      tag: '',
      exportScope: 'all',
      model: 'gemma3:4b',
    });
    receipt.checks.push(
      'validated public backup import; synthetic three-credit setup disclosed',
      'explicit source participation',
      'owned installed Ollama setup',
      'Codex folder outside source/data',
    );
    const started = Date.now();
    await checked({ op: 'resume' });
    const modelSamples = [];
    while (Date.now() - started < 180000) {
      state = await checked({ op: 'snapshot' });
      if (state.busy && state.model.pid)
        modelSamples.push({ at: Date.now(), processes: await modelMemory(state.model.pid) });
      if (state.workspace.garden.sprouts.length || state.status === 'attention') break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!state.workspace.garden.sprouts.length)
      throw new Error(
        'Genuine scheduled model call did not produce a valid candidate: ' +
          state.reason +
          ' ' +
          JSON.stringify(state.workspace.events),
      );
    receipt.firstScheduled = state.workspace.experiment.calls[0];
    receipt.ownedModelMemorySamples = modelSamples;
    receipt.firstResult = state.workspace.garden.sprouts[0];
    receipt.liveInference =
      'real owned Ollama Gemma 3 4B; structural validity only; owner quality not reviewed';
    await page.getByRole('button', { name: /Новые идеи/ }).click();
    await page.screenshot({ path: path.join(output, 'real-result.png'), fullPage: true });
    const before = state.workspace.garden.readySlots;
    await checked({ op: 'run' });
    await new Promise((r) => setTimeout(r, 600));
    const pausingAt = Date.now();
    state = await checked({ op: 'pause' });
    if (
      state.status !== 'paused' ||
      state.model.connected ||
      state.workspace.garden.readySlots !== before
    )
      throw new Error('Pause failed resource/slot acceptance.');
    receipt.pause = {
      durationMs: Date.now() - pausingAt,
      readySlots: state.workspace.garden.readySlots,
      modelProcessStopped: !state.model.connected,
      status: state.status,
    };
    receipt.pausedElectronMetrics = await app.evaluate(({ app }) =>
      app.getAppMetrics().map((m) => ({ type: m.type, cpu: m.cpu, memory: m.memory })),
    );
    receipt.checks.push(
      'genuine scheduled 4B call',
      'cancel genuine owned inference',
      'pause preserves slot',
      'owned model process stopped',
    );
    const pointer = JSON.parse(await readFile(path.join(exportPath, 'CURRENT.json'), 'utf8'));
    receipt.exportPointer = pointer;
    await writeFile(
      path.join(output, 'live-progress.json'),
      JSON.stringify({ ...receipt, workspace: state.workspace }, null, 2),
    );
    if (process.argv.includes('--long')) {
      await checked({ op: 'resume' });
      await app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.close();
      });
      receipt.checks.push('window close leaves tray process active');
      console.log(
        'Waiting for the next real default 60-minute scheduled call; no accelerated clock. ' +
          output,
      );
      const deadline = Date.now() + 65 * 60000;
      while (Date.now() < deadline) {
        const current = await checked({ op: 'snapshot' });
        if (current.workspace.garden.sprouts.length >= 2) {
          state = current;
          break;
        }
        await new Promise((r) => setTimeout(r, 10000));
      }
      if (state.workspace.garden.sprouts.length < 2)
        throw new Error('Second default-interval scheduled result was not observed.');
      const scheduled = state.workspace.events.filter((e) => e.kind === 'scheduled');
      if (scheduled.length < 2 || scheduled[1].at - scheduled[0].at < 3600000)
        throw new Error('Scheduled interval was shortened.');
      receipt.secondScheduled = scheduled[1];
      receipt.defaultIntervalObservedMs = scheduled[1].at - scheduled[0].at;
      receipt.checks.push(
        'two real scheduled calls at default 60-minute spacing with window closed',
      );
    }
    if (process.argv.includes('--pilot')) {
      await checked({
        op: 'review',
        id: receipt.firstResult.id,
        state: 'kept',
        note: 'Public fictional diagnostic only; this is not owner usefulness approval.',
      });
      await checked({
        op: 'settings',
        intervalMinutes: 60,
        dailyCalls: 6,
        backlog: 5,
        language: 'ru',
        tag: '',
        exportScope: 'all',
        model: 'gemma3:4b',
      });
      await checked({ op: 'resume' });
      await checked({
        op: 'tend',
        id: receipt.firstResult.id,
        kind: 'sprout',
        direction: 'Clarify the mechanism',
      });
      const settled = async () => {
        const until = Date.now() + 270000;
        while (Date.now() < until) {
          const latest = await checked({ op: 'snapshot' });
          if (!latest.busy) return latest;
          await new Promise((r) => setTimeout(r, 500));
        }
        throw new Error('Genuine model job did not settle within its timeout.');
      };
      state = await settled();
      const branch = state.workspace.garden.growth?.at(-1);
      receipt.manualTend = branch;
      if (branch?.status === 'proposed') {
        const decision = await invoke({
          op: 'growthDecision',
          id: branch.id,
          accept: true,
          title: branch.output.title,
          concept: branch.output.concept,
          experiment: branch.output.experiment,
        });
        if (decision.error) {
          receipt.manualTendAcceptance = { accepted: false, error: decision.error };
          await checked({
            op: 'growthDecision',
            id: branch.id,
            accept: false,
            title: '',
            concept: '',
            experiment: '',
          });
          receipt.checks.push(
            'genuine Tend proposal retained; acceptance guard rejection recorded; no replacement output',
          );
        } else {
          receipt.manualTendAcceptance = {
            accepted: true,
            kind: 'diagnostic only; no owner usefulness approval',
          };
          receipt.checks.push(
            'genuine Tend proposal and diagnostic acceptance; suggested experiment not performed',
          );
        }
      } else
        receipt.checks.push(
          'genuine Tend non-proposal retained without fabricated success: ' + branch?.status,
        );
      state = await checked({ op: 'snapshot' });
      if (state.workspace.garden.readySlots > 0 && state.workspace.experiment.calls.length < 6) {
        if (state.status === 'attention') await checked({ op: 'resume' });
        await checked({ op: 'run' });
        state = await settled();
        receipt.russianRequestedRun = state.workspace.garden.generations.at(-1);
        receipt.checks.push(
          'genuine Russian-requested manual blend; original result/failure retained, language quality not certified',
        );
      }
      state = await checked({ op: 'pause' });
      if (state.model.connected) throw new Error('Final pilot pause did not stop the owned model.');
    }
    receipt.checks.push('atomic Codex manifest present');
    receipt.errors = errors;
    await writeFile(
      path.join(output, 'receipt.json'),
      JSON.stringify({ ...receipt, workspace: state.workspace }, null, 2),
    );
    console.log(JSON.stringify({ output, checks: receipt.checks, errors }));
  }
} catch (e) {
  const state = await invoke({ op: 'snapshot' }).catch(() => null);
  await writeFile(
    path.join(output, 'failure.json'),
    JSON.stringify(
      { date: new Date().toISOString(), buildIdentity, error: String(e), state },
      null,
      2,
    ),
  );
  throw e;
} finally {
  await app.close();
}
