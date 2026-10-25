import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import recordings from '../fixtures/public/recordings.json' with { type: 'json' };
import {
  addScrap,
  beginRequest,
  completeRequest,
  createGarden,
  DESKTOP_LIMITS,
  editScrap,
  INTERVAL,
  serializeGarden,
} from '../src/domain/garden';
import { exactRecording } from '../src/domain/provenance';
import { DesktopStore } from '../desktop/store';
import { createWorkspace } from '../src/domain/experiment';

// Pure capacity diagnostic. These are exact unchanged public recording replays
// with an accelerated domain clock, never fresh inference or an observed pilot.
const start = performance.now(),
  count = 126,
  at = Date.now() - INTERVAL * (count + 1),
  r = recordings[0]!;
let garden = createGarden('personal', at, 'fictional-capacity-workspace');
garden = addScrap(garden, r.a, at, { id: 'a', origin: 'fixture' });
garden = addScrap(garden, r.b, at, { id: 'b', origin: 'fixture' });
for (let i = 0; i < 38; i++)
  garden = addScrap(
    garden,
    `Вымышленная идея проекта ${i + 1}: карта маршрутов для тихого кооперативного сада.`,
    at,
    { id: `extra-${i}` },
  );
for (let i = 0; i < count; i++) {
  if (i)
    garden = editScrap(
      garden,
      i < 90 ? 'a' : 'b',
      (i < 90 ? r.a : r.b) + ' '.repeat(i < 90 ? i : i - 89),
    );
  garden = beginRequest(
    garden,
    at + i * INTERVAL,
    'replay',
    r.model,
    r.revision,
    r.language as 'en' | 'ru',
    [garden.scraps.find((s) => s.id === 'a')!, garden.scraps.find((s) => s.id === 'b')!].map(
      (s) => ({ id: s.id, text: s.text, revision: s.revision }),
    ) as [
      { id: string; text: string; revision: number },
      { id: string; text: string; revision: number },
    ],
    DESKTOP_LIMITS,
  );
  assert.equal(exactRecording(garden.pending!, r.raw), true);
  garden = completeRequest(garden, garden.pending!.id, r.raw, at + i * INTERVAL + 1);
}
assert.throws(() => serializeGarden(garden), /100 runs/);
const raw = serializeGarden(garden, DESKTOP_LIMITS),
  workspace = createWorkspace(Date.now());
workspace.garden = garden;
for (const source of garden.scraps)
  workspace.sources[source.id] = {
    title: source.text.slice(0, 120),
    tags: ['Diagnostic fixture'],
    participating: false,
    origin: 'Explicit fictional replay capacity fixture',
  };
for (const result of garden.sprouts)
  workspace.reviews[result.id] = {
    state: 'rejected',
    note: 'Capacity fixture decision only; not owner quality review.',
    changedAt: Date.now(),
  };
const base = path.resolve('.local');
await mkdir(base, { recursive: true });
const directory = await mkdtemp(path.join(base, 'desktop-capacity-')),
  store = new DesktopStore(directory);
try {
  store.save(workspace);
  const beforeRestore = store.state.garden.sprouts.map((s) => s.rawOutput);
  store.restore(JSON.stringify(store.envelope()));
  assert.deepEqual(
    store.state.garden.sprouts.map((s) => s.rawOutput),
    beforeRestore,
  );
  for (let i = store.backups().length; i < 64; i++)
    store.backupInside(
      'Synthetic six-hour capacity snapshot; not elapsed use',
      at + i * 6 * 3600000,
    );
  const copies = store.backups();
  assert.equal(copies.length, 64);
  assert.throws(() => store.backup(), /quota/);
  assert.equal(store.backups().length, 64);
  const receipt = {
    date: new Date().toISOString(),
    scope:
      'Accelerated pure-domain exact public-fixture replay and backup capacity; no live inference or elapsed observation',
    liveCalls: 0,
    sources: garden.scraps.length,
    recordedReplays: count,
    gardenBytes: Buffer.byteLength(raw),
    workspaceBytes: Buffer.byteLength(JSON.stringify(workspace)),
    retainedSnapshots: copies.length,
    snapshotBytes: copies.reduce((n, b) => n + b.bytes, 0),
    verifiedQuotaRefusal: true,
    legacyBrowserLimitRetained: true,
    originalResponsesSurviveRestore: true,
    elapsedMs: Math.round(performance.now() - start),
  };
  await writeFile(path.join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2));
  await writeFile(
    '.local/desktop-capacity-latest.json',
    JSON.stringify({ directory, ...receipt }, null, 2),
  );
  console.log(JSON.stringify(receipt));
} finally {
  store.close();
}
