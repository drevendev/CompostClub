import { test, expect } from './acceptance';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import recordings from '../fixtures/public/recordings.json' with { type: 'json' };

async function noOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    x: scrollX,
    y: scrollY,
    horizontal: document.documentElement.scrollWidth > innerWidth + 1,
    vertical: document.documentElement.scrollHeight > innerHeight + 1,
    nested: [...document.querySelectorAll<HTMLElement>('*')]
      .filter(
        (el) =>
          el.clientHeight &&
          el.scrollHeight > el.clientHeight + 1 &&
          /auto|scroll/.test(getComputedStyle(el).overflowY),
      )
      .map((el) => el.className),
  }));
  expect(metrics).toEqual({ x: 0, y: 0, horizontal: false, vertical: false, nested: [] });
}

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1730, height: 776 },
]) {
  test(`sample journey needs no scrolling at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Try the sample garden', exact: true }).click();
    // Switching modes persists the sample asynchronously before rendering the workspace.
    await expect(page.locator('.count-badge')).toHaveText('6');
    await noOverflow(page);
    // All six sources remain reachable, with original numbering and uncut full text.
    for (const first of [1, 3, 5]) {
      await expect(
        page.getByRole('button', { name: `Read scrap ${first}`, exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: `Read scrap ${first}`, exact: true }).click();
      await expect(page.getByRole('dialog').locator('.full-scrap')).not.toBeEmpty();
      await noOverflow(page);
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('button', { name: `Read scrap ${first}`, exact: true }),
      ).toBeFocused();
      if (first !== 5)
        await page.getByRole('button', { name: 'Next idea pile page', exact: true }).click();
    }
    await expect(
      page.getByRole('button', { name: 'Next idea pile page', exact: true }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Discover a recorded sprout', exact: true }).click();
    const title = await page.locator('.sprout-card h3').innerText();
    const fixture = recordings.find((r) => JSON.parse(r.raw).title === title)!;
    expect(fixture).toBeTruthy();
    await page.getByRole('button', { name: /Grew from/ }).click();
    await expect(page.getByRole('dialog').locator('.parent p')).toHaveText([fixture.a, fixture.b]);
    await expect(page.getByRole('dialog')).toContainText('Recorded demo — no live AI');
    await noOverflow(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /Grew from/ })).toBeFocused();
    await page.getByRole('button', { name: 'Keep this idea', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Kept', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Collection/ }).click();
    await noOverflow(page);
    await page.reload();
    await page.getByRole('button', { name: /^Collection/ }).click();
    await expect(page.locator('.sprout-card h3')).toHaveText(title);
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export this sprout', exact: true }).click();
    const markdown = await readFile((await (await pending).path())!, 'utf8');
    for (const text of [title, fixture.a, fixture.b, 'Recorded demo'])
      expect(markdown).toContain(text);
    await noOverflow(page);
    await page.getByRole('button', { name: 'My garden', exact: true }).click();
    await page.getByRole('button', { name: 'Demo clock: +15 min', exact: true }).click();
    await noOverflow(page);
  });
}

test('long scraps stay readable and the last pile page recovers after deletion', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start your pile', exact: true }).click();
  const raw = '  Long fictional source. '.repeat(25) + '\nExact ending. 🌻';
  for (const value of ['First fictional source.', 'Second fictional source.', raw]) {
    await page.getByLabel('Your idea scrap', { exact: true }).fill(value);
    await page.getByRole('button', { name: 'Toss it in', exact: true }).click();
    await expect(page.getByLabel('Your idea scrap', { exact: true })).toHaveValue('');
  }
  await page.getByRole('button', { name: 'Read scrap 3', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.full-scrap')).toHaveText(raw);
  expect(await page.getByRole('dialog').locator('.full-scrap').textContent()).toBe(raw);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Remove scrap 3', exact: true }).click();
  await page
    .getByRole('button', { name: 'Remove scrap and dependent sprouts', exact: true })
    .click();
  await expect(page.locator('.count-badge')).toHaveText('2');
  await expect(page.getByRole('button', { name: 'Read scrap 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Read scrap 2', exact: true })).toBeVisible();
});

test('mobile and enlarged text keep a single document flow and all source access', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the sample garden', exact: true }).click();
  await page.getByRole('button', { name: 'Read scrap 1', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.full-scrap')).not.toBeEmpty();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Discover a recorded sprout', exact: true }).click();
  await page.getByRole('button', { name: /Grew from/ }).click();
  await expect(page.getByRole('dialog').locator('.parent')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await page.addStyleTag({ content: 'body {zoom: 1.5}' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  expect(await page.locator('.scrap-list').evaluate((el) => getComputedStyle(el).overflowY)).toBe(
    'visible',
  );
});
