import { defineConfig } from '@playwright/test';

import { DEV_SERVER_PORT } from './packages/app/vite.config.ts';

const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  snapshotPathTemplate: 'tests/e2e/__screenshots__/{arg}{ext}',
  outputDir: 'tests/e2e/.artifacts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: DEV_SERVER_URL,
    browserName: 'chromium',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: 'npm run dev',
    url: DEV_SERVER_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
