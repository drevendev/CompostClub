// Authored transport/runtime doubles and fictional text. No live model evidence.
/* eslint @typescript-eslint/require-await: "off" */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { CoherentController } from '../coherent-controller';
import { CoherentStore } from '../coherent-store';
import { ClaudeRuntime } from '../claude-runtime';
import { GroqRuntime } from '../groq-runtime';
import { OwnedOllama } from '../runtime';
import { fixture, candidate } from '../../tests/coherent-fixtures';
import { canonical } from '../../src/domain/coherent/hash';
import { executionMode } from '../../src/domain/coherent/automation';
import { noopTrace, type TraceMeta } from '../../server/observability.mjs';

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function setup(kind: 'local' | 'claude' | 'groq' = 'claude', alias = 'sonnet') {
  await mkdir('.local', { recursive: true });
  const s = new CoherentStore(await mkdtemp(path.resolve('.local/automatic-test-')));
  const w = fixture(Date.now());
  w.provider = { kind, revision: 1, ...(kind === 'claude' ? { model: alias } : {}) };
  w.gardens[0]!.background = true;
  s.save(w, false);
  const prompts: string[] = [],
    models: string[] = [],
    traces: TraceMeta[] = [];
  const hooks = { confirm: async () => true, auth: async () => {} };
  const services = {
    pick: async () => [],
    saveBackup: async () => true,
    openDirectory: async () => {},
    autostart: () => {},
    confirm: async (message: string) => {
      prompts.push(message);
      return hooks.confirm();
    },
  };
  let calls = 0;
  const body = () =>
    calls++ % 2 === 0
      ? JSON.stringify(candidate(s.state.jobs.at(-1)!))
      : JSON.stringify({ decision: 'pass', findings: [], limitations: 'DIAGNOSTIC only' });
  const claude = new ClaudeRuntime(s.directory, () => '');
  claude.start = async (model = 'sonnet') => {
    await hooks.auth();
    return { model, digest: '' };
  };
  claude.release = async () => {};
  claude.generate = async (_p, _f, _seed, signal, transport, before, limits) => {
    await hooks.auth();
    if (signal.aborted) throw Error('DIAGNOSTIC cancelled');
    before();
    models.push(limits?.requestedModel ?? alias);
    const raw = body();
    transport(JSON.stringify({ diagnostic: true, response: raw }));
    return raw;
  };
  const local = new OwnedOllama();
  local.start = async () => {
    await hooks.auth();
    return { model: s.state.runtime.model, digest: 'DIAGNOSTIC' };
  };
  local.release = async () => {};
  local.generate = async (_p, _f, _seed, signal, transport, before) => {
    if (signal.aborted) throw Error('DIAGNOSTIC cancelled');
    before();
    models.push(s.state.runtime.model);
    const raw = body();
    transport(JSON.stringify({ diagnostic: true, response: raw }));
    return raw;
  };
  const remote = new GroqRuntime(
    {
      available: () => true,
      has: () => true,
      get: async () => {
        await hooks.auth();
        return 'gsk_DIAGNOSTIC';
      },
      set: async () => {},
      remove: async () => {},
      retainSensitive: async () => {},
    },
    (async () => {
      models.push('openai/gpt-oss-20b');
      return new Response(
        JSON.stringify({
          choices: [{ finish_reason: 'stop', message: { content: body() } }],
          model: 'DIAGNOSTIC-reported',
          usage: { prompt_tokens: 10, completion_tokens: 10 },
        }),
      );
    }) as typeof fetch,
  );
  const c = new CoherentController(s, services, [], local, remote, claude, {
    enabled: true,
    flush: async () => true,
    run: async (meta, fn) => {
      traces.push(meta);
      return fn(noopTrace);
    },
  });
  return { s, c, hooks, prompts, models, traces };
}
function due(s: CoherentStore) {
  s.change((w) => {
    w.gardens[0]!.nextAt = 0;
  });
}
async function drain(c: CoherentController) {
  for (let i = 0; i < 1000; i++) {
    if (!c.view().busy) return;
    await new Promise((r) => setTimeout(r, 3));
  }
  throw Error('Diagnostic job did not drain');
}
for (const [kind, alias] of [
  ['local', 'gemma3:4b'],
  ['groq', 'openai/gpt-oss-20b'],
  ['claude', 'haiku'],
  ['claude', 'sonnet'],
  ['claude', 'opus'],
] as const)
  await test(`scheduled ${kind}/${alias}: bounded two-stage atomic commit and metadata`, async () => {
    const { s, c, prompts, models, traces } = await setup(kind, alias);
    await c.command({ op: 'resume' });
    due(s);
    c.tick();
    await drain(c);
    assert.equal(s.state.jobs[0]?.trigger, 'scheduled');
    assert.equal(s.state.jobs[0]?.manualPermit, false);
    assert.equal(s.state.calls.length, 2);
    assert.equal(s.state.nodes.length, 1);
    assert.equal(s.state.consumed.length, 1);
    assert.equal(s.state.gardens[0]!.credits.balance, 2);
    assert.equal(s.state.jobs[0]!.raw.length, 2);
    assert.deepEqual(models, [alias, alias]);
    if (kind !== 'local') {
      assert.match(prompts[0]!, /добавленные позднее/);
      assert.ok(s.state.jobs[0]!.remoteConsent?.automation);
    }
    const inference = traces.filter((t) => t.type === 'inference');
    assert.equal(inference.length, 2);
    assert.ok(!canonical(traces).includes('Tide tiles'));
    c.tick();
    await drain(c);
    assert.equal(s.state.calls.length, 2, 'No interval catch-up');
    await c.close();
  });

