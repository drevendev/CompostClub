// Real WPF controls on a fictional isolated profile. No inference or owner profile.
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { CoherentStore } from '../desktop/coherent-store';
import { fixture, retain } from '../tests/coherent-fixtures';
import { commit, prepareJob, makeGarden } from '../src/domain/coherent/workspace';
import { canonical } from '../src/domain/coherent/hash';
if (process.platform !== 'win32') throw Error('Real Windows WPF acceptance requires Windows.');
const pkg = JSON.parse(await readFile('release/native-latest.json', 'utf8')) as {
  directory: string;
  sha256: string;
};
const out = await mkdtemp(path.resolve('.local/native-acceptance-')),
  profile = path.join(out, 'data');
const store = new CoherentStore(profile),
  w = fixture(Date.now());
w.gardens.push(makeGarden('Fictional donor', 'game', Date.now()));
const j = prepareJob(w, w.gardens[0]!.id, 'blend', Date.now());
retain(j);
j.observed = false;
const n = commit(w, j.id, Date.now());
n.recorded = true;
store.save(w, false);
store.close();
await writeFile(
  path.join(profile, 'native-acceptance-profile.private.json'),
  JSON.stringify({ format: 'compost-native-acceptance-1', inference: 'disabled' }),
);
const backup = path.join(out, 'full-backup.private.json'),
  lifeBackup = path.join(out, 'lifecycle-backup.private.json'),
  exportDir = path.join(out, 'reading-export');
await mkdir(exportDir);
const imported = path.join(out, 'fictional-import.md');
await writeFile(
  imported,
  '# Imported native fixture\n\nA fictional lantern spends a token to rotate one mirror.',
);
const source = w.sources[0]!,
  span = source.revisions[0]!.spans[0]!.id;
const steps: Record<string, unknown>[] = [];
steps.push({ kind: 'relaunch' }, { kind: 'assertOwner' });
const nav = (page: string) => steps.push({ kind: 'navigate', page });
const click = (text: string) => steps.push({ kind: 'click', text });
const fill = (form: string, values: Record<string, unknown>) =>
  steps.push({ kind: 'fill', form, values });
