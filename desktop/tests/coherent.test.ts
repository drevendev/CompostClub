// Async test doubles deliberately implement the real transport Promise contract.
/* eslint @typescript-eslint/require-await: "off" */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { CoherentStore } from '../coherent-store';
import { CoherentController } from '../coherent-controller';
import { DesktopStore } from '../store';
import { OwnedOllama } from '../runtime';
import { exportCoherent, reading } from '../coherent-export';
import type { DesktopServices } from '../controller';
import { fixture, candidate, retain } from '../../tests/coherent-fixtures';
import { commit, counts, dispatch, prepareJob, stage } from '../../src/domain/coherent/workspace';
import { canonical, hash } from '../../src/domain/coherent/hash';
import { current } from '../../src/domain/coherent/prepare';
import type { Job } from '../../src/domain/coherent/types';

const services: DesktopServices = {
  pick: async () => [],
  saveBackup: async () => true,
  confirm: async () => true,
  openDirectory: async () => {},
  autostart: () => {},
};
await test('full lifecycle journal still releases compute and can be explicitly backed up/cleared before a safe exit', async () => {
  const s = await prepared(),
    m = model(s),
    c = new CoherentController(s, services, [], m.runtime);
  s.change((w) => {
    w.lifecycle = Array.from({ length: 12000 }, (_, i) => ({
      id: 'event-' + i,
      session: 'DIAGNOSTIC',
      job: null,
      kind: 'launch' as const,
      at: Date.now(),
      elapsed: 0,
      error: '',
    }));
  });
  await c.pause();
  assert.ok(m.releases() > 0);
  assert.ok(s.emergency.length > 0);
  await c.command({ op: 'cleanupLifecycle' });
  assert.equal(s.emergency.length, 0);
  assert.equal(s.state.lifecycle.length, 0);
  await c.close();
});
await test('rechecking an edited committed revision consumes one call and neither another slot nor candidate allowance', async () => {
  const s = await prepared(),
    m = model(s),
    c = new CoherentController(s, services, [], m.runtime);
  await c.command({ op: 'run', garden: s.state.gardens[0]!.id });
  await wait(c);
  const id = s.state.nodes[0]!.id;
  await c.command({ op: 'editIdea', id, content: { core: 'Human edited mechanism.' } });
  s.change((w) => {
    w.gardens[0]!.credits.balance = 0;
    w.settings.candidates = 1;
  });
  await c.command({ op: 'checkNode', id });
  await wait(c);
  assert.equal(m.calls(), 3);
  assert.equal(s.state.nodes.length, 1);
  assert.equal(s.state.gardens[0]!.credits.balance, 0);
  assert.equal(counts(s.state, Date.now()).candidates, 1);
  assert.equal(s.state.nodes[0]!.revisions.at(-1)!.assessment?.decision, 'pass');
  await c.close();
});
await test('targeted model revisions preserve earlier reference snapshots and disclose new locally observed evidence after import', async () => {
  const s = await prepared(),
    m = model(s, (j, i) =>
      i % 2 === 0
        ? JSON.stringify(candidate(j))
        : JSON.stringify({ decision: 'pass', findings: [], limitations: 'DIAGNOSTIC' }),
    ),
    c = new CoherentController(s, services, [], m.runtime),
    g = s.state.gardens[0]!.id,
    source = s.state.sources[0]!.id;
  await c.command({
    op: 'reference',
    source,
    name: 'Fictional reference',
    url: 'https://example.invalid/',
    property: 'Original supplied property.',
    differ: 'New proposal.',
    status: 'user-confirmed property',
    essential: false,
    spans: [],
  });
  await c.command({ op: 'run', garden: g });
  await wait(c);
  const n = s.state.nodes[0]!,
    id = n.id,
    rid = s.state.references[0]!.id,
    oldJob = n.job;
  s.change((w) => {
    w.nodes[0]!.imported = true;
    w.jobs[0]!.observed = false;
  });
  await c.command({
    op: 'reference',
    source,
    referenceId: rid,
    name: 'Fictional reference',
    url: 'https://example.invalid/',
    property: 'Updated supplied property.',
    differ: 'New proposal.',
    status: 'user-confirmed property',
    essential: false,
    spans: [],
  });
  await c.command({
    op: 'revise',
    garden: g,
    parents: n.parents,
    previousJob: oldJob,
    previousNode: id,
    previousRevision: 1,
    question: 'Clarify the concrete consequence.',
  });
  await wait(c);
  assert.equal(s.state.nodes.length, 1);
  assert.equal(s.state.nodes[0]!.revisions.length, 2);
  assert.equal(s.state.nodes[0]!.references[0]!.property, 'Original supplied property.');
  assert.equal(
    s.state.nodes[0]!.revisions[1]!.references![0]!.property,
    'Updated supplied property.',
  );
  assert.notEqual(s.state.nodes[0]!.revisions[1]!.job, oldJob);
  assert.match(reading(s.state, 'all')[0]!.text, /Observed local inference/);
  assert.equal(s.state.consumed.length, 1);
  assert.equal(s.state.jobs.at(-1)!.targetRevision?.revision, 1);
  assert.ok(s.state.jobs.at(-1)!.pack.payload.includes('omittedDraftFields'));
  await c.close();
});
await test('rechecking an unchanged restored local draft uses a fresh authorized pack and retains the earlier observations', async () => {
  const s = await prepared(),
    m = model(s, (j, i) =>
      i === 0
        ? JSON.stringify(candidate(j))
        : JSON.stringify({
            decision: 'needs_revision',
            findings: [{ field: 'core', issue: 'DIAGNOSTIC', evidence: ['e0'], missing: '' }],
            limitations: 'DIAGNOSTIC',
          }),
    ),
    c = new CoherentController(s, services, [], m.runtime);
  await c.command({ op: 'run', garden: s.state.gardens[0]!.id });
  await wait(c);
  const raw = JSON.stringify(s.envelope()),
    oldId = s.state.jobs[0]!.id;
  s.restore(raw);
  await c.command({ op: 'check', id: oldId });
  await wait(c);
  assert.equal(s.state.jobs.length, 2);
  assert.equal(s.state.jobs[1]!.calls.length, 1);
  assert.equal(s.state.jobs[0]!.observed, false);
  assert.equal(s.state.jobs[1]!.observed, true);
  await c.close();
});

