import { expect, test } from './acceptance';
import { readFile, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

test('real local model: add → blend → keep → reload → export and restore', async ({
  page,
}, testInfo) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (
      !r.url().startsWith('http://127.0.0.1:4173') &&
      !r.url().startsWith('blob:') &&
      !r.url().startsWith('data:')
    )
      external.push(r.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start your pile', exact: true }).click();
  await page
    .getByLabel('Your idea scrap', { exact: true })
    .fill('A tiny library lends pocket weather to people taking evening walks.');
  await page.getByRole('button', { name: 'Toss it in', exact: true }).click();
  await page
    .getByLabel('Your idea scrap', { exact: true })
    .fill('A robot turns lost kitchen words into labels for new plants.');
  await page.getByRole('button', { name: 'Toss it in', exact: true }).click();
  await expect(page.getByRole('heading', { name: '1 slot is ready' })).toBeVisible();
  await page.getByRole('button', { name: 'Choose your local AI', exact: true }).click();
  await page.getByRole('button', { name: 'Connect local Gemma', exact: true }).click();
  await expect(page.getByText('Connected: gemma3:1b')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Let it ferment', exact: true }).click();
  await expect(page.locator('.sprout-card')).toBeVisible({ timeout: 125000 });
  const generation = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('compost-club-v1', 1);
      r.onsuccess = () => resolve(r.result);
    });
    const garden = await new Promise<{ generations: unknown[] }>((resolve) => {
      const r = db.transaction('gardens').objectStore('gardens').get('personal');
      r.onsuccess = () => resolve(r.result as { generations: unknown[] });
    });
    db.close();
    return garden.generations.at(-1);
  });
  await testInfo.attach('live-inference', {
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify({ source: 'real-loopback-ollama', generation })),
  });
  await page.getByRole('button', { name: 'Keep this idea', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Kept', exact: true })).toBeVisible();
  const title = await page.locator('.sprout-card h3').innerText();
  await page.reload();
  await expect(page.locator('.sprout-card h3')).toHaveText(title);
  await expect(
    page.getByRole('heading', { name: 'Your pile needs a new ingredient' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Backup and export' }).click();
  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save JSON backup', exact: true }).click();
  const backup = await jsonDownload;
  const file = await backup.path();
  expect(file).toBeTruthy();
  const data = JSON.parse(await readFile(file!, 'utf8')) as {
    sprouts: unknown[];
    scraps: unknown[];
  };
  expect(data.sprouts).toHaveLength(1);
  expect(data.scraps).toHaveLength(2);
  const mdDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Markdown', exact: true }).click();
  const md = await mdDownload;
  expect(await readFile((await md.path())!, 'utf8')).toContain('Grew from:');
  await page.getByLabel('Restore JSON backup', { exact: true }).setInputFiles(file!);
  await expect(page.getByRole('heading', { name: 'Restore this little garden?' })).toBeVisible();
  await page.getByRole('button', { name: 'Replace garden with this backup' }).click();
  await expect(page.locator('.sprout-card h3')).toHaveText(title);
  await page.screenshot({ path: 'evidence/desktop-live.png', fullPage: true });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('sample garden replays only verified pairs; edit/recompost/clock/reload work', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the sample garden', exact: true }).click();
  await expect(page.getByText(/recorded Gemma outputs · no live generation/)).toBeVisible();
  await page.getByRole('button', { name: 'Discover a recorded sprout', exact: true }).click();
  await expect(page.locator('.sprout-card')).toBeVisible();
  await page.getByRole('button', { name: 'Keep this idea', exact: true }).click();
  await page.getByRole('button', { name: 'Compost again', exact: true }).click();
  await expect(page.locator('.count-badge')).toHaveText('7');
  await page.getByRole('button', { name: 'Demo clock: +15 min', exact: true }).click();
  await expect(page.getByRole('heading', { name: '1 slot is ready' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.count-badge')).toHaveText('7');
  await page.getByRole('button', { name: 'Edit scrap 1', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Idea scrap', { exact: true })
    .fill('A totally new custom thought with no matching model recording.');
  await page.getByRole('button', { name: 'Save edit', exact: true }).click();
  await expect(page.locator('.scrap').first()).toContainText('A totally new custom thought');
  await page.locator('.intro h1').click();
  await page.screenshot({ path: 'evidence/desktop-sample.png', fullPage: true });
});

test('mobile, keyboard, reduced motion and large text fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the sample garden', exact: true }).click();
  await page.getByRole('button', { name: 'Discover a recorded sprout', exact: true }).click();
  await expect(page.locator('.sprout-card')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.locator('.intro h1').click();
  await page.screenshot({ path: 'evidence/mobile-sample.png', fullPage: true });
  await page.addStyleTag({ content: 'html {font-size: 200%} body * {letter-spacing: .05em}' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON');
});

test('a second tab is read-only and a corrupt import cannot overwrite a garden', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start your pile', exact: true }).click();
  await page
    .getByLabel('Your idea scrap', { exact: true })
    .fill('A library of old and unfinished thoughts.');
  await page.getByRole('button', { name: 'Toss it in', exact: true }).click();
  const second = await context.newPage();
  await second.goto('/');
  await expect(
    second.getByText('Another tab is tending this garden.', { exact: false }),
  ).toBeVisible();
  await second.locator('.scrap-composer > summary').click();
  await expect(second.getByRole('button', { name: 'Toss it in', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Backup and export' }).click();
  await page.getByLabel('Restore JSON backup', { exact: true }).setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":9000}'),
  });
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Unsupported');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.locator('.count-badge')).toHaveText('1');
});

test('offline HTML runs from file with network blocked, denied storage and a renamed copy', async ({
  browser,
}) => {
  await mkdir('.local/offline-renamed', { recursive: true });
  await copyFile('release/compost-club-preview.html', '.local/offline-renamed/another-garden.html');
  for (const [denied, filename] of [
    [false, 'release/compost-club-preview.html'],
    [true, 'release/compost-club-preview.html'],
    [false, '.local/offline-renamed/another-garden.html'],
    [true, '.local/offline-renamed/another-garden.html'],
  ] as const) {
    const context = await browser.newContext({ offline: true });
    if (denied)
      await context.addInitScript(() => {
        Object.defineProperty(window, 'indexedDB', {
          get() {
            throw new Error('Storage denied');
          },
        });
      });
    const page = await context.newPage(),
      requests: string[] = [],
      errors: string[] = [];
    page.on('request', (r) => {
      if (
        !(r.isNavigationRequest() && r.url().startsWith('file:')) &&
        !r.url().startsWith('data:') &&
        !r.url().startsWith('blob:')
      )
        requests.push(r.url());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('file:///' + path.resolve(filename).replaceAll('\\', '/'));
    await page.getByRole('button', { name: 'Try the sample garden', exact: true }).click();
    await page.getByRole('button', { name: 'Discover a recorded sprout', exact: true }).click();
    await expect(page.locator('.sprout-card')).toBeVisible();
    await page.getByRole('button', { name: 'Keep this idea', exact: true }).click();
    await page.getByRole('button', { name: 'Backup and export' }).click();
    const result = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save JSON backup', exact: true }).click();
    const backup = await result;
    expect(backup.suggestedFilename()).toBe('compost-club-backup.json');
    const backupPath = await backup.path();
    expect(backupPath).toBeTruthy();
    await page.getByLabel('Restore JSON backup', { exact: true }).setInputFiles(backupPath!);
    await page.getByRole('button', { name: 'Replace garden with this backup' }).click();
    await expect(page.locator('.sprout-card')).toBeVisible();
    await page.reload();
    if (!denied) await expect(page.locator('.sprout-card')).toBeVisible();
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    if (denied)
      await expect(page.getByText('This session is in memory.', { exact: false })).toBeVisible();
    await context.close();
  }
});
