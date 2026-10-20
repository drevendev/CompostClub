import { createGarden, importGarden, type Garden, type GardenKind } from '../domain/garden';

export class GardenStorage {
  private db: IDBDatabase | undefined;
  private memory = new Map<GardenKind, Garden>();
  persistent = false;
  warning = '';
  async open(): Promise<void> {
    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('compost-club-v1', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('gardens');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('Storage could not open.'));
        req.onblocked = () => reject(new Error('Another tab is upgrading this garden.'));
      });
      this.persistent = true;
    } catch {
      this.warning =
        'This session is in memory. Storage is unavailable; export a JSON backup before closing.';
    }
  }
  async load(kind: GardenKind): Promise<Garden> {
    if (!this.db) return structuredClone(this.memory.get(kind) ?? createGarden(kind, Date.now()));
    const raw = await new Promise<unknown>((resolve, reject) => {
      const r = this.db?.transaction('gardens', 'readonly').objectStore('gardens').get(kind);
      if (!r) return reject(new Error('Storage closed.'));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error ?? new Error('Storage could not be read.'));
    });
    if (!raw) return createGarden(kind, Date.now());
    return importGarden(JSON.stringify(raw));
  }
  async save(garden: Garden, expected: number, replace = false): Promise<Garden> {
    const next = { ...garden, revision: expected + 1 };
    if (!this.db) {
      const current = this.memory.get(garden.kind);
      if (current && current.revision !== expected && !replace)
        throw new Error('This garden changed in another tab. Reload before continuing.');
      this.memory.set(next.kind, structuredClone(next));
      return next;
    }
    await new Promise<void>((resolve, reject) => {
      const tx = this.db?.transaction('gardens', 'readwrite');
      if (!tx) return reject(new Error('Storage closed.'));
      const store = tx.objectStore('gardens'),
        r = store.get(garden.kind);
      let conflict = false;
      r.onsuccess = () => {
        const current = r.result as Garden | undefined;
        if (current && current.revision !== expected && !replace) {
          conflict = true;
          tx.abort();
          return;
        }
        store.put(next, garden.kind);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(
          new Error(
            conflict
              ? 'This garden changed in another tab. Reload before continuing.'
              : 'Could not save your garden. Nothing was marked saved. Export a backup and free some storage.',
          ),
        );
      tx.onerror = () => reject(tx.error ?? new Error('Could not save your garden.'));
    });
    return next;
  }
}
export const storage = new GardenStorage();
