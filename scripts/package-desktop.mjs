import { cp, mkdir, readFile, writeFile, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
const app = path.join(directory, 'resources', 'app');
await mkdir(app, { recursive: true });
await cp('dist-desktop', path.join(app, 'dist-desktop'), { recursive: true });
await cp('dist-desktop-ui', path.join(app, 'dist-desktop-ui'), { recursive: true });
for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) await cp(file, path.join(app, file));
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
  'Compost Club — local Windows application\n\nStart CompostClub.exe. No terminal or Node installation is needed for this portable application.\nThe first launch is paused. Select your installed Ollama executable, model directory and an empty export folder in Settings. No model is downloaded.\nClose the window to keep an enabled experiment in the tray; use Pause before gaming, and Exit to stop the application.\nYour data is in the operating-system application-data directory, outside this package. Full private backups are separate from Codex exports.\n',
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
  directory,
};
await writeFile(path.join(directory, 'PACKAGE-IDENTITY.json'), JSON.stringify(receipt, null, 2));
await writeFile(
  'release/desktop-latest.json',
  JSON.stringify({ directory, sha256: receipt.sha256 }, null, 2),
);
console.log('Portable desktop application:', directory);
