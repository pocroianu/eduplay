/**
 * Global teardown for Playwright E2E tests
 * Runs once after all tests
 */

async function globalTeardown() {
  // Add any cleanup logic here
  // For example, cleaning up test data from the database

  console.log('Global teardown complete');
}

export default globalTeardown;
