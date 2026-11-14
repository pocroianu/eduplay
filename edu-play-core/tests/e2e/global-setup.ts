/**
 * Global setup for Playwright E2E tests
 *
 * This file runs BEFORE any tests and BEFORE the webServer starts.
 * It ensures all required services (Supabase) are available.
 *
 * Prerequisites:
 * - Supabase must be running (via `npx supabase start` or Docker)
 * - Environment variables must be configured (.env file)
 *
 * What this setup does:
 * 1. Validates required environment variables exist
 * 2. Checks if Supabase API is accessible
 * 3. Optionally attempts to start Supabase if not running
 * 4. Waits for the application to be ready
 *
 * @see README.md and AGENTS.md for detailed setup instructions
 */
import { chromium, FullConfig } from '@playwright/test';
import { execSync, spawn } from 'child_process';
import * as http from 'http';
import { seedParentE2EData } from './fixtures/parent-seed';

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  supabase: {
    apiUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54421',
    healthEndpoint: '/rest/v1/',
  },
  nextjs: {
    url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
  },
  healthCheck: {
    interval: 2000, // Check every 2 seconds
    supabaseTimeout: 60000, // Wait up to 60s for Supabase
    appTimeout: 120000, // Wait up to 120s for the app
  },
  // Whether to attempt starting Supabase automatically
  // Set to false to require manual startup (safer for CI)
  autoStartSupabase: process.env.AUTO_START_SUPABASE === 'true',
};

// =============================================================================
// Logger
// =============================================================================

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg: string) =>
    console.log(`${colors.blue}[E2E Setup]${colors.reset} ${msg}`),
  success: (msg: string) =>
    console.log(`${colors.green}[E2E Setup]${colors.reset} ${msg}`),
  warn: (msg: string) =>
    console.log(`${colors.yellow}[E2E Setup]${colors.reset} ${msg}`),
  error: (msg: string) =>
    console.log(`${colors.red}[E2E Setup]${colors.reset} ${msg}`),
  step: (num: number, total: number, msg: string) =>
    console.log(`${colors.cyan}[${num}/${total}]${colors.reset} ${msg}`),
};

// =============================================================================
// Health Check Utilities
// =============================================================================

/**
 * Check if a URL is accessible
 */
async function checkUrl(url: string, timeout = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname || '/',
        method: 'HEAD',
        timeout,
      };

      const req = http.request(options, (res) => {
        // Consider 2xx, 3xx, and 4xx as "service is running"
        // 4xx means the service is up but the endpoint may require auth
        resolve(res.statusCode !== undefined && res.statusCode < 500);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    } catch {
      resolve(false);
    }
  });
}

/**
 * Wait for a service to become available
 */
async function waitForService(
  name: string,
  url: string,
  maxWait: number
): Promise<boolean> {
  const startTime = Date.now();
  const interval = CONFIG.healthCheck.interval;

  process.stdout.write(`   Waiting for ${name}`);

  while (Date.now() - startTime < maxWait) {
    if (await checkUrl(url)) {
      console.log(` ${colors.green}OK${colors.reset}`);
      return true;
    }
    process.stdout.write('.');
    await sleep(interval);
  }

  console.log(` ${colors.red}TIMEOUT${colors.reset}`);
  return false;
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Environment Validation
// =============================================================================

/**
 * Validate that required environment variables are set
 */
function validateEnvironment(): boolean {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    log.error('Missing required environment variables:');
    missing.forEach((key) => console.log(`   - ${key}`));
    console.log('');
    console.log(`${colors.yellow}To fix this:${colors.reset}`);
    console.log('   1. Copy .env.example to .env: cp .env.example .env');
    console.log('   2. Ensure .env contains all required variables');
    console.log('   3. Run tests again: npm run test:e2e');
    console.log('');
    return false;
  }

  return true;
}

// =============================================================================
// Supabase Management
// =============================================================================

/**
 * Check if Supabase is running
 */
async function isSupabaseRunning(): Promise<boolean> {
  const healthUrl = `${CONFIG.supabase.apiUrl}${CONFIG.supabase.healthEndpoint}`;
  return checkUrl(healthUrl);
}

/**
 * Attempt to start Supabase using the CLI
 * Note: This is a blocking operation and may take 30-60 seconds
 */
