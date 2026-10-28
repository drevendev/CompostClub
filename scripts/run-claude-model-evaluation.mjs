// Explicit genuine evaluation; no terminal/UI automation or visible window.
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const args = process.argv.slice(2);
if (!args.includes('--run-genuine-claude'))
  throw new Error('Explicit --run-genuine-claude required; maximum nine subscription calls.');
const option = (name) => {
  const at = args.indexOf(name);
  return at < 0 ? '' : (args[at + 1] ?? '');
};
for (const name of ['--token-profile', '--claude-executable'])
  if (!path.isAbsolute(option(name))) throw new Error('Absolute ' + name + ' required.');
await mkdir('.local', { recursive: true });
const directory = await mkdtemp(path.resolve('.local/claude-model-helper-'));
const profile = path.join(directory, 'profile');
await mkdir(profile);
// Windows safeStorage uses profile crypto metadata. Keep its protected key with
// the isolated helper; copying only the encrypted credential is insufficient.
const cryptoState = path.join(option('--token-profile'), 'Local State');
const info = await lstat(cryptoState);
if (!info.isFile() || info.isSymbolicLink() || info.size > 4 * 1024 * 1024)
  throw new Error('Source profile crypto metadata must be a regular bounded file.');
const cryptoBytes = await readFile(cryptoState);
JSON.parse(cryptoBytes.toString('utf8'));
await writeFile(path.join(profile, 'Local State'), cryptoBytes, { flag: 'wx', mode: 0o600 });
const entry = path.join(directory, 'evaluate.cjs');
await build({
  entryPoints: ['scripts/claude-model-evaluate.ts'],
  outfile: entry,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  external: ['electron'],
});
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(
  path.resolve('node_modules/electron/dist/electron.exe'),
  [entry, ...args, '--helper-profile', profile],
  { cwd: process.cwd(), windowsHide: true, shell: false, env, stdio: 'inherit' },
);
child.once('error', () => {
  process.stderr.write('Evaluation helper could not start.\n');
  process.exitCode = 1;
});
child.once('close', (code) => {
  process.exitCode = code ?? 1;
});
