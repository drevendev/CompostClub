import { expect, test } from './acceptance';
import type { Page } from '@playwright/test';
import type { Garden } from '../src/domain/garden';

async function sample(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the sample garden', exact: true }).click();
  await expect(page.locator('.count-badge')).toHaveText('6');
  await page.getByRole('button', { name: 'Discover a recorded sprout', exact: true }).click();
  await expect(page.locator('.sprout-card')).toBeVisible();
}
async function saved(page: Page): Promise<Garden> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('compost-club-v1', 1);
      r.onsuccess = () => resolve(r.result);
    });
    try {
      return await new Promise<Garden>((resolve) => {
        const r = db.transaction('gardens').objectStore('gardens').get('sample');
        r.onsuccess = () => resolve(r.result as Garden);
      });
    } finally {
      db.close();
    }
  });
}

for (const target of ['scrap', 'sprout']) {
  test(`an unrelated add draft survives ${target} edit dismissal, validation and save`, async ({
    page,
  }) => {
    await sample(page);
    const draft = 'An unsaved fictional thought for later. 🌱';
    await page.locator('.scrap-composer > summary').click();
    const input = page.getByLabel('Your idea scrap', { exact: true });
    await input.fill(draft);
    const open = () =>
      target === 'scrap'
        ? page.getByRole('button', { name: 'Edit scrap 1', exact: true }).click()
        : page.locator('.sprout-card').getByRole('button', { name: 'Edit', exact: true }).click();
    for (const dismiss of ['escape', 'close', 'backdrop']) {
      await open();
      const editor = page
        .getByRole('dialog')
        .getByLabel(target === 'scrap' ? 'Idea scrap' : 'Your version', { exact: true });
      await editor.fill('A discarded edit must not replace an unrelated draft.');
      if (dismiss === 'escape') await editor.press('Escape');
      else if (dismiss === 'close')
        await page.getByRole('button', { name: 'Close dialog' }).click();
      else await page.mouse.click(3, 3);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(input).toHaveValue(draft);
    }
    await open();
    const editor = page
      .getByRole('dialog')
      .getByLabel(target === 'scrap' ? 'Idea scrap' : 'Your version', { exact: true });
    await editor.fill('');
    await page.getByRole('button', { name: 'Save edit', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
    await editor.fill('A saved fictional edit with its own little mechanism.');
    await page.getByRole('button', { name: 'Save edit', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(input).toHaveValue(draft);
    await page.getByRole('button', { name: 'Toss it in', exact: true }).click();
    await expect(input).toHaveValue('');
    await expect(page.locator('.count-badge')).toHaveText('7');
    expect((await saved(page)).scraps.at(-1)!.raw).toBe(draft);
  });
}

test('earlier unkept discoveries remain inspectable, editable and recoverable after unkeeping', async ({
  page,
}) => {
  await sample(page);
  const firstTitle = await page.locator('.sprout-card h3').innerText();
  await page.getByRole('button', { name: 'Demo clock: +15 min', exact: true }).click();
  await page.getByRole('button', { name: 'Discover a recorded sprout', exact: true }).click();
  await expect(page.locator('.sprout-card h3')).not.toHaveText(firstTitle);
  await page.reload();
  await page.getByRole('button', { name: 'View all discoveries', exact: true }).click();
  await expect(page.locator('.sprout-card')).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: 'All discoveries (2)', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const first = page
    .locator('.sprout-card')
    .filter({ has: page.getByRole('heading', { name: firstTitle, exact: true }) });
  await first.getByRole('button', { name: /Grew from/ }).click();
  await expect(first.locator('.parent')).toHaveCount(2);
  await expect(first.locator('.roots')).toContainText('Recorded demo — no live AI');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await first.getByRole('button', { name: 'Keep this idea', exact: true }).click();
  await expect(first.getByRole('button', { name: 'Kept', exact: true })).toBeVisible();
  await first.getByRole('button', { name: 'Edit', exact: true }).click();
  const editedTitle = 'An earlier discovery, revisited';
  await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill(editedTitle);
  await page
    .getByRole('dialog')
    .getByLabel('Your version', { exact: true })
    .fill('A fictional edited idea with its earlier sources intact.');
  await page.getByRole('button', { name: 'Save edit', exact: true }).click();
  const edited = page
    .locator('.sprout-card')
    .filter({ has: page.getByRole('heading', { name: editedTitle, exact: true }) });
  await edited.getByRole('button', { name: 'Compost again', exact: true }).click();
  await expect(
    edited.getByRole('button', { name: 'Back in the pile', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Kept ideas (1)', exact: true }).click();
  await edited.getByRole('button', { name: 'Kept', exact: true }).click();
  await expect(page.locator('.sprout-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'All discoveries (2)', exact: true }).click();
  await expect(edited).toBeVisible();
  await expect(edited.getByRole('button', { name: 'Keep this idea', exact: true })).toBeVisible();
  const garden = await saved(page);
  expect(garden.sprouts[0]!.output.title).toBe(firstTitle);
  expect(garden.sprouts[0]!.edited!.title).toBe(editedTitle);
  expect(garden.scraps.at(-1)!.parentSproutId).toBe(garden.sprouts[0]!.id);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('button', { name: 'All discoveries (2)', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('heading', { level: 1 }).click();
  await page.screenshot({
    path: '.local/workflow-discoveries-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
});

test('restore accepts reordered output keys but still rejects changed model text', async ({
  page,
}) => {
  await sample(page);
  const original = await saved(page);
  const reordered = structuredClone(original);
  const sprout = reordered.sprouts[0]!;
  sprout.output = Object.fromEntries(
    Object.entries(sprout.output).reverse(),
  ) as typeof sprout.output;
  await page.getByRole('button', { name: 'Backup and export' }).click();
  await page.getByLabel('Restore JSON backup', { exact: true }).setInputFiles({
    name: 'reordered-fictional-sample.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(reordered)),
  });
  await expect(page.getByRole('heading', { name: 'Restore this little garden?' })).toBeVisible();
  await page.getByRole('button', { name: 'Replace garden with this backup' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const restored = await saved(page);
  expect(restored.sprouts).toEqual(original.sprouts);
  expect(restored.generations).toEqual(original.generations);
  expect(restored.revision).toBe(original.revision + 1);
  sprout.output.concept = 'A changed concept is not an unchanged original response.';
  await page.getByRole('button', { name: 'Backup and export' }).click();
  await page.getByLabel('Restore JSON backup', { exact: true }).setInputFiles({
    name: 'changed-fictional-sample.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(reordered)),
  });
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'original model result was changed',
  );
  expect(await saved(page)).toEqual(restored);
});
