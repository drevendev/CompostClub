import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { assertWorkspace, createWorkspace, type Workspace } from '../src/domain/experiment';
import { DESKTOP_LIMITS, importGarden, type Garden } from '../src/domain/garden';

export const digest = (value: string | Uint8Array) =>
  createHash('sha256').update(value).digest('hex');
export interface Receipt {
  id: number;
  jobId: string;
  at: number;
  phase: string;
  raw: string;
}
export interface BackupEnvelope {
  format: 'compost-desktop';
  schemaVersion: 2;
  workspace: Workspace;
  receipts: Receipt[];
}
export class DesktopStore {
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
    const row = this.db.prepare('SELECT payload, sha FROM workspace WHERE id=1').get() as
      { payload: string; sha: string } | undefined;
    if (row) {
      if (digest(row.payload) !== row.sha)
        throw new Error(
          'Saved workspace checksum failed. The database was preserved; restore a validated backup.',
        );
      this.state = JSON.parse(row.payload) as Workspace;
      assertWorkspace(this.state);
      this.state.garden = importGarden(JSON.stringify(this.state.garden), 'local', DESKTOP_LIMITS);
    } else this.state = createWorkspace(now);
    this.state.experiment.enabled = false;
    this.state.experiment.reason = 'Paused after launch. Resume explicitly when ready.';
    this.save(this.state, false, now);
  }
  save(next: Workspace, automaticBackup = true, now = Date.now(), purgeJobs: string[] = []): void {
    assertWorkspace(next);
    const row = this.db.prepare('SELECT revision FROM workspace WHERE id=1').get() as
      { revision: number } | undefined;
    if (row && row.revision !== this.state.revision)
      throw new Error('Workspace changed in another writer. Reopen before continuing.');
    const saved = { ...next, revision: (row?.revision ?? 0) + 1 };
    const raw = JSON.stringify(saved);
    if (Buffer.byteLength(raw) > 32 * 1024 * 1024)
      throw new Error('Workspace exceeds 32 MiB. No data was replaced.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (automaticBackup && row) {
        const last = this.db.prepare('SELECT at FROM backups ORDER BY id DESC LIMIT 1').get() as
          { at: number } | undefined;
        if (!last || now - last.at >= 6 * 3_600_000)
          this.backupInside('Automatic six-hour snapshot', now);
      }
      this.db
        .prepare(
          'INSERT INTO workspace VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,sha=excluded.sha',
        )
        .run(saved.revision, raw, digest(raw));
      for (const id of purgeJobs) this.db.prepare('DELETE FROM receipts WHERE jobId=?').run(id);
      this.db.exec('COMMIT');
      this.state = saved;
      if (purgeJobs.length)
        this.emergency = this.emergency.filter((r) => !purgeJobs.includes(r.jobId));
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  change(fn: (next: Workspace) => void, backup = true, purgeJobs: string[] = []): Workspace {
    const next = structuredClone(this.state);
    fn(next);
    this.save(next, backup, Date.now(), purgeJobs);
    return this.state;
  }
  receipts(): Receipt[] {
    return this.db.prepare('SELECT * FROM receipts ORDER BY id').all() as unknown as Receipt[];
  }
  receipt(jobId: string, phase: string, raw: string): void {
    try {
      const usage = this.db
        .prepare(
          'SELECT count(*) count, coalesce(sum(length(cast(raw AS BLOB))),0) bytes FROM receipts',
        )
        .get() as { count: number; bytes: number };
      if (usage.count >= 3000 || usage.bytes + Buffer.byteLength(raw) > 128 * 1024 * 1024)
        throw new Error('Receipt archive is full. No new model call may be started.');
      this.db
        .prepare('INSERT INTO receipts(jobId,at,phase,raw) VALUES(?,?,?,?)')
        .run(jobId, Date.now(), phase, raw);
    } catch (e) {
      this.emergency.push({ id: -this.emergency.length - 1, jobId, at: Date.now(), phase, raw });
      throw new Error(
        'Original response retained in memory because it could not be saved. Save a full backup to another drive before exiting. ' +
          (e instanceof Error ? e.message : ''),
        { cause: e },
      );
    }
  }
  requireReceiptHeadroom(): void {
    const usage = this.db
      .prepare(
        'SELECT count(*) count,coalesce(sum(length(cast(raw AS BLOB))),0) bytes FROM receipts',
      )
      .get() as { count: number; bytes: number };
    if (this.emergency.length || usage.count > 2996 || usage.bytes > 122 * 1024 * 1024)
      throw new Error(
        'Receipt storage needs attention. Export a full backup and review retained data before another call.',
      );
  }
  envelope(): BackupEnvelope {
    return {
      format: 'compost-desktop',
      schemaVersion: 2,
      workspace: this.state,
      receipts: [...this.receipts(), ...this.emergency],
    };
  }
  backupInside(reason: string, now: number): number {
    const payload = JSON.stringify(this.envelope());
    const usage = this.db
      .prepare(
        'SELECT count(*) count, coalesce(sum(length(cast(payload AS BLOB))),0) bytes FROM backups',
      )
      .get() as { count: number; bytes: number };
    if (usage.count >= 64 || usage.bytes + Buffer.byteLength(payload) > 256 * 1024 * 1024)
      throw new Error(
        'Backup quota reached. Preview and remove retained copies before continuing.',
      );
    DesktopStore.parseBackup(payload);
    const result = this.db
      .prepare('INSERT INTO backups(at,reason,payload,sha) VALUES(?,?,?,?)')
      .run(now, reason, payload, digest(payload));
    return Number(result.lastInsertRowid);
  }
  backup(reason = 'Manual snapshot'): number {
    return this.backupInside(reason, Date.now());
  }
  backups(): { id: number; at: number; reason: string; bytes: number; sha: string }[] {
    return this.db
      .prepare(
        'SELECT id,at,reason,length(cast(payload AS BLOB)) bytes,sha FROM backups ORDER BY id DESC',
      )
      .all() as unknown as ReturnType<DesktopStore['backups']>;
  }
  backupRaw(id: number): string {
    const r = this.db.prepare('SELECT payload,sha FROM backups WHERE id=?').get(id) as
      { payload: string; sha: string } | undefined;
    if (!r || digest(r.payload) !== r.sha) throw new Error('Backup is missing or has changed.');
    DesktopStore.parseBackup(r.payload);
    return r.payload;
  }
  purgeBackup(id: number, sha: string): void {
    const r = this.db.prepare('DELETE FROM backups WHERE id=? AND sha=?').run(id, sha);
    if (!r.changes) throw new Error('Backup changed. Preview again before removing.');
  }
  static parseBackup(raw: string): BackupEnvelope | Garden {
    if (Buffer.byteLength(raw) > 192 * 1024 * 1024) throw new Error('Backup exceeds 192 MiB.');
    const o = JSON.parse(raw) as Partial<BackupEnvelope>;
    if (o.format !== 'compost-desktop') return importGarden(raw, 'import', DESKTOP_LIMITS);
    if (
      o.schemaVersion !== 2 ||
      !o.workspace ||
      !Array.isArray(o.receipts) ||
      o.receipts.length > 3000
    )
      throw new Error('Unsupported desktop backup.');
    assertWorkspace(o.workspace);
    for (const r of o.receipts)
      if (
        !r ||
        typeof r.raw !== 'string' ||
        typeof r.jobId !== 'string' ||
        typeof r.phase !== 'string' ||
        !Number.isFinite(r.at)
      )
        throw new Error('Invalid backup receipt.');
    return o as BackupEnvelope;
  }
  restore(raw: string): void {
    const restored = DesktopStore.parseBackup(raw),
      old = this.state;
    const next =
      'format' in restored ? structuredClone(restored.workspace) : createWorkspace(Date.now());
    next.garden = importGarden(
      JSON.stringify('format' in restored ? restored.workspace.garden : restored),
      'import',
      DESKTOP_LIMITS,
    );
    next.runtime = old.runtime;
    next.exportDirectory = old.exportDirectory;
    next.settings.timezone = old.settings.timezone;
    next.experiment.enabled = false;
    next.experiment.reason = 'Restored and paused. Review source participation before resuming.';
    const merged = new Map(old.experiment.calls.map((r) => [r.id, r]));
    for (const r of next.experiment.calls) if (!merged.has(r.id)) merged.set(r.id, r);
    next.experiment.calls = [...merged.values()];
    next.experiment.latestDate = [old.experiment.latestDate, next.experiment.latestDate]
      .sort()
      .at(-1)!;
    next.experiment.lastObservedAt = Math.max(
      old.experiment.lastObservedAt,
      next.experiment.lastObservedAt,
    );
    for (const s of next.garden.scraps)
      next.sources[s.id] = {
        ...(next.sources[s.id] ?? {
          title: s.text.slice(0, 120),
          tags: [],
          origin: 'Imported backup',
        }),
        participating: false,
      };
    assertWorkspace(next);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.backupInside('Before validated restore', Date.now());
      if ('format' in restored) {
        const retained = new Set(
          this.receipts().map((r) => digest(JSON.stringify([r.jobId, r.at, r.phase, r.raw]))),
        );
        let bytes = this.receipts().reduce((n, r) => n + Buffer.byteLength(r.raw), 0),
          count = retained.size;
        for (const r of restored.receipts) {
          const key = digest(JSON.stringify([r.jobId, r.at, r.phase, r.raw]));
          if (retained.has(key)) continue;
          count++;
          bytes += Buffer.byteLength(r.raw);
          if (count > 3000 || bytes > 128 * 1024 * 1024)
            throw new Error(
              'Restored receipt archive exceeds its quota. Original workspace is unchanged.',
            );
          this.db
            .prepare('INSERT INTO receipts(jobId,at,phase,raw) VALUES(?,?,?,?)')
            .run(r.jobId, r.at, r.phase, r.raw);
          retained.add(key);
        }
      }
      next.revision = old.revision + 1;
      const payload = JSON.stringify(next);
      this.db
        .prepare('UPDATE workspace SET revision=?,payload=?,sha=? WHERE id=1')
        .run(next.revision, payload, digest(payload));
      this.db.exec('COMMIT');
      this.state = next;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  close(): void {
    this.db.close();
  }
}
