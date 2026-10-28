import type { CredentialStore } from '../credentials';
// Real child-process I/O with fictional diagnostic output; no Claude model call.
/* eslint @typescript-eslint/require-await: "off" */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type SpawnOptions } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ClaudeRuntime,
  claudeEnvironment,
  claudeFlags,
  claudeJsonContent,
} from '../claude-runtime';
import { CoherentController } from '../coherent-controller';
import { CoherentStore } from '../coherent-store';
import { fixture, candidate } from '../../tests/coherent-fixtures';
import { canonical } from '../../src/domain/coherent/hash';
import { reading } from '../coherent-export';
import { noopTrace, type Observer } from '../../server/observability.mjs';

const services = {
  pick: async () => [],
  saveBackup: async () => true,
  confirm: async () => true,
  openDirectory: async () => {},
  autostart: () => {},
};
async function setup(
  mode:
    | 'success'
    | 'cancel'
    | 'turns'
    | 'login'
    | 'fenced'
    | 'invalid-draft'
    | 'reflect-token'
    | 'owner-shape' = 'success',
  tokenStore?: CredentialStore,
  telemetry?: Observer,
) {
  await mkdir('.local', { recursive: true });
  const directory = await mkdtemp(path.resolve('.local/claude-adapter-'));
  const executable = path.join(directory, 'official-diagnostic.exe');
  await writeFile(executable, 'DIAGNOSTIC inert file; injected child launcher below.');
  const store = new CoherentStore(path.join(directory, 'data'));
  store.save(fixture(Date.now()), false);
  const invocations: { args: readonly string[]; options: SpawnOptions }[] = [];
  const inspect = (async (_exe: string, args: string[]) => ({
    stdout: args.includes('--version')
      ? '2.1.259 (DIAGNOSTIC)'
      : JSON.stringify({
          loggedIn: mode !== 'login',
          authMethod: mode === 'login' ? 'none' : 'claude.ai',
        }),
  })) as unknown as ConstructorParameters<typeof ClaudeRuntime>[3];
  const launch = ((_exe: string, args: readonly string[], options: SpawnOptions) => {
    invocations.push({ args, options });
    const index = invocations.length - 1,
      content = (mode === 'owner-shape' ? index < 2 : index % 2 === 0)
        ? JSON.stringify({
            ...candidate(store.state.jobs.at(-1)!),
            ...(mode === 'invalid-draft' ? { core: '' } : {}),
            ...(mode === 'owner-shape' && index === 0
              ? {
                  summary: 'X'.repeat(385),
                  interaction: 'Y'.repeat(294),
                  contributions: [
                    ...candidate(store.state.jobs.at(-1)!).contributions,
                    { ...candidate(store.state.jobs.at(-1)!).contributions[0]! },
                  ],
                }
              : {}),
          })
        : JSON.stringify({ decision: 'pass', findings: [], limitations: '' });
    const result = JSON.stringify({
      type: 'result',
      result:
        mode === 'reflect-token'
          ? JSON.stringify({ error: options.env!.CLAUDE_CODE_OAUTH_TOKEN }).replaceAll(
              's',
              '\\u0073',
            )
          : mode === 'fenced'
            ? '```json\n' + content + '\n```'
            : content,
      is_error: false,
      num_turns: mode === 'turns' ? 2 : 1,
      usage: { input_tokens: 70, output_tokens: 60 },
      modelUsage: { 'DIAGNOSTIC-reported-sonnet': {} },
      session_id: 'DIAGNOSTIC-session',
    });
    return spawn(
      process.execPath,
      [
        '-e',
        mode === 'cancel'
          ? 'process.stdin.resume();setTimeout(()=>{},30000);'
          : 'process.stdin.resume();process.stdin.on("end",()=>process.stdout.write(process.argv[1]));',
        result,
      ],
      options,
    );
  }) as typeof spawn;
  const runtime = new ClaudeRuntime(
    directory,
    () => executable,
    launch,
    inspect,
    tokenStore,
    tokenStore,
  );
  const controller = new CoherentController(
    store,
    services,
    [],
    undefined,
    undefined,
    runtime,
    telemetry,
  );
  await controller.command({ op: 'configureProvider', kind: 'claude' });
  return { store, controller, runtime, invocations };
}
async function drain(c: CoherentController) {
  for (let i = 0; i < 1000; i++) {
    if (!c.view().busy) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('Diagnostic child did not drain.');
}
async function confirm(c: CoherentController) {
  const v = await c.command({
    op: 'eureka',
    garden: c.store.state.gardens[0]!.id,
    requestId: crypto.randomUUID(),
  });
  assert.equal(v.remotePreview?.provider.kind, 'claude');
  await c.command({ op: 'confirmRemote', previewId: v.remotePreview!.id, consent: true });
}

await test('Claude subscription adapter preserves the exact two-stage result, single turns and reported provenance without invoking local Ollama', async () => {
  const { store: s, controller: c, invocations } = await setup();
  await confirm(c);
  await drain(c);
  assert.equal(invocations.length, 2);
  assert.equal(s.state.nodes.length, 1);
  assert.equal(s.state.calls.length, 2);
  assert.equal(s.state.jobs[0]!.raw.length, 2);
  for (const invocation of invocations) {
    assert.deepEqual(invocation.args, claudeFlags);
    assert.equal(invocation.options.shell, false);
    assert.equal(invocation.options.env!.CLAUDE_CODE_MAX_RETRIES, '0');
    assert.ok(!invocation.args.join(' ').includes('fictional'));
  }
  assert.equal(
    s.state.jobs[0]!.dispatches![0]!.remote?.reportedModel,
    'DIAGNOSTIC-reported-sonnet',
  );
  assert.ok(reading(s.state, 'all')[0]!.text.includes('Observed remote inference (claude)'));
  assert.equal(c.view().model.connected, false);
  assert.ok(canonical(s.envelope()).includes('claude-cli-transport'));
  await c.close();
});
await test('escaped nested CLI token reflection preserves the protected original and never ordinary receipts', async () => {
  const token = 'sk-ant-oat01-ESCAPED_DIAGNOSTIC_NOT_A_REAL_TOKEN',
    originals: string[] = [];
  const vault: CredentialStore = {
    available: () => true,
    has: () => true,
    get: async () => token,
    set: async () => {},
    remove: async () => {},
    retainSensitive: async (raw) => {
      originals.push(raw);
    },
  };
  const { store: s, controller: c, invocations } = await setup('reflect-token', vault);
  await confirm(c);
  await drain(c);
  assert.equal(invocations.length, 1);
  assert.equal(originals.length, 1);
  const preserved = JSON.parse(originals[0]!) as { stdout: string };
  const content = JSON.parse((JSON.parse(preserved.stdout) as { result: string }).result) as {
    error: string;
  };
  assert.equal(content.error, token);
  assert.ok(!canonical(s.envelope()).includes(token));
  assert.ok(!canonical(s.envelope()).includes('ESCAPED_DIAGNOSTIC'));
  assert.equal(s.state.nodes.length, 0);
  assert.equal(s.state.gardens[0]!.credits.balance, 3);
  await c.close();
});
await test('Claude repairs the authored owner failure shape with all field/count feedback and one checker', async () => {
  const { store: s, controller: c, invocations } = await setup('owner-shape');
  await confirm(c);
  await drain(c);
  const j = s.state.jobs.at(-1)!;
  assert.equal(invocations.length, 3);
  assert.equal(j.raw.length, 3);
  assert.equal(j.repairUsed, true);
  assert.equal(s.state.nodes.length, 1);
  assert.equal(s.state.gardens[0]!.credits.balance, 2);
  assert.ok(j.dispatches![1]!.prompt.includes('$.summary maxLength 385/360'));
  assert.ok(j.dispatches![1]!.prompt.includes('$.contributions maxItems 3/2'));
  for (const d of j.dispatches!)
    assert.ok(d.inputByteUpperBound! + d.outputTokens <= j.admission!.contextLimit);
  await c.close();
});
await test('missing Claude subscription login refuses before any creative process, job charge or commit', async () => {
  const { store: s, controller: c, invocations } = await setup('login');
  await assert.rejects(confirm(c), /подписк/);
  assert.equal(invocations.length, 0);
  assert.equal(s.state.jobs.length, 0);
  assert.equal(s.state.calls.length, 0);
  await c.close();
});
await test('unexpected multi-turn CLI result remains a failed retained response, not a quality pass', async () => {
  const { store: s, controller: c, invocations } = await setup('turns');
  await confirm(c);
  await drain(c);
  assert.equal(invocations.length, 1);
  assert.equal(s.state.nodes.length, 0);
  assert.equal(s.state.gardens[0]!.credits.balance, 3);
  assert.ok(s.receipts().length > 0);
  await c.close();
});
await test('Pause terminates only the owned CLI child, preserves uncertain debt and prevents another stage', async () => {
  const { store: s, controller: c, invocations } = await setup('cancel');
  await confirm(c);
  for (let i = 0; i < 100 && !invocations.length; i++) await new Promise((r) => setTimeout(r, 5));
  await c.pause();
  await drain(c);
  assert.equal(invocations.length, 1);
  assert.equal(s.state.nodes.length, 0);
  assert.equal(s.state.calls.length, 1);
  assert.equal(s.state.gardens[0]!.credits.balance, 3);
  await c.close();
});
await test('CLI environment does not inherit API billing keys, arbitrary endpoints or shell startup settings', () => {
  const environment = claudeEnvironment();
  for (const name of [
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_BASE_URL',
    'NODE_OPTIONS',
    'BASH_ENV',
    'CLAUDE_CODE_RETRY_WATCHDOG',
  ])
    assert.equal(environment[name], undefined);
  assert.equal(environment.DISABLE_AUTOUPDATER, '1');
  assert.equal(environment.DISABLE_TELEMETRY, '1');
  assert.ok(!claudeFlags.includes('--fallback-model'));
  assert.ok(!claudeFlags.includes('--resume'));
});

await test('setup-token is accepted through secure settings and passed only in the owned CLI environment', async () => {
  const token = 'sk-ant-oat01-DIAGNOSTIC_NOT_A_REAL_TOKEN';
  let value = '';
  const vault: CredentialStore = {
    available: () => true,
    has: () => !!value,
    get: async () => value,
    set: async (v) => {
      value = v;
    },
    remove: async () => {
      value = '';
    },
    retainSensitive: async () => {},
  };
  const { store: s, controller: c, invocations } = await setup('success', vault);
  await c.command({ op: 'setClaudeToken', token });
  assert.equal(c.view().claudeToken?.present, true);
  assert.ok(!canonical(c.view()).includes(token));
  assert.ok(!canonical(s.envelope()).includes(token));
  await confirm(c);
  await drain(c);
  assert.equal(invocations.length, 2);
  for (const call of invocations) {
    assert.equal(call.options.env!.CLAUDE_CODE_OAUTH_TOKEN, token);
    assert.ok(!call.args.join(' ').includes(token));
  }
  assert.ok(!canonical(s.envelope()).includes(token));
  await c.command({ op: 'removeClaudeToken' });
  assert.equal(value, '');
  await c.close();
});

for (const model of ['haiku', 'sonnet', 'opus']) {
  await test(`selected ${model} remains frozen for both Claude stages, provenance and reopen`, async () => {
    const { store: s, controller: c, invocations } = await setup();
    await c.command({ op: 'configureClaudeModel', model });
    await confirm(c);
    await drain(c);
    assert.equal(s.state.jobs[0]!.model, model);
    assert.equal(s.state.jobs[0]!.provider!.requestedModel, model);
    assert.equal(invocations.length, 2);
    for (const invocation of invocations)
      assert.equal(invocation.args[invocation.args.indexOf('--model') + 1], model);
    assert.equal(s.state.calls.length, 2);
    assert.equal(s.state.nodes.length, 1);
    const directory = s.directory;
    await c.close();
    const reopened = new CoherentStore(directory);
    assert.equal(reopened.state.provider!.model, model);
    assert.equal(reopened.state.jobs[0]!.provider!.requestedModel, model);
    reopened.close();
  });
}

await test('model change invalidates earlier remote consent and invalid models do not change settings', async () => {
  const { store: s, controller: c, invocations } = await setup();
  const v = await c.command({
    op: 'eureka',
    garden: s.state.gardens[0]!.id,
    requestId: crypto.randomUUID(),
  });
  await c.command({ op: 'configureClaudeModel', model: 'opus' });
  await assert.rejects(
    c.command({ op: 'confirmRemote', previewId: v.remotePreview!.id, consent: true }),
    /Предпросмотр/,
  );
  const before = canonical(s.state);
  await assert.rejects(
    c.command({ op: 'configureClaudeModel', model: 'PRIVATE_NOT_A_MODEL' }),
    /модель/,
  );
  assert.equal(canonical(s.state), before);
  assert.equal(invocations.length, 0);
  assert.equal(s.state.calls.length, 0);
  await c.close();
});

await test('connection check reports success or failure without inference and changing configuration clears success', async () => {
  const { controller: c, invocations } = await setup();
  const states: string[] = [];
  c.subscribe(() => states.push(c.view().claudeConnection!.state));
  await c.command({ op: 'checkClaude' });
  assert.ok(states.includes('checking'));
  assert.equal(c.view().claudeConnection!.state, 'ready');
  assert.equal(c.view().claudeConnection!.version, '2.1.259');
  await c.command({ op: 'configureClaudeModel', model: 'haiku' });
  assert.equal(c.view().claudeConnection!.state, 'unchecked');
  assert.equal(invocations.length, 0);
  await c.close();
  const denied = await setup('login');
  await assert.rejects(denied.controller.command({ op: 'checkClaude' }));
  assert.equal(denied.controller.view().claudeConnection!.state, 'failed');
  assert.equal(denied.invocations.length, 0);
  await denied.controller.close();
});

await test('a late connection check cannot certify changed provider/model settings', async () => {
  const { controller: c, runtime } = await setup();
  const original = runtime.start.bind(runtime);
  let ready!: () => void;
  const gate = new Promise<void>((resolve) => {
    ready = resolve;
  });
  runtime.start = async (model) => {
    await gate;
    return original(model);
  };
  const checking = c.command({ op: 'checkClaude' });
  for (let i = 0; i < 30 && c.view().claudeConnection!.state !== 'checking'; i++)
    await new Promise((resolve) => setTimeout(resolve, 1));
  assert.equal(c.view().claudeConnection!.state, 'checking');
  await c.command({ op: 'configureClaudeModel', model: 'opus' });
  ready();
  await checking;
  assert.equal(c.view().claudeConnection!.state, 'unchecked');
  await c.close();
});

for (const invalidation of ['cancel', 'expire', 'replace'])
  await test(`${invalidation} during Claude authentication prevents remote dispatch`, async (t) => {
    const { controller: c, runtime, store: s, invocations } = await setup();
    const v = await c.command({
      op: 'eureka',
      garden: s.state.gardens[0]!.id,
      requestId: crypto.randomUUID(),
    });
    const original = runtime.start.bind(runtime);
    let release!: () => void, started!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    runtime.start = async (model) => {
      started();
      await gate;
      return original(model);
    };
    try {
      const confirming = c.command({
        op: 'confirmRemote',
        previewId: v.remotePreview!.id,
        consent: true,
      });
      await entered;
      if (invalidation === 'cancel') await c.command({ op: 'cancelRemote' });
      else if (invalidation === 'expire') {
        const expired = Date.now() + 300001;
        t.mock.method(Date, 'now', () => expired);
      } else
        await c.command({
          op: 'eureka',
          garden: s.state.gardens[0]!.id,
          requestId: crypto.randomUUID(),
        });
      release();
      await assert.rejects(confirming, /отмен|ист[её]к|changed|cancelled/i);
      assert.equal(s.state.jobs.length, 0);
      assert.equal(s.state.calls.length, 0);
      assert.equal(invocations.length, 0);
    } finally {
      t.mock.restoreAll();
      release();
      await c.pause();
      await c.close();
    }
  });

await test('broken telemetry before/after dispatch, token setters and validation cannot repeat or fail a successful model pipeline', async () => {
  for (const mode of ['before', 'after', 'hang-before', 'hang-after']) {
    const observer: Observer = {
      enabled: true,
      run: async (_meta, fn) => {
        if (mode === 'after' || mode === 'hang-after')
          await fn({
            ...noopTrace,
            tokens: () => {
              throw new Error('DIAGNOSTIC telemetry failure');
            },
            validate: () => {
              throw new Error('DIAGNOSTIC telemetry failure');
            },
          });
        if (mode.startsWith('hang-')) return await new Promise<never>(() => {});
        throw new Error('DIAGNOSTIC telemetry failure');
      },
      flush: async () => {
        throw new Error('DIAGNOSTIC monitoring failure');
      },
    };
    const { store: s, controller: c, invocations } = await setup('success', undefined, observer);
    await confirm(c);
    await drain(c);
    assert.equal(invocations.length, 2);
    assert.equal(s.state.calls.length, 2);
    assert.equal(s.state.nodes.length, 1);
    assert.equal(s.state.jobs[0]!.raw.length, 2);
    await c.close();
  }
});

await test('a single complete outer JSON fence is a disclosed transport wrapper; exact original and domain checks remain intact', async () => {
  const { store: s, controller: c, invocations } = await setup('fenced');
  await c.command({ op: 'configureClaudeModel', model: 'haiku' });
  await confirm(c);
  await drain(c);
  assert.equal(invocations.length, 2);
  assert.equal(s.state.nodes.length, 1);
  assert.equal(s.state.jobs[0]!.repairUsed, false);
  assert.ok(s.state.jobs[0]!.raw.every((r) => r.raw.startsWith('```json\n')));
  assert.ok(canonical(s.envelope()).includes('single-json-markdown-fence'));
  await c.close();
});

await test('JSON wrapper compatibility never extracts embedded objects, multiple blocks, arrays, invalid JSON or repairs values', () => {
  const object = '{"outcome":"candidate","title":"Original ` value"}';
  assert.equal(claudeJsonContent('```json\n' + object + '\n```').text, object);
  assert.equal(claudeJsonContent(object).text, object);
  for (const raw of [
    'Explanation\n```json\n' + object + '\n```',
    '```json\n' + object + '\n```\nMore text',
    '```json\n{}\n```\n```json\n{}\n```',
    '```json\n[{}]\n```',
    '```json\n{"invalid":}\n```',
    '```javascript\n{}\n```',
    '```json\n{}',
  ])
    assert.deepEqual(claudeJsonContent(raw), { text: raw, normalization: 'none' });
});

await test('an observer that skips validation cannot turn malformed model content into a committed card', async () => {
  const observer: Observer = {
    enabled: true,
    run: (_meta, fn) => fn({ ...noopTrace, validate: () => {} }),
    flush: () => Promise.resolve(true),
  };
  const {
    store: s,
    controller: c,
    invocations,
  } = await setup('invalid-draft', undefined, observer);
  await confirm(c);
  await drain(c);
  assert.equal(invocations.length, 2);
  assert.equal(s.state.nodes.length, 0);
  assert.equal(s.state.gardens[0]!.credits.balance, 3);
  assert.ok(s.state.jobs[0]!.primaryFailure);
  assert.ok(s.state.jobs[0]!.raw.length > 0);
  await c.close();
});
