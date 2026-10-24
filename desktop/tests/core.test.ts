import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import { DesktopStore, digest } from '../store';
import { exportWorkspace, initializeExport } from '../export';
import { DesktopController, type DesktopServices } from '../controller';
import {
  createWorkspace,
  reserveCall,
  callsToday,
  dateKey,
  prepareImport,
  acceptImport,
  assertWorkspace,
  waitReason,
  unreviewed,
} from '../../src/domain/experiment';
import { recordedPersonal } from '../../tests/garden-fixtures';

async function temporary(fn: (directory: string) => Promise<void> | void) {
  const base = path.resolve('.local');
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(path.join(base, 'compost-test-')),
    resolved = path.resolve(dir);
  assert.ok(
    resolved.startsWith(path.join(base, 'compost-test-')),
    'Unsafe temporary cleanup target.',
  );
  try {
    await fn(dir);
  } finally {
    await rm(resolved, { recursive: true, force: true });
  }
}
const now = Date.UTC(2026, 9, 24, 10);
const input = (text: string) => [
  { id: 'file1', name: 'ideas.txt', utf8: text, bytesBase64: Buffer.from(text).toString('base64') },
];
const diagnosticServices: DesktopServices = {
  pick: () => Promise.resolve([]),
  saveBackup: () => Promise.resolve(),
  confirm: () => Promise.resolve(false),
  openDirectory: () => Promise.resolve(),
  autostart: () => {},
};
async function settle(controller: DesktopController): Promise<void> {
  for (let i = 0; i < 100 && controller.view().busy; i++)
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  assert.equal(controller.view().busy, false);
}
function enableDiagnosticSources(store: DesktopStore): void {
  const texts =
    'A fictional library game with weather puzzles.\n\nA fictional map project collecting abandoned letters.';
  const preview = prepareImport(store.state, input(texts));
  store.change((w) => {
    acceptImport(
      w,
      preview,
      preview.parts.map((p) => p.text),
      [],
      true,
      Date.now(),
    );
    w.experiment.enabled = true;
  });
}

await test('diagnostic pause wins over a resume still awaiting export; no model is launched', () =>
  temporary(async (dir) => {
    const store = new DesktopStore(path.join(dir, 'data'));
    store.change((w) => {
      w.exportDirectory = path.join(dir, 'exports');
    });
    const c = new DesktopController(store, diagnosticServices, []);
    let finish = () => {},
      started = 0;
    c.publish = () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      });
    c.runtime.start = () => {
      started++;
      return Promise.resolve({ model: 'gemma3:4b', digest: 'TEST-ONLY' });
    };
    c.runtime.release = () => Promise.resolve();
    const resuming = c.command({ op: 'resume' });
    await c.pause();
    finish();
    await assert.rejects(resuming, /cancelled/);
    assert.equal(started, 0);
    assert.equal(store.state.experiment.enabled, false);
    await c.close();
  }));

await test('diagnostic late invalid response after pause is retained without a result or spent slot', () =>
  temporary(async (dir) => {
    const store = new DesktopStore(path.join(dir, 'data'));
    enableDiagnosticSources(store);
    const c = new DesktopController(store, diagnosticServices, []);
    c.runtime.start = () =>
      Promise.resolve({ model: 'gemma3:4b', digest: 'TEST-ONLY-NOT-MODEL-EVIDENCE' });
    let finish: (() => void) | undefined;
    c.runtime.generate = (_prompt, _format, _seed, _signal, onTransport, beforeDispatch) => {
      beforeDispatch();
      return new Promise<string>((resolve) => {
        finish = () => {
          onTransport('TEST-ONLY late transport bytes');
          resolve('TEST-ONLY invalid model bytes; not genuine inference');
        };
      });
    };
    c.runtime.release = () => {
      const resolve = finish;
      finish = undefined;
      resolve?.();
      return Promise.resolve();
    };
    await c.command({ op: 'run' });
    for (let i = 0; i < 100 && !finish; i++)
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
    assert.ok(finish);
    const slots = store.state.garden.readySlots;
    await c.pause();
    assert.equal(store.state.garden.readySlots, slots);
    assert.equal(store.state.garden.sprouts.length, 0);
    assert.equal(store.state.garden.generations![0]!.status, 'cancelled');
    assert.match(store.state.garden.generations![0]!.responses[0]!.raw, /TEST-ONLY invalid/);
    assert.equal(store.state.experiment.calls.length, 1);
    await c.close();
  }));

