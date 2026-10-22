import { test, expect } from './acceptance';
import { addScrap, beginRequest, completeRequest, createGarden } from '../src/domain/garden';
import recordings from '../fixtures/public/recordings.json' with { type: 'json' };
import { readFile } from 'node:fs/promises';
const output = {
  outcome: 'growth',
  title: 'TEST ONLY tiny library trial',
  concept: 'Test a single shelf before expanding the fictional library.',
  experiment: 'Ask three fictional readers to locate one book.',
};
test('growth: real Chromium review/edit/branch/reload and privacy exports (explicit transport stub)', async ({
  page,
}) => {
  const r = recordings[0]!;
  let g = addScrap(createGarden('personal', Date.now()), r.a, Date.now(), { id: 'a' });
  g = addScrap(g, r.b, Date.now(), { id: 'b' });
  g = beginRequest(g, Date.now(), 'replay', r.model, r.revision, 'en');
  g = completeRequest(g, g.pending!.id, r.raw, Date.now());
  g.sprouts[0]!.kept = true;
  g.readySlots = 3;
  await page.route('**/api/health', (route) =>
    route.fulfill({ json: { token: 'test-only', model: 'gemma3:4b', digest: 'test-only-digest' } }),
  );
  let calls = 0;
  await page.route('**/api/tend', (route) =>
    route.fulfill({
      json: {
        raw: ++calls === 1 ? 'TEST ONLY invalid original 🌱' : JSON.stringify(output),
        digest: 'test-only-digest',
      },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Start your pile', exact: true }).click();
  await page
    .getByLabel('Your idea scrap', { exact: true })
    .fill('TEST ONLY private original before restore.');
  await page.getByRole('button', { name: 'Toss it in', exact: true }).click();
  await page.getByRole('button', { name: 'Backup and export', exact: true }).click();
  await page.getByLabel('Restore JSON backup', { exact: true }).setInputFiles({
    name: 'test-only-recorded-parent.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(g)),
  });
  await page.getByRole('button', { name: 'Replace garden with this backup', exact: true }).click();
  await page.getByRole('button', { name: /^Collection/ }).click();
  await page.getByRole('button', { name: 'Tend this idea', exact: true }).click();
  await page.getByRole('button', { name: 'Grow one branch', exact: true }).click();
  await expect(page.getByRole('heading', { name: output.title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit before accepting', exact: true }).click();
  await page.getByLabel('Branch title', { exact: true }).fill('Human reviewed library trial');
  await page.getByRole('button', { name: 'Accept branch', exact: true }).click();
  await expect(
    page.getByText('Human reviewed library trial · accepted', { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Growth parent', { exact: true })
    .selectOption({ label: 'Human reviewed library trial' });
  await page.getByRole('button', { name: 'Grow one branch', exact: true }).click();
  await page.getByRole('button', { name: 'Reject proposal', exact: true }).click();
  await expect(page.getByText(output.title + ' · rejected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: /^Collection/ }).click();
  await page.getByRole('button', { name: 'Tend this idea', exact: true }).click();
  await expect(
    page.getByText('Human reviewed library trial · accepted', { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'Export this sprout', exact: true }).click();
  await expect(page.getByText(/Raw model responses are excluded by default/)).toBeVisible();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download idea card', exact: true }).click();
  const file = await (await dl).path();
  const card = await readFile(file!, 'utf8');
  expect(card).not.toContain('## Inference history');
  expect(card).not.toContain(r.raw);
  await page
    .getByRole('checkbox', {
      name: 'Include original inference transcript for this idea',
      exact: true,
    })
    .check();
  const dl2 = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download idea card', exact: true }).click();
  expect(await readFile((await (await dl2).path())!, 'utf8')).toContain(JSON.stringify(r.raw));
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'Backup and export', exact: true }).click();
  await page.getByRole('button', { name: 'Review before-restore copy', exact: true }).click();
  await page
    .getByRole('button', { name: 'Permanently remove before-restore copy', exact: true })
    .click();
  await expect(
    page.getByText('No additional recovery copies in this garden.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Review idea branches', exact: true }).click();
  await page.route('**/api/tend', (route) =>
    route.fulfill({
      json: { raw: 'TEST ONLY unsavable original '.repeat(3000), digest: 'test-only-digest' },
    }),
  );
  await page.getByRole('button', { name: 'Grow one branch', exact: true }).click();
  const unsaved = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download unsaved evidence before closing', exact: true })
    .click();
  expect(await readFile((await (await unsaved).path())!, 'utf8')).toContain(
    'TEST ONLY unsavable original',
  );
  await page.getByRole('button', { name: 'I saved the evidence; close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
