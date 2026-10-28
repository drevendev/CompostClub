// Private local verification. This script prints only counts and booleans.
import { DatabaseSync } from 'node:sqlite';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { CoherentStore } from '../desktop/coherent-store';
import { canonical, hash } from '../src/domain/coherent/hash';
import type { Workspace } from '../src/domain/coherent/types';
const backup = process.argv[2];
if (!backup)
  throw new Error('Provide a closed consistent private SQLite backup, never a live database.');
const originalDb = new DatabaseSync(backup, { readOnly: true });
assert.equal(
  (originalDb.prepare('PRAGMA integrity_check').get() as { integrity_check: string })
    .integrity_check,
  'ok',
);
const row = originalDb.prepare('SELECT payload,sha FROM workspace').get() as {
  payload: string;
  sha: string;
};
assert.equal(hash(row.payload), row.sha);
const original = JSON.parse(row.payload) as Workspace;
originalDb.close();
await mkdir('.local', { recursive: true });
const output = await mkdtemp(path.resolve('.local/generation-fix-preservation-'));
await copyFile(backup, path.join(output, 'garden.sqlite'));
const s = new CoherentStore(output);
const fields = [
  'sources',
  'documents',
  'nodes',
  'consumed',
  'calls',
  'settings',
  'preferences',
  'references',
  'runtime',
  'exportDirectory',
] as const;
for (const field of fields)
  assert.equal(canonical(s.state[field]), canonical(original[field]), field + ' changed');
for (const old of original.jobs) {
  const current = s.state.jobs.find((j) => j.id === old.id)!;
  assert.ok(current);
  for (const field of [
    'snapshots',
    'raw',
    'pack',
    'draft',
    'assessment',
    'calls',
    'modelDigest',
  ] as const)
    assert.equal(canonical(current[field]), canonical(old[field]), 'historical job ' + field);
}
for (const g of original.gardens) {
  const next = s.state.gardens.find((n) => n.id === g.id)!;
  for (const field of [
    'credits',
    'policy',
    'interval',
    'background',
    'profile',
    'objective',
  ] as const)
    assert.equal(canonical(next[field]), canonical(g[field]), 'garden ' + field);
}
assert.equal(s.state.paused, true);
const raw = JSON.stringify(s.envelope());
CoherentStore.parseBackup(raw);
await writeFile(path.join(output, 'roundtrip.private.json'), raw, { flag: 'wx', mode: 0o600 });
assert.equal(hash(await readFile(path.join(output, 'roundtrip.private.json'))), hash(raw));
s.restore(raw);
assert.equal(canonical(s.state.calls), canonical(original.calls));
assert.equal(canonical(s.state.sources), canonical(original.sources));
assert.equal(canonical(s.state.nodes), canonical(original.nodes));
// Restore intentionally revokes consent; this is an isolated roundtrip, never
// an update of the owner's installation. A normal update above preserves it.
const result = {
  normalUpdate:
    'preserves all originals, revisions, files, cards, decisions, notes, raw jobs, spent calls and settings',
  restore:
    'validated isolated roundtrip; no call refund; consent intentionally off by existing restore contract',
  counts: {
    gardens: original.gardens.length,
    sources: original.sources.length,
    cards: original.nodes.length,
    jobs: original.jobs.length,
    calls: original.calls.length,
  },
  originalBackupUnchanged: true,
};
s.close();
const verify = new DatabaseSync(backup, { readOnly: true });
assert.equal((verify.prepare('SELECT sha FROM workspace').get() as { sha: string }).sha, row.sha);
verify.close();
await writeFile(path.join(output, 'receipt.private.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ output, result }));
