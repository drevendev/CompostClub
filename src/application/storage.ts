import {
  createGarden,
  importGarden,
  serializeGarden,
  type Garden,
  type GardenKind,
} from '../domain/garden';

function matchesOriginal(value: unknown, original: string): boolean {
  try {
    return JSON.stringify(value, null, 2) === original;
  } catch {
    return false;
  }
}

export class GardenStorage {
  private db: IDBDatabase | undefined;
  private memory = new Map<GardenKind, Garden>();
  private recovery = new Map<GardenKind, unknown>();
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
  private async read(key: string): Promise<unknown> {
    if (!this.db)
      return structuredClone(
        key.startsWith('recovery:')
          ? this.recovery.get(key.slice(9) as GardenKind)
          : this.memory.get(key as GardenKind),
      );
    return new Promise<unknown>((resolve, reject) => {
      const r = this.db?.transaction('gardens', 'readonly').objectStore('gardens').get(key);
      if (!r) return reject(new Error('Storage closed.'));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error ?? new Error('Storage could not be read.'));
    });
  }
  async load(kind: GardenKind): Promise<Garden> {
    const raw = await this.read(kind);
    if (raw === undefined) return createGarden(kind, Date.now());
    return importGarden(JSON.stringify(raw));
  }
  async recoveryJSON(kind: GardenKind, previous = false): Promise<string> {
    const raw = await this.read(previous ? `recovery:${kind}` : kind);
    if (raw === undefined) throw new Error('There is no saved recovery record to download.');
    return JSON.stringify(raw, null, 2);
  }
  async restoreFromRecovery(garden: Garden, original: string): Promise<Garden> {
    // Imported counters do not identify the record being replaced. Advance the
    // old local counter where readable; otherwise use a fresh timestamp epoch
    // to avoid reusing small revisions held by a stale pre-recovery tab.
    const record: unknown = JSON.parse(original);
    const oldRevision =
      record &&
      typeof record === 'object' &&
      'revision' in record &&
      typeof record.revision === 'number' &&
      Number.isSafeInteger(record.revision) &&
      record.revision >= 0 &&
      record.revision < Number.MAX_SAFE_INTEGER
        ? record.revision
        : 0;
    const next = { ...garden, revision: Math.max(Date.now(), oldRevision) + 1, pending: null };
    serializeGarden(next);
    const conflict =
      'The saved record changed in another tab. Reload recovery before replacing it.';
    if (!this.db) {
      const current = this.memory.get(garden.kind);
      if (!matchesOriginal(current, original)) throw new Error(conflict);
      this.recovery.set(garden.kind, structuredClone(current));
      this.memory.set(garden.kind, structuredClone(next));
      return next;
    }
    await new Promise<void>((resolve, reject) => {
      const tx = this.db?.transaction('gardens', 'readwrite');
      if (!tx) return reject(new Error('Storage closed.'));
      const store = tx.objectStore('gardens'),
        r = store.get(garden.kind);
      let changed = false;
      r.onsuccess = () => {
        if (!matchesOriginal(r.result, original)) {
          changed = true;
          tx.abort();
          return;
        }
        // Preserve the original and install the validated backup atomically.
        // The last recovery copy stays outside the normal garden/backup limits.
        store.put(r.result, `recovery:${garden.kind}`);
        store.put(next, garden.kind);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(
          new Error(
            changed ? conflict : 'Recovery could not be saved. The original record is unchanged.',
          ),
        );
      tx.onerror = () => reject(tx.error ?? new Error('Recovery could not be saved.'));
    });
    return next;
  }
  async save(garden: Garden, expected: number, replace = false): Promise<Garden> {
    const next = { ...garden, revision: expected + 1 };
    // Validate the exact revision and pretty-printed backup before any write.
    serializeGarden(next);
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
