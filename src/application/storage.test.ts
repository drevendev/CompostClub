import 'fake-indexeddb/auto';
import { beforeEach, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { GardenStorage } from './storage';
import {
  createGarden,
  addScrap,
  editScrap,
  beginRequest,
  completeRequest,
  pairKey,
  serializeGarden,
  importGarden,
  MAX_BACKUP_BYTES,
  MAX_SPROUTS,
  MAX_ATTEMPTS,
  type Garden,
} from '../domain/garden';
import recordings from '../../fixtures/public/recordings.json';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

async function rawWrite(raw: unknown, key = 'personal') {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('compost-club-v1', 1);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('Test database did not open.'));
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('gardens', 'readwrite');
      tx.objectStore('gardens').put(raw, key);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('Test write aborted.'));
    });
  } finally {
    db.close();
  }
}
it('reviews/removes only an unchanged retained copy without touching either active garden', async () => {
  const a = new GardenStorage();
  await a.open();
  const saved = await a.save(createGarden('personal', 100), 0);
  await rawWrite({ secret: 'old private source' }, 'recovery:personal');
  await rawWrite({ secret: 'other garden' }, 'recovery:sample');
  const [copy] = await a.retainedCopies('personal');
  expect(copy!.json).toContain('old private source');
  await rawWrite({ secret: 'new private source' }, copy!.key);
  await expect(a.removeRetainedCopy('personal', copy!.key, copy!.json)).rejects.toThrow('changed');
  const [current] = await a.retainedCopies('personal');
  await a.removeRetainedCopy('personal', current!.key, current!.json);
  expect(await a.retainedCopies('personal')).toEqual([]);
  expect(await a.load('personal')).toEqual(saved);
  expect(await a.retainedCopies('sample')).toHaveLength(1);
  await expect(a.removeRetainedCopy('personal', 'personal', 'anything')).rejects.toThrow();
});
function history(count: number): Garden {
  const r = recordings[0]!;
  let g = createGarden('personal', 100);
  g = addScrap(g, r.a, 100, { id: 'a' });
  g = addScrap(g, r.b, 100, { id: 'b' });
  g = beginRequest(g, 100, 'replay', r.model, r.revision, 'en');
  g = completeRequest(g, g.pending!.id, r.raw, 100);
  const first = g.sprouts[0]!;
  // Legacy capacity fixture has no retained per-call inference journal.
  g.generations = [];
  g.scraps[0]!.revision = count;
  g.sprouts = Array.from({ length: count }, (_, i) => {
    const parents = structuredClone(first.parents);
    parents.find((p) => p.id === 'a')!.revision = i + 1;
    return { ...first, id: 'result-' + i, parents, key: pairKey(parents) };
  });
  g.attempts = g.sprouts.map((s) => ({ key: s.key, requestId: s.id, status: 'success' as const }));
  return g;
}
it('saves atomically across reload and rejects concurrent stale writers', async () => {
  const a = new GardenStorage(),
    b = new GardenStorage();
  await a.open();
  await b.open();
  const g = createGarden('personal', 100, 'storage-test');
  const saved = await a.save(g, 0);
  const loaded = await b.load('personal');
  expect(loaded).toEqual(saved);
  await a.save(addScrap(saved, 'A tiny cloud becomes a library.', 100), saved.revision);
  await expect(b.save(loaded, loaded.revision)).rejects.toThrow('another tab');
  expect((await b.load('personal')).scraps).toHaveLength(1);
});
it('rejects oversized original text before replacing a valid IndexedDB save', async () => {
  const store = new GardenStorage();
  await store.open();
  const saved = await store.save(
    addScrap(createGarden('personal', 100), 'A fictional cloud library.', 100),
    0,
  );
  const bad = structuredClone(saved);
  bad.scraps[0]!.raw += ' '.repeat(MAX_BACKUP_BYTES);
  await expect(store.save(bad, saved.revision)).rejects.toThrow('8 KiB');
  expect(await store.load('personal')).toEqual(saved);
});
it('rejects an edit whose retained source history exceeds the backup budget without replacing the original', async () => {
  const store = new GardenStorage();
  await store.open();
  const g = addScrap(
    createGarden('personal', 100),
    'An original fictional café.\r\n' + ' '.repeat(7000),
    100,
  );
  const overhead = Buffer.byteLength(
    JSON.stringify({ ...g, seed: '', revision: Number.MAX_SAFE_INTEGER }, null, 2),
  );
  g.seed = 'x'.repeat(MAX_BACKUP_BYTES - overhead - 32);
  const saved = await store.save(g, 0);
  const edited = editScrap(saved, saved.scraps[0]!.id, 'A revised fictional café.');
  await expect(store.save(edited, saved.revision)).rejects.toThrow('2 MiB');
  expect(await store.load('personal')).toEqual(saved);
  expect((await store.load('personal')).scraps[0]!.raw).toBe(g.scraps[0]!.raw);
});
it('roundtrips the largest allowed pretty backup across a revision digit boundary', async () => {
  const store = new GardenStorage();
  await store.open();
  const g = history(100);
  const overhead = Buffer.byteLength(
    JSON.stringify({ ...g, seed: '', revision: Number.MAX_SAFE_INTEGER }, null, 2),
  );
  g.seed = 'x'.repeat(MAX_BACKUP_BYTES - overhead);
  await rawWrite({ ...g, revision: 8 });
  const saved = await store.save(g, 8);
  const backup = serializeGarden(saved);
  expect(Buffer.byteLength(backup)).toBeLessThanOrEqual(MAX_BACKUP_BYTES);
  expect(importGarden(backup, 'local')).toEqual(saved);
  const restored = await store.restore(importGarden(backup), 9);
  expect(restored.revision).toBe(10);
  expect(importGarden(serializeGarden(restored))).toEqual(await store.load('personal'));
  const tooLarge = { ...restored, seed: restored.seed + 'x' };
  expect(Buffer.byteLength(JSON.stringify(tooLarge))).toBeLessThan(MAX_BACKUP_BYTES);
  await expect(store.save(tooLarge, 10)).rejects.toThrow('2 MiB');
  expect(await store.load('personal')).toEqual(restored);
  expect(() => importGarden(JSON.stringify(tooLarge))).toThrow('2 MiB');
});
it.each([true, false])(
  'rejects stale restore and subsequent stale saves, persistent=%s',
  async (persistent) => {
    const store = new GardenStorage();
    if (persistent) await store.open();
    const old = await store.save(
      addScrap(createGarden('personal', 100), 'An old fictional garden note.', 100),
      0,
    );
    const newer = await store.save(
      addScrap(old, 'A newer fictional thought worth keeping.', 100),
      old.revision,
    );
    await expect(store.restore(old, old.revision)).rejects.toThrow('another tab');
    await expect(store.save(old, old.revision)).rejects.toThrow('another tab');
    expect(await store.load('personal')).toEqual(newer);
    const restored = await store.restore(old, newer.revision);
    expect(restored.revision).toBe(newer.revision + 1);
    expect(JSON.parse(await store.beforeRestoreJSON('personal'))).toEqual(newer);
    await expect(store.save(newer, newer.revision)).rejects.toThrow('another tab');
  },
);
it('reloads a full sprout history and rejects growth past its record limit', async () => {
  const store = new GardenStorage();
  await store.open();
  const saved = await store.save(history(MAX_SPROUTS), 0);
  expect((await store.load('personal')).sprouts).toHaveLength(MAX_SPROUTS);
  expect(importGarden(serializeGarden(saved))).toEqual(saved);
  await expect(store.save(history(MAX_SPROUTS + 1), saved.revision)).rejects.toThrow(
    '1,000 sprouts',
  );
  expect(await store.load('personal')).toEqual(saved);
});
it('rejects excessive pairing history in memory storage too', async () => {
  const store = new GardenStorage();
  const saved = await store.save(createGarden('personal', 100), 0);
  const bad = {
    ...saved,
    attempts: Array.from({ length: MAX_ATTEMPTS + 1 }, (_, i) => ({
      key: 'a@' + i + '|b@1',
      requestId: 'request-' + i,
      status: 'failed' as const,
    })),
  };
  await expect(store.save(bad, saved.revision)).rejects.toThrow('19,900');
  expect(await store.load('personal')).toEqual(saved);
});
it.each([
  null,
  { version: 99, revision: 5000 },
  { ...createGarden('personal', 100), seed: 'x'.repeat(MAX_BACKUP_BYTES) },
])(
  'preserves unreadable originals and atomically retains the last recovery copy %#',
  async (original) => {
    const store = new GardenStorage();
    await store.open();
    await rawWrite(original);
    await expect(store.load('personal')).rejects.toThrow();
    const raw = await store.recoveryJSON('personal');
    expect(JSON.parse(raw)).toEqual(original);
    const replacement = addScrap(createGarden('personal', 100), 'A restored fictional idea.', 100);
    const restored = await store.restoreFromRecovery(replacement, raw);
    expect(restored.revision).toBeGreaterThan(5000);
    expect(await store.load('personal')).toEqual(restored);
    expect(JSON.parse(await store.recoveryJSON('personal', true))).toEqual(original);
    await store.save({ ...restored, readySlots: 1 }, restored.revision);
    expect(JSON.parse(await store.recoveryJSON('personal', true))).toEqual(original);
  },
);
it('rejects invalid recovery and conflicting records without modifying either saved version', async () => {
  const store = new GardenStorage();
  await store.open();
  const original = { version: 99 };
  await rawWrite(original);
  const snapshot = await store.recoveryJSON('personal');
  const invalid = { ...createGarden('personal', 100), seed: 'x'.repeat(MAX_BACKUP_BYTES) };
  await expect(store.restoreFromRecovery(invalid, snapshot)).rejects.toThrow('2 MiB');
  expect(await store.recoveryJSON('personal')).toBe(snapshot);
  await expect(store.recoveryJSON('personal', true)).rejects.toThrow('no saved recovery');
  const changed = { version: 100 };
  await rawWrite(changed);
  await expect(store.restoreFromRecovery(createGarden('personal', 100), snapshot)).rejects.toThrow(
    'another tab',
  );
  expect(JSON.parse(await store.recoveryJSON('personal'))).toEqual(changed);
  await expect(store.recoveryJSON('personal', true)).rejects.toThrow('no saved recovery');
});
it('rolls back both recovery writes when the transaction aborts', async () => {
  const store = new GardenStorage();
  await store.open();
  await rawWrite({ version: 99 });
  const original = await store.recoveryJSON('personal');
  // Forward the original implementation with its actual store receiver below.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const put = IDBObjectStore.prototype.put;
  const aborted = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
    this: IDBObjectStore,
    value: unknown,
    key?: IDBValidKey,
  ) {
    const result = put.call(this, value, key);
    if (key === 'personal') this.transaction.abort();
    return result;
  });
  try {
    await expect(
      store.restoreFromRecovery(createGarden('personal', 100), original),
    ).rejects.toThrow();
  } finally {
    aborted.mockRestore();
  }
  expect(await store.recoveryJSON('personal')).toBe(original);
  await expect(store.recoveryJSON('personal', true)).rejects.toThrow('no saved recovery');
});
it('does not discard an in-flight request while checking save/backup limits', async () => {
  const r = recordings[0]!;
  let g = createGarden('personal', 100);
  g = addScrap(g, r.a, 100);
  g = addScrap(g, r.b, 100);
  g = beginRequest(g, 100, 'replay', r.model, r.revision, 'en');
  const store = new GardenStorage();
  await store.open();
  const saved = await store.save(g, 0);
  expect(saved.pending).toEqual(g.pending);
  expect((await store.load('personal')).pending).toBeNull();
  expect((await store.load('personal')).readySlots).toBe(1);
});
