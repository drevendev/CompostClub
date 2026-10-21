import { expect, test } from './acceptance';
test('loopback bridge rejects foreign origins, missing tokens and oversized requests', async ({
  request,
}) => {
  const foreign = await request.get('/api/health', {
    headers: { Origin: 'https://example.invalid' },
  });
  expect(foreign.status()).toBe(403);
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  const data = (await health.json()) as { token: string };
  const missing = await request.post('/api/ferment', {
    headers: { Origin: 'http://127.0.0.1:4173' },
    data: {
      a: 'A new quiet thought.',
      b: 'Another little thought.',
      language: 'en',
      requestId: 'test',
    },
  });
  expect(missing.status()).toBe(403);
  const bad = await request.post('/api/ferment', {
    headers: { Origin: 'http://127.0.0.1:4173', 'X-Compost-Token': data.token },
    data: { a: '', b: 'Another little thought.', language: 'en', requestId: 'test' },
  });
  expect(bad.status()).toBeGreaterThanOrEqual(400);
  const large = await request.post('/api/ferment', {
    headers: { Origin: 'http://127.0.0.1:4173', 'X-Compost-Token': data.token },
    data: { a: 'x'.repeat(17000), b: 'Another little thought.', language: 'en', requestId: 'test' },
  });
  expect(large.status()).toBe(413);
});

test('a simulated transport failure keeps the slot; an explicit retry uses the real model', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start your pile', exact: true }).click();
  for (const text of [
    'A tiny library lends pocket rainstorms to gardeners.',
    'A robot turns lost kitchen words into funny recipe names.',
  ]) {
    await page.getByLabel('Your idea scrap', { exact: true }).fill(text);
    await page.getByRole('button', { name: 'Toss it in', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Choose your local AI', exact: true }).click();
  await page.getByRole('button', { name: 'Connect local Gemma', exact: true }).click();
  await expect(page.getByText('Connected: gemma3:1b')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  let first = true;
  await page.route('**/api/ferment', async (route) => {
    if (first) {
      first = false;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Test-only transport failure. No model result was substituted.',
        }),
      });
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Let it ferment', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Test-only transport failure');
  await expect(page.getByRole('heading', { name: '1 pairing is ready' })).toBeVisible();
  expect(await page.locator('.sprout-card').count()).toBe(0);
  await page.getByRole('button', { name: 'Retry this pairing', exact: true }).click();
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
  await testInfo.attach('transport-diagnostic', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({ kind: 'test-only-transport-failure', modelResponseSubstituted: false }),
    ),
  });
  await testInfo.attach('live-inference', {
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify({ source: 'real-loopback-ollama', generation })),
  });
});
