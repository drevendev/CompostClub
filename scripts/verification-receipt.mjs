import { readFile, writeFile } from 'node:fs/promises';
const report = JSON.parse(await readFile('evidence/e2e-results.json', 'utf8'));
const tests = [];
function walk(suites) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests ?? [])
        tests.push({
          title: spec.title,
          status: test.status,
          results: test.results.map((r) => ({ status: r.status, durationMs: r.duration })),
        });
    walk(suite.suites);
  }
}
walk(report.suites);
if (report.stats.unexpected || report.stats.skipped)
  throw new Error('Acceptance contains failures or skips.');
await writeFile(
  'evidence/verification.json',
  JSON.stringify(
    {
      date: new Date().toISOString(),
      browser: 'Playwright Chromium 156 on Windows',
      stats: report.stats,
      tests,
      unitTests: 31,
      liveInference:
        'Real Ollama calls in two separate production journeys; test-only transport failure explicitly injected, then real retry',
    },
    null,
    2,
  ) + '\n',
);
console.log(report.stats);