async function startSupabase(): Promise<boolean> {
  log.info('Attempting to start Supabase...');

  try {
    // Check if Supabase CLI is available
    execSync('npx supabase --version', { stdio: 'pipe' });
  } catch {
    log.error('Supabase CLI not found. Install with: npm install supabase');
    return false;
  }

  return new Promise((resolve) => {
    const proc = spawn('npx', ['supabase', 'start'], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    proc.on('close', async (code) => {
      if (code === 0) {
        log.success('Supabase started successfully');
        resolve(true);
      } else {
        log.error(`Supabase start failed with code ${code}`);
        resolve(false);
      }
    });

    proc.on('error', (err) => {
      log.error(`Failed to start Supabase: ${err.message}`);
      resolve(false);
    });
  });
}

/**
 * Print helpful instructions when Supabase is not running
 */
function printSupabaseInstructions(): void {
  console.log('');
  console.log(
    `${colors.bold}${colors.red}ERROR: Supabase is not running!${colors.reset}`
  );
  console.log('');
  console.log(
    `E2E tests require Supabase to be running at: ${colors.cyan}${CONFIG.supabase.apiUrl}${colors.reset}`
  );
  console.log('');
  console.log(`${colors.yellow}To start Supabase, choose one option:${colors.reset}`);
  console.log('');
  console.log('   Option 1 - Using npm script (recommended):');
  console.log(`     ${colors.cyan}npm run dev:full${colors.reset}`);
  console.log('     This starts both Supabase and Next.js');
  console.log('');
  console.log('   Option 2 - Using Supabase CLI directly:');
  console.log(`     ${colors.cyan}npx supabase start${colors.reset}`);
  console.log('     Then run tests: npm run test:e2e');
  console.log('');
  console.log('   Option 3 - Focused smoke suite after startup:');
  console.log(`     ${colors.cyan}npm run test:e2e:smoke${colors.reset}`);
  console.log('');
  console.log(`${colors.yellow}Troubleshooting:${colors.reset}`);
  console.log('   - Ensure Docker is running');
  console.log('   - Check port 54421 is not in use');
  console.log('   - Run "npm run dev:status" to check service status');
  console.log('   - See README.md and AGENTS.md for detailed setup instructions');
  console.log('');
}

// =============================================================================
// Main Setup Function
// =============================================================================

async function globalSetup(config: FullConfig) {
  const totalSteps = 4;

  console.log('');
  console.log(
    `${colors.bold}=== EduPlay E2E Test Setup ===${colors.reset}`
  );
  console.log('');

  // Step 1: Validate environment variables
  log.step(1, totalSteps, 'Validating environment variables...');

  if (!validateEnvironment()) {
    throw new Error(
      'Environment validation failed. Please configure .env file.'
    );
  }

  log.success('Environment variables OK');

  // Step 2: Check Supabase is running
  log.step(2, totalSteps, 'Checking Supabase availability...');

  let supabaseRunning = await isSupabaseRunning();

  if (!supabaseRunning) {
    log.warn('Supabase not ready yet, waiting...');
    supabaseRunning = await waitForService(
      'Supabase',
      `${CONFIG.supabase.apiUrl}${CONFIG.supabase.healthEndpoint}`,
      CONFIG.healthCheck.supabaseTimeout
    );
  }

  if (!supabaseRunning) {
    // Supabase is not running - decide what to do
    if (CONFIG.autoStartSupabase) {
      // Attempt to start Supabase automatically
      log.warn('Supabase not running, attempting to start...');
      const started = await startSupabase();

      if (started) {
        // Wait for Supabase to be fully ready
        supabaseRunning = await waitForService(
          'Supabase',
          `${CONFIG.supabase.apiUrl}${CONFIG.supabase.healthEndpoint}`,
          CONFIG.healthCheck.supabaseTimeout
        );
      }
    }

    if (!supabaseRunning) {
      // Still not running - print instructions and fail
      printSupabaseInstructions();
      throw new Error(
        'Supabase is not running. Start it before running E2E tests.'
      );
    }
  } else {
    log.success(`Supabase is running at ${CONFIG.supabase.apiUrl}`);
  }

  // Step 3: Seed authenticated parent fixtures
  log.step(3, totalSteps, 'Seeding parent E2E fixtures...');
  await seedParentE2EData();
  log.success('Parent E2E fixtures seeded');

  // Step 4: Wait for the application to be ready
  log.step(4, totalSteps, 'Checking application availability...');

  const { baseURL } = config.projects[0].use;

  if (baseURL) {
    // Use Playwright browser to check the app (more reliable than HTTP check)
    const browser = await chromium.launch();
    const page = await browser.newPage();

    let appReady = false;
    const startTime = Date.now();
    const maxWait = CONFIG.healthCheck.appTimeout;

    process.stdout.write(`   Waiting for application at ${baseURL}`);

    while (Date.now() - startTime < maxWait) {
      try {
        const response = await page.goto(baseURL, { timeout: 10000 });

        // Check if we got a valid response (not a 5xx error)
        if (response && response.status() < 500) {
          console.log(` ${colors.green}OK${colors.reset}`);
          appReady = true;
          break;
        }
      } catch {
        // Page not ready yet
      }

      process.stdout.write('.');
      await sleep(CONFIG.healthCheck.interval);
    }

    await browser.close();

    if (!appReady) {
      console.log(` ${colors.red}TIMEOUT${colors.reset}`);
      log.error(`Application at ${baseURL} is not responding`);
      console.log('');
      console.log(`${colors.yellow}Possible causes:${colors.reset}`);
      console.log('   - Next.js is not running');
      console.log('   - Port 3000 is blocked');
      console.log('   - There is an error in the application');
      console.log('');
      console.log(`${colors.yellow}To fix:${colors.reset}`);
      console.log('   - Run "npm run dev" in another terminal');
      console.log('   - Or use "npm run dev:full" to start everything');
      console.log('   - Check for errors in the Next.js console');
      console.log('');
      throw new Error(`Application at ${baseURL} is not responding`);
    }

    log.success(`Application is ready at ${baseURL}`);
  }

  // Setup complete
  console.log('');
  log.success('Global setup complete - ready to run tests');
  console.log('');

  // Parent authenticated specs depend on the seed above. Keep additional
  // fixture families idempotent before wiring them into this setup.
}

export default globalSetup;