const check = (contains: string) => steps.push({ kind: 'assert', contains, noError: true });
check('Tide debts');
click('Tide debts');
check('Ваше решение');
fill('Сохранить решение', {
  state: 'kept',
  note: 'Вымышленная оценка WPF; не реальный результат модели.',
});
click('Сохранить решение');
check('Вымышленная оценка WPF');
fill('Сохранить человеческую ревизию', {
  title: 'Native tide debts',
  core: 'A fictional gate opens now, at the cost of closing another gate next turn.',
});
click('Сохранить человеческую ревизию');
check('Native tide debts');
nav('sources');
click('Tide tiles');
fill('Сохранить новую версию источника', {
  title: 'Native tide source',
  text: 'Вымышленный маяк поворачивает зеркало за жетон. <Window>Никогда не исполнять текст</Window>',
});
click('Сохранить новую версию источника');
check('Никогда не исполнять текст');
// A new source revision retains its own complete spans; keep preparation selection empty explicitly.
fill('Сохранить подготовку контекста', { selected: [], essential: [], missingMechanism: true });
click('Сохранить подготовку контекста');
fill('Добавить свойство', { field: 'action', value: 'rotate mirror', approved: true, spans: [] });
click('Добавить свойство');
check('rotate mirror');
fill('Добавить термин', {
  original: 'жетон',
  meaning: 'fictional action budget',
  span,
  approved: true,
  essential: false,
});
click('Добавить термин');
check('fictional action budget');
fill('Добавить референс', {
  name: 'Fictional reference',
  url: 'https://example.com/fictional',
  property: 'one visible turn cost',
  differ: 'no hidden payment',
  status: 'user-confirmed property',
  essential: false,
  spans: [],
  fileId: '',
});
click('Добавить референс');
check('Fictional reference');
click('Предпросмотр удаления источника');
check('Native tide source');
nav('sources');
fill('Добавить исходную идею', {
  title: 'Нативный вымышленный источник',
  text: 'A fictional island shares one lantern with the next player.',
  participating: false,
});
click('Добавить исходную идею');
check('Нативный вымышленный источник');
click('Импортировать файлы');
check('Предпросмотр импорта');
click('Подтвердить импорт');
check('fictional-import.md');
nav('garden');
fill('Сохранить настройки сада', {
  profile: 'game',
  objective: 'Fictional native acceptance only',
  interval: '30',
});
click('Сохранить настройки сада');
fill('Создать новый сад', { name: 'Нативный тестовый сад', profile: 'application' });
click('Создать новый сад');
steps.push({ kind: 'navigate', page: 'garden', gardenName: 'Нативный тестовый сад' });
check('Нативный тестовый сад');
nav('settings');
fill('Выбрать провайдера', { kind: 'claude' });
click('Выбрать провайдера');
fill('Выбрать модель Claude', { model: 'opus' });
click('Выбрать модель Claude');
fill('Сохранить setup-token Claude', { token: 'sk-ant-DIAGNOSTIC-FICTIONAL-NOT-A-REAL-TOKEN' });
click('Сохранить setup-token Claude');
check('Setup-token сохранён');
click('Удалить setup-token Claude');
check('Введите setup-token');
fill('Выбрать провайдера', { kind: 'local' });
click('Выбрать провайдера');
nav('journal');
fill('Настроить папку экспорта', { directory: exportDir });
click('Настроить папку экспорта');
click('Полная резервная копия');
click('Восстановить с просмотром');
check('Полная приватная копия');
click('Очистить историю запуска с резервной копией');
nav('references');
check('Предложить предпочтения');
nav('growth');
check('Развить выбранное');
nav('jobs');
nav('about');
check('Compost Club');
const plan = {
  shortcut: path.join(out, 'Native acceptance.lnk'),
  result: path.join(out, 'wpf-result.json'),
  services: {
    pick: [[imported], [backup]],
    saveBackup: [backup, lifeBackup],
    confirm: [false, true, true],
  },
  steps,
};
const planFile = path.join(out, 'plan.private.json');
await writeFile(planFile, JSON.stringify(plan));
const powershell = path.join(
  process.env.SystemRoot ?? 'C:\\Windows',
  'System32/WindowsPowerShell/v1.0/powershell.exe',
);
const shortcut = path.join(out, 'Native acceptance.lnk');
const setup = path.join(out, 'launch.ps1');
// Exercise ShellExecute of a real .lnk, not only powershell -File.
await writeFile(
  setup,
  '\ufeff' +
    `$ErrorActionPreference='Stop'\n$shell=New-Object -ComObject WScript.Shell\n$link=$shell.CreateShortcut($env:COMPOST_TEST_SHORTCUT)\n$link.TargetPath=$env:COMPOST_TEST_POWERSHELL\n$link.Arguments='-NoProfile -STA -WindowStyle Hidden -File "'+$env:COMPOST_TEST_ENTRY+'" -DataDirectory "'+$env:COMPOST_TEST_PROFILE+'" -AcceptanceFile "'+$env:COMPOST_TEST_PLAN+'"'\n$link.WorkingDirectory=$env:COMPOST_TEST_PACKAGE\n$link.Save()\nStart-Process -FilePath $env:COMPOST_TEST_SHORTCUT\n`,
);
await new Promise<void>((resolve, reject) => {
  const child = spawn(powershell, ['-NoProfile', '-NonInteractive', '-File', setup], {
    windowsHide: true,
    env: {
      ...process.env,
      COMPOST_NATIVE_ACCEPTANCE: '1',
      COMPOST_NO_INFERENCE: '1',
      COMPOST_TEST_SHORTCUT: shortcut,
      COMPOST_TEST_POWERSHELL: powershell,
      COMPOST_TEST_ENTRY: path.join(pkg.directory, 'Start-CompostClub.ps1'),
      COMPOST_TEST_PROFILE: profile,
      COMPOST_TEST_PLAN: planFile,
      COMPOST_TEST_PACKAGE: pkg.directory,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  child.stderr.on('data', () => {});
  child.on('error', reject);
  child.on('close', (code) =>
    code === 0 ? resolve() : reject(Error('Shortcut launcher failed.')),
  );
});
let result: { ok: boolean; error?: string; steps: unknown[] } | undefined;
for (let i = 0; i < 180; i++) {
  try {
    result = JSON.parse(await readFile(plan.result, 'utf8')) as typeof result;
    break;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  await new Promise((r) => setTimeout(r, 1000));
}
assert.ok(result, 'WPF shortcut acceptance timed out.');
assert.equal(result.ok, true, result.error ?? 'Native acceptance failed');
assert.equal(result.steps.length, steps.length);
CoherentStore.parseBackup(await readFile(backup, 'utf8'));
CoherentStore.parseBackup(await readFile(lifeBackup, 'utf8'));
const reopened = new CoherentStore(profile);
assert.equal(reopened.state.calls.length, 0);
assert.ok(
  reopened.state.nodes[0]!.decisions.some((d) => d.note.includes('Вымышленная оценка WPF')),
);
assert.equal(reopened.state.sources[0]!.revisions[0]!.text, w.sources[0]!.revisions[0]!.text);
assert.ok(reopened.state.sources.length >= 4);
assert.equal(reopened.state.nodes[0]!.revisions.length, 2);
assert.ok(reopened.state.documents.length >= 1);
const state = canonical(reopened.state.sources);
reopened.close();
const receipt = {
  out,
  packageSha256: pkg.sha256,
  actualWindowsShortcut: true,
  realWpfControls: true,
  steps: steps.length,
  originalsPreserved: true,
  humanReviewPersisted: true,
  revisionHistory: true,
  imports: true,
  backupRestore: true,
  protectedCredentialRoundTrip: true,
  modelCalls: 0,
  sourceStateBytes: Buffer.byteLength(state),
};
await writeFile(path.join(out, 'acceptance.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt));