await test('diagnostic transport failures keep slots, require explicit retries and pause after three jobs', () =>
  temporary(async (dir) => {
    const store = new DesktopStore(path.join(dir, 'data'));
    enableDiagnosticSources(store);
    const c = new DesktopController(store, diagnosticServices, []);
    c.runtime.start = () =>
      Promise.resolve({ model: 'gemma3:4b', digest: 'TEST-ONLY-NOT-MODEL-EVIDENCE' });
    c.runtime.release = () => Promise.resolve();
    c.runtime.generate = (_prompt, _format, _seed, _signal, _onTransport, beforeDispatch) => {
      beforeDispatch();
      return Promise.reject(new Error('TEST-ONLY simulated connection failure; no response.'));
    };
    for (let i = 0; i < 3; i++) {
      const retryId = store.state.garden.generations?.at(-1)?.id;
      await c.command(retryId ? { op: 'run', retryId } : { op: 'run' });
      await assert.rejects(c.command({ op: 'run' }), /Pause/);
      await settle(c);
    }
    assert.equal(store.state.experiment.enabled, false);
    assert.equal(store.state.experiment.consecutiveFailures, 3);
    assert.equal(store.state.garden.readySlots, 1);
    assert.equal(store.state.garden.sprouts.length, 0);
    assert.equal(store.state.experiment.calls.length, 3);
    await c.close();
  }));