await test('a new negative assessment of an existing card is attached without replacing its original assessment or human decisions', async () => {
  const s = await prepared(),
    m = model(s, (j, i) =>
      i === 0
        ? JSON.stringify(candidate(j))
        : i === 1
          ? JSON.stringify({ decision: 'pass', findings: [], limitations: 'DIAGNOSTIC initial' })
          : JSON.stringify({
              decision: 'needs_revision',
              findings: [
                { field: 'core', issue: 'DIAGNOSTIC new finding', evidence: ['e0'], missing: '' },
              ],
              limitations: 'DIAGNOSTIC later',
            }),
    ),
    c = new CoherentController(s, services, [], m.runtime);
  await c.command({ op: 'run', garden: s.state.gardens[0]!.id });
  await wait(c);
  const n = s.state.nodes[0]!,
    before = canonical(n.decisions),
    old = canonical(n.revisions[0]!.assessment);
  await c.command({ op: 'checkNode', id: n.id });
  await wait(c);
  const r = s.state.nodes[0]!.revisions[0]!;
  assert.equal(r.assessment!.decision, 'needs_revision');
  assert.ok(r.assessments!.some((a) => canonical(a) === old));
  assert.equal(canonical(s.state.nodes[0]!.decisions), before);
  assert.equal(s.state.nodes.length, 1);
  assert.equal(m.calls(), 3);
  await c.close();
});
await test('purging job evidence rolls back together with receipt deletion and never refunds calls', async () => {
  const s = await prepared(),
    m = model(s, () => JSON.stringify({ outcome: 'no_blend', reason: 'DIAGNOSTIC', missing: [] })),
    c = new CoherentController(s, services, [], m.runtime);
  await c.command({ op: 'run', garden: s.state.gardens[0]!.id });
  await wait(c);
  const id = s.state.jobs[0]!.id;
  s.db.exec(
    "CREATE TRIGGER fail_receipt_purge BEFORE DELETE ON receipts BEGIN SELECT RAISE(ABORT,'DIAGNOSTIC deletion failure'); END;",
  );
  await assert.rejects(c.command({ op: 'purgeJob', id }));
  assert.equal(s.state.jobs.length, 1);
  assert.equal(s.receipts().length, 2);
  s.db.exec('DROP TRIGGER fail_receipt_purge');
  await c.command({ op: 'purgeJob', id });
  assert.equal(s.state.jobs.length, 0);
  assert.equal(s.receipts().length, 0);
  assert.equal(s.state.calls.length, 1);
  await c.close();
});
async function store() {
  await mkdir('.local', { recursive: true });
  const dir = await mkdtemp(path.resolve('.local/coherent-diagnostic-'));
  return new CoherentStore(dir);
}
async function wait(c: CoherentController) {
  for (let i = 0; i < 2000; i++) {
    if (!c.view().busy) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('Diagnostic job failed to drain.');
}
function model(
  s: CoherentStore,
  responses: (j: Job, index: number) => string = (j, i) =>
    i === 0
      ? JSON.stringify(candidate(j))
      : JSON.stringify({
          decision: 'pass',
          findings: [],
          limitations: 'DIAGNOSTIC ONLY; no live-model claim.',
        }),
  delay = 0,
) {
  let calls = 0,
    releases = 0,
    running = false;
  const runtime = {
    get running() {
      return running;
    },
    get pid() {
      return undefined;
    },
    digest: 'DIAGNOSTIC',
    start: async () => {
      running = true;
      return { model: 'gemma3:4b', digest: 'DIAGNOSTIC' };
    },
    release: async () => {
      running = false;
      releases++;
    },
    generate: async (
      _p: string,
      _f: unknown,
      _seed: number,
      signal: AbortSignal,
      onTransport: (raw: string) => void,
      before: () => void,
    ) => {
      before();
      const index = calls++;
      if (delay)
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, delay);
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(t);
              reject(new Error('DIAGNOSTIC cancellation'));
            },
            { once: true },
          );
        });
      const j = s.state.jobs.at(-1)!;
      const raw = responses(j, index);
      onTransport(JSON.stringify({ diagnostic: true, response: raw }));
      return raw;
    },
  };
  return {
    runtime: runtime as unknown as OwnedOllama,
    calls: () => calls,
    releases: () => releases,
  };
}
async function prepared() {
  const s = await store();
  s.save(fixture(Date.now()), false);
  return s;
}

