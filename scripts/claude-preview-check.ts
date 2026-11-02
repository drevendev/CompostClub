// Explicit owner-profile connection check in a hidden Chromium window; zero creative calls.
import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hash } from '../src/domain/coherent/hash';
const option = (name: string) => {
  const at = process.argv.indexOf(name);
  return at < 0 ? '' : (process.argv[at + 1] ?? '');
};
if (!process.argv.includes('--check-owner-profile'))
  throw new Error('Explicit owner-profile opt-in is required.');
const packaged = option('--package'),
  profile = option('--profile');
if (!path.isAbsolute(packaged) || !path.isAbsolute(profile))
  throw new Error('Absolute package/profile required.');
const identity = JSON.parse(
  await readFile(path.join(packaged, 'PACKAGE-IDENTITY.json'), 'utf8'),
) as { sha256: string; files: Record<string, string> };
for (const [file, sha] of Object.entries(identity.files))
  assert.equal(hash(await readFile(path.join(packaged, file))), sha, file);
await mkdir('.local', { recursive: true });
const output = await mkdtemp(path.resolve('.local/claude-preview-check-'));
const application = await electron.launch({
  executablePath: path.join(packaged, 'CompostClub.exe'),
  args: ['--compost-data-dir=' + profile, '--compost-start-hidden'],
  env: { ...process.env, COMPOST_ACCEPTANCE: '1' },
  timeout: 30000,
});
let result: unknown;
try {
  const page = await application.firstWindow();
  await page.locator('.desktop-app').waitFor();
  const before = await page.evaluate(() => window.compost.invoke({ op: 'snapshot' }));
  assert.equal(before.claudeToken?.present, true);
  assert.equal(before.provider?.kind, 'claude');
  const checked = await page.evaluate(() => window.compost.invoke({ op: 'checkClaude' }));
  assert.equal(checked.claudeConnection?.state, 'ready');
  assert.equal(checked.workspace.calls.length, before.workspace.calls.length);
  assert.equal(checked.workspace.jobs.length, before.workspace.jobs.length);
  assert.equal(
    hash(JSON.stringify(checked.workspace.sources)),
    hash(JSON.stringify(before.workspace.sources)),
  );
  const state = await application.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]!;
    return { visible: win.isVisible(), minimized: win.isMinimized() };
  });
  assert.equal(state.visible, false);
  result = {
    packageSha256: identity.sha256,
    sourceProfilePreserved: true,
    protectedTokenPresent: true,
    connection: checked.claudeConnection,
    requestedModel: checked.provider?.requestedModel,
    telemetryEnabled: checked.telemetry?.enabled,
    creativeCallsAdded: 0,
    originalsPreserved: true,
    windowHidden: true,
  };
  await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
} finally {
  await application.close();
}
console.log(JSON.stringify({ output, result }));