await test('call budgets include repairs and survive date rollback; DST does not duplicate a date', () => {
  const w = createWorkspace(now);
  w.settings.timezone = 'Asia/Nicosia';
  w.settings.dailyCalls = 2;
  reserveCall(w, 'job1', 'primary', 'blend', now);
  reserveCall(w, 'job1', 'repair', 'blend', now + 1000);
  assert.equal(callsToday(w, now), 2);
  assert.throws(() => reserveCall(w, 'job2', 'primary', 'tend', now + 2000), /budget/);
  assert.throws(() => reserveCall(w, 'job2', 'primary', 'blend', now - 86400000), /backwards/);
  assert.equal(
    dateKey(Date.UTC(2026, 9, 25, 0, 30), 'Asia/Nicosia'),
    dateKey(Date.UTC(2026, 9, 25, 1, 30), 'Asia/Nicosia'),
  );
  assertWorkspace(w);
});
await test('batch import preserves Unicode originals, skips duplicates and rejects a whole stale or invalid batch', () => {
  const w = createWorkspace(now),
    raw = '  Игра про облака и забытые письма.\r\n\r\nПроект с библиотекой необычных маршрутов.  ';
  const preview = prepareImport(w, input(raw));
  acceptImport(
    w,
    preview,
    preview.parts.map((p) => p.text),
    ['Игры'],
    true,
    now,
  );
  assert.equal(w.garden.scraps.length, 2);
  assert.equal(w.files[0]!.utf8, raw);
  assert.equal(Buffer.from(w.files[0]!.bytesBase64, 'base64').toString(), raw);
  assert.equal(
    Object.values(w.sources).every((s) => s.participating),
    true,
  );
  assertWorkspace(w);
  const duplicate = prepareImport(w, input(raw));
  assert.equal(
    duplicate.parts.every((p) => p.duplicate),
    true,
  );
  const before = JSON.stringify(w);
  assert.throws(
    () =>
      acceptImport(
        w,
        duplicate,
        duplicate.parts.map((p) => p.text),
        [],
        false,
        now,
      ),
    /No new/,
  );
  assert.equal(JSON.stringify(w), before);
  w.revision++;
  assert.throws(
    () =>
      acceptImport(
        w,
        preview,
        preview.parts.map((p) => p.text),
        [],
        false,
        now,
      ),
    /changed/,
  );
});
await test('review backpressure counts deferred candidates and blocks unattended self-feeding', () => {
  const w = createWorkspace(now);
  w.garden = recordedPersonal(now);
  w.settings.backlog = 1;
  w.experiment.enabled = true;
  const id = w.garden.sprouts[0]!.id;
  w.reviews[id] = { state: 'later', note: 'later', changedAt: now };
  assert.equal(unreviewed(w), 1);
  assert.match(waitReason(w, now), /Review/);
  w.reviews[id]!.state = 'kept';
  assert.equal(unreviewed(w), 0);
});
await test('SQLite rollback, validated migration and restart retain evidence, call budget and pause', () =>
  temporary((dir) => {
    const store = new DesktopStore(path.join(dir, 'data'), now);
    const preview = prepareImport(
      store.state,
      input(
        'A fictional game about travelling libraries.\n\nA fictional project mapping small weather stories.',
      ),
    );
    store.change((w) =>
      acceptImport(
        w,
        preview,
        preview.parts.map((p) => p.text),
        ['Games'],
        true,
        now,
      ),
    );
    store.change((w) => {
      reserveCall(w, 'real-id-not-an-inference-claim', 'primary', 'blend', now);
      w.experiment.enabled = true;
    });
    store.receipt(
      'diagnostic-fixture',
      'model',
      'Explicit diagnostic invalid output; not real inference.',
    );
    const before = JSON.stringify(store.state);
    assert.throws(
      () =>
        store.change((w) => {
          w.settings.dailyCalls = -1;
        }),
      /settings/,
    );
    assert.equal(JSON.stringify(store.state), before);
    assert.throws(
      () => store.restore('{"schemaVersion":999,"format":"compost-desktop"}'),
      /Unsupported/,
    );
    assert.equal(JSON.stringify(store.state), before);
    const backup = JSON.stringify(store.envelope());
    store.restore(backup);
    assert.equal(store.state.experiment.enabled, false);
    assert.equal(store.state.experiment.calls.length, 1);
    assert.equal(
      Object.values(store.state.sources).every((s) => !s.participating),
      true,
    );
    assert.ok(store.backups().some((b) => b.reason === 'Before validated restore'));
    const receipts = store.receipts().length;
    store.close();
    const reopened = new DesktopStore(path.join(dir, 'data'), now + 1000);
    assert.equal(reopened.state.experiment.enabled, false);
    assert.equal(reopened.state.experiment.calls.length, 1);
    assert.equal(reopened.receipts().length, receipts);
    reopened.close();
  }));
await test('restoring a backup cannot replace the local runtime/export paths or refund dispatched calls', () =>
  temporary((dir) => {
    const store = new DesktopStore(path.join(dir, 'data'), now);
    const old = JSON.stringify(store.envelope());
    store.change((w) => {
      w.runtime.executable = 'C:\\operator\\ollama.exe';
      w.runtime.models = 'C:\\operator\\models';
      w.exportDirectory = 'C:\\operator\\export';
      reserveCall(w, 'used', 'primary', 'blend', now);
    });
    store.restore(old);
    assert.equal(store.state.runtime.executable, 'C:\\operator\\ollama.exe');
    assert.equal(store.state.exportDirectory, 'C:\\operator\\export');
    assert.equal(callsToday(store.state, now), 1);
    store.close();
  }));
