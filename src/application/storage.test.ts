import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { GardenStorage } from './storage';
import { createGarden, addScrap } from '../domain/garden';
it('saves atomically across reload and rejects concurrent stale writers', async () => {
  const a = new GardenStorage(),
    b = new GardenStorage();
  await a.open();
  await b.open();
  const g = createGarden('personal', 100, 'storage-test');
  const saved = await a.save(g, 0, true);
  const loaded = await b.load('personal');
  expect(loaded).toEqual(saved);
  await a.save(addScrap(saved, 'A tiny cloud becomes a library.', 100), saved.revision);
  await expect(b.save(loaded, loaded.revision)).rejects.toThrow('another tab');
  expect((await b.load('personal')).scraps).toHaveLength(1);
});
