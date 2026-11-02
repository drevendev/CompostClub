import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { digest, type Receipt } from './store';
import { migrate } from '../src/domain/coherent/migrate';
import { validate } from '../src/domain/coherent/validate';
import { recover } from '../src/domain/coherent/workspace';
import type { Workspace } from '../src/domain/coherent/types';

export interface Envelope {
  format: 'compost-desktop';
  schemaVersion: 3;
  workspace: Workspace;
  receipts: Receipt[];
}
export class CoherentStore {
  readonly db: DatabaseSync;
  state: Workspace;
  emergency: Receipt[] = [];
  constructor(
    readonly directory: string,
    now = Date.now(),
  ) {
    mkdirSync(directory, { recursive: true });
    this.db = new DatabaseSync(path.join(directory, 'garden.sqlite'));
    this.db.exec(
      'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, payload TEXT NOT NULL, sha TEXT NOT NULL); CREATE TABLE IF NOT EXISTS receipts(id INTEGER PRIMARY KEY, jobId TEXT NOT NULL, at INTEGER NOT NULL, phase TEXT NOT NULL, raw TEXT NOT NULL); CREATE TABLE IF NOT EXISTS backups(id INTEGER PRIMARY KEY, at INTEGER NOT NULL, reason TEXT NOT NULL, payload TEXT NOT NULL, sha TEXT NOT NULL);',
    );
    const row = this.db.prepare('SELECT payload,sha,revision FROM workspace WHERE id=1').get() as
      { payload: string; sha: string; revision: number } | undefined;
    if (row && digest(row.payload) !== row.sha)
      throw new Error('Saved workspace checksum failed. Original database preserved.');
    const original = row ? (JSON.parse(row.payload) as { schemaVersion: number }) : null;
    if (original && original.schemaVersion !== 3) {
      // Validate a consistent rollback envelope before changing the schema.
      const rollback = JSON.stringify({
        format: 'compost-desktop',
        schemaVersion: 2,
        workspace: original,
        receipts: this.receipts(),
      });
      CoherentStore.parseBackup(rollback, now);
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.retainBackup(
          rollback,
          'Before schema-3 migration; use previous executable for rollback',
          now,
        );
        this.state = migrate(original, now);
        this.state.revision = row!.revision;
        recover(this.state, now);
        this.write(this.state, row!.revision);
        this.db.exec('COMMIT');
      } catch (e) {
        this.db.exec('ROLLBACK');
        throw e;
      }
    } else {
      this.state = original ? migrate(original, now) : migrateEmpty(now);
      recover(this.state, now);
      this.save(this.state, false, now);
    }
  }
  private write(next: Workspace, expected: number | null) {
    validate(next);
    const row = this.db.prepare('SELECT revision FROM workspace WHERE id=1').get() as
      { revision: number } | undefined;
    if ((row?.revision ?? null) !== expected)
      throw new Error('Workspace changed in another writer. Reopen before continuing.');
    const saved = { ...next, revision: (expected ?? 0) + 1 },
      raw = JSON.stringify(saved);
    validate(saved);
    this.db
      .prepare(
        'INSERT INTO workspace VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,sha=excluded.sha',
      )
      .run(saved.revision, raw, digest(raw));
    this.state = saved;
  }
  save(next: Workspace, backup = true, now = Date.now(), purgeJobs: string[] = []) {
    validate(next);
    const previous = this.state;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.prepare('SELECT revision FROM workspace WHERE id=1').get() as
        { revision: number } | undefined;
      if (row && row.revision !== previous.revision)
        throw new Error('Workspace changed in another writer.');
      const last = this.db.prepare('SELECT at FROM backups ORDER BY id DESC LIMIT 1').get() as
        { at: number } | undefined;
      if (backup && row && (!last || now - last.at >= 21600000))
        this.retainBackup(JSON.stringify(this.envelope()), 'Automatic six-hour snapshot', now);
      this.write(next, row?.revision ?? null);
      for (const id of purgeJobs) this.db.prepare('DELETE FROM receipts WHERE jobId=?').run(id);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      this.state = previous;
      throw e;
    }
  }
  change(fn: (w: Workspace) => void, backup = true, purgeJobs: string[] = []) {
    const next = structuredClone(this.state);
    fn(next);
    this.save(next, backup, Date.now(), purgeJobs);
    return this.state;
  }
  receipts(): Receipt[] {
    return this.db.prepare('SELECT * FROM receipts ORDER BY id').all() as unknown as Receipt[];
  }
  receipt(jobId: string, phase: string, raw: string) {
    try {
      const records = this.receipts();
      if (
        records.length >= 3000 ||
        records.reduce((n, r) => n + Buffer.byteLength(r.raw), 0) + Buffer.byteLength(raw) >
          128 * 1024 * 1024
      )
        throw new Error('Receipt archive capacity reached.');
      this.db
        .prepare('INSERT INTO receipts(jobId,at,phase,raw) VALUES(?,?,?,?)')
        .run(jobId, Date.now(), phase, raw);
    } catch (e) {
      this.emergency.push({ id: -this.emergency.length - 1, jobId, phase, raw, at: Date.now() });
      throw new Error(
        'Original response retained in memory. Save a full backup before exit. ' + String(e),
        { cause: e },
      );
    }
  }
  requireReceiptHeadroom(calls = 3) {
    const records = this.receipts();
    if (
      Buffer.byteLength(JSON.stringify(this.envelope())) + calls * 10 * 1024 * 1024 >
        192 * 1024 * 1024 ||
      this.emergency.length ||
      records.length + calls * 2 > 3000 ||
      records.reduce((n, r) => n + Buffer.byteLength(r.raw), 0) + calls * 5 * 1024 * 1024 >
        128 * 1024 * 1024
    )
      throw new Error('Receipt storage needs attention before dispatch.');
  }
  envelope(): Envelope {
    return {
      format: 'compost-desktop',
      schemaVersion: 3,
      workspace: this.state,
      receipts: [...this.receipts(), ...this.emergency],
    };
  }
  static parseBackup(raw: string, now = Date.now()): Envelope {
    if (Buffer.byteLength(raw) > 192 * 1024 * 1024)
      throw new Error('Backup exceeds 192 MiB; original state preserved.');
    const o = JSON.parse(raw) as {
      format?: string;
      schemaVersion?: number;
      workspace?: unknown;
      receipts?: Receipt[];
    };
    if (o.format && o.format !== 'compost-desktop') throw new Error('Unsupported recovery format.');
    if (
      o.format === 'compost-desktop' &&
      (![2, 3].includes(o.schemaVersion ?? 0) || !o.workspace || !Array.isArray(o.receipts))
    )
      throw new Error('Unsupported desktop backup version.');
    const workspace = migrate(o.format ? o.workspace : o, now),
      receipts = o.receipts ?? [];
    if (
      receipts.length > 3000 ||
      receipts.reduce((n, r) => n + Buffer.byteLength(r.raw ?? ''), 0) > 128 * 1024 * 1024
    )
      throw new Error('Receipt quota exceeded.');
    for (const r of receipts)
      if (
        typeof r.jobId !== 'string' ||
        r.jobId.length > 128 ||
        typeof r.phase !== 'string' ||
        typeof r.raw !== 'string' ||
        !Number.isFinite(r.at)
      )
        throw new Error('Invalid original receipt.');
    return { format: 'compost-desktop', schemaVersion: 3, workspace, receipts };
  }
  private retainBackup(raw: string, reason: string, now: number) {
    CoherentStore.parseBackup(raw, now);
    const usage = this.db
      .prepare(
        'SELECT count(*) count,coalesce(sum(length(cast(payload AS BLOB))),0) bytes FROM backups',
      )
      .get() as { count: number; bytes: number };
    if (usage.count >= 64 || usage.bytes + Buffer.byteLength(raw) > 256 * 1024 * 1024)
      throw new Error('Retained backup quota reached; preview manual cleanup.');
    this.db
      .prepare('INSERT INTO backups(at,reason,payload,sha) VALUES(?,?,?,?)')
      .run(now, reason, raw, digest(raw));
  }
  backup(reason = 'Manual private snapshot') {
    this.retainBackup(JSON.stringify(this.envelope()), reason, Date.now());
  }
  backups() {
    return this.db
      .prepare(
        'SELECT id,at,reason,length(cast(payload AS BLOB)) bytes,sha FROM backups ORDER BY id DESC',
      )
      .all() as unknown as { id: number; at: number; reason: string; bytes: number; sha: string }[];
  }
  backupRaw(id: number) {
    const r = this.db.prepare('SELECT payload,sha FROM backups WHERE id=?').get(id) as
      { payload: string; sha: string } | undefined;
    if (!r || digest(r.payload) !== r.sha) throw new Error('Backup checksum changed.');
    CoherentStore.parseBackup(r.payload);
    return r.payload;
  }
  purgeBackup(id: number, sha: string) {
    if (!this.db.prepare('DELETE FROM backups WHERE id=? AND sha=?').run(id, sha).changes)
      throw new Error('Backup changed; preview again.');
  }
  restore(raw: string, now = Date.now()) {
    const restored = CoherentStore.parseBackup(raw, now),
      old = this.state,
      next = restored.workspace;
    next.runtime = structuredClone(old.runtime);
    if (old.claudeExecutable) next.claudeExecutable = old.claudeExecutable;
    else delete next.claudeExecutable;
    next.provider = structuredClone(old.provider ?? { kind: 'local', revision: 1 });
    next.exportDirectory = old.exportDirectory;
    next.settings.timezone = old.settings.timezone;
    const callMap = new Map(old.calls.map((c) => [c.id, c]));
    for (const call of next.calls) {
      const previous = callMap.get(call.id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(call))
        throw new Error('Conflicting persisted call identity; no usage was refunded.');
      if (!previous) callMap.set(call.id, call);
    }
    next.calls = [...callMap.values()];
    const requests = new Map((old.requests ?? []).map((r) => [r.id, r]));
    for (const r of next.requests ?? []) {
      const existing = requests.get(r.id);
      if (existing && existing.fingerprint !== r.fingerprint)
        throw new Error('Conflicting request identity; restore refused.');
      if (!existing) requests.set(r.id, r);
    }
    // Tombstones survive an older snapshot even if its job is absent. A restore
    // never turns a previously dispatched request into a fresh authorization.
    next.requests = [...requests.values()].map((r) => ({
      ...r,
      job: next.jobs.some((j) => j.id === r.job) ? r.job : null,
      state: r.state === 'started' ? 'uncertain' : r.state,
    }));
    for (const [day, value] of Object.entries(old.daily)) {
      const other = next.daily[day] ?? { attempts: [], candidates: [] };
      next.daily[day] = {
        attempts: [...new Set([...value.attempts, ...other.attempts])],
        candidates: [...new Set([...value.candidates, ...other.candidates])],
      };
    }
    next.latestDate = [old.latestDate, next.latestDate].sort().at(-1)!;
    next.lastObservedAt = Math.max(old.lastObservedAt, next.lastObservedAt, now);
    next.revision = old.revision;
    recover(next, now);
    for (const g of next.gardens) {
      g.background = false;
      g.policy.probability = 0;
      g.policy.donors = [];
      g.policy.donate = false;
      g.policy.revision++;
      g.plan = null;
    }
    for (const j of next.jobs) {
      j.observed = false;
      if (j.assessment) j.assessment.observed = false;
    }
    for (const n of next.nodes) {
      n.imported = true;
      for (const r of n.revisions) {
        if (r.assessment) r.assessment.observed = false;
        for (const a of r.assessments ?? []) a.observed = false;
      }
    }
    validate(next);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.retainBackup(JSON.stringify(this.envelope()), 'Before validated schema-3 restore', now);
      const original = this.receipts(),
        seen = new Set(
          original.map((r) => digest(JSON.stringify([r.jobId, r.at, r.phase, r.raw]))),
        );
      let count = original.length,
        total = original.reduce((n, r) => n + Buffer.byteLength(r.raw), 0);
      for (const r of restored.receipts) {
        const h = digest(JSON.stringify([r.jobId, r.at, r.phase, r.raw]));
        if (seen.has(h)) continue;
        if (++count > 3000 || (total += Buffer.byteLength(r.raw)) > 128 * 1024 * 1024)
          throw new Error('Restored receipts exceed shared quota.');
        this.db
          .prepare('INSERT INTO receipts(jobId,at,phase,raw) VALUES(?,?,?,?)')
          .run(r.jobId, r.at, r.phase, r.raw);
        seen.add(h);
      }
      this.write(next, old.revision);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      this.state = old;
      throw e;
    }
  }
  close() {
    this.db.close();
  }
}
import { create } from '../src/domain/coherent/workspace';
const migrateEmpty = (now: number) => create(now);