await test('manual mode remains independent of models and blocks scheduling; Eureka works in either mode', async () => {
  const { s, c } = await setup();
  await c.command({ op: 'configureExecutionMode', mode: 'manual' });
  for (const model of ['haiku', 'opus', 'sonnet']) {
    await c.command({ op: 'configureClaudeModel', model });
    assert.equal(executionMode(s.state), 'manual');
  }
  await assert.rejects(c.command({ op: 'resume' }), /ручной/);
  due(s);
  c.tick();
  assert.equal(s.state.calls.length, 0);
  const v = await c.command({
    op: 'eureka',
    garden: s.state.gardens[0]!.id,
    requestId: crypto.randomUUID(),
  });
  await c.command({ op: 'confirmRemote', previewId: v.remotePreview!.id, consent: true });
  await drain(c);
  assert.equal(s.state.jobs[0]!.trigger, 'eureka');
  assert.equal(executionMode(s.state), 'manual');
  assert.equal(s.state.paused, true);
  await c.command({
    op: 'add',
    garden: s.state.gardens[0]!.id,
    title: 'Fictional third source',
    text: 'Rotate a fictional mirror at a cost of one token.',
    participating: true,
  });
  await c.command({ op: 'configureExecutionMode', mode: 'automatic' });
  assert.equal(s.state.paused, true, 'Choosing a mode never grants permission by itself');
  await c.command({ op: 'resume' });
  const next = await c.command({
    op: 'eureka',
    garden: s.state.gardens[0]!.id,
    requestId: crypto.randomUUID(),
  });
  assert.ok(next.remotePreview, 'Manual request remains available during automatic mode');
  await c.command({ op: 'cancelRemote' });
  assert.equal(s.state.paused, false);
  await c.close();
});

await test('cancelled model warning preserves running state; confirmed change preserves automation and uses new alias', async () => {
  const { s, c, hooks, prompts, models } = await setup();
  await c.command({ op: 'resume' });
  const before = canonical(s.state);
  hooks.confirm = async () => false;
  await c.command({ op: 'configureClaudeModel', model: 'opus' });
  assert.equal(canonical(s.state), before);
  hooks.confirm = async () => true;
  await c.command({ op: 'configureClaudeModel', model: 'opus' });
  assert.equal(s.state.paused, false);
  assert.equal(executionMode(s.state), 'automatic');
  assert.match(prompts.at(-1)!, /Расписание продолжится с новой моделью/);
  due(s);
  c.tick();
  await drain(c);
  assert.deepEqual(models, ['opus', 'opus']);
  await c.close();
});

await test('provider change warns and preserves selected mode; pending preview prevents scheduled racing', async () => {
  const { s, c, models } = await setup();
  await c.command({ op: 'resume' });
  await c.command({ op: 'configureProvider', kind: 'groq' });
  assert.equal(s.state.paused, false);
  due(s);
  const v = await c.command({
    op: 'eureka',
    garden: s.state.gardens[0]!.id,
    requestId: crypto.randomUUID(),
  });
  c.tick();
  await drain(c);
  assert.equal(models.length, 0);
  assert.equal(c.view().remotePreview?.id, v.remotePreview?.id);
  await c.command({ op: 'cancelRemote' });
  c.tick();
  await drain(c);
  assert.equal(models.length, 2);
  await c.close();
});

await test('Pause during a model warning cannot be overwritten by its late confirmation', async () => {
  const { s, c, hooks } = await setup();
  await c.command({ op: 'resume' });
  const entered = gate(),
    answer = gate();
  hooks.confirm = async () => {
    entered.release();
    await answer.promise;
    return true;
  };
  const selecting = c.command({ op: 'configureClaudeModel', model: 'opus' });
  await entered.promise;
  await c.pause();
  answer.release();
  await assert.rejects(selecting, /изменились/);
  assert.equal(s.state.provider?.model, 'sonnet');
  assert.equal(s.state.paused, true);
  await c.close();
});