await test('Eureka is a durable one-off authorization while paused and excluded from scheduling; duplicates and restart never dispatch twice', async () => {
  const s = await prepared(),
    m = model(s),
    c = new CoherentController(s, services, [], m.runtime),
    gid = s.state.gardens[0]!.id;
  const command = { op: 'eureka', garden: gid, requestId: 'diagnostic-durable-one-off' };
  await Promise.all([c.command(command), c.command(command)]);
  await wait(c);
  assert.equal(m.calls(), 2);
  assert.equal(s.state.paused, true);
  assert.equal(s.state.gardens[0]!.background, false);
  assert.equal(s.state.jobs[0]!.trigger, 'eureka');
  assert.equal(s.state.jobs[0]!.plan.manual, false);
  assert.equal(s.state.requests![0]!.state, 'settled');
  assert.equal(s.state.nodes.length, 1);
  assert.equal(s.state.gardens[0]!.credits.balance, 2);
  await assert.rejects(c.command({ ...command, garden: 'other' }), /Конфликт/);
  const directory = s.directory;
  await c.close();
  const reopened = new CoherentStore(directory),
    nextModel = model(reopened),
    next = new CoherentController(reopened, services, [], nextModel.runtime);
  await next.command(command);
  await next.command({ op: 'requestState', requestId: command.requestId });
  assert.equal(nextModel.calls(), 0);
  assert.equal(reopened.state.nodes.length, 1);
  assert.equal(reopened.state.calls.length, 2);
  await next.close();
});

await test('Eureka preflight refuses a blocked full job with no runtime start and persists the same route', async () => {
  const s = await prepared(),
    m = model(s),
    c = new CoherentController(s, services, [], m.runtime),
    gid = s.state.gardens[0]!.id;
  s.change((w) => {
    w.gardens[0]!.objective = 'Ю'.repeat(1000);
  });
  for (const requestId of ['blocked-1', 'blocked-2'])
    await c.command({ op: 'eureka', garden: gid, requestId });
  assert.equal(s.state.jobs.length, 0);
  assert.equal(m.calls(), 0);
  assert.equal(m.releases(), 0);
  assert.equal(s.state.requests!.length, 2);
  assert.match(s.state.requests![0]!.reason, /admission:/);
  const planId = s.state.gardens[0]!.plan!.id;
  s.change((w) => {
    w.paused = false;
    w.gardens[0]!.background = true;
    w.gardens[0]!.nextAt = 0;
  });
  for (let i = 0; i < 10; i++) c.tick();
  assert.equal(s.state.gardens[0]!.plan!.id, planId);
  assert.equal(m.calls(), 0);
  await c.close();
});

