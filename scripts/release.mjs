import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { packageSource, sha256 } from './source-package.mjs';
const output = path.resolve('release');
await mkdir(output, { recursive: true });
const source = await packageSource(process.cwd(), output);
const archive = path.join(
  output,
  'CompostClub-Source-' + new Date().toISOString().replaceAll(':', '-') + '.zip',
);
if (process.platform === 'win32') {
  const script =
    'Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($env:COMPOST_SOURCE_PATH, $env:COMPOST_ARCHIVE_PATH)';
  await promisify(execFile)(
    path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(script, 'utf16le').toString('base64'),
    ],
    {
      windowsHide: true,
      env: { ...process.env, COMPOST_SOURCE_PATH: source.directory, COMPOST_ARCHIVE_PATH: archive },
    },
  );
} else await promisify(execFile)('zip', ['-qr', archive, '.'], { cwd: source.directory });
const pages = path.join(output, 'pages-' + randomUUID());
await cp('dist', pages, { recursive: true, errorOnExist: true, force: false });
const identity = {
  date: new Date().toISOString(),
  sourceSha256: source.identity.sourceSha256,
  sourceDirectory: path.basename(source.directory),
  sourceArchive: path.basename(archive),
  sourceArchiveSha256: sha256(await readFile(archive)),
  pagesDirectory: path.basename(pages),
  standalone: JSON.parse(await readFile('release/standalone-receipt.json', 'utf8')),
};
await writeFile('release/build-identity.json', JSON.stringify(identity, null, 2) + '\n');
console.log('Packaged reviewed source:', JSON.stringify(identity));
