// Explicit, bounded real subscription evaluation. No visible window is created.
import { app, safeStorage } from 'electron';
import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ClaudeRuntime } from '../desktop/claude-runtime';
import { EncryptedCredentialStore } from '../desktop/credentials';
import { CoherentController } from '../desktop/coherent-controller';
import { CoherentStore } from '../desktop/coherent-store';
import { createDesktopObserver } from '../desktop/telemetry';
import { createObserver } from '../server/observability.mjs';
import { create, addSource } from '../src/domain/coherent/workspace';
import { hash } from '../src/domain/coherent/hash';

const args = process.argv.slice(2),
  option = (name: string) => {
    const at = args.indexOf(name);
    return at < 0 ? '' : (args[at + 1] ?? '');
  };
let output = '';
const helperProfile = option('--helper-profile');
if (helperProfile && path.isAbsolute(helperProfile)) {
  app.setName('Compost Club');
  app.setPath('userData', helperProfile);
}
async function main() {
  if (!args.includes('--run-genuine-claude'))
    throw new Error('Explicit genuine opt-in is required.');
  const profile = option('--token-profile'),
    executable = option('--claude-executable');
  if (!path.isAbsolute(profile) || !path.isAbsolute(executable))
    throw new Error('Explicit profile and native executable paths required.');
  const file = path.resolve('fixtures/public/claude-model-acceptance.json');
  const raw = await readFile(file, 'utf8');
  const protocol = JSON.parse(raw) as {
    version: string;
    fictional: boolean;
    variantsPerModel: number;
    models: string[];
    maximumCallsPerModel: number;
    maximumCalls: number;
    language: 'ru';
    parents: string[];
  };
  assert.equal(protocol.fictional, true);
  assert.equal(protocol.variantsPerModel, 1);
  assert.equal(protocol.maximumCallsPerModel, 3);
  assert.equal(protocol.maximumCalls, 9);
  assert.deepEqual(protocol.models, ['haiku', 'sonnet', 'opus']);
  assert.equal(protocol.parents.length, 2);
  const priorFile = option('--haiku-regression-after');
  let priorCalls = 0,
    priorHash = '';
  if (priorFile) {
    const priorBytes = await readFile(priorFile);
    const prior = JSON.parse(priorBytes.toString('utf8')) as {
      inputSha256: string;
      totalCalls: number;
      results: { requestedModel: string; stage: string }[];
    };
    assert.equal(prior.inputSha256, hash(raw));
    assert.equal(prior.totalCalls, 6);
    assert.equal(prior.results.find((r) => r.requestedModel === 'haiku')?.stage, 'failed');
    priorCalls = prior.totalCalls;
    priorHash = hash(priorBytes);
  }
  await mkdir('.local', { recursive: true });
  output = await mkdtemp(path.resolve('.local/claude-model-genuine-'));
  await app.whenReady();
  const tokenStore = new EncryptedCredentialStore(profile, safeStorage, 'claude');
  await tokenStore.initialize();
  if (!tokenStore.has()) throw new Error('The selected preview has no protected setup-token.');
  const configuration = option('--telemetry-config');
  const delivery: { status: number; at: number }[] = [];
  let observerDirectory = output;
  if (configuration) {
    const info = await lstat(configuration);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 16384)
      throw new Error('Invalid operator telemetry configuration.');
    await writeFile(
      path.join(output, 'operator-telemetry.private.json'),
      await readFile(configuration),
      { flag: 'wx' },
    );
    observerDirectory = output;
  }
  const observer = await createDesktopObserver(observerDirectory, {}, (options) =>
    createObserver({
      ...options,
      onDelivery: (status) => {
        delivery.push({ status, at: Date.now() });
      },
    }),
  );
  await writeFile(path.join(output, 'frozen-inputs.json'), raw, { flag: 'wx' });
  await writeFile(
    path.join(output, 'protocol.json'),
    JSON.stringify(
      {
        inputSha256: hash(raw),
        version: protocol.version,
        maximumCalls: 9,
        modelVariants: protocol.models,
        variantsPerModel: 1,
        ...(priorFile
          ? {
              purpose:
                'One corrective Haiku regression after a deterministic transport-wrapper fix; initial failures remain untouched',
              priorResultSha256: priorHash,
              priorCalls,
              totalCumulativeLimit: 9,
            }
          : {}),
        inference: 'official unmodified installed Claude Code; owner subscription setup-token',
        telemetry: observer.enabled ? 'operator opt-in metadata only' : 'off',
        semanticOwnerAcceptance: 'not implied by screening',
      },
      null,
      2,
    ),
  );
  const services = {
    pick: () => Promise.resolve([]),
    saveBackup: () => Promise.resolve(true),
    confirm: () => Promise.resolve(true),
    openDirectory: () => Promise.resolve(),
    autostart: () => {},
  };
  let total = priorCalls;
  const results: Record<string, unknown>[] = [];
  for (const model of priorFile ? ['haiku'] : protocol.models) {
    assert.ok(total + 3 <= 9);
    const store = new CoherentStore(path.join(output, model));
    const state = create(Date.now(), 'Asia/Nicosia');
    state.gardens[0]!.profile = 'game';
    state.settings.language = 'ru';
    state.settings.calls = 3;
    state.provider = { kind: 'claude', model, revision: 1 };
    state.claudeExecutable = executable;
    protocol.parents.forEach((text, i) =>
      addSource(
        state,
        state.gardens[0]!.id,
        `Вымышленный источник ${i + 1}`,
        text,
        true,
        Date.now(),
      ),
    );
    store.save(state, false);
    const runtime = new ClaudeRuntime(
      store.directory,
      () => executable,
      undefined,
      undefined,
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
      observer,
    );
    let failure = '';
    try {
      await controller.command({ op: 'checkClaude' });
      const preview = (
        await controller.command({
          op: 'eureka',
          garden: state.gardens[0]!.id,
          requestId: crypto.randomUUID(),
        })
      ).remotePreview;
      if (!preview) throw new Error('No exact remote preview was prepared.');
      assert.equal(preview.provider.requestedModel, model);
      await writeFile(path.join(output, model + '-consent.json'), JSON.stringify(preview, null, 2));
      await controller.command({ op: 'confirmRemote', previewId: preview.id, consent: true });
      const deadline = Date.now() + 560000;
      while (controller.view().busy && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 100));
      if (controller.view().busy) {
        await controller.pause();
        throw new Error('Bounded pipeline timeout.');
      }
      failure = controller.view().status === 'attention' ? controller.view().reason : '';
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    const job = store.state.jobs.at(-1);
    failure ||= job?.primaryFailure || job?.repairRefusal || '';
    total += store.state.calls.length;
    assert.ok(store.state.calls.length <= 3 && total <= 9);
    const evidence = {
      requestedModel: model,
      clientVersion: runtime.version,
      reportedModels: job?.dispatches?.map((d) => d.remote?.reportedModel ?? null) ?? [],
      calls: store.state.calls.length,
      committed: store.state.nodes.length,
      stage: job?.stage ?? 'not dispatched',
      assessment: job?.assessment ?? null,
      candidate: job?.draft ?? null,
      failure,
      schemaVersion: job?.schemaVersion ?? null,
      rawReceipts: store.receipts().length,
      remainingCredits: store.state.gardens[0]!.credits.balance,
      status: controller.view().status,
      ownerUsefulness: 'not evaluated',
    };
    results.push(evidence);
    await writeFile(path.join(output, model + '-result.json'), JSON.stringify(evidence, null, 2));
    const backup = JSON.stringify(store.envelope());
    CoherentStore.parseBackup(backup);
    await writeFile(path.join(output, model + '-backup.private.json'), backup, {
      flag: 'wx',
    });
    const credentialOrQuota = /auth|login|quota|rate.?limit|credit balance|hit your limit/i.test(
      failure + ' ' + (job?.raw.map((r) => r.raw).join(' ') ?? ''),
    );
    await controller.close();
    console.log(
      JSON.stringify({
        model,
        calls: evidence.calls,
        committed: evidence.committed,
        stage: evidence.stage,
        totalCalls: total,
        priorCalls,
      }),
    );
    await observer.flush();
    await writeFile(
      path.join(output, 'progress.json'),
      JSON.stringify({ totalCalls: total, maximumCalls: 9, results, delivery }, null, 2),
    );
    if (credentialOrQuota) break;
  }
  await observer.flush();
  await writeFile(
    path.join(output, 'result.json'),
    JSON.stringify(
      {
        format: 'claude-model-genuine-1',
        inputSha256: hash(raw),
        cli: '2.1.259 inspected before evaluation',
        totalCalls: total,
        maximumCalls: 9,
        results,
        telemetryEnabled: observer.enabled,
        telemetryDelivery: delivery,
        ownerUsefulness: 'not evaluated',
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      output,
      totalCalls: total,
      maximumCalls: 9,
      modelsAttempted: results.length,
      telemetryEnabled: observer.enabled,
      acceptedMetadataEnvelopes: delivery.filter((d) => d.status >= 200 && d.status < 300).length,
    }),
  );
}
void main()
  .then(() => app.quit())
  .catch(async (error: unknown) => {
    if (output)
      await writeFile(
        path.join(output, 'stopped.json'),
        JSON.stringify({
          stopped: true,
          noAutomaticRetry: true,
          error:
            error instanceof Error
              ? error.message.replace(/sk-ant-[\x21-\x7e]+/g, '[credential]')
              : 'Unknown evaluation error',
        }),
      );
    process.stderr.write(
      'Genuine evaluation stopped; inspect private retained evidence. No retry.\n',
    );
    app.exit(1);
  });