await test('Codex snapshots are complete/hash-verifiable, preserve notes and omit hidden parent text', () =>
  temporary(async (dir) => {
    const exportDir = path.join(dir, 'export');
    await mkdir(exportDir);
    const w = createWorkspace(now);
    w.garden = recordedPersonal(now);
    w.garden.sprouts[0]!.kept = true;
    w.exportDirectory = exportDir;
    await initializeExport(exportDir, []);
    await writeFile(path.join(exportDir, 'analysis', 'owner.md'), 'Do not overwrite my notes.');
    const first = await exportWorkspace(w, []);
    const pointer = JSON.parse(await readFile(path.join(exportDir, 'CURRENT.json'), 'utf8')) as {
      generation: string;
      manifest: string;
      sha256: string;
    };
    assert.equal(pointer.generation, first.generation);
    const manifestRaw = await readFile(path.join(exportDir, pointer.manifest), 'utf8');
    assert.equal(digest(manifestRaw), pointer.sha256);
    const manifest = JSON.parse(manifestRaw) as {
      files: Record<string, string>;
      cards: { file: string }[];
    };
    for (const [name, sha] of Object.entries(manifest.files))
      assert.equal(
        digest(await readFile(path.join(exportDir, 'snapshots', first.generation, name))),
        sha,
      );
    const card = await readFile(
      path.join(exportDir, 'snapshots', first.generation, manifest.cards[0]!.file),
      'utf8',
    );
    assert.ok(!card.includes(w.garden.scraps[0]!.text));
    assert.ok(card.includes('Recorded demo'));
    w.revision++;
    await exportWorkspace(w, []);
    assert.equal(
      await readFile(path.join(exportDir, 'analysis', 'owner.md'), 'utf8'),
      'Do not overwrite my notes.',
    );
    assert.equal((await readdir(path.join(exportDir, 'snapshots'))).length, 2);
    const userDir = path.join(dir, 'not-empty');
    await mkdir(userDir);
    await writeFile(path.join(userDir, 'notes.txt'), 'Mine');
    await assert.rejects(initializeExport(userDir, []), /empty/);
    assert.equal(await readFile(path.join(userDir, 'notes.txt'), 'utf8'), 'Mine');
  }));
await test('exports refuse source-tree paths and link escapes before writing cards', (t) =>
  temporary(async (dir) => {
    const root = path.join(dir, 'root');
    await mkdir(root);
    await assert.rejects(initializeExport(root, [root]), /outside/);
    const exportDir = path.join(dir, 'export');
    await mkdir(exportDir);
    await initializeExport(exportDir, []);
    const outside = path.join(dir, 'outside');
    await mkdir(outside);
    const link = path.join(exportDir, 'snapshots', 'foreign-link');
    try {
      await symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EPERM') {
        t.skip('OS denied creation of a diagnostic link');
        return;
      }
      throw e;
    }
    const w = createWorkspace(now);
    w.exportDirectory = exportDir;
    await assert.rejects(exportWorkspace(w, []), /Unexpected/);
    assert.deepEqual(await readdir(outside), []);
  }));
await test('desktop commands validate unknown input and commit imports atomically', () =>
  temporary(async (dir) => {
    const store = new DesktopStore(path.join(dir, 'data'), now);
    const services: DesktopServices = {
      pick: () => Promise.resolve([]),
      saveBackup: () => Promise.resolve(),
      confirm: () => Promise.resolve(false),
      openDirectory: () => Promise.resolve(),
      autostart: () => {},
    };
    const controller = new DesktopController(store, services, []);
    await assert.rejects(controller.command({ op: 'eval', code: 'bad' }), /Unknown/);
    await controller.command({
      op: 'pasteImport',
      text: 'A fictional idea about a quiet puzzle garden.\n\nA fictional idea about a map of sounds.',
    });
    const preview = controller.view().preview!;
    const before = JSON.stringify(store.state);
    await assert.rejects(
      controller.command({
        op: 'acceptImport',
        id: preview.id,
        texts: [preview.parts[0]!.text, 'x'],
        tags: 'Games',
        participating: true,
      }),
    );
    assert.equal(JSON.stringify(store.state), before);
    await controller.command({
      op: 'acceptImport',
      id: preview.id,
      texts: preview.parts.map((p) => p.text),
      tags: 'Games',
      participating: true,
    });
    assert.equal(store.state.garden.scraps.length, 2);
    assert.equal(store.state.experiment.enabled, false);
    await assert.rejects(controller.command({ op: 'run' }), /Resume/);
    await controller.close();
  }));