for (const stage of ['startup', 'dispatch'] as const)
  await test(`Pause during scheduled ${stage} authentication sends nothing`, async () => {
    const { s, c, hooks, models } = await setup('groq');
    await c.command({ op: 'resume' });
    const entered = gate(),
      answer = gate();
    let auth = 0;
    hooks.auth = async () => {
      if (++auth === (stage === 'startup' ? 1 : 2)) {
        entered.release();
        await answer.promise;
      }
    };
    due(s);
    c.tick();
    await entered.promise;
    const stopping = c.pause();
    answer.release();
    await stopping;
    await drain(c);
    assert.equal(models.length, 0);
    assert.equal(s.state.calls.length, 0);
    assert.equal(s.state.nodes.length, 0);
    assert.equal(s.state.gardens[0]!.credits.balance, 3);
    await c.close();
  });

await test('scope changes revoke scheduling, rejected confirmation grants nothing, and restart stays paused', async () => {
  const { s, c, hooks, models } = await setup();
  await c.command({ op: 'resume' });
  s.change((w) => {
    w.gardens[0]!.policy.revision++;
  });
  due(s);
  c.tick();
  await drain(c);
  assert.equal(s.state.paused, true);
  assert.equal(models.length, 0);
  hooks.confirm = async () => false;
  await c.command({ op: 'resume' });
  due(s);
  c.tick();
  assert.equal(models.length, 0);
  hooks.confirm = async () => true;
  await c.command({ op: 'resume' });
  const dir = s.directory;
  await c.close();
  const reopened = new CoherentStore(dir),
    next = new CoherentController(
      reopened,
      {
        pick: async () => [],
        confirm: async () => false,
        saveBackup: async () => true,
        openDirectory: async () => {},
        autostart: () => {},
      },
      [],
    );
  assert.equal(executionMode(reopened.state), 'automatic');
  assert.equal(reopened.state.paused, true);
  next.tick();
  assert.equal(reopened.state.calls.length, 0);
  await next.close();
});

for (const limit of ['backlog', 'calls'] as const)
  await test(`automatic jobs stop at ${limit} limit with eligible new sources and retain the slot`, async () => {
    const { s, c, models } = await setup();
    s.change((w) => {
      w.settings.backlog = limit === 'backlog' ? 1 : 20;
      w.settings.calls = limit === 'calls' ? 2 : 96;
    });
    await c.command({ op: 'resume' });
    due(s);
    c.tick();
    await drain(c);
    assert.equal(models.length, 2);
    await c.command({
      op: 'add',
      garden: s.state.gardens[0]!.id,
      title: 'Fictional later source',
      text: 'Choose a fictional route by paying one mirror token.',
      participating: true,
    });
    due(s);
    c.tick();
    await drain(c);
    assert.equal(models.length, 2);
    assert.equal(s.state.jobs.length, 1);
    assert.equal(s.state.gardens[0]!.credits.balance, 2);
    await c.close();
  });

await test('changed donor policy during credential access is revalidated before dispatch without a timer', async () => {
  const { s, c, hooks, models } = await setup('groq');
  await c.command({ op: 'resume' });
  const entered = gate(),
    answer = gate();
  let auth = 0;
  hooks.auth = async () => {
    if (++auth === 2) {
      entered.release();
      await answer.promise;
    }
  };
  due(s);
  c.tick();
  await entered.promise;
  s.change((w) => {
    w.gardens[0]!.policy.revision++;
  });
  answer.release();
  await drain(c);
  assert.equal(models.length, 0);
  assert.equal(s.state.calls.length, 0);
  assert.equal(s.state.nodes.length, 0);
  await c.close();
});

await test('restore and a forged unpaused imported state cannot grant automatic authority', async () => {
  const { s, c, models } = await setup();
  await c.command({ op: 'resume' });
  const backup = JSON.stringify(s.envelope());
  s.restore(backup);
  assert.equal(s.state.paused, true);
  due(s);
  c.tick();
  assert.equal(models.length, 0);
  await c.pause();
  s.change((w) => {
    w.paused = false;
  });
  c.tick();
  await drain(c);
  assert.equal(s.state.paused, true);
  assert.equal(s.state.jobs.length, 0);
  assert.equal(models.length, 0);
  await c.close();
});

await test('scope changes while a model change drains cannot inherit its earlier confirmation', async () => {
  const { s, c, models } = await setup();
  await c.command({ op: 'resume' });
  const entered = gate(),
    released = gate();
  c.claude.release = async () => {
    entered.release();
    await released.promise;
  };
  const changing = c.command({ op: 'configureClaudeModel', model: 'opus' });
  await entered.promise;
  s.change((w) => {
    w.gardens[0]!.policy.revision++;
  });
  released.release();
  await assert.rejects(changing, /Управление изменилось/);
  assert.equal(s.state.provider?.model, 'sonnet');
  assert.equal(s.state.paused, true);
  assert.equal(models.length, 0);
  await c.close();
});
