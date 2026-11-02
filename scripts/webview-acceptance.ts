// Real packaged React/WebView2 and .lnk, authored fictional data, inference hard-disabled.
import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import { CoherentStore } from '../desktop/coherent-store';
import { fixture, retain } from '../tests/coherent-fixtures';
import { commit, prepareJob } from '../src/domain/coherent/workspace';
import { canonical, hash } from '../src/domain/coherent/hash';
if (process.platform !== 'win32')
  throw Error('Actual Windows WebView2 acceptance requires Windows.');
await mkdir('.local', { recursive: true });
const out = await mkdtemp(path.resolve('.local/webview-acceptance-')),
  profile = path.join(out, 'data'),
  backup = path.join(out, 'backup.private.json'),
  pkg = JSON.parse(await readFile('release/webview-latest.json', 'utf8')) as {
    directory: string;
    sha256: string;
  };
const w = fixture(Date.now()),
  g = w.gardens[0]!;
const job = prepareJob(w, g.id, 'blend', Date.now());
retain(job);
job.observed = false;
const card = commit(w, job.id, Date.now());
card.recorded = true;
const store = new CoherentStore(profile);
store.save(w, false);
store.close();
await writeFile(
  path.join(profile, 'webview-acceptance-profile.private.json'),
  JSON.stringify({ format: 'compost-webview-acceptance-1', inference: 'disabled' }),
);
const imported = path.join(out, 'fictional-import.md'),
  exportDir = path.join(out, 'reading-export');
await mkdir(exportDir);
await writeFile(imported, '# Fictional mirror\n\nA lantern spends one token to rotate a mirror.');
const steps: Record<string, unknown>[] = [];
steps.push({ kind: 'assertDpi' });
const script = (body: string) =>
  steps.push({ kind: 'script', script: 'const check=(v,m)=>{if(!v)throw Error(m)};' + body });
