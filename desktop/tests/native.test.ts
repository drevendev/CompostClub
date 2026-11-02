/* eslint @typescript-eslint/require-await: "off" */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createCipheriv, randomBytes } from 'node:crypto';
import { NativeCredentialStore, type Protect } from '../native-credentials';
import { NativeUI, NATIVE_PAGES, type NativeElement } from '../native-ui';
import { ownProfile } from '../profile-owner';
import { CoherentController } from '../coherent-controller';
import { CoherentStore } from '../coherent-store';
import { fixture, retain } from '../../tests/coherent-fixtures';
import { commit, prepareJob } from '../../src/domain/coherent/workspace';
import { canonical } from '../../src/domain/coherent/hash';
import { providerSnapshot } from '../../src/domain/coherent/provider';
import type { CoherentCommand } from '../coherent-types';
const directory = async () => {
  await mkdir('.local', { recursive: true });
  return mkdtemp(path.resolve('.local/native-test-'));
};
const protection: Protect = async (mode, bytes) =>
  mode === 'protect' ? Buffer.concat([Buffer.from('DIAGNOSTIC-ONLY:'), bytes]) : bytes.subarray(16);
const services = {
  pick: async () => [],
  confirm: async () => false,
  saveBackup: async () => false,
  openDirectory: async () => {},
  autostart: async () => {},
};
async function setup() {
  const dir = await directory(),
    store = new CoherentStore(dir);
  const w = fixture(Date.now());
  const j = prepareJob(w, w.gardens[0]!.id, 'blend', Date.now());
  retain(j);
  j.observed = false;
  const n = commit(w, j.id, Date.now());
  n.recorded = true;
  store.save(w, false);
  const c = new CoherentController(store, services, []);
  const ui = new NativeUI(
    () => c.view(),
    (command) => c.command(command),
    async () => {},
  );
  return { store, c, ui };
}
const find = (body: NativeElement[], title: string) => {
  const e = body.find((e) => e.text === title);
  assert.ok(e?.action, 'Native action missing: ' + title);
  return e;
};
await test('native view exposes every main journey and preserves exact candidate/source text without model calls', async () => {
  const { store, c, ui } = await setup();
  const before = canonical(store.state.calls);
  for (const [page] of NATIVE_PAGES) {
    ui.navigate(page);
    const s = ui.render();
    assert.ok(s.body.length);
    assert.equal(s.page, page);
  }
  ui.navigate('cards', store.state.nodes[0]!.id);
  let screen = ui.render();
  assert.ok(JSON.stringify(screen).includes(store.state.nodes[0]!.revisions[0]!.content.core));
  const action = find(screen.body, 'Сохранить решение');
  await ui.act(screen.renderId, action.action!, {
    state: 'kept',
    note: 'Native fictional review',
    reasons: ['contradiction'],
  });
  assert.equal(store.state.nodes[0]!.decisions.at(-1)!.note, 'Native fictional review');
  assert.equal(canonical(store.state.calls), before);
  const snapshot = canonical(store.state.sources);
  ui.navigate('sources', store.state.sources[0]!.id);
  screen = ui.render();
  assert.ok(JSON.stringify(screen).includes(store.state.sources[0]!.revisions[0]!.text));
  assert.equal(canonical(store.state.sources), snapshot);
  await c.close();
});
await test('native source edit retains originals, rejects stale UI actions and unlisted selection values', async () => {
  const { store, c, ui } = await setup();
  const id = store.state.sources[0]!.id,
    original = store.state.sources[0]!.revisions[0]!.text;
  ui.navigate('sources', id);
  let s = ui.render();
  const old = s;
  const edit = find(s.body, 'Сохранить новую версию источника');
  s = ui.render();
  await assert.rejects(
    ui.act(old.renderId, edit.action!, { title: 'stale', text: 'stale' }),
    /изменился/,
  );
  await ui.act(s.renderId, find(s.body, 'Сохранить новую версию источника').action!, {
    title: 'Native revision',
    text: '<Window><Script>Never execute this fictional text</Script></Window>',
  });
  assert.equal(store.state.sources[0]!.revisions[0]!.text, original);
  assert.equal(store.state.sources[0]!.revisions.length, 2);
  s = ui.render();
  await assert.rejects(
    ui.act(s.renderId, find(s.body, 'Сохранить подготовку контекста').action!, {
      selected: ['unknown-span'],
      essential: [],
      missingMechanism: false,
    }),
    /выбор/,
  );
  await c.close();
});
await test('native pair is previewed before dispatch, and blocked commands do not call a provider', async () => {
  const { store, c, ui } = await setup();
  ui.navigate('sources');
  let s = ui.render();
  const form = find(s.body, 'Просмотреть выбранную пару');
  const parents = form.fields!.find((f) => f.key === 'parents')!.options!.map((o) => o.value);
  const before = store.state.jobs.length;
  await ui.act(s.renderId, form.action!, { parents });
  s = ui.render();
  assert.ok(s.body.some((e) => e.text === 'Начать одну попытку'));
  assert.equal(store.state.jobs.length, before);
  assert.equal(store.state.calls.length, 0);
  await c.close();
});
await test('native encrypted credential round-trip, deletion tombstone, and recovery never write cleartext', async () => {
  const dir = await directory(),
    secret = 'sk-ant-DIAGNOSTIC-NOT-A-REAL-TOKEN';
  // Use authenticated encryption in this diagnostic, not the production OS mechanism.
  const key = randomBytes(32);
  const protect: Protect = async (mode, b) => {
    if (mode === 'protect') {
      const iv = randomBytes(12),
        cipher = createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(b), cipher.final()]);
      return Buffer.concat([iv, encrypted, cipher.getAuthTag()]);
    }
    const { createDecipheriv } = await import('node:crypto');
    const d = createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
    d.setAuthTag(b.subarray(-16));
    return Buffer.concat([d.update(b.subarray(12, -16)), d.final()]);
  };
  const vault = new NativeCredentialStore(dir, 'claude', protect);
  await vault.initialize();
  assert.ok(vault.available());
  await vault.set(secret);
  assert.equal(await vault.get(), secret);
  assert.ok(
    !(await readFile(path.join(dir, 'native-secrets/claude.private.bin'))).includes(
      Buffer.from(secret),
    ),
  );
  await vault.retainSensitive('Fictional recovery ' + secret);
  await vault.remove();
  await writeFile(
    path.join(dir, 'claude-credential.private.bin'),
    Buffer.from('v20unsupported retained original'),
  );
  const reopened = new NativeCredentialStore(dir, 'claude', protect);
  await reopened.initialize();
  assert.equal(reopened.has(), false);
});
await test('native migration preserves Chromium originals and validates AES-GCM before replacing no data', async () => {
  const dir = await directory(),
    key = randomBytes(32),
    nonce = randomBytes(12),
    secret = 'sk-ant-DIAGNOSTIC-LEGACY-FAKE-TOKEN';
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const raw = Buffer.concat([
    Buffer.from('v10'),
    nonce,
    cipher.update(secret),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const local = JSON.stringify({
    os_crypt: {
      encrypted_key: Buffer.concat([
        Buffer.from('DPAPI'),
        await protection('protect', key),
      ]).toString('base64'),
    },
  });
  await writeFile(path.join(dir, 'Local State'), local);
  await writeFile(path.join(dir, 'claude-credential.private.bin'), raw);
  const vault = new NativeCredentialStore(dir, 'claude', protection);
  await vault.initialize();
  assert.equal(vault.migration, 'migrated');
  assert.equal(await vault.get(), secret);
  assert.equal(await readFile(path.join(dir, 'Local State'), 'utf8'), local);
  assert.deepEqual(await readFile(path.join(dir, 'claude-credential.private.bin')), raw);
});
await test('native unknown credential format and unavailable protection fail closed', async () => {
  const dir = await directory();
  await writeFile(path.join(dir, 'claude-credential.private.bin'), 'v20unsupported');
  const vault = new NativeCredentialStore(dir, 'claude', protection);
  await vault.initialize();
  assert.equal(vault.has(), false);
  assert.equal(vault.migration, 'reenter');
  const bad = new NativeCredentialStore(await directory(), 'claude', async () => {
    throw Error('Diagnostic unavailable');
  });
  await bad.initialize();
  assert.equal(bad.available(), false);
  await assert.rejects(bad.set('sk-ant-DIAGNOSTIC-NOT-A-REAL-TOKEN'));
});
await test('shared profile ownership excludes both hosts and is reacquired after a clean close', async () => {
  const dir = await directory(),
    a = await ownProfile(dir, 'wpf');
  await assert.rejects(ownProfile(dir, 'electron'), /already open/);
  await a.close();
  const b = await ownProfile(dir, 'electron');
  await assert.rejects(ownProfile(dir, 'wpf'), /already open/);
  await b.close();
});
await test('shared ownership refuses a live pre-lock Electron writer', async () => {
  const dir = await directory();
  await writeFile(
    path.join(dir, 'operator-connection.private.json'),
    JSON.stringify({ pid: process.pid }),
  );
  await assert.rejects(ownProfile(dir, 'wpf'), /another desktop host/);
});

await test('native consent/cancellation and model controls retain exact commands without dispatching inference', async () => {
  const { c } = await setup();
  const view = c.view();
  const commands: CoherentCommand[] = [];
  view.remotePreview = {
    id: 'fictional-preview',
    expires: Date.now() + 10000,
    garden: view.workspace.gardens[0]!.id,
    provider: providerSnapshot({ kind: 'claude', revision: 1 }, ''),
    context: 'Fictional exact context',
    sections: [{ title: 'Fixture', text: 'Fictional source only' }],
    objective: '',
    draft: null,
    prompt: 'Fictional diagnostic instruction',
    calls: 3,
    donorGardens: [],
  };
  const ui = new NativeUI(
    () => view,
    async (command) => {
      commands.push(command);
    },
    async () => {},
  );
  let screen = ui.render();
  assert.equal(screen.toolbar[0]!.priority, 'pause');
  assert.equal(find(screen.body, 'Отменить отправку').priority, 'cancelRemote');
  await ui.act(screen.renderId, find(screen.body, 'Разрешить эту отправку').action!, {});
  assert.deepEqual(commands[0], {
    op: 'confirmRemote',
    previewId: 'fictional-preview',
    consent: true,
  });
  const eureka = screen.toolbar.find((b) => b.text === 'Эврика')!;
  await ui.act(screen.renderId, eureka.action!, {});
  await ui.act(screen.renderId, eureka.action!, {});
  assert.notEqual(commands[1]!.requestId, commands[2]!.requestId);
  ui.navigate('settings');
  screen = ui.render();
  assert.deepEqual(
    find(screen.body, 'Выбрать модель Claude').fields![0]!.options!.map((o) => o.value),
    ['haiku', 'sonnet', 'opus'],
  );
  assert.equal(find(screen.body, 'Сохранить setup-token Claude').fields![0]!.value, '');
  await c.close();
});
