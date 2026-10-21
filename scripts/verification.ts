import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { acceptanceIdentity, sha256, type AcceptanceIdentity } from './acceptance-identity.ts';
import { parseOutput } from '../src/inference/contract.ts';
import type { Generation } from '../src/domain/generation';

export const liveTitles = [
  'real local model: add → blend → keep → reload → export and restore',
  'a simulated transport failure keeps the slot; an explicit retry uses the real model',
];
export const sampleTitles = [
  'sample garden replays only verified pairs; edit/recompost/clock/reload work',
  'mobile, keyboard, reduced motion and large text fit the viewport',
  'a second tab is read-only and a corrupt import cannot overwrite a garden',
  'offline HTML runs from file with network blocked, denied storage and a renamed copy',
];
export const plans = {
  sample: sampleTitles,
  live: [
    ...sampleTitles,
    ...liveTitles,
    'loopback bridge rejects foreign origins, missing tokens and oversized requests',
  ],
};
export type Scope = keyof typeof plans;
export interface RuntimeEvidence {
  browser: { name: string; version: string };
  platform: string;
  node: string;
  identity: AcceptanceIdentity;
}
interface Attachment {
  name: string;
  contentType: string;
  path?: string;
  body?: string;
}
interface Result {
  status: string;
  duration: number;
  attachments?: Attachment[];
}
interface ReportTest {
  status: string;
  results: Result[];
}
interface Suite {
  specs?: { title: string; tests: ReportTest[] }[];
  suites?: Suite[];
}
export interface Report {
  stats: {
    expected: number;
    unexpected: number;
    skipped: number;
    flaky: number;
    startTime: string;
  };
  suites: Suite[];
  errors?: unknown[];
}
export interface RunTest {
  title: string;
  status: string;
  results: Result[];
  runtime?: RuntimeEvidence;
  live?: { source: string; generation: Generation };
}
export function reportTests(report: Report): RunTest[] {
  const tests: RunTest[] = [];
  function walk(suites: Suite[]) {
    for (const suite of suites) {
      for (const spec of suite.specs ?? [])
        for (const test of spec.tests) tests.push({ title: spec.title, ...test });
      walk(suite.suites ?? []);
    }
  }
  walk(report.suites ?? []);
  return tests;
}
export function buildVerification(
  scope: Scope,
  report: Report,
  tests: RunTest[],
  current: AcceptanceIdentity,
  unit?: unknown,
) {
  const required = plans[scope];
  if (
    !required ||
    tests.length !== required.length ||
    new Set(tests.map((t) => t.title)).size !== tests.length ||
    required.some((title) => !tests.some((t) => t.title === title))
  )
    throw new Error(
      'Acceptance must contain the complete selected suite, without extra or missing tests.',
    );
  if (
    !report.stats ||
    report.stats.expected !== tests.length ||
    report.stats.unexpected !== 0 ||
    report.stats.skipped !== 0 ||
    report.stats.flaky !== 0 ||
    report.errors?.length ||
    tests.some(
      (t) => t.status !== 'expected' || t.results.length !== 1 || t.results[0]!.status !== 'passed',
    )
  )
    throw new Error('Acceptance contains failed, skipped, flaky or incomplete tests.');
  const runtimes = tests.map((t) => t.runtime);
  const completeRuntime = runtimes.every(
    (r) =>
      r &&
      typeof r.browser?.name === 'string' &&
      typeof r.browser.version === 'string' &&
      typeof r.platform === 'string' &&
      typeof r.node === 'string' &&
      r.identity?.sourceSha256 === current.sourceSha256 &&
      r.identity.buildSha256 === current.buildSha256 &&
      r.identity.standaloneSha256 === current.standaloneSha256,
  );
  if (runtimes.some(Boolean) && !completeRuntime)
    throw new Error('Runtime evidence is incomplete or does not match the current source/build.');
  if (
    completeRuntime &&
    runtimes.some(
      (r) =>
        r!.browser.name !== runtimes[0]!.browser.name ||
        r!.browser.version !== runtimes[0]!.browser.version ||
        r!.platform !== runtimes[0]!.platform ||
        r!.node !== runtimes[0]!.node,
    )
  )
    throw new Error('Runtime evidence differs between tests.');
  const live = [];
  for (const test of tests.filter((t) => liveTitles.includes(t.title))) {
    const evidence = test.live,
      run = evidence?.generation;
    if (
      !completeRuntime ||
      evidence?.source !== 'real-loopback-ollama' ||
      !run ||
      run.backend !== 'ollama' ||
      run.status !== 'success' ||
      !/^gemma3:(1b|4b)$/.test(run.model) ||
      !/^[a-f\d]{64}$/.test(run.modelRevision) ||
      !run.responses.length
    )
      throw new Error(
        'Live acceptance requires actual model-response and runtime attachments for each live journey.',
      );
    const raw = run.responses.at(-1)!.raw;
    if (parseOutput(raw, run.parents[0].text, run.parents[1].text).outcome !== 'sprout')
      throw new Error('Live journey did not produce a valid sprout.');
    live.push({
      test: test.title,
      generation: run,
      rawSha256: sha256(raw),
      source: evidence!.source,
    });
  }
  let unitTests: number | null = null;
  if (unit !== undefined) {
    const u = unit as {
      success: boolean;
      numTotalTests: number;
      numPassedTests: number;
      numFailedTests: number;
      numPendingTests: number;
      testResults: { status: string; assertionResults: { status: string }[] }[];
    };
    const assertions = u.testResults?.flatMap((t) => t.assertionResults ?? []);
    if (
      !u.success ||
      !Number.isSafeInteger(u.numTotalTests) ||
      u.numTotalTests < 1 ||
      u.numTotalTests !== u.numPassedTests ||
      u.numFailedTests !== 0 ||
      u.numPendingTests !== 0 ||
      assertions?.length !== u.numTotalTests ||
      assertions.some((a) => a.status !== 'passed')
    )
      throw new Error('The supplied unit report is not complete and successful.');
    unitTests = u.numPassedTests;
  }
  return {
    date: new Date().toISOString(),
    scope,
    stats: report.stats,
    tests: tests.map((t) => ({
      title: t.title,
      status: t.status,
      results: t.results.map((r) => ({ status: r.status, durationMs: r.duration })),
    })),
    runtime: completeRuntime
      ? { browser: runtimes[0]!.browser, platform: runtimes[0]!.platform, node: runtimes[0]!.node }
      : null,
    verifiedIdentity: completeRuntime ? current : null,
    unitTests,
    liveInference: {
      status: scope === 'live' ? 'verified-from-run-attachments' : 'not-run',
      journeys: live.length,
      evidence: live,
    },
    disclosure:
      'Test-only transport diagnostics are not model evidence. Structural validity does not certify creative usefulness. Missing metadata is unverified.',
  };
}
export async function writeVerification(args: string[]) {
  const options = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]!,
      value = args[i + 1];
    if (
      !['--scope', '--report', '--unit-report', '--out'].includes(key) ||
      !value ||
      options.has(key)
    )
      throw new Error(
        'Use --scope sample|live --report <JSON> [--unit-report <JSON>] [--out <JSON>].',
      );
    options.set(key, value);
  }
  const scope = options.get('--scope') as Scope;
  if (!Object.hasOwn(plans, scope) || !options.get('--report'))
    throw new Error('An explicit scope and Playwright report are required.');
  const report = JSON.parse(await readFile(options.get('--report')!, 'utf8')) as Report;
  const tests = reportTests(report);
  for (const test of tests)
    for (const a of test.results.flatMap((r) => r.attachments ?? [])) {
      if (!['acceptance-runtime', 'live-inference'].includes(a.name)) continue;
      let body: string;
      if (a.body) body = Buffer.from(a.body, 'base64').toString('utf8');
      else if (a.path) {
        const full = path.resolve(a.path);
        if (
          !['.local', 'test-results'].some((dir) => full.startsWith(path.resolve(dir) + path.sep))
        )
          throw new Error('Acceptance attachments must be local test artifacts.');
        body = await readFile(full, 'utf8');
      } else throw new Error('Acceptance attachment has no content.');
      if (Buffer.byteLength(body) > 512 * 1024 || a.contentType !== 'application/json')
        throw new Error('Invalid acceptance attachment.');
      if (a.name === 'acceptance-runtime') test.runtime = JSON.parse(body) as RuntimeEvidence;
      else test.live = JSON.parse(body) as NonNullable<RunTest['live']>;
    }
  const unitPath = options.get('--unit-report');
  const result = buildVerification(
    scope,
    report,
    tests,
    await acceptanceIdentity(),
    unitPath ? JSON.parse(await readFile(unitPath, 'utf8')) : undefined,
  );
  const output = options.get('--out') ?? `.local/verification-${scope}-${Date.now()}.json`;
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(
    `Verified ${scope}: ${tests.length} Chromium journeys; live journeys ${result.liveInference.journeys}; unit tests ${result.unitTests ?? 'unverified'}. Wrote ${output}`,
  );
}