script(
  `await document.fonts.ready;check(document.querySelector('.coherent-app'),'Existing desktop React design missing');check(document.body.innerText.includes('Tide tiles'),'Source list missing');check(Math.abs(devicePixelRatio-expectedDevicePixelRatio)<0.02,'WebView raster scale does not match native DPI');window.fixtureView=await compost.invoke({op:'snapshot'});check(fixtureView.workspace.calls.length===0,'Unexpected calls');return {nativeDpi,devicePixelRatio,innerWidth,innerHeight};`,
);
steps.push(
  { kind: 'capture', file: path.join(out, 'react-sources.png') },
  { kind: 'relaunch' },
  { kind: 'assertOwner' },
);
script(
  `document.querySelector('nav[aria-label="Разделы сада"] button[aria-current="page"]').click();const v=await compost.invoke(${JSON.stringify({ op: 'add', garden: g.id, title: 'Hybrid fictional source', text: 'A fictional <Window> string is always plain text, never executable HTML.', participating: false })});check(v.workspace.sources.length===3,'Add did not persist');`,
);
script(
  `check(document.body.innerText.includes('Hybrid fictional source'),'Async update absent');const v=await compost.invoke(${JSON.stringify({ op: 'editSource', id: w.sources[0]!.id, title: 'Hybrid tide source', text: 'A fictional gate rotates at the cost of one signal token.' })});check(v.workspace.sources[0].revisions.length===2,'Source revision missing');`,
);
script(
  `const nav=[...document.querySelectorAll('nav[aria-label="Разделы сада"] button')].find(b=>b.innerText==='На просмотр');check(nav,'Review navigation missing');nav.click();`,
);
script(
  `check(document.body.innerText.includes('Tide debts'),'Recorded card missing');await compost.invoke(${JSON.stringify({ op: 'review', id: card.id, state: 'kept', note: 'Fictional hybrid review', reasons: [] })});await compost.invoke(${JSON.stringify({ op: 'editIdea', id: card.id, content: { title: 'Hybrid tide debts' } })});`,
);
script(
  `const v=await compost.invoke(${JSON.stringify({ op: 'chooseImport', garden: g.id })});check(v.preview?.items.length===1,'Native import preview missing');window.importPreview=v.preview;`,
);
script(
  `const v=await compost.invoke({op:'acceptImport',id:importPreview.id,choices:importPreview.items.map(()=> 'new-copy'),participating:false});check(v.workspace.documents.length===1,'Original imported document absent');`,
);
script(
  `await compost.invoke({op:'configureProvider',kind:'claude'});await compost.invoke({op:'configureClaudeModel',model:'opus'});const v=await compost.invoke({op:'setClaudeToken',token:'sk-ant-DIAGNOSTIC-FICTIONAL-NOT-REAL'});check(v.claudeToken.present,'Protected credential missing');`,
);
script(
  `const before=await compost.invoke({op:'snapshot'});const parents=before.workspace.sources.slice(0,2).map(s=>({garden:s.garden,kind:'source',id:s.id,revision:s.revisions.at(-1).revision}));const v=await compost.invoke({op:'run',garden:${JSON.stringify(g.id)},parents});check(v.remotePreview,'Exact-context preview missing');check(v.workspace.calls.length===0,'Preview dispatched a call');window.previewId=v.remotePreview.id;`,
);
script(
  `check(document.querySelector('dialog[open]'),'React consent dialog absent');await compost.invoke({op:'cancelRemote'});const v=await compost.invoke({op:'snapshot'});check(!v.remotePreview,'Cancel failed');check(v.workspace.calls.length===0,'Cancellation spent calls');`,
);
script(
  `await compost.invoke({op:'removeClaudeToken'});await compost.invoke({op:'configureProvider',kind:'local'});await compost.invoke(${JSON.stringify({ op: 'configureExport', directory: exportDir })});await compost.invoke({op:'export'});await compost.invoke({op:'backup'});`,
);
script(
  `await compost.invoke(${JSON.stringify({ op: 'add', garden: g.id, title: 'After backup only', text: 'Fictional source removed by explicit test restore.', participating: false })});const v=await compost.invoke({op:'restore'});check(!v.workspace.sources.some(s=>s.revisions.at(-1).title==='After backup only'),'Restore did not replace validated state');check(v.workspace.calls.length===0,'Restore changed calls');`,
);
script(
  `let rejected=false;try{await compost.invoke({op:'operatorCredits',garden:${JSON.stringify(g.id)},value:99})}catch{rejected=true}check(rejected,'Operator command crossed renderer boundary');await compost.invoke({op:'pause'});`,
);
const plan = {
  shortcut: path.join(out, 'React acceptance.lnk'),
  result: path.join(out, 'result.json'),
  services: { pick: [[imported], [backup]], saveBackup: [backup], confirm: [true, true] },
  steps,
};
const planFile = path.join(out, 'plan.private.json');
await writeFile(planFile, JSON.stringify(plan));
const ps = path.join(
  process.env.SystemRoot ?? 'C:\\Windows',
  'System32/WindowsPowerShell/v1.0/powershell.exe',
);
const setup = path.join(out, 'launch.ps1');
await writeFile(
  setup,
  '\ufeff' +
    `$ErrorActionPreference='Stop'\n$shell=New-Object -ComObject WScript.Shell\n$link=$shell.CreateShortcut($env:COMPOST_TEST_SHORTCUT)\n$link.TargetPath=$env:COMPOST_TEST_POWERSHELL\n$link.Arguments='-NoProfile -STA -WindowStyle Hidden -File "'+$env:COMPOST_TEST_ENTRY+'" -DataDirectory "'+$env:COMPOST_TEST_PROFILE+'" -AcceptanceFile "'+$env:COMPOST_TEST_PLAN+'"'\n$link.WorkingDirectory=$env:COMPOST_TEST_PACKAGE\n$link.Save()\nStart-Process -FilePath $env:COMPOST_TEST_SHORTCUT\n`,
);
await new Promise<void>((resolve, reject) => {
  const child = spawn(ps, ['-NoProfile', '-File', setup], {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      COMPOST_TEST_SHORTCUT: plan.shortcut,
      COMPOST_TEST_POWERSHELL: ps,
      COMPOST_TEST_ENTRY: path.join(pkg.directory, 'Start-CompostClub.ps1'),
      COMPOST_TEST_PROFILE: profile,
      COMPOST_TEST_PLAN: planFile,
      COMPOST_TEST_PACKAGE: pkg.directory,
    },
  });
  child.on('error', reject);
  child.on('close', (code) => (code === 0 ? resolve() : reject(Error('Shortcut launch failed'))));
});
let result: { ok: boolean; error?: string; steps: unknown[] } | undefined;
for (let i = 0; i < 200; i++) {
  try {
    result = JSON.parse(await readFile(plan.result, 'utf8')) as typeof result;
    break;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  await new Promise((r) => setTimeout(r, 1000));
}
assert.ok(result, 'WebView shortcut did not finish');
assert.equal(result.ok, true, result.error ?? 'WebView acceptance failed');
assert.equal(result.steps.length, steps.length);
CoherentStore.parseBackup(await readFile(backup, 'utf8'));
const reopened = new CoherentStore(profile);
assert.equal(reopened.state.calls.length, 0);
assert.ok(reopened.state.nodes[0]!.decisions.some((d) => d.note === 'Fictional hybrid review'));
assert.equal(reopened.state.nodes[0]!.revisions.length, 2);
assert.equal(reopened.state.sources[0]!.revisions[0]!.text, w.sources[0]!.revisions[0]!.text);
assert.equal(reopened.state.sources.length, 4);
assert.equal(reopened.state.documents.length, 1);
assert.ok((await readdir(exportDir)).length > 0);
const workspaceHash = hash(canonical(reopened.state));
reopened.close();
const receipt = {
  packageSha256: pkg.sha256,
  actualWindowsShortcut: true,
  existingReactRenderer: true,
  steps: steps.length,
  realModelCalls: 0,
  originalsPreserved: true,
  backupRestore: true,
  protectedCredentialRoundTrip: true,
  remotePreviewCancelled: true,
  workspaceHash,
  out,
};
await writeFile(path.join(out, 'acceptance.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt));
