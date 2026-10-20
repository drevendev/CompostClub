import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

// Repository-owned Markdown file destinations only; no network or anchor claims.
const files = ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'THIRD_PARTY_NOTICES.md'];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(name);
    else if (name.endsWith('.md')) files.push(name);
  }
}
await walk('docs');
await walk('.github');
const missing = [];
for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^[a-z][a-z\d+.-]*:/i.test(target)) continue;
    try {
      await stat(path.resolve(path.dirname(file), decodeURIComponent(target)));
    } catch {
      missing.push(`${file}: ${target}`);
    }
  }
  for (const match of text.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const target = match[1].split('#')[0];
    if (/^[a-z][a-z\d+.-]*:/i.test(target)) continue;
    try {
      await stat(path.resolve(path.dirname(file), target));
    } catch {
      missing.push(`${file}: ${target}`);
    }
  }
}
if (missing.length) throw new Error(`Missing documentation destinations:\n${missing.join('\n')}`);
console.log(
  `Checked local file destinations in ${files.length} Markdown files. External URLs and anchors were not checked.`,
);
