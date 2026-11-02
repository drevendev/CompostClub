import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createObserver, noop, type Observer } from '../server/observability.mjs';

export const TELEMETRY_FILE = 'operator-telemetry.private.json';
// This operator-only file is outside the workspace/backup/export schema.
// Invalid optional monitoring must never prevent the garden from opening.
export async function createDesktopObserver(
  directory: string,
  env: NodeJS.ProcessEnv = process.env,
  factory: typeof createObserver = createObserver,
): Promise<Observer> {
  try {
    const file = path.join(directory, TELEMETRY_FILE);
    let input: unknown;
    try {
      const info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 16384)
        throw new Error('Invalid optional telemetry file.');
      input = JSON.parse(await readFile(file, 'utf8')) as unknown;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') return noop;
      return await factory({ env });
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) return noop;
    const config = input as Record<string, unknown>;
    if (
      config.format !== 'compost-operator-telemetry-1' ||
      typeof config.enabled !== 'boolean' ||
      Object.keys(config).some((key) => !['format', 'enabled', 'dsn'].includes(key)) ||
      (config.enabled && typeof config.dsn !== 'string')
    )
      return noop;
    if (!config.enabled) return noop;
    return await factory({
      env: { ...env, COMPOST_SENTRY_ENABLED: '1', SENTRY_DSN: config.dsn as string },
    });
  } catch {
    return noop;
  }
}
