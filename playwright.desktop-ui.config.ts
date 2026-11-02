import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'desktop-outcome.spec.ts',
  outputDir: '.local/desktop-outcome-artifacts',
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4197', headless: true, trace: 'retain-on-failure' },
  webServer: {
    command: 'npx vite preview --outDir dist-desktop-ui --host 127.0.0.1 --port 4197 --strictPort',
    url: 'http://127.0.0.1:4197/desktop.html',
    reuseExistingServer: false,
  },
  reporter: [['list'], ['json', { outputFile: '.local/desktop-outcome-results.json' }]],
});
