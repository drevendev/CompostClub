import { readFile, writeFile, mkdir, lstat, realpath, copyFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export async function packageSource(root, outputRoot) {
  const selection = JSON.parse(
    await readFile(path.join(root, 'scripts/source-files.json'), 'utf8'),
  );
  if (selection.version !== 1 || !Array.isArray(selection.files) || !selection.files.length)
    throw new Error('A reviewed explicit source-file list is required.');
  const files = [...selection.files].sort();
  if (new Set(files).size !== files.length) throw new Error('Duplicate source file selection.');
  const source = path.join(outputRoot, 'source-' + randomUUID());
  await mkdir(source, { recursive: false });
  const manifest = {};
  for (const name of files) {
    if (
      typeof name !== 'string' ||
      name.includes('\\') ||
      path.isAbsolute(name) ||
      name.split('/').some((p) => !p || p === '.' || p === '..') ||
      /(^|\/)(\.local|\.git|node_modules|release|brief|dist[^/]*)(\/|$)/.test(name) ||
      (/(^|\/)\.env($|\.)/.test(name) && name !== '.env.example') ||
      /\.(exe|dll|gguf|safetensors|onnx|onnx_data|zip|docx|pem|key|bin)$/i.test(name)
    )
      throw new Error('Unsafe source selection: ' + name);
    const absolute = path.resolve(root, name),
      resolvedRoot = path.resolve(root);
    if (!absolute.startsWith(resolvedRoot + path.sep))
      throw new Error('Source path escaped the project.');
    let current = resolvedRoot;
    for (const piece of name.split('/')) {
      current = path.join(current, piece);
      if ((await lstat(current)).isSymbolicLink())
        throw new Error('Source selection traverses a link: ' + name);
    }
    const info = await lstat(absolute);
    if (!info.isFile() || (await realpath(absolute)).toLowerCase() !== absolute.toLowerCase())
      throw new Error('Source selection is not a regular project file: ' + name);
    const bytes = await readFile(absolute),
      target = path.join(source, name);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(absolute, target);
    if (sha256(await readFile(target)) !== sha256(bytes))
      throw new Error('Source changed during packaging: ' + name);
    manifest[name] = sha256(bytes);
  }
  const identity = {
    sourceKind:
      'Explicit reviewed working-tree files; no directory enumeration or implicit untracked files',
    selection: 'scripts/source-files.json',
    sourceSha256: sha256(JSON.stringify(manifest)),
    files: manifest,
  };
  await writeFile(
    path.join(outputRoot, 'source-manifest.json'),
    JSON.stringify(identity, null, 2) + '\n',
  );
  return { directory: source, identity };
}
