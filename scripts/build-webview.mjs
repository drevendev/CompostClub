import { build } from 'esbuild';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const pin = JSON.parse(await readFile('scripts/webview2-sdk.json', 'utf8'));
const sdk = path.resolve('.local/webview2-sdk', pin.version, 'sdk');
const directory = path.resolve(
  'release',
  'CompostClub-WebView-' + new Date().toISOString().replaceAll(':', '-'),
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
await cp('dist-desktop-ui', path.join(directory, 'ui'), { recursive: true });
for (const [source, target] of [
  ['scripts/start-webview.ps1', 'Start-CompostClub.ps1'],
  ['scripts/native-dpapi.ps1', 'native-dpapi.ps1'],
  ['scripts/webview-dpi.ps1', 'webview-dpi.ps1'],
  ['scripts/create-webview-shortcut.ps1', 'Create-Shortcut.ps1'],
])
  await writeFile(
    path.join(directory, target),
    '\ufeff' + (await readFile(source, 'utf8')).replace(/^\ufeff/, ''),
  );
for (const [source, target] of [
  ['scripts/webview-preload.js', 'webview-preload.js'],
  ['scripts/desktop-operator.mjs', 'operator.mjs'],
  ['public/garden-icon.ico', 'garden-icon.ico'],
  ['LICENSE', 'LICENSE'],
  ['THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'],
  ['public/THIRD_PARTY_LICENSES.txt', 'THIRD_PARTY_LICENSES.txt'],
])
  await cp(source, path.join(directory, target));
await mkdir(path.join(directory, 'webview2'));
for (const [source, target] of [
  ['lib/net462/Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.Core.dll'],
  ['lib/net462/Microsoft.Web.WebView2.WinForms.dll', 'Microsoft.Web.WebView2.WinForms.dll'],
  ['runtimes/win-x64/native/WebView2Loader.dll', 'WebView2Loader.dll'],
  ['LICENSE.txt', 'LICENSE.txt'],
  ['NOTICE.txt', 'NOTICE.txt'],
])
  await cp(path.join(sdk, source), path.join(directory, 'webview2', target));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile(
  path.join(directory, 'START-HERE.txt'),
  `Compost Club ${pkg.version}: React UI in WinForms/WebView2.\nUse Create-Shortcut.ps1 with installed signed Node 24 and the existing data directory.\nRequires installed Microsoft WebView2 Runtime and Windows PowerShell 5.1 (STA). No application EXE, HTTP server or runtime/model download. Official SDK ${pin.version} libraries are included with their license/notices.\nClose hides to tray; Exit safely stops the worker. Use one host at a time for each profile. All three project hosts remain available: React/Electron, minimal WPF and React/WebView2.\nClaude requires the installed official Claude Code. Choose manual/automatic mode separately from the model; Continue explicitly confirms external scheduling scope and limits. Manual external jobs keep exact-context previews. Model changes warn; Pause/restart revokes scheduling permission.\nSee docs/WEBVIEW_WINDOWS.md in the source archive.\n`,
);
const files = {};
async function walk(root, prefix = '') {
  for (const item of (await readdir(root, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const name = prefix + item.name;
    if (item.isDirectory()) await walk(path.join(root, item.name), name + '/');
    else
      files[name] = createHash('sha256')
        .update(await readFile(path.join(root, item.name)))
        .digest('hex');
  }
}
await walk(directory);
const identity = {
  format: 'compost-webview-package-1',
  date: new Date().toISOString(),
  version: pkg.version,
  files,
  sha256: createHash('sha256').update(JSON.stringify(files)).digest('hex'),
  sdk: pin,
  requires: {
    node: '24',
    windowsPowerShell: '5.1 STA',
    webview2: 'Installed Evergreen Runtime, x64',
  },
  httpListener: false,
  customNativeBinaries: 0,
};
await writeFile(path.join(directory, 'PACKAGE-IDENTITY.json'), JSON.stringify(identity, null, 2));
await writeFile(
  'release/webview-latest.json',
  JSON.stringify({ directory, sha256: identity.sha256 }, null, 2),
);
console.log(JSON.stringify({ directory, sha256: identity.sha256 }));
