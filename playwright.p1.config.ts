import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  outputDir: '.local/p1-artifacts',
  testMatch: [
    'p1.spec.ts',
    'workflow.spec.ts',
    'stability.spec.ts',
    'layout.spec.ts',
    'growth.spec.ts',
  ],
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4192',
    headless: true,
    trace: 'retain-on-failure',
    actionTimeout: 10000,
  },
  webServer: {
    command: 'node tests/serve-p1.mjs',
    url: 'http://127.0.0.1:4192',
    reuseExistingServer: false,
  },
  reporter: [['list'], ['json', { outputFile: '.local/p1-browser-results.json' }]],
});
