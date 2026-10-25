import { expect, test } from './acceptance';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import {
  addScrap,
  createGarden,
  editScrap,
  INTERVAL,
  serializeGarden,
  type Garden,
} from '../src/domain/garden';
import { capacityGarden, recordedPersonal } from './garden-fixtures';

async function readGarden(page: Page): Promise<Garden> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('compost-club-v1', 1);
      r.onsuccess = () => resolve(r.result);
    });
    try {
      return await new Promise<Garden>((resolve) => {
        const r = db.transaction('gardens').objectStore('gardens').get('personal');
        r.onsuccess = () => resolve(r.result as Garden);
      });
    } finally {
      db.close();
    }
  });
}
async function install(page: Page, garden: Garden) {
  const raw = serializeGarden(garden);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start your pile', exact: true })).toBeVisible();
  await page.evaluate(async (raw) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('compost-club-v1', 1);
      r.onsuccess = () => resolve(r.result);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('gardens', 'readwrite');
        tx.objectStore('gardens').put(JSON.parse(raw), 'personal');
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }, raw);
  await page.reload();
  await expect(page.locator('.count-badge')).toHaveText(String(garden.scraps.length));
}

for (const mode of ['production', 'offline']) {
  test(`${mode}: source originals survive edits before generation, downloads, reload and a cascade preview`, async ({
    page,
    context,
  }) => {
    if (mode === 'offline') await context.setOffline(true);
    await page.goto(
      mode === 'offline'
        ? pathToFileURL(path.resolve('release/compost-club-preview.html')).href
        : '/',
    );
    await page.getByRole('button', { name: 'Start your pile', exact: true }).click();
    const original = '  A fictional cafe\u0301 of clockwork plants.\r\n  ';
    await page.getByLabel('Your idea scrap', { exact: true }).fill(original);
    await page.getByRole('button', { name: 'Toss it in', exact: true }).click();
    for (const text of [
      'A revised fictional café of clockwork plants.',
      'A third fictional café for clockwork plants.',
    ]) {
      await page.getByRole('button', { name: 'Edit scrap 1', exact: true }).click();
      await page.getByRole('dialog').getByLabel('Idea scrap', { exact: true }).fill(text);
      await page.getByRole('button', { name: 'Save edit', exact: true }).click();
    }
    const before = await readGarden(page);
    // textarea's browser value normalizes line endings; preserve that actual submitted raw text.
    const submitted = original.replaceAll('\r\n', '\n');
    expect(before.scraps[0]!.history![0]!.raw).toBe(submitted);
    expect(before.sprouts).toHaveLength(0);
    await page.reload();
    await page.getByRole('button', { name: 'View history of scrap 1', exact: true }).click();
    await expect(
      page.getByRole('dialog').getByRole('heading', { name: 'Revision 1', exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: `.local/source-history-${mode}.png`, animations: 'disabled' });
    const event = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download source history', exact: true }).click();
    const source = JSON.parse(await readFile((await (await event).path())!, 'utf8')) as {
      revisions: { raw: string }[];
    };
    expect(source.revisions).toHaveLength(3);
    expect(source.revisions[0]!.raw).toBe(submitted);
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.getByRole('button', { name: 'Backup and export' }).click();
    const backupEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save JSON backup', exact: true }).click();
    const backup = JSON.parse(
      await readFile((await (await backupEvent).path())!, 'utf8'),
    ) as Garden;
    expect(backup.scraps).toEqual(before.scraps);
    await page.getByLabel('Restore JSON backup', { exact: true }).setInputFiles({
      name: 'fictional-source-history.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await page.getByRole('button', { name: 'Replace garden with this backup' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await readGarden(page)).scraps).toEqual(before.scraps);
    await page.getByRole('button', { name: 'Remove scrap 1', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('3 saved text revisions');
    await page.keyboard.press('Escape');
    expect((await readGarden(page)).scraps).toEqual(before.scraps);
    await page.getByRole('button', { name: 'Remove scrap 1', exact: true }).click();
    await page
      .getByRole('button', { name: 'Remove scrap and dependent sprouts', exact: true })
      .click();
    await expect(page.locator('.count-badge')).toHaveText('0');
    expect((await readGarden(page)).scraps).toHaveLength(0);
  });
}

test('legacy source history is disclosed and the 100-revision boundary keeps the saved original', async ({
  page,
}) => {
  let g = addScrap(createGarden('personal', Date.now()), 'An older fictional source.', Date.now(), {
    id: 'old',
  });
  delete g.scraps[0]!.history;
  g.scraps[0]!.revision = 7;
  g = editScrap(g, 'old', 'An eighth fictional source revision.');
  await install(page, g);
  await page.getByRole('button', { name: 'View history of scrap 1', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Revisions before 7 were not saved');
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Revision 1', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.goto('/');
  g = addScrap(
    createGarden('personal', Date.now()),
    'An original fictional source at capacity.',
    Date.now(),
    { id: 'full' },
  );
  for (let i = 2; i <= 100; i++) g = editScrap(g, 'full', `A fictional revision number ${i}.`);
  await page.getByRole('button', { name: 'Backup and export' }).click();
  await page.getByLabel('Restore JSON backup', { exact: true }).setInputFiles({
    name: 'fictional-full-history.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializeGarden(g)),
  });
  await page.getByRole('button', { name: 'Replace garden with this backup' }).click();
  await page.getByRole('button', { name: 'Edit scrap 1', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Idea scrap', { exact: true })
    .fill('An overflowing fictional source revision.');
  await page.getByRole('button', { name: 'Save edit', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '100 saved text revisions',
  );
  expect((await readGarden(page)).scraps).toEqual(g.scraps);
});

test('keyboard skip keeps both gardens and results through reload and browser history', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start your pile', exact: true }).click();
  await page
    .getByLabel('Your idea scrap', { exact: true })
    .fill('A fictional personal thought stays separate.');
  await page.getByRole('button', { name: 'Toss it in', exact: true }).click();
  await page.getByRole('button', { name: 'Sample garden recorded', exact: true }).click();
  await page.getByRole('button', { name: 'Discover a recorded sprout', exact: true }).click();
  const title = await page.locator('.sprout-card h3').innerText();
  for (const kind of ['sample', 'personal']) {
    if (kind === 'personal') {
      await page.getByRole('button', { name: 'Your garden', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Your garden', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(page.locator('.count-badge')).toHaveText('1');
    }
    await page.reload();
    const before = await page.evaluate(() => ({ hash: location.hash, entries: history.length }));
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
    expect(await page.evaluate(() => ({ hash: location.hash, entries: history.length }))).toEqual(
      before,
    );
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON');
    await page.reload();
    await expect(page.locator('.count-badge')).toHaveText(kind === 'sample' ? '6' : '1');
    if (kind === 'sample') await expect(page.locator('.sprout-card h3')).toHaveText(title);
  }
  await page.goBack();
  await expect(
    page.getByRole('button', { name: 'Sample garden recorded', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sprout-card h3')).toHaveText(title);
  await page.goForward();
  await expect(page.getByRole('button', { name: 'Your garden', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.count-badge')).toHaveText('1');
  await page.goBack();
  await expect(page.locator('.count-badge')).toHaveText('6');
  await page.goBack();
  await expect(page.locator('.count-badge')).toHaveText('1');
});

for (const count of [2, 3, 200]) {
  test(`exhausted ${count}-source garden retains earned slots and offers a usable next action`, async ({
    page,
  }) => {
    const now = Date.now();
    await page.clock.install({ time: now });
    const g =
      count === 2
        ? recordedPersonal(now)
        : { ...capacityGarden(count, 'failed', now), readySlots: 0 };
    await install(page, g);
    await page.clock.fastForward(INTERVAL);
    await expect(page.getByLabel('1 of 3 slots ready', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name:
          count === 200
            ? 'Pairing history is full'
            : count === 2
              ? 'Your pile needs a new ingredient'
              : 'An unfinished pairing awaits',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Let it ferment', exact: true })).toBeDisabled();
    await expect(page.locator('.pairing-count')).toContainText('0 unused combinations');
    await expect.poll(async () => (await readGarden(page)).readySlots).toBe(1);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Let it ferment', exact: true })).toBeDisabled();
    if (count === 200) {
      await page.getByRole('button', { name: 'Review a source for removal', exact: true }).click();
      await expect(page.getByRole('dialog')).toContainText('199 pairing records');
      await page
        .getByRole('button', { name: 'Remove scrap and dependent sprouts', exact: true })
        .click();
      await expect(page.locator('.count-badge')).toHaveText('199');
      await expect(
        page.getByRole('button', { name: 'Let it ferment', exact: true }),
      ).toBeDisabled();
      await page.getByRole('button', { name: 'Add another scrap', exact: true }).click();
      await page
        .getByLabel('Your idea scrap', { exact: true })
        .fill('A new fictional ingredient for another pairing.');
      await page.getByRole('button', { name: 'Toss it in', exact: true }).click();
    } else {
      await page.getByRole('button', { name: 'Add another scrap', exact: true }).click();
      await expect(page.getByLabel('Your idea scrap', { exact: true })).toBeFocused();
      await page
        .getByLabel('Your idea scrap', { exact: true })
        .fill('A new fictional ingredient for another pairing.');
      await page.getByRole('button', { name: 'Toss it in', exact: true }).click();
    }
    await expect(page.getByRole('button', { name: 'Let it ferment', exact: true })).toBeEnabled();
    expect((await readGarden(page)).readySlots).toBe(1);
    expect((await readGarden(page)).attempts).toEqual(
      count === 200
        ? g.attempts.filter((attempt) => !attempt.key.includes(g.scraps[0]!.id + '@'))
        : g.attempts,
    );
  });
}

test('200 sources and 19,900 failed attempts keep retry selection and navigation responsive', async ({
  page,
}, testInfo) => {
  const g = capacityGarden(200, 'failed', Date.now());
  const start = performance.now();
  await install(page, g);
  await expect(page.getByRole('button', { name: 'Retry this pairing', exact: true })).toBeVisible();
  await expect(page.getByLabel('Pairing to retry', { exact: true }).locator('option')).toHaveCount(
    50,
  );
  await page.getByRole('button', { name: 'Next retry choices', exact: true }).click();
  await expect(page.locator('.retry-pagination')).toContainText('Pairings 51–100 of 19900');
  await page.getByLabel('Pairing to retry', { exact: true }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Backup and export' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await testInfo.attach('capacity-diagnostic', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({
        source: 'synthetic pairing-index data; no inference',
        scraps: 200,
        attempts: 19900,
        loadAndInteractionMs: performance.now() - start,
        backupBytes: Buffer.byteLength(serializeGarden(g)),
      }),
    ),
  });
  expect((await readGarden(page)).readySlots).toBe(1);
  expect((await readGarden(page)).generations ?? []).toHaveLength(0);
});
