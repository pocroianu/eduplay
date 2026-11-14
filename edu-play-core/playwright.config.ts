import { defineConfig, devices } from "@playwright/test";
import { loadPlaywrightEnv } from "./tests/e2e/playwright-env";

// Load environment variables before Playwright starts Next.js.
// `npm run dev:full -- --skip-next` writes local Supabase credentials to
// .env.local, while CI can still provide explicit process env values.
loadPlaywrightEnv();

/**
 * Playwright configuration for EduPlay E2E tests
 *
 * IMPORTANT: E2E tests require Supabase to be running.
 * The global-setup.ts will verify Supabase is running before tests start.
 *
 * Options for running tests:
 * 1. Start services manually first: `npm run dev:full` then `npm run test:e2e`
 * 2. Let Playwright start Next.js: Supabase must be running via `npx supabase start`
 * 3. For a focused browser check, run `npm run test:e2e:smoke`
 *
 * @see https://playwright.dev/docs/test-configuration
 * @see README.md and AGENTS.md for detailed setup instructions
 */
export default defineConfig({
  // Directory containing test files
  testDir: "./tests/e2e",

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI (Supabase connections may be limited)
  workers: process.env.CI ? 1 : 1,

  // Reporter to use
  reporter: process.env.CI
    ? [["html", { outputFolder: "playwright-report" }], ["list"], ["github"]]
    : [["html", { outputFolder: "playwright-report" }], ["list"]],

  // Shared settings for all projects
  use: {
    // Base URL for navigation
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",

    // Keep first-failure traces in CI so agents and reviewers can inspect the
    // real failure without depending on retry behavior.
    trace: process.env.CI ? "retain-on-failure" : "on-first-retry",

    // Capture screenshot on failure
    screenshot: "only-on-failure",

    // Record video on failure
    video: "retain-on-failure",

    // Default timeout for actions
    actionTimeout: 10000,

    // Default timeout for navigation
    navigationTimeout: 30000,
  },

  // Global timeout for each test
  timeout: 60000,

  // Output directory for test artifacts
  outputDir: "test-results",

  // Projects for different browsers
  projects: [
    // Desktop browsers
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use larger viewport for teacher UI testing
        viewport: { width: 1280, height: 720 },
      },
    },
    // {
    //   name: 'firefox',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //     viewport: { width: 1280, height: 720 },
    //   },
    // },
    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //     viewport: { width: 1280, height: 720 },
    //   },
    // },

    // // Mobile browsers (important for student UI with touch targets)
    // {
    //   name: 'mobile-chrome',
    //   use: {
    //     ...devices['Pixel 5'],
    //     // Student UI requires larger touch targets (64x64px min)
    //   },
    // },
    // {
    //   name: 'mobile-safari',
    //   use: {
    //     ...devices['iPhone 12'],
    //   },
    // },

    // // Tablet (good middle ground for testing responsive)
    // {
    //   name: 'tablet',
    //   use: {
    //     ...devices['iPad (gen 7)'],
    //   },
    // },
  ],

  // Configure web server for local testing
  // Note: Supabase must be running before tests start (verified in global-setup.ts)
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000,
    // Pass through environment variables to Next.js. Playwright's webServer.env
    // replaces the inherited environment for the spawned process, so anything the
    // dev server needs at startup must be listed explicitly here. Missing
    // SUPABASE_SERVICE_ROLE_KEY caused all forgot-password rate-limit checks to
    // throw on the self-hosted Windows runner (EDU-156).
    env: {
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54421",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    },
    // Skip web server if:
    // - DOCKER_TESTING is set (services already running in Docker)
    // - SKIP_WEB_SERVER is set (developer started services manually)
    ...(process.env.DOCKER_TESTING || process.env.SKIP_WEB_SERVER
      ? { command: undefined }
      : {}),
  },

  // Global setup - verifies Supabase is running and seeds test data
  globalSetup: "./tests/e2e/global-setup.ts",

  // Global teardown for cleanup
  globalTeardown: "./tests/e2e/global-teardown.ts",

  // Expect configuration
  expect: {
    // Maximum time expect() should wait for the condition to be met
    timeout: 10000,

    // Configure toHaveScreenshot for visual regression
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
    },
  },
});
