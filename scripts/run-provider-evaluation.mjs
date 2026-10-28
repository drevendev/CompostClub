// Explicit owner-run helper: decrypts the preview token only inside Electron.
// The token is never returned to this launcher, stdout or process arguments.
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

if (!process.argv.includes('--run-genuine-claude'))
  throw new Error(
    'Explicit --run-genuine-claude required. This uses subscription quota (maximum 36 calls).',
  );
const at = process.argv.indexOf('--token-profile'),
  profile = process.argv[at + 1];
if (at < 0 || !profile || !path.isAbsolute(profile))
  throw new Error('Supply the isolated preview profile with --token-profile.');
await mkdir('.local', { recursive: true });
const entry = path.resolve('.local/provider-evaluation-' + randomUUID() + '.cjs');
await build({
  entryPoints: ['scripts/provider-evaluate.ts'],
  outfile: entry,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  external: ['electron'],
});
const helperProfile = path.resolve('.local/provider-profile-' + randomUUID());
await mkdir(helperProfile);
const cryptoState = path.join(profile, 'Local State');
const info = await lstat(cryptoState);
if (!info.isFile() || info.isSymbolicLink() || info.size > 4 * 1024 * 1024)
  throw new Error('Invalid source profile crypto metadata.');
const cryptoBytes = await readFile(cryptoState);
JSON.parse(cryptoBytes.toString('utf8'));
await writeFile(path.join(helperProfile, 'Local State'), cryptoBytes, { flag: 'wx', mode: 0o600 });
const bootstrap = entry + '.bootstrap.cjs';
await writeFile(
  bootstrap,
  'const { app } = require("electron"); app.setName("Compost Club"); app.setPath("userData", ' +
    JSON.stringify(helperProfile) +
    '); require(' +
    JSON.stringify(entry) +
    ');\n',
  { flag: 'wx', mode: 0o600 },
);
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const executable = path.resolve(
  'node_modules/electron/dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron',
);
const child = spawn(executable, [bootstrap, '--run-genuine-claude', '--token-profile', profile], {
  cwd: process.cwd(),
  windowsHide: true,
  shell: false,
  env: environment,
  stdio: 'inherit',
});
child.once('error', () => {
  process.stderr.write('Evaluation helper could not start.\n');
  process.exitCode = 1;
});
child.once('close', (code) => {
  process.exitCode = code ?? 1;
});
