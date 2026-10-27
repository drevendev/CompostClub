// Explicit owner-run helper: decrypts the preview token only inside Electron.
// The token is never returned to this launcher, stdout or process arguments.
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
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
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const executable = path.resolve(
  'node_modules/electron/dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron',
);
const child = spawn(executable, [entry, '--run-genuine-claude', '--token-profile', profile], {
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
