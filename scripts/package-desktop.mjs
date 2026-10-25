import { cp, mkdir, readFile, writeFile, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const directory = path.resolve(
  'release',
  `CompostClub-Desktop-${new Date().toISOString().replaceAll(':', '-')}`,
);
await mkdir(path.dirname(directory), { recursive: true });
await cp('node_modules/electron/dist', directory, {
  recursive: true,
  errorOnExist: true,
  force: false,
});
await rename(path.join(directory, 'electron.exe'), path.join(directory, 'CompostClub.exe'));
if (process.platform === 'win32') {
  const iconScript =
    '& {\n' +
    (await readFile('scripts/set-windows-icon.ps1', 'utf8')) +
    '\n} -Executable $env:COMPOST_ICON_EXE -Icon $env:COMPOST_ICON_FILE';
  await promisify(execFile)(
    path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(iconScript, 'utf16le').toString('base64'),
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        COMPOST_ICON_EXE: path.join(directory, 'CompostClub.exe'),
        COMPOST_ICON_FILE: path.resolve('public/garden-icon.ico'),
      },
    },
  );
}
const app = path.join(directory, 'resources', 'app');
await mkdir(app, { recursive: true });
await cp('dist-desktop', path.join(app, 'dist-desktop'), { recursive: true });
await cp('dist-desktop-ui', path.join(app, 'dist-desktop-ui'), { recursive: true });
for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) await cp(file, path.join(app, file));
await mkdir(path.join(app, 'licenses'), { recursive: true });
for (const file of ['GolosText-OFL.txt', 'Literata-OFL.txt'])
  await cp(path.join('src/desktop/fonts', file), path.join(app, 'licenses', file));
await writeFile(
  path.join(app, 'package.json'),
  JSON.stringify({
    name: 'compost-club',
    productName: 'Compost Club',
    version: pkg.version,
    author: pkg.author,
    main: 'dist-desktop/main.cjs',
    private: true,
  }),
);
await writeFile(
  path.join(directory, 'START-HERE.txt'),
  'Compost Club ' +
    pkg.version +
    ' — experimental local Windows application\n\nCreative usefulness is not certified; inspect filtered drafts and make your own review decisions.\nStart CompostClub.exe. No terminal or Node installation is needed for this portable application.\nThe first launch is paused. Select your installed Ollama executable, model directory and an empty export folder in Settings. No model is downloaded.\nKeep a closed-app copy of your previous data directory and executable before upgrading. Schema 3 needs this new executable; use the preserved old copy for rollback.\nClose the window to keep an enabled experiment in the tray; use Pause before gaming, and Exit to stop the application.\nYour data is in the operating-system application-data directory, outside this package. Full private backups are separate from Codex exports. Font licences are in resources/app/licenses.\n',
);
const files = {};
async function walk(dir, relative = '') {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const name = path.posix.join(relative, e.name),
      full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, name);
    else
      files[name] = createHash('sha256')
        .update(await readFile(full))
        .digest('hex');
  }
}
await walk(directory);
const receipt = {
  date: new Date().toISOString(),
  electron: pkg.devDependencies.electron,
  files,
  sha256: createHash('sha256').update(JSON.stringify(files)).digest('hex'),
  directory: path.basename(directory),
};
await writeFile(path.join(directory, 'PACKAGE-IDENTITY.json'), JSON.stringify(receipt, null, 2));
await writeFile(
  'release/desktop-latest.json',
  JSON.stringify({ directory, sha256: receipt.sha256 }, null, 2),
);
console.log('Portable desktop application:', directory);