await test('due admission blocks are visible, do not spin, and re-evaluate the same frozen pair after a real condition change', async () => {
  const s = await prepared(),
    m = model(s),
    c = new CoherentController(s, services, [], m.runtime);
  s.change((w) => {
    w.paused = false;
    const g = w.gardens[0]!;
    g.background = true;
    g.nextAt = 0;
    g.objective = 'Ю'.repeat(1000);
  });
  let updates = 0;
  c.subscribe(() => updates++);
  c.tick();
  const frozen = structuredClone(s.state.gardens[0]!.plan!);
  assert.match(c.view().reason, /admission:/);
  assert.ok(updates > 0);
  const revision = s.state.revision;
  for (let i = 0; i < 5; i++) c.tick();
  assert.equal(s.state.revision, revision);
  assert.equal(m.calls(), 0);
  s.change((w) => {
    w.gardens[0]!.objective = '';
  });
  c.tick();
  await wait(c);
  assert.equal(s.state.jobs[0]!.trigger, 'scheduled');
  assert.equal(s.state.jobs[0]!.plan.id, frozen.id);
  assert.deepEqual(s.state.jobs[0]!.parents, frozen.parents);
  assert.equal(m.calls(), 2);
  await c.close();
});

await test('a historical admission fingerprint is re-evaluated without replacing its frozen route', async () => {
  const s = await prepared(),
    m = model(s),
    c = new CoherentController(s, services, [], m.runtime);
  s.change((w) => {
    w.paused = false;
    const g = w.gardens[0]!;
    g.background = true;
    g.nextAt = 0;
    g.plan = null;
  });
  // A no-dispatch preflight persists a plan; emulate the old version's fingerprint only.
  s.change((w) => {
    const j = prepareJob(w, w.gardens[0]!.id, 'blend', Date.now(), { manual: false });
    w.jobs.pop();
    w.gardens[0]!.plan = {
      ...j.plan,
      blocked: { fingerprint: 'previous-admission-contract', reason: 'admission: old budget' },
    };
  });
  const frozen = structuredClone(s.state.gardens[0]!.plan!);
  c.tick();
  await wait(c);
  assert.equal(s.state.jobs.at(-1)!.plan.id, frozen.id);
  assert.deepEqual(s.state.jobs.at(-1)!.parents, frozen.parents);
  assert.equal(m.calls(), 2);
  await c.close();
});

await test('checking the original committed job targets its exact existing revision without another credit or duplicate card', async () => {
  const s = await prepared(),
    m = model(s),
    c = new CoherentController(s, services, [], m.runtime);
  await c.command({ op: 'run', garden: s.state.gardens[0]!.id });
  await wait(c);
  const original = s.state.jobs[0]!,
    node = s.state.nodes[0]!,
    credits = s.state.gardens[0]!.credits.balance;
  await c.command({ op: 'check', id: original.id });
  await wait(c);
  assert.equal(s.state.nodes.length, 1);
  assert.equal(s.state.nodes[0]!.id, node.id);
  assert.equal(s.state.consumed.length, 1);
  assert.equal(s.state.gardens[0]!.credits.balance, credits);
  assert.equal(m.calls(), 3);
  assert.equal(s.state.jobs.at(-1)!.targetRevision!.revision, 1);
  await c.close();
});

await test('resume preserves schedule membership and cannot clear a storage/evidence blocker', async () => {
  const s = await prepared(),
    m = model(s),
    c = new CoherentController(s, services, [], m.runtime),
    gid = s.state.gardens[0]!.id;
  await assert.rejects(c.command({ op: 'resume' }), /ни один сад/);
  s.change((w) => {
    w.gardens[0]!.background = true;
    w.attention = 'Persistence attention: DIAGNOSTIC';
  });
  await assert.rejects(c.command({ op: 'resume' }), /Продолжение/);
  assert.equal(s.state.attention, 'Persistence attention: DIAGNOSTIC');
  assert.equal(m.calls(), 0);
  await c.command({ op: 'clearAttention' });
  await c.command({ op: 'resume' });
  assert.equal(s.state.gardens[0]!.id, gid);
  assert.equal(s.state.gardens[0]!.background, true);
  assert.equal(m.calls(), 0);
  await c.close();
});

