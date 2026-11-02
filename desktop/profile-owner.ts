import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Both desktop hosts must acquire this before opening a writable SQLite connection.
export async function ownProfile(directory: string, host: 'electron' | 'wpf') {
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'profile-owner.private.json');
  const alive = (pid: unknown) => {
    if (!Number.isInteger(pid) || Number(pid) < 1) throw new Error('Invalid profile owner.');
    try {
      process.kill(Number(pid), 0);
      return true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ESRCH') return false;
      throw e;
    }
  };
  // Older Electron packages do not know the shared lock. Refuse their live writer too.
  try {
    const discovery = JSON.parse(
      await readFile(path.join(directory, 'operator-connection.private.json'), 'utf8'),
    ) as { pid: number };
    if (alive(discovery.pid))
      throw new Error('This profile is open in another desktop host. Exit it first.');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  // An OS-held SQLite exclusive transaction has no stale-PID reclamation race.
  // The sidecar contains no application data, and Windows releases it on a crash.
  const lock = new DatabaseSync(path.join(directory, 'profile-ownership.sqlite'));
  try {
    lock.exec(
      'PRAGMA busy_timeout=0; BEGIN EXCLUSIVE; CREATE TABLE IF NOT EXISTS owner(nonce TEXT)',
    );
  } catch (e) {
    lock.close();
    throw new Error('The profile is already open.', { cause: e });
  }
  const nonce = randomUUID();
  await writeFile(
    file,
    JSON.stringify({ format: 'compost-profile-owner-1', pid: process.pid, host, nonce }),
    { mode: 0o600 },
  );
  return {
    async close() {
      try {
        await unlink(file);
      } finally {
        lock.exec('ROLLBACK');
        lock.close();
      }
    },
  };
}
