import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { DesktopStore } from '../store';
import { DesktopController, type DesktopServices } from '../controller';
import {
  prepareImport,
  acceptImport,
  createWorkspace,
  assertWorkspace,
} from '../../src/domain/experiment';

await test('read-only persistence does not prevent compute release or allow another dispatch', async () => {
  const base = path.resolve('.local');
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(path.join(base, 'failure-test-'));
  assert.ok(path.resolve(dir).startsWith(path.join(base, 'failure-test-')));
  const store = new DesktopStore(dir);
  let released = 0,
    saved = '';
  const services: DesktopServices = {
    pick: () => Promise.resolve([]),
    confirm: () => Promise.resolve(false),
    openDirectory: () => Promise.resolve(),
    autostart: () => {},
    saveBackup: (raw) => {
      saved = raw;
      return Promise.resolve(true);
    },
  };
  const c = new DesktopController(store, services, []);
  c.runtime.release = () => {
    released++;
    return Promise.resolve();
  };
  try {
    store.change((w) => {
      w.experiment.enabled = true;
    });
    store.db.exec('PRAGMA query_only=ON');
    await assert.rejects(c.pause(), /could not be saved/);
    assert.ok(released > 0);
    assert.equal(c.view().workspace.experiment.enabled, false);
    await assert.rejects(c.command({ op: 'run' }));
    assert.throws(
      () =>
        store.receipt(
          'TEST-ONLY-storage-failure',
          'model',
          'TEST-ONLY received bytes retained despite a failed database write',
        ),
      /retained in memory/,
    );
    assert.equal(store.emergency.length, 1);
    await c.command({ op: 'backup' });
    assert.match(saved, /TEST-ONLY received bytes/);
    assert.equal(store.emergency.length, 0);
    assert.equal(c.view().workspace.experiment.enabled, false);
  } finally {
    store.db.exec('PRAGMA query_only=OFF');
    await c.close();
    await rm(dir, { recursive: true, force: true });
  }
});

await test('selected-file attribution is exact and short headings remain editable in preview', () => {
  const w = createWorkspace(Date.now());
  const files = [
    {
      id: 'a',
      name: 'game.md',
      utf8: '# Game\n\nA fictional cooperative game about lost maps.',
      bytesBase64: Buffer.from('# Game\n\nA fictional cooperative game about lost maps.').toString(
        'base64',
      ),
    },
    {
      id: 'b',
      name: 'project.txt',
      utf8: 'A fictional project collecting weather postcards.',
      bytesBase64: Buffer.from('A fictional project collecting weather postcards.').toString(
        'base64',
      ),
    },
  ];
  const preview = prepareImport(w, files);
  assert.equal(preview.parts.length, 3);
  assert.equal(preview.parts[0]!.text, '# Game');
  acceptImport(
    w,
    preview,
    ['', preview.parts[1]!.text, preview.parts[2]!.text],
    [],
    false,
    Date.now(),
  );
  assert.equal(w.sources[w.garden.scraps[0]!.id]!.importedFile, 'a');
  assert.equal(w.sources[w.garden.scraps[1]!.id]!.importedFile, 'b');
  assert.equal(w.files.length, 2);
});

await test('a SQLite abort rolls back workspace, backup and receipt purge together', async () => {
  const base = path.resolve('.local');
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(path.join(base, 'transaction-test-'));
  assert.ok(dir.startsWith(path.join(base, 'transaction-test-')));
  const store = new DesktopStore(dir);
  try {
    store.receipt('TEST-ONLY-job', 'model', 'TEST-ONLY original response');
    const before = JSON.stringify(store.state);
    const backups = store.backups().length;
    store.db.exec(
      "CREATE TRIGGER diagnostic_abort BEFORE UPDATE ON workspace BEGIN SELECT RAISE(ABORT,'TEST-ONLY forced transaction failure'); END",
    );
    const next = structuredClone(store.state);
    next.experiment.reason = 'TEST-ONLY proposed state';
    assert.throws(
      () => store.save(next, true, Date.now() + 7 * 3_600_000, ['TEST-ONLY-job']),
      /forced transaction failure/,
    );
    assert.equal(JSON.stringify(store.state), before);
    assert.equal(store.backups().length, backups);
    assert.equal(store.receipts()[0]!.raw, 'TEST-ONLY original response');
    assert.equal(store.db.prepare('SELECT payload FROM workspace').get()!.payload, before);
  } finally {
    store.db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

await test('workspace quota counts UTF-8 bytes when validating a restored envelope', () => {
  const w = createWorkspace(Date.now());
  // Fewer than 32 MiB UTF-16 characters, but more than 32 MiB on disk.
  w.experiment.reason = '界'.repeat(11 * 1024 * 1024);
  assert.throws(() => assertWorkspace(w), /32 MiB/);
});

await test('an unconfirmed model release stays attention-needed and blocks dispatch', async () => {
  const base = path.resolve('.local');
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(path.join(base, 'release-test-'));
  assert.ok(dir.startsWith(path.join(base, 'release-test-')));
  const store = new DesktopStore(dir);
  const c = new DesktopController(
    store,
    {
      pick: () => Promise.resolve([]),
      saveBackup: () => Promise.resolve(false),
      confirm: () => Promise.resolve(false),
      openDirectory: () => Promise.resolve(),
      autostart: () => {},
    },
    [],
  );
  c.runtime.release = () => Promise.reject(new Error('TEST-ONLY unconfirmed process stop'));
  try {
    await assert.rejects(c.pause(), /unconfirmed process stop/);
    assert.equal(c.view().status, 'attention');
    assert.equal(c.view().workspace.experiment.enabled, false);
    await assert.rejects(c.command({ op: 'run' }));
  } finally {
    c.runtime.release = () => Promise.resolve();
    await c.close();
    await rm(dir, { recursive: true, force: true });
  }
});
