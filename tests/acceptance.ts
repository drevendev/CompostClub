import { test as base, expect } from '@playwright/test';
import { acceptanceIdentity } from '../scripts/acceptance-identity';

export const test = base.extend<{ evidenceRuntime: void }>({
  evidenceRuntime: [
    async ({ browser, page }, use, testInfo) => {
      await testInfo.attach('acceptance-runtime', {
        contentType: 'application/json',
        body: Buffer.from(
          JSON.stringify({
            browser: { name: browser.browserType().name(), version: browser.version() },
            platform: process.platform,
            node: process.version,
            identity: await acceptanceIdentity(),
          }),
        ),
      });
      await use();
      // Retain the actual garden journal on failures too. This fixture depends
      // on page so its teardown runs before the isolated page is closed.
      try {
        const journal = await page.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const r = indexedDB.open('compost-club-v1', 1);
            r.onupgradeneeded = () => {
              r.transaction?.abort();
            };
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
          });
          try {
            return await new Promise<unknown>((resolve) => {
              const r = db.transaction('gardens').objectStore('gardens').get('personal');
              r.onsuccess = () =>
                resolve((r.result as { generations?: unknown[] } | undefined)?.generations ?? []);
            });
          } finally {
            db.close();
          }
        });
        await testInfo.attach('inference-journal', {
          contentType: 'application/json',
          body: Buffer.from(
            JSON.stringify({
              disclosure:
                'Actual app journal; transport diagnostics and replay remain labelled by their recorded metadata.',
              generations: journal,
            }),
          ),
        });
      } catch {
        /* Blank pages and denied-storage scenarios have no readable journal. */
      }
    },
    { auto: true },
  ],
});
export { expect };
