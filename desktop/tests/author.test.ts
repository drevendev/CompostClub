import assert from 'node:assert/strict';
import { test } from 'node:test';
import { author, isAuthorLink } from '../../src/content/author';

void test('external author navigation accepts exact owner destinations only', () => {
  for (const link of author.links) assert.equal(isAuthorLink(link.url), true);
  for (const url of [
    'javascript:alert(1)',
    'file:///C:/Windows/System32/cmd.exe',
    'https://github.com/drevendev?redirect=elsewhere',
    'https://github.com.evil.example/drevendev',
    'https://github.com@evil.example/drevendev',
    'https://t.me/Drevenoise/other',
    'https://x.com/drevendev#other',
    'http://dev.to/drevendev',
    '',
  ])
    assert.equal(isAuthorLink(url), false, url);
});
