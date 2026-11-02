import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { rendererCommand } from '../webview-protocol';

await test('WebView renderer cannot invoke operator, lifecycle or arbitrary services', () => {
  for (const input of [
    null,
    [],
    { op: 'shutdown' },
    { op: 'external' },
    { op: 'operatorCredits' },
    { op: 'backupTo' },
    { op: 'serviceResult' },
    { op: 'snapshot', text: 'x'.repeat(2 * 1024 * 1024) },
  ])
    assert.throws(() => rendererCommand(input));
  assert.deepEqual(rendererCommand({ op: 'review', id: 'fixture', state: 'kept' }), {
    op: 'review',
    id: 'fixture',
    state: 'kept',
  });
});

await test('WebView preload restricts origin/frame and correlates replies, errors and subscriptions', async () => {
  const code = await readFile('scripts/webview-preload.js', 'utf8');
  for (const wrong of ['https://other.invalid', 'null']) {
    const context = { location: { origin: wrong }, window: {} };
    vm.runInNewContext(code, context);
    assert.equal('compost' in context.window, false);
  }
  type Callback = (e: { data: unknown }) => void;
  const sent: unknown[] = [];
  let handler: Callback = () => {};
  let id = 0;
  const window: Record<string, unknown> = { addEventListener() {}, dispatchEvent() {} };
  window.top = window;
  vm.runInNewContext(code, {
    window,
    location: { origin: 'https://compost.invalid' },
    chrome: {
      webview: {
        postMessage: (m: unknown) => sent.push(m),
        addEventListener: (_name: string, callback: Callback) => {
          handler = callback;
        },
      },
    },
    crypto: { randomUUID: () => String(++id) },
    CustomEvent: class {},
  });
  const api = window.compost as {
    invoke(c: unknown): Promise<unknown>;
    subscribe(fn: (v: unknown) => void): () => void;
  };
  const first = api.invoke({ op: 'snapshot' }),
    second = api.invoke({ op: 'pause' });
  handler({ data: { type: 'reply', id: '2', view: 'paused' } });
  handler({ data: { type: 'reply', id: '1', view: 'snapshot' } });
  assert.equal(await first, 'snapshot');
  assert.equal(await second, 'paused');
  const values: unknown[] = [],
    unsubscribe = api.subscribe((v) => values.push(v));
  handler({ data: { type: 'view', view: 'update' } });
  unsubscribe();
  handler({ data: { type: 'view', view: 'ignored' } });
  assert.deepEqual(values, ['update']);
  const failed = api.invoke({ op: 'restore' });
  handler({ data: { type: 'reply', id: '3', error: 'Invalid backup' } });
  await assert.rejects(failed, /Invalid backup/);
  assert.equal(sent.length, 4);
});
