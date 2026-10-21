import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const sha256 = (value: string | Uint8Array) =>
  createHash('sha256').update(value).digest('hex');
async function files(root: string, names: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function walk(name: string) {
    const full = path.join(root, name);
    const entries = await readdir(full, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = `${name}/${entry.name}`;
      if (entry.isDirectory()) await walk(relative);
      else result[relative] = sha256(await readFile(path.join(root, relative)));
    }
  }
  for (const name of names) {
    if (name.endsWith('/')) await walk(name.slice(0, -1));
    else result[name] = sha256(await readFile(path.join(root, name)));
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}
export async function acceptanceIdentity(root = process.cwd()) {
  let commit: string | null = null,
    dirty: boolean | null = null;
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    dirty =
      execFileSync('git', ['status', '--porcelain'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim().length > 0;
  } catch {
    /* Explicit source archives need not contain Git metadata. */
  }
  const source = await files(root, [
    'src/',
    'server/',
    'scripts/',
    'tests/',
    'fixtures/',
    'prompts/',
    'public/',
    'package.json',
    'package-lock.json',
    'vite.config.ts',
    'tsconfig.json',
    'playwright.config.ts',
    'playwright.recovery.config.ts',
    'playwright.p1.config.ts',
  ]);
  const build = await files(root, ['dist/', 'release/compost-club-preview.html']);
  return {
    commit,
    dirty,
    sourceSha256: sha256(JSON.stringify(source)),
    buildSha256: sha256(JSON.stringify(build)),
    standaloneSha256: build['release/compost-club-preview.html']!,
    source,
    build,
  };
}
export type AcceptanceIdentity = Awaited<ReturnType<typeof acceptanceIdentity>>;