await test('schema-3 SQLite transaction survives reopen, retaining exact originals and paused launch', async () => {
  const s = await prepared(),
    dir = s.directory,
    original = s.state.sources[0]!.revisions[0]!.text;
  s.close();
  const next = new CoherentStore(dir);
  assert.equal(next.state.sources[0]!.revisions[0]!.text, original);
  assert.equal(next.state.paused, true);
  next.close();
});
await test('v2 migration preserves a consistent validated rollback envelope and source participation', async () => {
  await mkdir('.local', { recursive: true });
  const dir = await mkdtemp(path.resolve('.local/coherent-migrate-'));
  const old = new DesktopStore(dir);
  old.change((w) => {
    w.settings.dailyCalls = 6;
    w.settings.intervalMinutes = 120;
  });
  const raw = JSON.stringify(old.envelope());
  old.close();
  const next = new CoherentStore(dir);
  assert.equal(next.state.schemaVersion, 3);
  assert.equal(next.state.settings.calls, 6);
  assert.equal(next.state.gardens[0]!.interval, 120);
  const backup = next.backups().find((b) => b.reason.startsWith('Before schema-3'));
  assert.ok(backup);
  const rollback = JSON.parse(next.backupRaw(backup.id)) as {
    schemaVersion: number;
    workspace: unknown;
  };
  assert.equal(rollback.schemaVersion, 2);
  assert.deepEqual(rollback.workspace, (JSON.parse(raw) as { workspace: unknown }).workspace);
  next.close();
});
await test('two writers cannot replace a newer workspace; compare-and-swap occurs inside transaction', async () => {
  const a = await prepared(),
    b = new CoherentStore(a.directory);
  assert.throws(
    () =>
      a.change((w) => {
        w.gardens[0]!.name = 'Stale writer';
      }),
    /changed/,
  );
  assert.notEqual(b.state.gardens[0]!.name, 'Stale writer');
  a.close();
  b.close();
});
await test('synthetic two-stage pipeline charges 2 calls and one candidate without enabling background', async () => {
  const s = await prepared(),
    m = model(s),
    c = new CoherentController(s, services, [], m.runtime);
  await c.command({ op: 'run', garden: s.state.gardens[0]!.id });
  await wait(c);
  assert.equal(m.calls(), 2);
  assert.equal(s.state.nodes.length, 1);
  assert.equal(s.state.calls.length, 2);
  assert.equal(s.state.gardens[0]!.credits.balance, 2);
  assert.equal(s.state.paused, true);
  assert.equal(s.state.jobs[0]!.raw.length, 2);
  assert.equal(s.receipts().length, 4);
  assert.ok(m.releases() > 0);
  await c.close();
});
await test('one remaining call refuses two-stage generation before model startup or attempt charge', async () => {
  const s = await prepared();
  s.change((w) => {
    w.settings.calls = 1;
  });
  const m = model(s),
    c = new CoherentController(s, services, [], m.runtime);
  await assert.rejects(c.command({ op: 'run', garden: s.state.gardens[0]!.id }), /Waiting for 2/);
  assert.equal(m.calls(), 0);
  assert.equal(s.state.jobs.length, 0);
  assert.equal(counts(s.state, Date.now()).attempts, 0);
  await c.close();
});
await test('malformed primary across the accounting date keeps its validation cause and counts exactly one failed job', async () => {
  const actualNow = Date.now;
  let now = Date.UTC(2026, 9, 25, 20, 59, 59);
  Date.now = () => now;
  try {
    const s = await prepared(),
      m = model(s, () => {
        now += 86400000;
        return '{"outcome":"no_blend","reason":"DIAGNOSTIC","missing":[],"illegal":true}';
      }),
      c = new CoherentController(s, services, [], m.runtime);
    await c.command({ op: 'run', garden: s.state.gardens[0]!.id });
    await wait(c);
    assert.equal(m.calls(), 1);
    assert.equal(s.state.calls.length, 1);
    assert.equal(s.state.failures, 1);
    assert.equal(s.state.jobs[0]!.stage, 'failed');
    assert.match(s.state.jobs[0]!.primaryFailure, /fields/);
    assert.match(s.state.jobs[0]!.repairRefusal, /Accounting date/);
    await c.close();
  } finally {
    Date.now = actualNow;
  }
});
await test('malformed negative at two-call budget preserves primary error, repair refusal and one failure', async () => {
  const s = await prepared();
  s.change((w) => {
    w.settings.calls = 2;
  });
  const m = model(s, () =>
      JSON.stringify({
        outcome: 'no_blend',
        reason: 'DIAGNOSTIC',
        missing: [],
        title: 'Illegal extra field',
      }),
    ),
    c = new CoherentController(s, services, [], m.runtime);
  await c.command({ op: 'run', garden: s.state.gardens[0]!.id });
  await wait(c);
  const j = s.state.jobs[0]!;
  assert.equal(m.calls(), 1);
  assert.match(j.primaryFailure, /fields/);
  assert.match(j.repairRefusal, /unavailable/);
  assert.equal(s.state.failures, 1);
  assert.equal(s.state.nodes.length, 0);
  assert.equal(s.state.gardens[0]!.credits.balance, 3);
  assert.equal(s.receipts().length, 2);
  await c.close();
});
await test('valid terminal negative uses no checker, keeps credit and does not increment operational failures', async () => {
  const s = await prepared(),
    m = model(s, () =>
      JSON.stringify({ outcome: 'no_blend', reason: 'DIAGNOSTIC incompatibility', missing: [] }),
    ),
    c = new CoherentController(s, services, [], m.runtime);
  await c.command({ op: 'run', garden: s.state.gardens[0]!.id });
  await wait(c);
  assert.equal(m.calls(), 1);
  assert.equal(s.state.jobs[0]!.stage, 'negative');
  assert.equal(s.state.failures, 0);
  assert.equal(s.state.gardens[0]!.credits.balance, 3);
  assert.equal(s.state.jobs[0]!.heldCalls, 0);
  await c.close();
});
await test('one repair is shared; malformed generator followed by valid draft and valid checker uses exactly 3 calls', async () => {
  const s = await prepared(),
    m = model(s, (j, i) =>
      i === 0
        ? 'INVALID DIAGNOSTIC RAW'
        : i === 1
          ? JSON.stringify(candidate(j))
          : JSON.stringify({ decision: 'pass', findings: [], limitations: 'DIAGNOSTIC' }),
    ),
    c = new CoherentController(s, services, [], m.runtime);
  await c.command({ op: 'run', garden: s.state.gardens[0]!.id });
  await wait(c);
  assert.equal(m.calls(), 3);
  assert.equal(s.state.nodes.length, 1);
  assert.equal(s.state.jobs[0]!.repairUsed, true);
  assert.equal(s.state.jobs[0]!.raw[0]!.raw, 'INVALID DIAGNOSTIC RAW');
  await c.close();
});
await test('malformed checker consumes the one optional format repair without rerunning generation', async () => {
  const s = await prepared(),
    m = model(s, (j, i) =>
      i === 0
        ? JSON.stringify(candidate(j))
        : i === 1
          ? 'INVALID CHECKER'
          : JSON.stringify({ decision: 'pass', findings: [], limitations: 'DIAGNOSTIC' }),
    ),
    c = new CoherentController(s, services, [], m.runtime);
  await c.command({ op: 'run', garden: s.state.gardens[0]!.id });
  await wait(c);
  assert.equal(m.calls(), 3);
  assert.deepEqual(
    s.state.calls.map((c) => c.stage),
    ['generating', 'screening', 'screening:repair'],
  );
  assert.equal(s.state.nodes.length, 1);
  await c.close();
});
await test('screened-out draft is retained separately and human override atomically commits once', async () => {
  const s = await prepared(),
    m = model(s, (j, i) =>
      i === 0
        ? JSON.stringify(candidate(j))
        : JSON.stringify({
            decision: 'needs_revision',
            findings: [
              { field: 'core', issue: 'DIAGNOSTIC false negative', evidence: ['e0'], missing: '' },
            ],
            limitations: 'DIAGNOSTIC',
          }),
    ),
    c = new CoherentController(s, services, [], m.runtime);
  await c.command({ op: 'run', garden: s.state.gardens[0]!.id });
  await wait(c);
  assert.equal(s.state.nodes.length, 0);
  assert.equal(s.state.jobs[0]!.stage, 'needs_revision');
  const jid = s.state.jobs[0]!.id;
  await c.command({ op: 'override', id: jid });
  assert.equal(s.state.nodes.length, 1);
  assert.equal(s.state.nodes[0]!.decisions[0]!.override, true);
  assert.equal(s.state.gardens[0]!.credits.balance, 2);
  await assert.rejects(c.command({ op: 'override', id: jid }));
  await c.close();
});
await test('pause during generation drains, releases runtime, invalidates permit and prevents late commit', async () => {
  const s = await prepared(),
    m = model(s, undefined, 5000),
    c = new CoherentController(s, services, [], m.runtime);
  await c.command({ op: 'run', garden: s.state.gardens[0]!.id });
  for (let i = 0; i < 100 && !m.calls(); i++) await new Promise((r) => setTimeout(r, 5));
  await c.pause();
  assert.equal(c.view().busy, false);
  assert.equal(m.runtime.running, false);
  assert.equal(s.state.nodes.length, 0);
  assert.equal(s.state.jobs[0]!.stage, 'cancelled');
  assert.equal(s.state.calls.length, 1);
  assert.ok(s.state.lifecycle.some((e) => e.kind === 'release confirmed'));
  assert.equal(s.state.jobs[0]!.manualPermit, false);
  await c.close();
});
await test('receipt write failure retains raw response in emergency memory and blocks unsafe exit', async () => {
  const s = await prepared(),
    m = model(s),
    c = new CoherentController(s, services, [], m.runtime);
  const original = s.receipt.bind(s);
  s.receipt = (job, phase, raw) => {
    s.db.exec('PRAGMA query_only=ON');
    return original(job, phase, raw);
  };
  await c.command({ op: 'run', garden: s.state.gardens[0]!.id });
  await wait(c);
  assert.ok(s.emergency.length > 0);
  assert.ok(s.emergency.some((r) => r.raw.includes('Tide debts')));
  assert.equal(s.state.nodes.length, 0);
  assert.equal(m.runtime.running, false);
  await assert.rejects(c.close());
  s.db.exec('PRAGMA query_only=OFF');
  let saved = '';
  const recovery = new CoherentController(
    s,
    {
      ...services,
      saveBackup: async (raw) => {
        saved = raw;
        return true;
      },
    },
    [],
    m.runtime,
  );
  await recovery.command({ op: 'backup' });
  assert.ok(saved.includes('Tide debts'));
  assert.equal(s.emergency.length, 0);
  await recovery.close();
});
await test('read-only lifecycle journal does not prevent abort or owned-model release; evidence gap is exportable', async () => {
  const s = await prepared(),
    m = model(s),
    c = new CoherentController(s, services, [], m.runtime);
  s.db.exec('PRAGMA query_only=ON');
  await assert.rejects(c.pause());
  assert.ok(m.releases() > 0);
  assert.ok(s.emergency.some((r) => r.phase === 'lifecycle-gap'));
  assert.equal(c.view().status, 'attention');
  await assert.rejects(c.command({ op: 'run', garden: s.state.gardens[0]!.id }));
  s.db.exec('PRAGMA query_only=OFF');
  await c.command({ op: 'backup' });
  await c.close();
});
await test('invalid restore is rejected before replacement; calls, timezone and installation paths cannot be refunded', async () => {
  const s = await prepared(),
    now = Date.now();
  s.change((w) => {
    const j = prepareJob(w, w.gardens[0]!.id, 'blend', now);
    dispatch(w, j.id, 'generating', now);
    stage(j, 'failed', now);
    j.heldCalls = 0;
    j.creditHeld = false;
    w.runtime.executable = 'C:\\installed\\ollama.exe';
    w.runtime.models = 'C:\\installed\\models';
  });
  const original = JSON.stringify(s.state);
  const bad = s.envelope();
  bad.workspace = structuredClone(bad.workspace);
  bad.workspace.schemaVersion = 99 as 3;
  assert.throws(() => s.restore(JSON.stringify(bad)));
  assert.equal(JSON.stringify(s.state), original);
  const clean = await store();
  const raw = JSON.stringify(clean.envelope());
  clean.close();
  s.restore(raw);
  assert.equal(s.state.calls.length, 1);
  assert.equal(s.state.runtime.executable, 'C:\\installed\\ollama.exe');
  assert.equal(s.state.paused, true);
  assert.ok(
    s.state.gardens.every((g) => g.policy.probability === 0 && !g.policy.donate && !g.background),
  );
  assert.equal(counts(s.state, Date.now()).attempts, 1);
  s.close();
});
await test('forged call ID/date conflicts cannot lower accounting on restore', async () => {
  const s = await prepared(),
    now = Date.now();
  s.change((w) => {
    const j = prepareJob(w, w.gardens[0]!.id, 'blend', now);
    dispatch(w, j.id, 'generating', now);
    j.heldCalls = 0;
    j.creditHeld = false;
    stage(j, 'failed', now);
  });
  const envelope = structuredClone(s.envelope());
  envelope.workspace.calls[0]!.date = '2020-01-01';
  assert.throws(() => s.restore(JSON.stringify(envelope)), /Conflicting/);
  assert.notEqual(s.state.calls[0]!.date, '2020-01-01');
  s.close();
});
await test('import previews keep same-title distinct text, exact-match choices, complete original bytes and no inference', async () => {
  const s = await prepared(),
    m = model(s),
    c = new CoherentController(s, services, [], m.runtime),
    g = s.state.gardens[0]!.id;
  await c.command({
    op: 'pasteImport',
    garden: g,
    text: '## Whole original\n\n[Label](relative.md) and <script>untrusted()</script>',
  });
  const preview = c.view().preview!;
  assert.equal(preview.items.length, 1);
  assert.equal(m.calls(), 0);
  await c.command({
    op: 'acceptImport',
    id: preview.id,
    choices: ['new-copy'],
    participating: false,
  });
  const imported = s.state.sources.at(-1)!,
    doc = s.state.documents[0]!;
  assert.equal(current(imported).text, doc.text);
  assert.equal(Buffer.from(doc.bytesBase64, 'base64').toString('utf8'), doc.text);
  await c.command({ op: 'pasteImport', garden: g, text: doc.text });
  assert.equal(c.view().preview!.items[0]!.duplicate, 'exact');
  await c.command({
    op: 'acceptImport',
    id: c.view().preview!.id,
    choices: ['skip'],
    participating: false,
  });
  assert.equal(s.state.documents.length, 1);
  assert.equal(m.calls(), 0);
  await c.close();
});
await test('reading scopes redact original texts, exact notes, IDs and context hashes; full backup retains them', async () => {
  const s = await prepared(),
    now = Date.now();
  s.change((w) => {
    const j = prepareJob(w, w.gardens[0]!.id, 'blend', now);
    retain(j);
    const n = commit(w, j.id, now);
    n.accepted = true;
    n.decisions[0]!.state = 'kept';
    n.decisions[0]!.state = 'kept';
    n.decisions[0]!.note = 'DIAGNOSTIC PRIVATE NOTE';
  });
  const text = reading(s.state)
    .map((f) => f.text)
    .join('\n');
  assert.ok(text.includes('Tide debts'));
  assert.ok(!text.includes(s.state.sources[0]!.revisions[0]!.text));
  assert.ok(!text.includes('DIAGNOSTIC PRIVATE NOTE'));
  assert.ok(!text.includes(s.state.sources[0]!.id));
  assert.ok(!text.includes(s.state.jobs[0]!.pack.hash));
  assert.ok(JSON.stringify(s.envelope()).includes('DIAGNOSTIC PRIVATE NOTE'));
  assert.equal(reading(s.state, 'filtered').length, 0);
  s.close();
});
await test('Codex export publishes immutable verified manifest/current, preserves independent analysis and refuses foreign folder', async () => {
  const s = await prepared(),
    now = Date.now(),
    dir = await mkdtemp(path.resolve('.local/coherent-export-'));
  s.change((w) => {
    const j = prepareJob(w, w.gardens[0]!.id, 'blend', now);
    retain(j);
    const n = commit(w, j.id, now);
    n.accepted = true;
    n.decisions[0]!.state = 'kept';
    w.exportDirectory = dir;
  });
  const first = await exportCoherent(s.state, []);
  await writeFile(path.join(dir, 'analysis/owner.md'), 'Independent diagnostic note');
  const second = await exportCoherent(s.state, []);
  assert.notEqual(first.generation, second.generation);
  const pointer = JSON.parse(await readFile(path.join(dir, 'CURRENT.json'), 'utf8')) as {
      manifest: string;
      generation: string;
      sha256: string;
    },
    raw = await readFile(path.join(dir, pointer.manifest), 'utf8');
  assert.equal(pointer.sha256, hash(raw));
  const manifest = JSON.parse(raw) as { files: Record<string, string> };
  for (const [name, h] of Object.entries(manifest.files))
    assert.equal(
      hash(await readFile(path.join(dir, 'snapshots', pointer.generation, name), 'utf8')),
      h,
    );
  assert.equal(
    await readFile(path.join(dir, 'analysis/owner.md'), 'utf8'),
    'Independent diagnostic note',
  );
  assert.ok((await readdir(path.join(dir, 'snapshots'))).includes(first.generation));
  const foreign = await mkdtemp(path.resolve('.local/coherent-foreign-'));
  await writeFile(path.join(foreign, 'owner.txt'), 'Do not overwrite.');
  s.change((w) => {
    w.exportDirectory = foreign;
  });
  await assert.rejects(exportCoherent(s.state, []));
  s.close();
});
await test('shutdown preparation is durable only after confirmed release, and next launch never invents OS exit time', async () => {
  const s = await prepared(),
    m = model(s),
    c = new CoherentController(s, services, [], m.runtime),
    dir = s.directory;
  await c.close();
  const next = new CoherentStore(dir),
    events = next.state.lifecycle;
  assert.ok(
    events.findIndex((e) => e.kind === 'release confirmed') <
      events.findIndex((e) => e.kind === 'shutdown prepared'),
  );
  assert.equal(next.state.paused, true);
  assert.ok(events.every((e) => !canonical(e).includes('Tide debts')));
  assert.ok(events.every((e) => !('osExitAt' in e)));
  next.close();
});
