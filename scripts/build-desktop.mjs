import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist-desktop', { recursive: true });
await build({
  entryPoints: { main: 'desktop/main.ts', preload: 'desktop/preload.ts' },
  outdir: 'dist-desktop',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  external: ['electron'],
  sourcemap: false,
});
await writeFile(
  'dist-desktop/package.json',
  JSON.stringify({ name: 'compost-club-desktop', private: true, main: 'main.cjs' }),
);
console.log('Built desktop host and isolated preload.');
await writeFile(
  'dist-desktop/native-dpapi.ps1',
  '\ufeff' + (await readFile('scripts/native-dpapi.ps1', 'utf8')).replace(/^\ufeff/, ''),
);
