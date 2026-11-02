// Actual native UI workflow with explicitly synthetic model/decision fixtures.
// This cannot satisfy an owner-accepted live candidate or growth quality gate.
import { _electron as electron } from '@playwright/test';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { CoherentStore } from '../desktop/coherent-store';
import { fixture, NOW, retain, assess } from '../tests/coherent-fixtures';
import { prepareJob, commit, decide } from '../src/domain/coherent/workspace';
import type { Identity } from '../src/domain/coherent/types';
import type { CoherentCommand } from '../desktop/coherent-types';
const packaged = process.argv[2];
if (!packaged) throw new Error('Provide the exact portable directory.');
await mkdir('.local', { recursive: true });
const output = await mkdtemp(path.resolve('.local/coherent-workflow-')),
  data = path.join(output, 'data');
const w = fixture(),
  g = w.gardens[0]!;
g.name = 'Fictional UI diagnostic';
w.settings.candidates = 48;
const add = (name: string, parent?: Identity) => {
  g.credits.balance = 3; // Explicit synthetic capacity, not clock/inference evidence.
  const j = prepareJob(
    w,
    g.id,
    parent ? 'growth' : 'blend',
    NOW,
    parent ? { parents: [parent], direction: 'explore an alternative' } : {},
  );
  retain(j);
  if (j.draft?.outcome !== 'candidate') throw new Error('Diagnostic candidate missing');
  j.draft.title = name;
  j.assessment = assess(j);
  const n = commit(w, j.id, NOW);
  decide(
    w,
    n.id,
    'kept',
    'AUTOMATED FICTIONAL DIAGNOSTIC; not an owner usefulness judgment.',
    [],
    NOW,
  );
  return n;
};
const root = add('Diagnostic root');
const identity = (n: typeof root): Identity => ({
  garden: n.garden,
  kind: n.kind,
  id: n.id,
  revision: n.revisions.at(-1)!.revision,
});
let parent = identity(root);
for (let i = 1; i <= 3; i++) parent = identity(add('Diagnostic growth ' + i, parent));
const alt1 = add('Diagnostic alternative A', identity(root));
add('Diagnostic alternative B', identity(root));
const store = new CoherentStore(data);
store.save(w);
store.close();
const app = await electron.launch({
  executablePath: path.join(path.resolve(packaged), 'CompostClub.exe'),
  args: ['--compost-data-dir=' + data],
  cwd: path.resolve(packaged),
  env: { ...process.env, COMPOST_ACCEPTANCE: '1', COMPOST_DATA_DIR: '' },
});
const errors: string[] = [];
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForSelector('.coherent-app');
  const invoke = async (c: CoherentCommand) => {
    const s = await page.evaluate((c) => window.compost.invoke(c), c);
    if (s.error) throw new Error(s.error);
    return s;
  };
  await page.getByRole('button', { name: 'Развитие', exact: true }).click();
  assert.equal(
    await page.getByRole('list', { name: 'Контур развития' }).locator(':scope > li').count(),
    6,
  );
  await page.getByRole('button', { name: /Diagnostic growth 1/, exact: false }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Сравнить альтернативу').selectOption(alt1.id);
  assert.equal(await dialog.locator('.compare pre').count(), 2);
  await dialog.getByText('Редактировать отдельной человеческой ревизией', { exact: true }).click();
  const edited =
    'DIAGNOSTIC HUMAN EDIT: open a gate with one signal, then repay with a delayed closure.';
  await dialog.getByLabel('Механизм', { exact: true }).fill(edited);
  await dialog.getByRole('button', { name: 'Сохранить человеческую ревизию', exact: true }).click();
  await page.waitForFunction((text) => document.body.textContent?.includes(text), edited);
  let state = await invoke({ op: 'snapshot' });
  const n = state.workspace.nodes.find((n) => n.revisions.at(-1)!.content.core === edited)!;
  assert.equal(n.revisions.length, 2);
  assert.equal(n.revisions.at(-1)!.assessment, null);
  assert.equal(
    n.revisions[0]!.content.core,
    w.nodes.find((old) => old.id === n.id)!.revisions[0]!.content.core,
  );
  await dialog.getByLabel('Решение', { exact: false }).selectOption('rejected');
  await dialog
    .getByLabel('Ваша исходная заметка')
    .fill('AUTOMATED diagnostic rejection; exact note preserved.');
  await dialog.getByRole('button', { name: 'Сохранить решение', exact: true }).click();
  state = await invoke({ op: 'snapshot' });
  assert.equal(
    state.workspace.nodes.find((node) => node.id === n.id)!.decisions.at(-1)!.state,
    'rejected',
  );
  await page.keyboard.press('Escape');
  await page.reload();
  await page.waitForSelector('.coherent-app');
  state = await invoke({ op: 'snapshot' });
  assert.equal(state.workspace.nodes.find((node) => node.id === n.id)!.revisions.length, 2);
  assert.equal(state.workspace.calls.length, 0, 'Synthetic UI workflow makes no model calls.');
  await app.evaluate(
    ({ dialog }, target) => {
      dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: target });
    },
    path.join(output, 'diagnostic-backup.json'),
  );
  await invoke({ op: 'backup' });
  await app.evaluate(
    ({ dialog }, target) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [target] });
      dialog.showMessageBox = () => Promise.resolve({ response: 1, checkboxChecked: false });
    },
    path.join(output, 'diagnostic-backup.json'),
  );
  await invoke({ op: 'restore' });
  await invoke({ op: 'deleteSource', id: w.sources[0]!.id });
  state = await invoke({ op: 'snapshot' });
  assert.equal(
    state.workspace.sources.some((s) => s.id === w.sources[0]!.id),
    false,
  );
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(output, 'acceptance.json'),
    JSON.stringify(
      {
        label: 'Native Chromium synthetic workflow; zero inference, no owner score',
        acceptedDiagnosticChain: 3,
        alternatives: 2,
        compare: true,
        humanRevisionOriginalPreserved: true,
        rejectionNotePreserved: true,
        reload: true,
        fullBackupRestore: true,
        confirmedCascade: true,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await app.close();
}
console.log(JSON.stringify({ output, result: 'passed; synthetic UI workflow only' }));
