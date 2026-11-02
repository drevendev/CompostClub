import type { App } from 'electron';
import { EncryptedCredentialStore } from '../desktop/credentials';
// Opt-in genuine Claude evaluation on a frozen fictional set; never a default test.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { key } from '../src/domain/coherent/prepare';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ClaudeRuntime } from '../desktop/claude-runtime';
import { CoherentController } from '../desktop/coherent-controller';
import { CoherentStore } from '../desktop/coherent-store';
import { create, addSource, prepareJob } from '../src/domain/coherent/workspace';
import {
  generationPrompt,
  parseAssessment,
  schemaForAssessment,
  screeningPrompt,
} from '../src/domain/coherent/contract';
import { canonical, hash } from '../src/domain/coherent/hash';
import type { Candidate } from '../src/domain/coherent/types';

let electronApplication: App | undefined;
async function main() {
  if (!process.argv.includes('--run-genuine-claude'))
    throw new Error(
      'Explicit --run-genuine-claude required; consumes the owner subscription quota.',
    );
  const rawInputs = await readFile('fixtures/public/provider-acceptance.json', 'utf8');
  const inputs = JSON.parse(rawInputs) as {
    version: string;
    maximumCalls: number;
    variants: number;
    cases: {
      id: string;
      language: 'ru' | 'en';
      expected: 'compatible' | 'negative';
      parents: [string, string];
      rubric: string[];
    }[];
  };
  assert.equal(inputs.maximumCalls, 36);
  assert.equal(inputs.variants, 1);
  assert.equal(inputs.cases.length, 10);
  await mkdir('.local', { recursive: true });
  const output = await mkdtemp(path.resolve('.local/provider-genuine-'));
  const profileOption = process.argv.indexOf('--token-profile');
  let tokenStore: EncryptedCredentialStore | undefined;
  if (profileOption >= 0) {
    const profile = process.argv[profileOption + 1];
    if (!profile || !path.isAbsolute(profile))
      throw new Error('An absolute token profile is required.');
    const electron = await import('electron');
    electronApplication = electron.app;
    await electron.app.whenReady();
    tokenStore = new EncryptedCredentialStore(profile, electron.safeStorage, 'claude');
    await tokenStore.initialize();
    if (!tokenStore.has()) throw new Error('Save the setup-token in the isolated preview first.');
  }
  const runtime = new ClaudeRuntime(
    output,
    () => undefined,
    undefined,
    undefined,
    tokenStore,
    tokenStore,
  );
  await runtime.start(); // auth probe only; zero model calls
  const services = {
    pick: async () => [],
    saveBackup: async () => true,
    confirm: async () => true,
    openDirectory: async () => {},
    autostart: () => {},
  };
  const results: unknown[] = [];
  let calls = 0;
  await writeFile(path.join(output, 'frozen-inputs.json'), rawInputs, { flag: 'wx' });
  await writeFile(
    path.join(output, 'protocol.json'),
    JSON.stringify(
      {
        inputSha256: hash(rawInputs),
        provider: 'official Claude Code subscription',
        requestedModel: 'sonnet',
        variants: 1,
        maximumCalls: 36,
        stop: 'One attempt per case; at most three calls per pipeline and two per authored checker probe. No reruns. All outcomes retained. Human semantic review remains separate.',
      },
      null,
      2,
    ),
  );
  for (const item of inputs.cases) {
    assert.ok(calls + 3 <= inputs.maximumCalls);
    const s = new CoherentStore(path.join(output, item.id));
    const now = Date.now(),
      w = create(now, 'Asia/Nicosia'),
      g = w.gardens[0]!;
    g.profile = 'game';
    w.provider = { kind: 'claude', revision: 1 };
    w.settings.language = item.language;
    w.settings.calls = 3;
    item.parents.forEach((text, i) =>
      addSource(w, g.id, 'Fictional source ' + (i + 1), text, true, now),
    );
    s.save(w, false);
    const c = new CoherentController(s, services, [], undefined, undefined, runtime);
    const preview = await c.command({
      op: 'eureka',
      garden: g.id,
      requestId: 'evaluation-' + item.id,
    });
    assert.ok(preview.remotePreview);
    await c.command({ op: 'confirmRemote', previewId: preview.remotePreview.id, consent: true });
    const deadline = Date.now() + 570000;
    while (c.view().busy && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
    if (c.view().busy) {
      await c.pause();
      throw new Error('Evaluation exceeded its bounded job wall clock.');
    }
    const job = s.state.jobs[0]!;
    assert.ok(job.calls.length <= 3);
    calls += job.calls.length;
    results.push({
      id: item.id,
      expected: item.expected,
      rubric: item.rubric,
      stage: job.stage,
      calls: job.calls.length,
      cards: s.state.nodes.length,
      draft: job.draft,
      assessment: job.assessment,
      error: job.primaryFailure,
      humanSemanticReview: 'pending; model pass is not quality',
    });
    await writeFile(
      path.join(output, 'progress.json'),
      JSON.stringify({ calls, maximumCalls: 36, results }, null, 2),
    );
    await c.close();
  }
  // Authored adversarial drafts are sent directly to the checker with explicit
  // provenance. They never become app cards or pretend to be generated results.
  const example = inputs.cases.find((c) => c.id === 'en-kiln')!,
    now = Date.now(),
    w = create(now, 'Asia/Nicosia');
  w.gardens[0]!.profile = 'game';
  w.provider = { kind: 'claude', revision: 1 };
  example.parents.forEach((text, i) =>
    addSource(w, w.gardens[0]!.id, 'Authored checker source ' + i, text, true, now),
  );
  const job = prepareJob(w, w.gardens[0]!.id, 'blend', now);
  job.observed = false;
  const parentContributions = job.parents.map((p) => ({
    parent: key(p),
    text: 'Preserve the exact supplied action and mandatory consequence.',
    evidence: job.pack.evidence
      .filter((e) => e.parent?.id === p.id)
      .map((e) => e.id)
      .slice(0, 1),
  }));
  const base: Candidate = {
    outcome: 'candidate',
    target: 'game',
    title: 'Authored kiln diagnostic',
    summary: 'Manage heat and discard cards to preserve a vase.',
    experience: 'Choose whether the mandatory discard is worth cooling.',
    core: 'The kiln heats by three degrees at each turn end; the vase breaks at nine or above. Cooling by four requires discarding one card.',
    example:
      'At seven degrees, discard a card to cool to three; otherwise the next turn end breaks the vase at ten.',
    interaction: 'Cooling links hand size to the temperature threshold.',
    contributions: parentContributions,
    references: [],
    unknowns: [],
    nextQuestion: 'Is the timing interesting?',
    preservedCore: '',
    delta: '',
    changedAssumption: '',
    test: '',
  };
  const mutations = [
    ['changed-number', base.core.replace('three degrees', 'one degree')],
    [
      'optional-cost',
      base.core.replace(
        'requires discarding one card',
        'may be paid with points instead of discarding',
      ),
    ],
    ['changed-trigger', base.core.replace('nine or above', 'above twelve')],
  ];
  for (const [id, core] of mutations) {
    job.draft = { ...base, core: core! };
    const evidence: unknown[] = [];
    let primaryFailure = '';
    let decision: ReturnType<typeof parseAssessment> | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.ok(calls < 36);
      let dispatched = false;
      const raw = await runtime.generate(
        screeningPrompt(
          job,
          attempt ? 'Return valid assessment JSON; actual supplied evidence IDs only.' : '',
        ),
        schemaForAssessment(job),
        0,
        new AbortController().signal,
        (raw) => {
          evidence.push({ kind: 'genuine CLI transport for authored damaged draft', raw });
          writeFileSync(
            path.join(output, 'checker-' + id + '-' + attempt + '-transport.json'),
            raw,
            {
              flag: 'wx',
            },
          );
        },
        () => {
          calls++;
          writeFileSync(
            path.join(output, 'checker-' + id + '-' + attempt + '-reserved.json'),
            JSON.stringify({ calls, maximumCalls: 36, possibleDispatch: true }),
            { flag: 'wx' },
          );
          dispatched = true;
        },
        { tokens: 2048, timeout: 180000 },
      );
      assert.ok(dispatched);
      evidence.push({ kind: 'genuine model response', raw });
      try {
        decision = parseAssessment(raw, job, Date.now());
        break;
      } catch (error) {
        primaryFailure = String(error);
      }
    }
    results.push({
      id: 'authored-checker-' + id,
      provenance: 'authored adversarial input; no upstream generation',
      draft: job.draft,
      decision,
      primaryFailure,
      semanticFalsePass: decision?.decision === 'pass',
      evidence,
    });
    await writeFile(
      path.join(output, 'progress.json'),
      JSON.stringify({ calls, maximumCalls: 36, results }, null, 2),
    );
  }
  await runtime.release();
  await writeFile(
    path.join(output, 'result.json'),
    JSON.stringify(
      {
        format: 'provider-genuine-evaluation-1',
        inputSha256: hash(rawInputs),
        calls,
        maximumCalls: 36,
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      output,
      calls,
      maximumCalls: 36,
      humanReview: 'required; no automatic quality promotion',
      contract: hash(generationPrompt(job)),
      resultHash: hash(canonical(results)),
    }),
  );
}
void main()
  .then(() => electronApplication?.quit())
  .catch(() => {
    process.stderr.write(
      'Evaluation stopped; inspect retained local evidence. No automatic retry.\n',
    );
    if (electronApplication) electronApplication.exit(1);
    else process.exitCode = 1;
  });
