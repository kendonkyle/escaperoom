import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 20_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    headless: true,
    testIdAttribute: 'data-testid',
  },
  webServer: {
    command: `npm run dev -- --host --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: true,
    timeout: 20_000,
  },
});

