import type { CredentialStore } from '../credentials';
// Real child-process I/O with fictional diagnostic output; no Claude model call.
/* eslint @typescript-eslint/require-await: "off" */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type SpawnOptions } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ClaudeRuntime, claudeEnvironment, claudeFlags } from '../claude-runtime';
import { CoherentController } from '../coherent-controller';
import { CoherentStore } from '../coherent-store';
import { fixture, candidate } from '../../tests/coherent-fixtures';
import { canonical } from '../../src/domain/coherent/hash';
import { reading } from '../coherent-export';

const services = {
  pick: async () => [],
  saveBackup: async () => true,
  confirm: async () => true,
  openDirectory: async () => {},
  autostart: () => {},
};
async function setup(
  mode: 'success' | 'cancel' | 'turns' | 'login' = 'success',
  tokenStore?: CredentialStore,
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
      content =
        index % 2 === 0
          ? JSON.stringify(candidate(store.state.jobs.at(-1)!))
          : JSON.stringify({ decision: 'pass', findings: [], limitations: '' });
    const result = JSON.stringify({
      type: 'result',
      result: content,
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
  const controller = new CoherentController(store, services, [], undefined, undefined, runtime);
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
