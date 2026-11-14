import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const port = Number(process.env.ACTIVITY_DIST_PORT ?? 4173);
const baseURL = `http://127.0.0.1:${port}`;

const chromiumLaunchArgs = [
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-background-timer-throttling',
  '--force-device-scale-factor=1',
  '--disable-ipc-flooding-protection',
  '--run-all-compositor-stages-before-draw',
];

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/activity-dist', open: 'never' }],
    ['junit', { outputFile: 'test-results/activity-dist-junit.xml' }],
  ],
  timeout: process.env.CI ? 120000 : 60000,
  expect: {
    timeout: process.env.CI ? 20000 : 10000,
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 30000,
    launchOptions: {
      args: chromiumLaunchArgs,
    },
  },
  projects: [
    {
      name: 'activity-host-dist',
      testMatch: ['**/activity-host-dist/**/*.spec.ts'],
    },
  ],
  webServer: {
    command: `npm run build:host --workspace=@edu-play/game-core && npx vite preview --config packages/game-core/vite.host.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
    url: `${baseURL}/activities/fruits-01`,
    reuseExistingServer: false,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: repoRoot,
  },
  outputDir: 'test-results/activity-dist',
});
