import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createDesktopObserver, TELEMETRY_FILE } from '../telemetry';
import { noop, type Observer } from '../../server/observability.mjs';

void test('desktop monitoring is opt-in, profile-local, absent from ordinary state, and invalid/disabled config never activates SDK', async () => {
  await mkdir('.local', { recursive: true });
  const directory = await mkdtemp(path.resolve('.local/telemetry-'));
  const seen: NodeJS.ProcessEnv[] = [];
  const factory = (options?: { env?: NodeJS.ProcessEnv }): Promise<Observer> => {
    seen.push(options?.env ?? {});
    return Promise.resolve(noop);
  };
  const env = { COMPOST_SENTRY_ENABLED: '0' };
  assert.equal((await createDesktopObserver(directory, env, factory)).enabled, false);
  assert.equal(seen.length, 1);
  assert.equal(seen[0]!.COMPOST_SENTRY_ENABLED, '0');
  const config = path.join(directory, TELEMETRY_FILE);
  for (const input of [
    'not-json',
    JSON.stringify({ format: 'wrong', enabled: true }),
    JSON.stringify({ format: 'compost-operator-telemetry-1', enabled: false }),
    JSON.stringify({
      format: 'compost-operator-telemetry-1',
      enabled: true,
      dsn: 'test',
      prompt: 'PRIVATE',
    }),
  ]) {
    await writeFile(config, input);
    assert.equal(
      (await createDesktopObserver(directory, { COMPOST_SENTRY_ENABLED: '1' }, factory)).enabled,
      false,
    );
    assert.equal(seen.length, 1);
  }
  await writeFile(
    config,
    JSON.stringify({
      format: 'compost-operator-telemetry-1',
      enabled: true,
      dsn: 'DIAGNOSTIC_DSN',
    }),
  );
  await createDesktopObserver(directory, env, factory);
  assert.equal(seen.length, 2);
  assert.equal(seen[1]!.COMPOST_SENTRY_ENABLED, '1');
  assert.equal(seen[1]!.SENTRY_DSN, 'DIAGNOSTIC_DSN');
});

void test('missing or unusable optional Sentry can be removed without disabling desktop operations', async () => {
  await mkdir('.local', { recursive: true });
  const directory = await mkdtemp(path.resolve('.local/telemetry-off-'));
  const observer = await createDesktopObserver(directory, {}, () =>
    Promise.reject(new Error('DIAGNOSTIC unavailable SDK')),
  );
  assert.equal(observer.enabled, false);
  assert.equal(
    await observer.run({ model: 'sonnet', phase: 'generating', operation: 'blend' }, () =>
      Promise.resolve('original result'),
    ),
    'original result',
  );
});
