import { expect, it } from 'vitest';
import { buildVerification, plans, type Report, type RunTest } from '../../scripts/verification';
import type { AcceptanceIdentity } from '../../scripts/acceptance-identity';

// Synthetic report fixtures exercise the receipt validator only. No receipt is
// published and no fixture is presented as real browser or model evidence.
const identity: AcceptanceIdentity = {
  commit: null,
  dirty: null,
  sourceSha256: 'fixture-source',
  buildSha256: 'fixture-build',
  standaloneSha256: 'fixture-html',
  source: {},
  build: {},
};
function fixture(scope: 'sample' | 'live' = 'sample') {
  const tests: RunTest[] = plans[scope].map((title) => ({
    title,
    status: 'expected',
    results: [{ status: 'passed', duration: 1 }],
  }));
  const report: Report = {
    stats: {
      expected: tests.length,
      unexpected: 0,
      skipped: 0,
      flaky: 0,
      startTime: '2026-10-21T00:00:00Z',
    },
    suites: [],
  };
  return { tests, report };
}
it.each(['empty', 'subset', 'extra', 'duplicate'] as const)(
  'rejects %s reports without certifying inference',
  (kind) => {
    const { tests, report } = fixture();
    if (kind === 'empty') tests.splice(0);
    if (kind === 'subset') tests.pop();
    if (kind === 'extra') tests.push({ ...tests[0]!, title: 'Extra diagnostic' });
    if (kind === 'duplicate') tests[0] = tests[1]!;
    report.stats.expected = tests.length;
    expect(() => buildVerification('sample', report, tests, identity)).toThrow(
      'complete selected suite',
    );
  },
);
it.each(['failed', 'skipped', 'flaky', 'interrupted'] as const)('rejects %s acceptance', (kind) => {
  const { tests, report } = fixture();
  tests[0]!.results[0]!.status = kind;
  expect(() => buildVerification('sample', report, tests, identity)).toThrow('failed, skipped');
});
it('records a complete sample suite with missing metadata explicitly unverified and no live claims', () => {
  const { tests, report } = fixture();
  const receipt = buildVerification('sample', report, tests, identity);
  expect(receipt.runtime).toBeNull();
  expect(receipt.verifiedIdentity).toBeNull();
  expect(receipt.unitTests).toBeNull();
  expect(receipt.liveInference).toEqual({ status: 'not-run', journeys: 0, evidence: [] });
});
it('derives the actual runtime, hashes and unit count from a complete supplied fixture', () => {
  const { tests, report } = fixture();
  for (const test of tests)
    test.runtime = {
      browser: { name: 'fixture-browser', version: 'fixture-version' },
      platform: 'fixture-os',
      node: 'fixture-node',
      identity,
    };
  const unit = {
    success: true,
    numTotalTests: 2,
    numPassedTests: 2,
    numFailedTests: 0,
    numPendingTests: 0,
    testResults: [
      { status: 'passed', assertionResults: [{ status: 'passed' }, { status: 'passed' }] },
    ],
  };
  const receipt = buildVerification('sample', report, tests, identity, unit);
  expect(receipt.unitTests).toBe(2);
  expect(receipt.runtime!.browser.version).toBe('fixture-version');
  expect(receipt.verifiedIdentity!.standaloneSha256).toBe('fixture-html');
  unit.numTotalTests = 3;
  expect(() => buildVerification('sample', report, tests, identity, unit)).toThrow('unit report');
});
it('rejects mismatched current source/build evidence and incomplete runtime attachments', () => {
  const { tests, report } = fixture();
  tests[0]!.runtime = {
    browser: { name: 'fixture', version: 'fixture' },
    platform: 'fixture',
    node: 'fixture',
    identity,
  };
  expect(() => buildVerification('sample', report, tests, identity)).toThrow('Runtime evidence');
  for (const test of tests) test.runtime = tests[0]!.runtime!;
  expect(() =>
    buildVerification('sample', report, tests, { ...identity, buildSha256: 'changed' }),
  ).toThrow('Runtime evidence');
});
it('refuses a full live suite without actual live/runtime attachments', () => {
  const { tests, report } = fixture('live');
  expect(() => buildVerification('live', report, tests, identity)).toThrow('actual model-response');
});
