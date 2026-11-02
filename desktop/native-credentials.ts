import { spawn } from 'node:child_process';
import { createDecipheriv, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { CredentialStore } from './credentials';

export type Protect = (mode: 'protect' | 'unprotect', bytes: Buffer) => Promise<Buffer>;
export function windowsProtection(script: string): Protect {
  return (mode, bytes) =>
    new Promise((resolve, reject) => {
      const executable = path.join(
        process.env.SystemRoot ?? 'C:\\Windows',
        'System32/WindowsPowerShell/v1.0/powershell.exe',
      );
      const child = spawn(
        executable,
        ['-NoProfile', '-NonInteractive', '-File', script, '-Mode', mode],
        {
          windowsHide: true,
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      const chunks: Buffer[] = [];
      let size = 0;
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Windows protected storage timed out.'));
      }, 15000);
      child.stdout.on('data', (b: Buffer) => {
        size += b.length;
        if (size > 3 * 1024 * 1024) child.kill();
        else chunks.push(b);
      });
      child.stderr.resume(); // Never expose OS/credential diagnostics through the protocol or logs.
      child.on('error', () => {
        clearTimeout(timeout);
        reject(new Error('Windows protected storage is unavailable.'));
      });
      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0 || size > 3 * 1024 * 1024)
          return reject(new Error('Windows protected storage failed.'));
        const text = Buffer.concat(chunks).toString('ascii').trim();
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text))
          return reject(new Error('Invalid protected-storage response.'));
        resolve(Buffer.from(text, 'base64'));
      });
      child.stdin.on('error', () => {});
      child.stdin.end(bytes.toString('base64'));
    });
}
export class NativeCredentialStore implements CredentialStore {
  private present = false;
  private ready = false;
  migration = '';
  private root: string;
  private file: string;
  constructor(
    private directory: string,
    private kind: 'claude' | 'groq',
    private protect: Protect,
  ) {
    this.root = path.join(directory, 'native-secrets');
    this.file = path.join(this.root, kind + '.private.bin');
  }
  available() {
    return this.ready;
  }
  has() {
    return this.present;
  }
  private valid(value: string) {
    return this.kind === 'groq'
      ? /^gsk_[A-Za-z0-9_-]{16,200}$/.test(value)
      : /^[\x21-\x7e]{20,4096}$/.test(value);
  }
  private async bytes(file: string, max = 16384) {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > max)
      throw new Error('Unsafe credential file.');
    return readFile(file);
  }
  async initialize() {
    const sentinel = Buffer.from('Compost protected-storage probe');
    try {
      const encrypted = await this.protect('protect', sentinel);
      if (!(await this.protect('unprotect', encrypted)).equals(sentinel))
        throw new Error('Protection check failed.');
      await mkdir(this.root, { recursive: true });
      if ((await lstat(this.root)).isSymbolicLink())
        throw new Error('Unsafe credential directory.');
      this.ready = true;
      try {
        await this.get();
        this.present = true;
        return;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
      try {
        await this.bytes(this.file + '.removed');
        return;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
      // Chromium's legacy v10/v11 format: DPAPI-wrapped key + AES-256-GCM.
      // Preserve every Electron file. App-bound/unknown formats require re-entry.
      const old = await this.bytes(
        path.join(this.directory, this.kind + '-credential.private.bin'),
      );
      let plain: Buffer;
      if (['v10', 'v11'].includes(old.subarray(0, 3).toString('ascii'))) {
        const local = JSON.parse(
          (await this.bytes(path.join(this.directory, 'Local State'), 4 * 1024 * 1024)).toString(
            'utf8',
          ),
        ) as { os_crypt?: { encrypted_key?: string } };
        const wrapped = Buffer.from(local.os_crypt?.encrypted_key ?? '', 'base64');
        if (wrapped.subarray(0, 5).toString('ascii') !== 'DPAPI' || old.length < 31)
          throw new Error('Unsupported Electron protection.');
        const key = await this.protect('unprotect', wrapped.subarray(5));
        try {
          const decipher = createDecipheriv('aes-256-gcm', key, old.subarray(3, 15));
          decipher.setAuthTag(old.subarray(-16));
          plain = Buffer.concat([decipher.update(old.subarray(15, -16)), decipher.final()]);
        } finally {
          key.fill(0);
        }
      } else if (old.readUInt32LE(0) === 1) plain = await this.protect('unprotect', old);
      else throw new Error('Unsupported Electron protection.');
      try {
        await this.set(plain.toString('utf8'));
        this.migration = 'migrated';
      } finally {
        plain.fill(0);
      }
    } catch (e) {
      this.present = false;
      this.migration = (e as NodeJS.ErrnoException).code === 'ENOENT' ? 'empty' : 'reenter';
    }
  }
  async get() {
    if (!this.ready)
      throw new Error('Защита Windows недоступна. Токен не сохраняется открытым текстом.');
    const value = (await this.protect('unprotect', await this.bytes(this.file))).toString('utf8');
    if (!this.valid(value)) throw new Error('Invalid protected credential.');
    return value;
  }
  async set(value: string) {
    if (!this.ready || !this.valid(value))
      throw new Error('Проверьте формат токена и доступность защиты Windows.');
    const bytes = await this.protect('protect', Buffer.from(value));
    if ((await this.protect('unprotect', bytes)).toString('utf8') !== value)
      throw new Error('Protected credential verification failed.');
    const temporary = this.file + '.' + randomUUID() + '.tmp';
    await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
    await rename(temporary, this.file);
    await unlink(this.file + '.removed').catch((e: NodeJS.ErrnoException) => {
      if (e.code !== 'ENOENT') throw e;
    });
    this.present = true;
  }
  async remove() {
    // A tombstone prevents a removed token reappearing from the retained Electron vault.
    await writeFile(this.file + '.removed', 'removed', { mode: 0o600 });
    await unlink(this.file).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== 'ENOENT') throw e;
    });
    this.present = false;
  }
  async retainSensitive(value: string) {
    if (!this.ready) throw new Error('Protected recovery unavailable.');
    const bytes = await this.protect('protect', Buffer.from(value));
    if ((await this.protect('unprotect', bytes)).toString('utf8') !== value)
      throw new Error('Recovery verification failed.');
    await writeFile(path.join(this.root, 'recovery-' + randomUUID() + '.private.bin'), bytes, {
      flag: 'wx',
      mode: 0o600,
    });
  }
}
