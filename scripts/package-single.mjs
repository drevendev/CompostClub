import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const html = await readFile('dist-offline/index.html', 'utf8');
if (Buffer.byteLength(html) > 2 * 1024 * 1024)
  throw new Error('Standalone exceeds its 2 MiB UTF-8 budget.');
if (/<script[^>]+src=|<link[^>]+(?:href=["'](?!data:))/.test(html))
  throw new Error('Standalone still has external startup dependencies.');
if (!html.includes('recorded Gemma outputs')) throw new Error('Missing replay disclosure.');
await mkdir('release', { recursive: true });
await writeFile('release/compost-club-preview.html', html);
await writeFile(
  'release/standalone-receipt.json',
  JSON.stringify(
    {
      date: new Date().toISOString(),
      bytes: Buffer.byteLength(html),
      budget: 2097152,
      sha256: createHash('sha256').update(html).digest('hex'),
      mode: 'fixed-fixture recorded demo; no live AI; no weights',
    },
    null,
    2,
  ) + '\n',
);
console.log('release/compost-club-preview.html', Buffer.byteLength(html), 'bytes');
