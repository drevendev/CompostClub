import { lstat, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

export interface CredentialStore {
  available(): boolean;
  has(): boolean;
  get(): Promise<string>;
  set(value: string): Promise<void>;
  remove(): Promise<void>;
  retainSensitive(value: string): Promise<void>;
}
// Inspect the supported JSON envelopes without changing the retained original.
// Nested model JSON is bounded to four string layers; this is not a detector
// for arbitrary encodings such as encrypted or deliberately transformed secrets.
export function reflectsCredential(raw: string, secret: string): boolean {
  if (!secret) return false;
  let strings = [raw];
  for (let layer = 0; layer < 4; layer++) {
    const next: string[] = [];
    for (const text of strings) {
      if (text.includes(secret)) return true;
      const fenced = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(text.trim());
      const input = fenced?.[1] ?? text;
      if (!['[', '{', '"'].includes(input.trimStart()[0] ?? '')) continue;
      try {
        const values: unknown[] = [JSON.parse(input)];
        while (values.length) {
          const value = values.pop();
          if (typeof value === 'string') {
            if (value.includes(secret)) return true;
            next.push(value);
          } else if (value && typeof value === 'object')
            for (const item of Object.values(value)) values.push(item);
        }
      } catch {
        /* Malformed JSON stays intact for the normal failure path. */
      }
    }
    strings = next;
  }
  return false;
}
export class EncryptedCredentialStore implements CredentialStore {
  private present = false;
  private file: string;
  constructor(
    directory: string,
    private encryption: {
      isEncryptionAvailable(): boolean;
      encryptString(value: string): Buffer;
      decryptString(value: Buffer): string;
    },
    private kind: 'groq' | 'claude' = 'groq',
  ) {
    this.file = path.join(directory, this.kind + '-credential.private.bin');
  }
  private valid(value: string) {
    return this.kind === 'groq'
      ? /^gsk_[A-Za-z0-9_-]{16,200}$/.test(value)
      : /^[\x21-\x7e]{20,4096}$/.test(value);
  }
  available() {
    return this.encryption.isEncryptionAvailable();
  }
  has() {
    return this.present;
  }
  async initialize() {
    try {
      await this.get();
      this.present = true;
    } catch {
      this.present = false;
    }
  }
  async get() {
    if (!this.available())
      throw new Error('Защищённое хранилище ОС недоступно. Ключ не сохраняется открытым текстом.');
    const info = await lstat(this.file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 16384)
      throw new Error('Invalid credential file.');
    const value = this.encryption.decryptString(await readFile(this.file));
    if (!this.valid(value)) throw new Error('Invalid stored credential.');
    return value;
  }
  async set(value: string) {
    if (!this.available()) throw new Error('Защищённое хранилище ОС недоступно.');
    if (!this.valid(value))
      throw new Error(
        this.kind === 'groq'
          ? 'Укажите ключ Groq в формате gsk_…'
          : 'Вставьте готовый setup-token Claude без пробелов и переносов строки.',
      );
    try {
      const info = await lstat(this.file);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error('Unsafe credential file.');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    const temporary = this.file + '.' + crypto.randomUUID() + '.tmp';
    try {
      await writeFile(temporary, this.encryption.encryptString(value), { flag: 'wx', mode: 0o600 });
      await rename(temporary, this.file);
      this.present = true;
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }
  async retainSensitive(value: string) {
    if (!this.available()) throw new Error('Secure recovery unavailable.');
    const target = path.join(
      path.dirname(this.file),
      'sensitive-response-' + crypto.randomUUID() + '.private.bin',
    );
    await writeFile(target, this.encryption.encryptString(value), { flag: 'wx', mode: 0o600 });
    if (this.encryption.decryptString(await readFile(target)) !== value)
      throw new Error('Secure recovery verification failed.');
  }
  async remove() {
    await unlink(this.file).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== 'ENOENT') throw e;
    });
    this.present = false;
  }
}
