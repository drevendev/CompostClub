import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  outputDir: '.local/live-acceptance-artifacts',
  testIgnore: ['recovery.spec.ts', 'p1.spec.ts'],
  timeout: 150000,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    trace: 'retain-on-failure',
    actionTimeout: 15000,
  },
  reporter: [['list'], ['json', { outputFile: 'evidence/e2e-results.json' }]],
});
