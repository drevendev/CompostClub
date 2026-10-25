import http from 'node:http';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';
const root = path.resolve('dist'),
  prefix = '/CompostClub/',
  origin = 'http://127.0.0.1:4189';
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    if (!url.pathname.startsWith(prefix)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const relative = url.pathname.slice(prefix.length) || 'index.html',
      file = path.resolve(root, decodeURIComponent(relative));
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
    res.setHeader(
      'Content-Type',
      {
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.wasm': 'application/wasm',
      }[path.extname(file)] ?? 'application/octet-stream',
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(4189, '127.0.0.1', resolve));
const browser = await chromium.launch(),
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [],
  badResponses = [],
  external = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.status() >= 400) badResponses.push({ url: r.url(), status: r.status() });
});
page.on('request', (r) => {
  if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:'))
    external.push(r.url());
});
try {
  await page.goto(origin + prefix);
  await page.getByRole('button', { name: 'Try the sample garden', exact: true }).click();
  await page.getByRole('button', { name: 'Discover a recorded sprout', exact: true }).click();
  await expect(page.locator('.sprout-card')).toBeVisible();
  await page.getByRole('button', { name: 'Keep this idea', exact: true }).click();
  await page.reload();
  await expect(page.locator('.sprout-card')).toBeVisible();
  const assets = await readdir('dist/assets');
  for (const file of assets) {
    const response = await fetch(origin + prefix + 'assets/' + file, { method: 'HEAD' });
    expect(response.ok).toBe(true);
  }
  await page.locator('.intro h1').click();
  await page.screenshot({ path: 'evidence/pages-preview.png', fullPage: true });
  expect(errors).toEqual([]);
  expect(badResponses).toEqual([]);
  expect(external).toEqual([]);
  await writeFile(
    'evidence/pages-path.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        path: prefix,
        published: false,
        result: 'PASS',
        journey: 'real recorded sample → keep → reload',
        errors,
        badResponses,
        external,
        assets,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'PASS: production at /CompostClub/, all assets including worker/WASM, sample keep/reload, no external requests.',
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
