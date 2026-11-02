import { build } from 'esbuild';
import { mkdir, readFile, writeFile, cp, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const directory = path.resolve(
  'release',
  'CompostClub-WPF-' + new Date().toISOString().replaceAll(':', '-'),
);
await mkdir(directory, { recursive: true });
await build({
  entryPoints: ['desktop/native-worker.ts'],
  outfile: path.join(directory, 'native-worker.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
});
for (const [source, target] of [
  ['scripts/start-native.ps1', 'Start-CompostClub.ps1'],
  ['scripts/native-dpapi.ps1', 'native-dpapi.ps1'],
  ['scripts/create-native-shortcut.ps1', 'Create-Shortcut.ps1'],
]) {
  const text = await readFile(source, 'utf8');
  await writeFile(path.join(directory, target), '\ufeff' + text.replace(/^\ufeff/, ''), 'utf8');
}
for (const [source, target] of [
  ['public/garden-icon.ico', 'garden-icon.ico'],
  ['LICENSE', 'LICENSE'],
  ['THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'],
  ['public/THIRD_PARTY_LICENSES.txt', 'THIRD_PARTY_LICENSES.txt'],
])
  await cp(source, path.join(directory, target));
await cp('scripts/desktop-operator.mjs', path.join(directory, 'operator.mjs'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile(
  path.join(directory, 'START-HERE.txt'),
  `Compost Club ${pkg.version} · native Windows WPF\n\nStart Start-CompostClub.ps1 using installed signed Windows PowerShell (STA) and Node 24. No custom EXE, browser or web server is bundled. No runtime/model is downloaded. The original SQLite profile remains canonical.\nClose hides the window in the tray; Exit drains work and closes the host. After sleep scheduling is paused.\nChoose manual/automatic mode independently of provider/model. Manual Claude/Groq jobs require exact-context previews; Continue confirms external scheduling scope and limits. Model changes warn; Pause/restart revokes scheduling permission. Native Windows DPAPI credentials are separate; originals remain preserved.\nDo not publish private profiles, receipts or reading snapshots. See docs/NATIVE_WINDOWS.md in the source archive.\n`,
);
const files = {};
for (const f of (await readdir(directory)).sort())
  files[f] = createHash('sha256')
    .update(await readFile(path.join(directory, f)))
    .digest('hex');
const identity = {
  format: 'compost-wpf-package-1',
  date: new Date().toISOString(),
  version: pkg.version,
  files,
  sha256: createHash('sha256').update(JSON.stringify(files)).digest('hex'),
  requires: { node: '24', windowsPowerShell: '5.1 with WPF' },
  customNativeBinaries: 0,
  httpListener: false,
};
await writeFile(path.join(directory, 'PACKAGE-IDENTITY.json'), JSON.stringify(identity, null, 2));
await writeFile(
  'release/native-latest.json',
  JSON.stringify({ directory, sha256: identity.sha256 }, null, 2),
);
console.log(JSON.stringify({ directory, sha256: identity.sha256 }));
