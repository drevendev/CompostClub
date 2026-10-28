// Measured storage/selection diagnostic on fictional data. No inference or
// accelerated-clock resource claim is made by this capacity measurement.
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { CoherentStore } from '../desktop/coherent-store';
import { addSource, create, makeGarden, plan, selection } from '../src/domain/coherent/workspace';
import { current } from '../src/domain/coherent/prepare';
import { bytes, hash } from '../src/domain/coherent/hash';
import { validate } from '../src/domain/coherent/validate';
await mkdir('.local', { recursive: true });
const output = await mkdtemp(path.resolve('.local/coherent-capacity-'));
const now = Date.now(),
  start = performance.now(),
  w = create(now, 'UTC');
w.gardens[0]!.profile = 'game';
w.gardens.push(makeGarden('Fictional capacity garden B', 'game', now));
for (let i = 0; i < 400; i++) {
  const garden = w.gardens[i < 200 ? 0 : 1]!;
  const id = addSource(
    w,
    garden.id,
    'Fictional document ' + i,
    `Fictional game ${i}: choose a tide gate to route a boat, paying with one future turn. ` +
      'A complete retained diagnostic paragraph. '.repeat(20),
    true,
    now,
  );
  const s = w.sources.find((s) => s.id === id)!,
    text = current(s).text;
  s.fileId = 'document-' + i;
  w.documents.push({
    id: s.fileId,
    name: `fiction-${i}.txt`,
    text,
    bytesBase64: Buffer.from(text).toString('base64'),
    hash: hash(text),
    decoding: 'UTF-8',
    entry: { at: now, timezone: 'UTC', offset: 0 },
  });
}
const preparedMs = performance.now() - start,
  validationStart = performance.now();
validate(w);
const validateMs = performance.now() - validationStart,
  selectStart = performance.now();
assert.equal(selection(w, plan(w, w.gardens[0]!.id, 12345, true)).length, 2);
const selectMs = performance.now() - selectStart;
let store = new CoherentStore(path.join(output, 'data'));
const saveStart = performance.now();
store.save(w);
const saveMs = performance.now() - saveStart;
store.close();
const loadStart = performance.now();
store = new CoherentStore(path.join(output, 'data'));
const loadMs = performance.now() - loadStart;
assert.equal(store.state.documents.length, 400);
assert.deepEqual(
  store.state.sources.map((s) => current(s).text),
  w.sources.map((s) => current(s).text),
);
const result = {
  label: 'Measured fictional capacity diagnostic; no live inference',
  gardens: 2,
  sources: 400,
  documents: 400,
  workspaceBytes: bytes(JSON.stringify(w)),
  preparedMs,
  validateMs,
  selectMs,
  saveMs,
  loadMs,
  processMemory: process.memoryUsage(),
  originalsPreserved: true,
};
store.close();
await writeFile(path.join(output, 'capacity.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ output, result }));
