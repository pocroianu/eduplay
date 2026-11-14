import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..');
// Keep Chromium from throttling requestAnimationFrame in Docker/headless runs;
// Phaser animation timers otherwise stretch and make canvas specs flaky.
const chromiumLaunchArgs = [
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-background-timer-throttling',
  '--force-device-scale-factor=1',
  '--disable-ipc-flooding-protection',
  '--run-all-compositor-stages-before-draw',
];

const activityHostUse = {
  ...devices['Desktop Chrome'],
  baseURL: 'http://localhost:5173',
  viewport: { width: 1280, height: 720 },
  launchOptions: {
    args: chromiumLaunchArgs,
  },
};

const e2eTemplates: Array<{ id: string; testMatch: string[] }> = [
  {
    id: 'multiple-choice',
    testMatch: ['**/multiple-choice/**/*.spec.ts', '**/shared/**/*.spec.ts'],
  },
  {
    id: 'matching-game',
    testMatch: ['**/matching-game/**/*.spec.ts'],
  },
  {
    id: 'categorize-game',
    testMatch: ['**/categorize-game/**/*.spec.ts'],
  },
  {
    id: 'counting-game',
    testMatch: ['**/counting-game/**/*.spec.ts'],
  },
  {
    id: 'pattern-game',
    testMatch: ['**/pattern-game/**/*.spec.ts'],
  },
  {
    id: 'memory-game',
    testMatch: ['**/memory-game/**/*.spec.ts'],
  },
  {
    id: 'sequence-order',
    testMatch: ['**/sequence-order/**/*.spec.ts'],
  },
  {
    id: 'repeat-sequence',
    testMatch: ['**/repeat-sequence/**/*.spec.ts'],
  },
  {
    id: 'listen-tap',
    testMatch: ['**/listen-tap/**/*.spec.ts'],
  },
  {
    id: 'tracing-game',
    testMatch: ['**/tracing-game/**/*.spec.ts'],
  },
];

export default defineConfig({
  testDir: './tests',

  // Run tests in files in parallel
  fullyParallel: false,

  // Fail the build on CI if test.only is left in source
  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 0 : 0,

  // Parallel workers - limit in CI for stability
  workers: process.env.CI ? 1 : 1,

  // Reporter configuration
  reporter: [
    // Always show list in console
    ['list'],
    // HTML report for detailed analysis
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    // JUnit for CI integration
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  timeout: process.env.CI ? 120000 : 60000,
  expect: {
    timeout: process.env.CI ? 20000 : 10000,
  },

  // Shared settings for all projects
  use: {
    // Trace recording for debugging failures
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording for failed tests
    video: 'retain-on-failure',

    // Action timeout
    actionTimeout: 15000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  projects: [
    ...e2eTemplates.map(({ id, testMatch }) => ({
      name: id,
      use: activityHostUse,
      testMatch,
    })),
    {
      name: 'activity-host',
      use: activityHostUse,
      testMatch: ['**/activity-host/**/*.spec.ts'],
    },
  ],

  // All browser projects run through the single game-core Activity host.
  webServer: {
    command: 'npm run start:activities',
    url: 'http://localhost:5173/activities/fruits-01',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: repoRoot,
    env: {
      PORT: '5173',
      STRICT_PORT: 'true',
    },
  },

  // Output directory for test artifacts
  outputDir: 'test-results/',

  // Global setup/teardown
  // globalSetup: require.resolve('./global-setup.ts'),
  // globalTeardown: require.resolve('./global-teardown.ts'),
});
