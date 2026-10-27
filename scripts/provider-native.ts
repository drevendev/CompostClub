// Actual packaged Chromium/IPC and OS credential storage on fictional sources.
// No creative model request is authorized by this diagnostic.
import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CoherentStore } from '../desktop/coherent-store';
import { fixture } from '../tests/coherent-fixtures';
import { canonical, hash } from '../src/domain/coherent/hash';

const index = process.argv.indexOf('--package'),
  packaged = process.argv[index + 1];
if (index < 0 || !packaged) throw new Error('Supply the exact portable directory with --package.');
const identity = JSON.parse(
  await readFile(path.join(packaged, 'PACKAGE-IDENTITY.json'), 'utf8'),
) as { sha256: string; files: Record<string, string> };
assert.equal(hash(JSON.stringify(identity.files)), identity.sha256);
for (const [file, sha] of Object.entries(identity.files))
  assert.equal(hash(await readFile(path.join(packaged, file))), sha, file);
await mkdir('.local', { recursive: true });
const output = await mkdtemp(path.resolve('.local/provider-native-')),
  data = path.join(output, 'data');
const initial = new CoherentStore(data);
initial.save(fixture(Date.now()), false);
const originals = canonical(initial.state.sources);
initial.close();
const errors: string[] = [],
  network: string[] = [];
const application = await electron.launch({
  executablePath: path.join(packaged, 'CompostClub.exe'),
  args: ['--compost-data-dir=' + data, '--compost-start-hidden'],
  env: { ...process.env, COMPOST_ACCEPTANCE: '1' },
  timeout: 30000,
});
const pid = await application.evaluate(() => process.pid);
try {
  await application.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]!;
    win.showInactive();
  });
  const page = await application.firstWindow();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/^https?:/.test(r.url())) network.push(r.url());
  });
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByLabel('Способ генерации').selectOption('claude');
  const setupToken = 'sk-ant-oat01-NATIVE_DIAGNOSTIC_NOT_A_REAL_TOKEN';
  await page.getByLabel('Claude setup-token', { exact: true }).fill(setupToken);
  await page.getByRole('button', { name: 'Сохранить setup-token защищённо' }).click();
  await page.getByText('Setup-token сохранён в защищённом хранилище.', { exact: true }).waitFor();
  assert.ok(
    !(await readFile(path.join(data, 'claude-credential.private.bin'))).includes(
      Buffer.from(setupToken),
    ),
  );
  const tokenView = await page.evaluate(() => window.compost.invoke({ op: 'snapshot' }));
  assert.ok(!canonical(tokenView).includes(setupToken));
  await page.getByRole('button', { name: 'Удалить setup-token', exact: true }).click();

  await page.getByRole('button', { name: 'Эврика', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Передача контекста Claude' });
  await dialog.waitFor();
  assert.ok((await dialog.textContent())!.includes('official-claude-code'));
  await dialog.screenshot({ path: path.join(output, 'claude-consent.png') });
  await dialog
    .getByRole('button', { name: 'Разрешить эту отправку и начать' })
    .scrollIntoViewIfNeeded();
  await dialog.screenshot({ path: path.join(output, 'claude-consent-actions.png') });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  // Repeat after dismissal: no orphaned local Eureka ID may block another preview.
  await page.getByRole('button', { name: 'Эврика', exact: true }).click();
  await dialog.waitFor();
  await page.keyboard.press('Escape');
  await page.getByLabel('Способ генерации').selectOption('groq');
  const key = 'gsk_NATIVE_DIAGNOSTIC_SENTINEL_NOT_A_REAL_KEY';
  await page.getByLabel('Ключ Groq', { exact: true }).fill(key);
  await page.getByRole('button', { name: 'Сохранить ключ в защищённом хранилище ОС' }).click();
  await page.getByText('Ключ сохранён.', { exact: false }).waitFor();
  assert.ok(
    !(await readFile(path.join(data, 'groq-credential.private.bin'))).includes(Buffer.from(key)),
  );
  const view = await page.evaluate(() => window.compost.invoke({ op: 'snapshot' }));
  assert.ok(!canonical(view).includes(key));
  assert.equal(view.workspace.calls.length, 0);
  assert.equal(view.workspace.jobs.length, 0);
  await page.getByRole('button', { name: 'Эврика', exact: true }).click();
  await page.getByRole('dialog', { name: 'Передача контекста Groq' }).waitFor();
  await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]!.setSize(430, 850),
  );
  await page.setViewportSize({ width: 430, height: 850 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page.screenshot({
    path: path.join(output, 'consent-430-forced-colors.png'),
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  assert.equal(overflow, false);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Удалить ключ', exact: true }).click();
  await page.getByLabel('Способ генерации').selectOption('claude');
  // No inspection of the owner's installed login is needed for this UI/storage diagnostic.
  const probe = await page.evaluate(() => window.compost.invoke({ op: 'snapshot' }));
  assert.equal(probe.workspace.calls.length, 0);
  assert.equal(network.length, 0);
  assert.equal(errors.length, 0);
  await writeFile(
    path.join(output, 'ui-result.json'),
    JSON.stringify(
      {
        format: 'provider-native-diagnostic-1',
        packageSha256: identity.sha256,
        actualPid: pid,
        fictional: true,
        creativeCalls: 0,
        rendererHttp: network.length,
        rendererErrors: errors.length,
        claudeConsent: true,
        groqConsent: true,
        osEncryption: true,
        repeatDismissal: true,
        narrowForcedColors: true,
        authenticationChecked: false,
        claudeSetupTokenOsEncryption: true,
        genuineCreativeAcceptance: 'not run; requires authenticated owner provider',
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await application.close();
}
const saved = new CoherentStore(data);
assert.equal(canonical(saved.state.sources), originals);
assert.equal(saved.state.calls.length, 0);
assert.equal(saved.state.paused, true);
saved.close();
console.log(
  JSON.stringify({
    output,
    packageSha256: identity.sha256,
    creativeCalls: 0,
    originalsPreserved: true,
  }),
);
