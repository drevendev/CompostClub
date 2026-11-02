import { test, expect, type Page } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import {
  addScrap,
  createGarden,
  serializeGarden,
  MAX_BACKUP_BYTES,
  pairKey,
} from '../src/domain/garden';
import { recordedPersonal } from './garden-fixtures';

// Persistence fault injection with fictional records; no inference is simulated.
async function writeRecord(page: Page, value: unknown) {
  await page.evaluate(async (record) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('compost-club-v1', 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('gardens', 'readwrite');
        tx.objectStore('gardens').put(record, 'personal');
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }, value);
}
async function readRecord(page: Page, key = 'personal') {
  return page.evaluate(async (recordKey) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('compost-club-v1', 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const r = db.transaction('gardens', 'readonly').objectStore('gardens').get(recordKey);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    } finally {
      db.close();
    }
  }, key);
}
function replacement() {
  return addScrap(
    createGarden('personal', Date.now()),
    'A restored fictional library of little clouds.',
    Date.now(),
  );
}
const missingPair = recordedPersonal(100);
missingPair.attempts = [];
const sourceCycle = recordedPersonal(100);
sourceCycle.scraps[0]!.parentSproutId = sourceCycle.sprouts[0]!.id;
const nonexistentRevision = recordedPersonal(100);
nonexistentRevision.sprouts[0]!.parents[0].revision = 999;
nonexistentRevision.sprouts[0]!.key = pairKey(nonexistentRevision.sprouts[0]!.parents);
const originals = [
  { name: 'corrupt', value: null },
  { name: 'future-version', value: { version: 99, ownerNote: 'A fictional future garden. 🌱' } },
  { name: 'oversized', value: { ...replacement(), seed: 'x'.repeat(MAX_BACKUP_BYTES) } },
  { name: 'missing-consumed-pair', value: missingPair },
  { name: 'source-ancestry-cycle', value: sourceCycle },
  { name: 'nonexistent-source-revision', value: nonexistentRevision },
];
async function chooseBackup(page: Page, value: unknown) {
  await page.getByLabel('Recovery JSON backup', { exact: true }).setInputFiles({
    name: 'fictional-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(value)),
  });
}
for (const mode of ['production', 'offline'] as const) {
  for (const original of originals) {
    test(`${mode}: recover ${original.name} without losing the original record`, async ({
      page,
      context,
    }) => {
      const errors: string[] = [],
        requests: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      if (mode === 'offline') {
        await context.setOffline(true);
        page.on('request', (r) => {
          if (
            !r.url().startsWith('file:') &&
            !r.url().startsWith('data:') &&
            !r.url().startsWith('blob:')
          )
            requests.push(r.url());
        });
      }
      await page.goto(
        mode === 'offline'
          ? pathToFileURL(path.resolve('release/compost-club-preview.html')).href
          : '/',
      );
      await expect(
        page.getByRole('button', { name: 'Start your pile', exact: true }),
      ).toBeVisible();
      await writeRecord(page, original.value);
      await page.reload();
      await expect(
        page.getByRole('heading', { name: 'Your garden needs a little care.' }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Download original record', exact: true }),
      ).toBeEnabled();
      expect(await readRecord(page)).toEqual(original.value);
      const rawDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download original record', exact: true }).click();
      expect(JSON.parse(await readFile((await (await rawDownload).path())!, 'utf8'))).toEqual(
        original.value,
      );

      await chooseBackup(page, { version: 88 });
      await expect(page.getByRole('alert')).toContainText('Unsupported');
      expect(await readRecord(page)).toEqual(original.value);
      await chooseBackup(page, { ...replacement(), kind: 'sample' });
      await expect(page.getByRole('alert')).toContainText('personal garden backup');
      expect(await readRecord(page)).toEqual(original.value);
      await chooseBackup(page, originals[2]!.value);
      await expect(page.getByRole('alert')).toContainText('2 MiB');
      expect(await readRecord(page)).toEqual(original.value);

      const backup = replacement();
      await chooseBackup(page, backup);
      await expect(page.getByRole('heading', { name: 'Replace this saved garden?' })).toBeVisible();
      if (mode === 'production' && original.name === 'future-version') {
        await mkdir('.local/recovery-evidence', { recursive: true });
        await page.screenshot({
          path: '.local/recovery-evidence/desktop-recovery.png',
          fullPage: true,
        });
      }
      expect(await readRecord(page)).toEqual(original.value);
      await page.getByRole('button', { name: 'Cancel restore', exact: true }).click();
      expect(await readRecord(page)).toEqual(original.value);
      await chooseBackup(page, backup);
      await page
        .getByRole('button', { name: 'Replace saved garden with this backup', exact: true })
        .click();
      await expect(page.locator('.scrap')).toContainText('A restored fictional library');
      expect(await readRecord(page, 'recovery:personal')).toEqual(original.value);
      await page.reload();
      await expect(page.locator('.scrap')).toContainText('A restored fictional library');
      await page.getByRole('button', { name: 'Backup and export' }).click();
      const previousDownload = page.waitForEvent('download');
      await page
        .getByRole('button', { name: 'Download previous recovery copy', exact: true })
        .click();
      expect(JSON.parse(await readFile((await (await previousDownload).path())!, 'utf8'))).toEqual(
        original.value,
      );
      const currentDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Save JSON backup', exact: true }).click();
      const exported = await readFile((await (await currentDownload).path())!, 'utf8');
      expect(Buffer.byteLength(exported)).toBeLessThanOrEqual(MAX_BACKUP_BYTES);
      expect(exported).toBe(
        serializeGarden((await readRecord(page)) as ReturnType<typeof replacement>),
      );
      await page.getByLabel('Restore JSON backup', { exact: true }).setInputFiles({
        name: 'roundtrip.json',
        mimeType: 'application/json',
        buffer: Buffer.from(exported),
      });
      await page
        .getByRole('button', { name: 'Replace garden with this backup', exact: true })
        .click();
      await expect(page.locator('.scrap')).toContainText('A restored fictional library');
      expect(await readRecord(page, 'recovery:personal')).toEqual(original.value);
      expect(errors).toEqual([]);
      expect(requests).toEqual([]);
    });
  }
}
test('recovery can open the independent sample and refuses a changed record', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start your pile', exact: true })).toBeVisible();
  await writeRecord(page, { version: 99 });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open sample garden' })).toBeVisible();
  await page.getByRole('button', { name: 'Open sample garden' }).click();
  await expect(page.locator('.count-badge')).toHaveText('6');
  expect(await readRecord(page)).toEqual({ version: 99 });
  await page.getByRole('button', { name: 'Your garden', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Your garden needs a little care.' }),
  ).toBeVisible();
  await chooseBackup(page, replacement());
  await expect(page.getByRole('heading', { name: 'Replace this saved garden?' })).toBeVisible();
  const second = await context.newPage();
  await second.goto('/');
  await expect(
    second.getByText('Another tab is tending this garden.', { exact: false }),
  ).toBeVisible();
  await expect(second.getByLabel('Recovery JSON backup', { exact: true })).toBeDisabled();
  await second.close();
  await writeRecord(page, { version: 100 });
  await page
    .getByRole('button', { name: 'Replace saved garden with this backup', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('changed in another tab');
  expect(await readRecord(page)).toEqual({ version: 100 });
  expect(await readRecord(page, 'recovery:personal')).toBeUndefined();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mkdir('.local/recovery-evidence', { recursive: true });
  await page.screenshot({ path: '.local/recovery-evidence/mobile-recovery.png', fullPage: true });
});
test('an oversized new scrap leaves the previous saved garden usable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start your pile', exact: true }).click();
  await page
    .getByLabel('Your idea scrap', { exact: true })
    .fill('A saved fictional garden thought.');
  await page.getByRole('button', { name: 'Toss it in', exact: true }).click();
  await expect(page.locator('.scrap')).toHaveCount(1);
  const before = await readRecord(page);
  await page
    .getByLabel('Your idea scrap', { exact: true })
    .fill('A new fictional thought.' + ' '.repeat(9000));
  await page.getByRole('button', { name: 'Toss it in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('8 KiB');
  expect(await readRecord(page)).toEqual(before);
  await page.reload();
  await expect(page.locator('.scrap')).toContainText('A saved fictional garden thought.');
});
