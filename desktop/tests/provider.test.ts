// Authored fake transports and fictional gardens; never live model evidence.
/* eslint @typescript-eslint/require-await: "off" */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { CoherentStore } from '../coherent-store';
import { CoherentController } from '../coherent-controller';
import { GroqRuntime } from '../groq-runtime';
import { EncryptedCredentialStore, reflectsCredential, type CredentialStore } from '../credentials';
import { fixture, candidate } from '../../tests/coherent-fixtures';
import { reading } from '../coherent-export';
import { canonical } from '../../src/domain/coherent/hash';
import { makeGarden, addSource } from '../../src/domain/coherent/workspace';
import { GROQ_ENDPOINT } from '../../src/domain/coherent/provider';

const KEY = 'gsk_DIAGNOSTIC_SENTINEL_NOT_A_REAL_KEY';
await test('reflection inspection decodes bounded nested JSON and complete fences without changing evidence', () => {
  const escaped = JSON.stringify({ error: KEY }).replaceAll('g', '\\u0067');
  for (const body of [
    escaped,
    JSON.stringify({ result: escaped }),
    JSON.stringify({ result: '```json\n' + escaped + '\n```' }),
  ]) {
    assert.equal(reflectsCredential(body, KEY), true);
    assert.equal(reflectsCredential(body, 'different-secret'), false);
  }
  assert.equal(reflectsCredential('not JSON', KEY), false);
  assert.equal(reflectsCredential(JSON.stringify({ note: 'ordinary content' }), KEY), false);
  assert.equal(
    reflectsCredential(JSON.stringify([...Array<string>(150000).fill(''), KEY]), KEY),
    true,
  );
});
const services = {
  pick: async () => [],
  saveBackup: async () => true,
  confirm: async () => true,
  openDirectory: async () => {},
  autostart: () => {},
};
function credential(): CredentialStore & { sensitive: string[] } {
  let key = KEY;
  const sensitive: string[] = [];
  return {
    sensitive,
    available: () => true,
    has: () => !!key,
    get: async () => {
      if (!key) throw new Error('Missing key');
      return key;
    },
    set: async (v) => {
      key = v;
    },
    remove: async () => {
      key = '';
    },
    retainSensitive: async (v) => {
      sensitive.push(v);
    },
  };
}
async function setup(
  answer?: (index: number, s: CoherentStore, signal: AbortSignal) => Promise<Response>,
) {
  await mkdir('.local', { recursive: true });
  const store = new CoherentStore(await mkdtemp(path.resolve('.local/provider-test-')));
  store.save(fixture(Date.now()), false);
  const sent: { url: string; body: string; headers: HeadersInit | undefined }[] = [];
  const vault = credential();
  const transport = (async (url, init) => {
    const index = sent.length;
    if (typeof init?.body !== 'string') throw new Error('Diagnostic expected JSON text.');
    sent.push({
      url: typeof url === 'string' ? url : url instanceof URL ? url.href : url.url,
      body: init.body,
      headers: init.headers,
    });
    assert.equal(init?.redirect, 'error');
    if (answer) return answer(index, store, init!.signal!);
    const content =
      index % 2 === 0
        ? JSON.stringify(candidate(store.state.jobs.at(-1)!))
        : JSON.stringify({ decision: 'pass', findings: [], limitations: '' });
    return response(content);
  }) as typeof fetch;
  const controller = new CoherentController(
    store,
    services,
    [],
    undefined,
    new GroqRuntime(vault, transport),
  );
  await controller.command({ op: 'configureProvider', kind: 'groq' });
  return { store, controller, sent, vault };
}
function response(content: string, status = 200, finish = 'stop') {
  return new Response(
    JSON.stringify({
      id: 'DIAGNOSTIC-request',
      model: 'reported-model',
      choices: [{ finish_reason: finish, message: { content } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    }),
    { status, headers: { 'retry-after': '5' } },
  );
}
async function drain(c: CoherentController) {
  for (let i = 0; i < 1000; i++) {
    if (!c.view().busy) return;
    await new Promise((r) => setTimeout(r, 3));
  }
  throw new Error('Diagnostic work did not drain');
}
async function preview(c: CoherentController) {
  const v = await c.command({
    op: 'eureka',
    garden: c.store.state.gardens[0]!.id,
    requestId: crypto.randomUUID(),
  });
  assert.ok(v.remotePreview);
  return v.remotePreview;
}
async function confirm(c: CoherentController) {
  const p = await preview(c);
  await c.command({ op: 'confirmRemote', previewId: p.id, consent: true });
  return p;
}
await test('remote preview is read-only; consent binds exactly one job, double confirm does not repeat; provenance and backups retain no key', async () => {
  const { store: s, controller: c, sent } = await setup();
  const before = canonical(s.state),
    p = await preview(c);
  assert.equal(canonical(s.state), before);
  assert.equal(sent.length, 0);
  assert.ok(p.context.toLowerCase().includes('signal'));
  assert.equal(p.calls, 3);
  await c.command({ op: 'confirmRemote', previewId: p.id, consent: true });
  await drain(c);
  await c.command({ op: 'confirmRemote', previewId: p.id, consent: true });
  assert.equal(sent.length, 2);
  assert.equal(s.state.nodes.length, 1);
  assert.equal(s.state.gardens[0]!.credits.balance, 2);
  assert.equal(sent[0]!.url, GROQ_ENDPOINT);
  assert.equal(s.state.jobs[0]!.dispatches![1]!.remote?.reportedModel, 'reported-model');
  assert.equal(s.state.nodes[0]!.revisions[0]!.origin, 'remote-model proposal');
  assert.ok(!canonical(s.envelope()).includes(KEY));
  assert.ok(!canonical(c.view()).includes(KEY));
  const exported = reading(s.state, 'all')[0]!.text;
  assert.ok(exported.includes('Observed remote inference'));
  assert.ok(!exported.includes(KEY));
  const dir = s.directory;
  await c.close();
  const reopened = new CoherentStore(dir);
  assert.equal(reopened.state.calls.length, 2);
  assert.equal(reopened.state.paused, true);
  reopened.close();
});
await test('changed source after preview invalidates consent without sending; restored config cannot grant authorization', async () => {
  const { store: s, controller: c, sent } = await setup(),
    p = await preview(c);
  await c.command({ op: 'participate', id: s.state.sources[0]!.id, value: false });
  await assert.rejects(
    c.command({ op: 'confirmRemote', previewId: p.id, consent: true }),
    /изменил/,
  );
  assert.equal(sent.length, 0);
  await c.close();
});
for (const invalidation of ['cancel', 'expire', 'replace'])
  await test(`${invalidation} during Groq credential access prevents remote dispatch`, async (t) => {
    const { store: s, controller: c, sent, vault } = await setup();
    const p = await preview(c),
      before = canonical(s.state);
    const original = vault.get.bind(vault);
    let release!: () => void, started!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    vault.get = async () => {
      started();
      await gate;
      return original();
    };
    try {
      const confirming = c.command({ op: 'confirmRemote', previewId: p.id, consent: true });
      await entered;
      if (invalidation === 'cancel') await c.command({ op: 'cancelRemote' });
      else if (invalidation === 'expire') {
        const expired = Date.now() + 300001;
        t.mock.method(Date, 'now', () => expired);
      } else await preview(c);
      release();
      await assert.rejects(confirming, /отмен|ист[её]к|changed|cancelled/i);
      assert.equal(sent.length, 0);
      assert.equal(canonical(s.state), before);
    } finally {
      t.mock.restoreAll();
      release();
      await c.pause();
      await c.close();
    }
  });
await test('remote scheduled tick and resume refuse; manual cancel/missing key send nothing', async () => {
  const { store: s, controller: c, sent } = await setup();
  s.change((w) => {
    w.paused = false;
    w.gardens[0]!.background = true;
    w.gardens[0]!.nextAt = 0;
  });
  c.tick();
  assert.equal(sent.length, 0);
  assert.equal(s.state.jobs.length, 0);
  await assert.rejects(c.command({ op: 'resume' }), /расписание/);
  const p = await preview(c);
  await c.command({ op: 'cancelRemote' });
  await assert.rejects(c.command({ op: 'confirmRemote', previewId: p.id, consent: true }));
  const next = await preview(c);
  await c.remote.credentials.remove();
  await assert.rejects(
    c.command({ op: 'confirmRemote', previewId: next.id, consent: true }),
    /Missing/,
  );
  assert.equal(sent.length, 0);
  await c.close();
});
for (const status of [401, 403, 429, 500])
  await test(`HTTP ${status} retains body/status, one call, no retry or slot charge`, async () => {
    const {
      store: s,
      controller: c,
      sent,
    } = await setup(
      async () =>
        new Response(JSON.stringify({ error: { message: 'DIAGNOSTIC provider refusal' } }), {
          status,
          headers: { 'retry-after': '5' },
        }),
    );
    await confirm(c);
    await drain(c);
    assert.equal(sent.length, 1);
    assert.equal(s.state.calls.length, 1);
    assert.equal(s.state.nodes.length, 0);
    assert.equal(s.state.gardens[0]!.credits.balance, 3);
    assert.equal(s.state.jobs[0]!.dispatches![0]!.remote?.httpStatus, status);
    assert.ok(canonical(s.receipts()).includes('groq-transport'));
    await c.close();
  });
for (const repaired of [true, false])
  await test(`field/list failure shapes receive exact bounded repair feedback; repaired=${repaired}`, async () => {
    const {
      store: s,
      controller: c,
      sent,
    } = await setup(async (index, s) => {
      const j = s.state.jobs.at(-1)!;
      if (index === 0) {
        const invalid = candidate(j);
        invalid.summary = 'X'.repeat(385);
        invalid.interaction = 'Y'.repeat(294);
        invalid.contributions.push({ ...invalid.contributions[0]! });
        return response(JSON.stringify(invalid));
      }
      if (index === 1) {
        const fixed = candidate(j);
        if (!repaired) fixed.interaction = 'Y'.repeat(286);
        return response(JSON.stringify(fixed));
      }
      return response(JSON.stringify({ decision: 'pass', findings: [], limitations: '' }));
    });
    await confirm(c);
    await drain(c);
    const j = s.state.jobs.at(-1)!;
    const feedback = JSON.parse(sent[1]!.body) as { messages: { content: string }[] };
    assert.ok(feedback.messages[0]!.content.includes('$.summary maxLength 385/360'));
    assert.ok(feedback.messages[0]!.content.includes('$.interaction maxLength 294/240'));
    assert.ok(feedback.messages[0]!.content.includes('$.contributions maxItems 3/2'));
    assert.equal(sent.length, repaired ? 3 : 2);
    assert.equal(s.state.nodes.length, repaired ? 1 : 0);
    assert.equal(s.state.gardens[0]!.credits.balance, repaired ? 2 : 3);
    assert.equal(j.raw.length, repaired ? 3 : 2);
    assert.equal(j.repairUsed, true);
    assert.equal(j.admission!.version, 'provider-admission-2');
    for (const d of j.dispatches!)
      assert.ok(d.inputByteUpperBound! + d.outputTokens <= j.admission!.contextLimit);
    if (!repaired) assert.ok(j.repairRefusal.includes('$.interaction maxLength 286/240'));
    await c.close();
  });
await test('one shared repair cannot turn repeated instruction echoes into a card', async () => {
  const {
    store: s,
    controller: c,
    sent,
  } = await setup(async (_i, s) =>
    response(JSON.stringify({ ...candidate(s.state.jobs.at(-1)!), core: 'rule' })),
  );
  await confirm(c);
  await drain(c);
  assert.equal(sent.length, 2);
  assert.equal(s.state.nodes.length, 0);
  assert.equal(s.state.jobs[0]!.raw.length, 2);
  assert.equal(s.state.gardens[0]!.credits.balance, 3);
  await c.close();
});
await test('negative response is not screened, repaired or committed', async () => {
  const {
    store: s,
    controller: c,
    sent,
  } = await setup(async () =>
    response(
      JSON.stringify({
        outcome: 'no_blend',
        reason: 'DIAGNOSTIC incompatible constraints',
        missing: [],
      }),
    ),
  );
  await confirm(c);
  await drain(c);
  assert.equal(sent.length, 1);
  assert.equal(s.state.jobs[0]!.stage, 'negative');
  assert.equal(s.state.gardens[0]!.credits.balance, 3);
  await c.close();
});
await test('truncation and malformed transport keep original evidence with no hidden retry', async () => {
  for (const body of [response('{"partial":', 200, 'length'), new Response('not JSON')]) {
    const { store: s, controller: c, sent } = await setup(async () => body);
    await confirm(c);
    await drain(c);
    assert.equal(sent.length, 1);
    assert.equal(s.state.nodes.length, 0);
    assert.ok(s.receipts().length > 0);
    await c.close();
  }
});
await test('pause while remote request is pending prevents checker and late commit; dispatched debt survives', async () => {
  let ready!: () => void;
  const started = new Promise<void>((r) => {
    ready = r;
  });
  const {
    store: s,
    controller: c,
    sent,
  } = await setup(async (_i, s, signal) => {
    ready();
    await new Promise<void>((resolve) => {
      signal.addEventListener('abort', () => resolve(), { once: true });
    });
    return response(JSON.stringify(candidate(s.state.jobs.at(-1)!)));
  });
  await confirm(c);
  await started;
  await c.pause();
  await drain(c);
  assert.equal(sent.length, 1);
  assert.equal(s.state.calls.length, 1);
  assert.equal(s.state.nodes.length, 0);
  assert.equal(s.state.jobs[0]!.raw.length, 1);
  assert.equal(s.state.gardens[0]!.credits.balance, 3);
  assert.ok(s.state.lifecycle.some((e) => e.kind === 'remote wait drained'));
  await c.close();
});
for (const escaped of [false, true])
  await test(`credential reflection (${escaped ? 'JSON escaped' : 'literal'}) is retained in protected recovery, never ordinary state/receipts`, async () => {
    const body = JSON.stringify({ error: KEY });
    const original = escaped ? body.replaceAll('g', '\\u0067') : body;
    const {
      store: s,
      controller: c,
      vault,
    } = await setup(async () => new Response(original, { status: 500 }));
    await confirm(c);
    await drain(c);
    assert.equal(vault.sensitive[0], original);
    assert.ok(!canonical(s.envelope()).includes(KEY));
    assert.ok(!canonical(c.view()).includes(KEY));
    await c.close();
  });
await test('cross-garden preview names donor and sends only explicit approved selected context', async () => {
  const { store: s, controller: c, sent } = await setup();
  s.change((w) => {
    const g = w.gardens[0]!,
      d = makeGarden('Fictional donor', 'game', Date.now());
    w.gardens.push(d);
    d.policy.donate = true;
    g.policy = { revision: 2, probability: 100, donors: [d.id], donate: true };
    addSource(
      w,
      d.id,
      'Donor',
      'A fictional bell requires two turns to recharge.',
      true,
      Date.now(),
    );
  });
  const p = await preview(c);
  assert.equal(p.donorGardens.length, 1);
  assert.ok(p.context.includes('two turns'));
  assert.equal(sent.length, 0);
  await c.command({ op: 'confirmRemote', previewId: p.id, consent: true });
  await drain(c);
  assert.equal(sent.length, 2);
  await c.close();
});
await test('encrypted credentials and sensitive recovery exclude plaintext; unavailable encryption has no fallback', async () => {
  const dir = await mkdtemp(path.resolve('.local/credential-test-'));
  const encryption = {
    isEncryptionAvailable: () => true,
    encryptString: (v: string) => Buffer.from(Buffer.from(v).map((b) => b ^ 0xa5)),
    decryptString: (v: Buffer) => Buffer.from(v.map((b) => b ^ 0xa5)).toString(),
  };
  const vault = new EncryptedCredentialStore(dir, encryption);
  await vault.set(KEY);
  await vault.initialize();
  assert.equal(await vault.get(), KEY);
  await vault.retainSensitive('DIAGNOSTIC ' + KEY);
  for (const file of await readdir(dir))
    assert.ok(!(await readFile(path.join(dir, file))).includes(Buffer.from(KEY)));
  const denied = new EncryptedCredentialStore(dir, {
    ...encryption,
    isEncryptionAvailable: () => false,
  });
  await assert.rejects(denied.set(KEY));
  await vault.remove();
  assert.equal(vault.has(), false);
});

await test('remote recheck targets the exact committed revision without a new card or credit charge', async () => {
  const {
    store: s,
    controller: c,
    sent,
  } = await setup(async (index, s) =>
    response(
      JSON.stringify(
        index === 0
          ? candidate(s.state.jobs.at(-1)!)
          : { decision: 'pass', findings: [], limitations: '' },
      ),
    ),
  );
  await confirm(c);
  await drain(c);
  const id = s.state.nodes[0]!.id;
  const before = s.state.gardens[0]!.credits.balance;
  const v = await c.command({ op: 'checkNode', id });
  assert.ok(v.remotePreview?.draft);
  assert.equal(sent.length, 2);
  await c.command({ op: 'confirmRemote', previewId: v.remotePreview!.id, consent: true });
  await drain(c);
  assert.equal(sent.length, 3);
  assert.equal(s.state.nodes.length, 1);
  assert.equal(s.state.gardens[0]!.credits.balance, before);
  assert.equal(s.state.nodes[0]!.revisions[0]!.assessments!.length, 2);
  await c.close();
});

await test('restart interrupts imported pending consent and cannot authorize a remote dispatch', async () => {
  const { store: s, controller: c, sent } = await setup();
  const p = await preview(c);
  // Reopen a profile after closing its controller: consent existed only in memory.
  const dir = s.directory;
  await c.close();
  const next = new CoherentStore(dir);
  const fresh = new CoherentController(
    next,
    services,
    [],
    undefined,
    new GroqRuntime(credential(), (async () => {
      throw new Error('Unexpected dispatch');
    }) as typeof fetch),
  );
  await assert.rejects(
    fresh.command({ op: 'confirmRemote', previewId: p.id, consent: true }),
    /истёк/,
  );
  fresh.tick();
  assert.equal(next.state.calls.length, 0);
  assert.equal(sent.length, 0);
  assert.equal(next.state.paused, true);
  await fresh.close();
});

await test('Claude setup-token encryption uses a separate non-exported file and rejects multiline input', async () => {
  const dir = await mkdtemp(path.resolve('.local/claude-token-vault-'));
  const encryption = {
    isEncryptionAvailable: () => true,
    encryptString: (v: string) => Buffer.from(Buffer.from(v).map((b) => b ^ 0xa5)),
    decryptString: (v: Buffer) => Buffer.from(v.map((b) => b ^ 0xa5)).toString(),
  };
  const token = 'sk-ant-oat01-DIAGNOSTIC_NOT_A_REAL_TOKEN';
  const vault = new EncryptedCredentialStore(dir, encryption, 'claude');
  await vault.set(token);
  assert.equal(await vault.get(), token);
  assert.ok(
    !(await readFile(path.join(dir, 'claude-credential.private.bin'))).includes(Buffer.from(token)),
  );
  await assert.rejects(vault.set(token + '\n'));
  assert.equal(await vault.get(), token);
  await vault.remove();
});
