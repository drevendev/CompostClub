import { readFile, writeFile, mkdir, readdir, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const roots = [
  'src',
  'fixtures',
  'scripts',
  'server',
  'tests',
  'prompts',
  '.github',
  'experiments',
  'docs',
  'public',
];
const files = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'playwright.config.ts',
  'playwright.recovery.config.ts',
  'index.html',
  'eslint.config.js',
  '.prettierrc.json',
  '.prettierignore',
  'README.md',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'AGENTS.md',
  '.gitignore',
  '.gitattributes',
  '.npmrc',
  '.nvmrc',
];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, e.name);
    if (e.isDirectory()) await walk(name);
    else files.push(name);
  }
}
for (const dir of roots) await walk(dir);
await walk('evidence/model');
files.push(
  'evidence/verification.json',
  'evidence/pages-path.json',
  'evidence/desktop-sample.png',
  'evidence/mobile-sample.png',
  'evidence/pages-preview.png',
  'evidence/recovery.png',
  'evidence/recovery-verification.json',
);
const manifest = {};
for (const file of files.sort())
  manifest[file.replaceAll('\\', '/')] = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
const sourceSha256 = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
await mkdir('release/pages', { recursive: true });
await cp('dist', 'release/pages', { recursive: true });
for (const file of files) {
  const target = path.join('release/source', file);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(file, target);
}
await writeFile(
  'release/source-manifest.json',
  JSON.stringify(
    { sourceKind: 'explicit source archive, no Git metadata', sourceSha256, files: manifest },
    null,
    2,
  ) + '\n',
);
await writeFile(
  'release/build-identity.json',
  JSON.stringify(
    {
      date: new Date().toISOString(),
      sourceSha256,
      standalone: JSON.parse(await readFile('release/standalone-receipt.json', 'utf8')),
    },
    null,
    2,
  ) + '\n',
);
console.log('Packaged source identity:', sourceSha256);
