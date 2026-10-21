import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'recovery.spec.ts',
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4187',
    headless: true,
    trace: 'retain-on-failure',
    actionTimeout: 10000,
  },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4187 --strictPort',
    url: 'http://127.0.0.1:4187',
    reuseExistingServer: false,
  },
  reporter: [['list'], ['json', { outputFile: '.local/recovery-results.json' }]],
});
