// UI inspection of retained genuine fictional outputs. No model stubs, replay
// injection, human approval, or new inference. Exact portable is required.
import { _electron as electron } from '@playwright/test';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const [packaged, ...profiles] = process.argv.slice(2);
if (!packaged || !profiles.length)
  throw new Error('Provide exact portable and closed fictional evaluation profiles.');
await mkdir('.local', { recursive: true });
const output = await mkdtemp(path.resolve('.local/generation-fix-results-'));
const identity = JSON.parse(
  await readFile(path.join(packaged, 'PACKAGE-IDENTITY.json'), 'utf8'),
) as { sha256: string };
const rows: unknown[] = [];
for (const [index, profile] of profiles.entries()) {
  const data = path.join(output, 'data-' + index);
  await cp(profile, data, { recursive: true, errorOnExist: true, force: false });
  const app = await electron.launch({
    executablePath: path.join(path.resolve(packaged), 'CompostClub.exe'),
    args: ['--compost-data-dir=' + data],
    cwd: path.resolve(packaged),
    env: { ...process.env, COMPOST_ACCEPTANCE: '1', COMPOST_DATA_DIR: '' },
  });
  const errors: string[] = [];
  try {
    const p = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0]!;
      w.webContents.setBackgroundThrottling(false);
      w.showInactive();
    });
    p.on('pageerror', (e) => errors.push(e.message));
    await p.waitForSelector('.coherent-app');
    const v = await p.evaluate(() => window.compost.invoke({ op: 'snapshot' }));
    assert.equal(v.workspace.paused, true);
    assert.equal(v.model.connected, false);
    assert.equal(v.workspace.nodes.length, 1);
    const n = v.workspace.nodes[0]!,
      r = n.revisions.at(-1)!,
      j = v.workspace.jobs.find((j) => j.id === n.job)!;
    assert.equal(r.assessment?.decision, 'pass');
    assert.equal(n.recorded, undefined);
    assert.equal(
      n.decisions.some((d) => d.override),
      false,
    );
    assert.equal(j.observed, true);
    assert.ok(j.dispatches?.some((d) => d.stage === 'generating'));
    assert.ok(j.dispatches?.some((d) => d.stage === 'screening'));
    await p.getByRole('button', { name: 'На просмотр', exact: true }).click();
    await p.getByRole('button', { name: 'Читать, сравнить и решить', exact: true }).click();
    assert.ok(await p.getByRole('dialog').getByText(r.content.title, { exact: true }).isVisible());
    await p.screenshot({
      path: path.join(output, 'genuine-' + j.language + '-' + index + '.png'),
      fullPage: true,
    });
    await p.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    const after = await p.evaluate(() => window.compost.invoke({ op: 'snapshot' }));
    assert.equal(after.workspace.calls.length, v.workspace.calls.length);
    rows.push({
      language: j.language,
      promptVersion: j.promptVersion,
      admission: j.admission?.version,
      calls: j.calls.length,
      visible: true,
      recorded: false,
      humanOverride: false,
      usefulness: 'unknown',
      newInferenceCalls: 0,
    });
  } finally {
    await app.close();
  }
}
await writeFile(
  path.join(output, 'receipt.json'),
  JSON.stringify(
    {
      packageSha256: identity.sha256,
      rows,
      limit: 'No inference permitted by this inspection script.',
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ output, rows }));
