import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'journey.spec.ts',
  outputDir: '.local/sample-artifacts',
  grep: /sample garden replays|mobile, keyboard|a second tab|offline HTML/,
  timeout: 150000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4195',
    headless: true,
    trace: 'retain-on-failure',
    actionTimeout: 15000,
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4195 --strictPort',
    url: 'http://127.0.0.1:4195',
    reuseExistingServer: false,
  },
  reporter: [['list'], ['json', { outputFile: '.local/sample-browser-results.json' }]],
});
