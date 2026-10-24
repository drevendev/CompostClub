import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { packageSource, sha256 } from '../scripts/source-package.mjs';
test('explicit source selection excludes unlisted/ignored material and does not retain stale output', async () => {
  const base = path.resolve('.local');
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(path.join(base, 'packaging-test-'));
  assert.ok(path.resolve(root).startsWith(path.join(base, 'packaging-test-')));
  try {
    await mkdir(path.join(root, 'scripts'));
    await mkdir(path.join(root, 'docs'));
    await mkdir(path.join(root, 'output'));
    await writeFile(
      path.join(root, 'scripts/source-files.json'),
      JSON.stringify({ version: 1, files: ['docs/public.md'] }),
    );
    await writeFile(path.join(root, 'docs/public.md'), 'Public fictional document');
    await writeFile(path.join(root, 'docs/.env.sentinel'), 'Synthetic ignored sentinel');
    await writeFile(path.join(root, 'docs/untracked.md'), 'Synthetic untracked sentinel');
    const first = await packageSource(root, path.join(root, 'output'));
    assert.deepEqual(await readdir(path.join(first.directory, 'docs')), ['public.md']);
    assert.equal(
      first.identity.files['docs/public.md'],
      sha256(await readFile(path.join(first.directory, 'docs/public.md'))),
    );
    await writeFile(
      path.join(root, 'scripts/source-files.json'),
      JSON.stringify({ version: 1, files: ['scripts/source-files.json'] }),
    );
    const second = await packageSource(root, path.join(root, 'output'));
    assert.notEqual(first.directory, second.directory);
    assert.deepEqual(await readdir(second.directory), ['scripts']);
    for (const unsafe of [
      'docs/.env.sentinel',
      '../outside.txt',
      'docs/../../outside.txt',
      'models/private.gguf',
    ]) {
      await writeFile(
        path.join(root, 'scripts/source-files.json'),
        JSON.stringify({ version: 1, files: [unsafe] }),
      );
      await assert.rejects(packageSource(root, path.join(root, 'output')), /Unsafe/);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
