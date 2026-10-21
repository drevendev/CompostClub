import { expect, test } from './acceptance';
import type { Page } from '@playwright/test';
import type { Garden } from '../src/domain/garden';
import { readFile } from 'node:fs/promises';

// Fictional inputs and labelled loopback stubs, never live-model evidence.
async function record(page: Page, key = 'personal'): Promise<Garden> {
  return page.evaluate(async (key) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('compost-club-v1', 1);
      r.onsuccess = () => resolve(r.result);
    });
    try {
      return await new Promise<Garden>((resolve) => {
        const r = db.transaction('gardens').objectStore('gardens').get(key);
        r.onsuccess = () => resolve(r.result as Garden);
      });
    } finally {
      db.close();
    }
  }, key);
}
async function add(page: Page, value: string) {
  await page.getByLabel('Your idea scrap', { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Toss it in', exact: true }).click();
}
async function prepare(page: Page, mode: string) {
  await page.request.get(`http://127.0.0.1:4193/control/${mode}`);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start your pile', exact: true }).click();
  await add(page, 'A fictional library lends little clouds.');
  await add(page, 'A fictional robot collects lost words.');
  await page.getByRole('button', { name: 'Choose your local AI', exact: true }).click();
  await page.getByRole('button', { name: 'Connect local Gemma', exact: true }).click();
  await expect(page.getByText('Connected: gemma3:1b')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
}
for (const mode of ['invalid', 'no_blend', 'repair_no_blend']) {
  test(`transport diagnostic: ${mode} responses survive reload and export without spending a slot`, async ({
    page,
  }) => {
    await prepare(page, mode);
    await page.getByRole('button', { name: 'Let it ferment', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Retry this pairing', exact: true }),
    ).toBeVisible();
    const before = await record(page);
    const run = before.generations![0]!;
    expect(run.responses).toHaveLength(mode === 'no_blend' ? 1 : 2);
    expect(run.status).toBe(mode === 'invalid' ? 'failed' : 'no_blend');
    if (mode !== 'no_blend') expect(run.responses[0]!.raw).toBe('TEST-ONLY invalid primary 🌱\r\n');
    expect(before.readySlots).toBe(1);
    await page.reload();
    await expect(page.locator('.count-badge')).toHaveText('2');
    expect((await record(page)).generations).toEqual(before.generations);
    await page.getByRole('button', { name: 'Backup and export' }).click();
    await page.getByRole('button', { name: 'Inspect inference history' }).click();
    await page.getByRole('dialog').locator('summary').click();
    await expect(page.getByRole('dialog').locator('pre').first()).toContainText('TEST-ONLY');
    const event = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download inference history', exact: true }).click();
    const file = await (await event).path();
    const exported = JSON.parse(await readFile(file!, 'utf8')) as { generations: unknown[] };
    expect(exported.generations).toEqual(before.generations);
  });
}
test('transport diagnostic: cancelling repair retains the original primary response', async ({
  page,
}) => {
  await prepare(page, 'cancel');
  await page.getByRole('button', { name: 'Let it ferment', exact: true }).click();
  await expect.poll(async () => (await record(page)).generations?.[0]?.responses.length).toBe(1);
  await page.getByRole('button', { name: 'Cancel · keep my slot', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry this pairing', exact: true })).toBeVisible();
  await page.reload();
  const garden = await record(page);
  expect(garden.readySlots).toBe(1);
  expect(garden.generations![0]!.status).toBe('cancelled');
  expect(garden.generations![0]!.responses[0]!.raw).toBe('TEST-ONLY invalid primary 🌱\r\n');
});
test('transport diagnostic: oversized raw output is recoverable separately after reload', async ({
  page,
}) => {
  await prepare(page, 'oversized');
  await page.getByRole('button', { name: 'Let it ferment', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('separate inference recovery copy');
  expect((await record(page)).readySlots).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'Backup and export' }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download inference recovery copy', exact: true }).click();
  const file = await (await event).path();
  const recovered = JSON.parse(await readFile(file!, 'utf8')) as { responses: { raw: string }[] };
  expect(recovered.responses[0]!.raw).toBe('TEST-ONLY oversized response ' + 'x'.repeat(2097152));
  await page.getByRole('button', { name: 'Remove inference recovery copy…', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('one run with 1 original responses');
  await page.getByRole('button', { name: 'Remove this recovery copy', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Download inference recovery copy', exact: true }),
  ).toHaveCount(0);
});
test('normal restore rejects stale previews and stale saves without Web Locks', async ({
  page,
  context,
}) => {
  await context.addInitScript(() =>
    Object.defineProperty(navigator, 'locks', { value: undefined }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Start your pile', exact: true }).click();
  await add(page, 'A fictional library keeps the original thought.');
  const old = await record(page);
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.locator('.count-badge')).toHaveText('1');
  const preview = async () => {
    await second.getByRole('button', { name: 'Backup and export' }).click();
    await second.getByLabel('Restore JSON backup', { exact: true }).setInputFiles({
      name: 'fictional-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(old)),
    });
  };
  await preview();
  await add(page, 'A newer fictional thought must not disappear.');
  const newer = await record(page);
  await second.getByRole('button', { name: 'Replace garden with this backup' }).click();
  await expect(second.getByRole('dialog').getByRole('alert')).toContainText('another tab');
  expect(await record(second)).toEqual(newer);
  await second.reload();
  await expect(second.locator('.count-badge')).toHaveText('2');
  await preview();
  await second.getByRole('button', { name: 'Replace garden with this backup' }).click();
  await expect(second.getByRole('dialog')).toHaveCount(0);
  const restored = await record(second);
  expect(restored.revision).toBe(newer.revision + 1);
  expect(restored.scraps).toHaveLength(1);
  await add(page, 'A stale writer must be rejected after restore.');
  await expect(page.getByRole('alert')).toContainText('another tab');
  expect(await record(page)).toEqual(restored);
  expect(await record(page, 'before-restore:personal')).toEqual(newer);
});
