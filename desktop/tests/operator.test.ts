import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdir, mkdtemp, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { startOperator, OPERATOR_FILE } from '../operator';
import { create } from '../../src/domain/coherent/workspace';
import type { CoherentView } from '../coherent-types';
void test('local operator requires session capability and explicit exchange consent, serializes commands, and opens no UI', async () => {
  await mkdir('.local', { recursive: true });
  // Unix socket paths have an OS length bound; keep the diagnostic fixture
  // short even inside a deeply nested CI checkout.
  const dir = await mkdtemp(path.resolve('.local/op-'));
  const view: CoherentView = {
    workspace: create(Date.now(), 'UTC'),
    busy: false,
    status: 'paused',
    reason: 'diagnostic',
    activeJob: null,
    preview: null,
    backups: [],
    receiptCount: 0,
    dataDirectory: dir,
    model: { connected: false, digest: '' },
    exportStatus: null,
    autostart: false,
  };
  const calls: { op: string; confirmed: boolean }[] = [];
  let quit = 0;
  const handle = await startOperator(
    dir,
    async (c, confirmed) => {
      calls.push({ op: c.op, confirmed });
      await Promise.resolve();
      return view;
    },
    () => {
      quit++;
    },
  );
  const config = JSON.parse(await readFile(path.join(dir, OPERATOR_FILE), 'utf8')) as {
    address: string;
    token: string;
  };
  const request = (command: { op: string }, confirm = false, token = config.token) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const s = net.createConnection(config.address),
        parts: Buffer[] = [];
      s.once('error', reject);
      s.once('connect', () =>
        s.write(JSON.stringify({ version: 1, token, command, confirm }) + '\n'),
      );
      s.on('data', (p) => parts.push(Buffer.isBuffer(p) ? p : Buffer.from(p)));
      s.once('end', () =>
        resolve(JSON.parse(Buffer.concat(parts).toString('utf8')) as Record<string, unknown>),
      );
    });
  try {
    assert.equal((await request({ op: 'snapshot' }, false, '0'.repeat(64))).ok, false);
    assert.equal(calls.length, 0);
    assert.equal((await request({ op: 'pickExecutable' }, true)).ok, false);
    assert.equal(calls.length, 0);
    assert.equal((await request({ op: 'exchange' })).needsConfirmation, true);
    assert.equal(calls.length, 0);
    assert.equal((await request({ op: 'exchange' }, true)).ok, true);
    assert.deepEqual(calls, [{ op: 'exchange', confirmed: true }]);
    await Promise.all([request({ op: 'pause' }), request({ op: 'snapshot' })]);
    assert.deepEqual(
      calls.map((c) => c.op),
      ['exchange', 'pause', 'snapshot'],
    );
    assert.equal(quit, 0);
  } finally {
    await handle.close();
  }
  await assert.rejects(access(path.join(dir, OPERATOR_FILE)));
});
