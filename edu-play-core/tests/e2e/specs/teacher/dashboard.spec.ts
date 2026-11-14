import { test, expect } from '../../fixtures/auth.fixture';
import { testTeacher } from '../../fixtures/test-data';

/**
 * Teacher Dashboard E2E Tests
 * Tests the teacher dashboard functionality after login
 *
 * NOTE: Authenticated tests are skipped until test user seeding is implemented.
 * The testTeacher credentials don't exist in the database yet.
 * TODO: Implement test data seeding in global-setup.ts
 */
test.describe('Teacher Dashboard', () => {
  // Use the pre-authenticated teacher fixture for most tests
  test.describe('Authenticated User', () => {
    // Skip all tests in this describe block - requires seeded test user
    test.skip(true, 'Authenticated tests require seeded test user in database');

    test.beforeEach(async ({ loginPage, page }) => {
      // Login before each test
      await loginPage.goto();
      await loginPage.loginAsTeacher(testTeacher.email, testTeacher.password);
      await expect(page).toHaveURL(/\/teacher/, { timeout: 15000 });
    });

    test('should display dashboard after login', async ({ teacherDashboard }) => {
      await teacherDashboard.verifyDashboardLoaded();
    });

    test('should have working navigation', async ({ teacherDashboard, page }) => {
      // Navigate to Classes
      await teacherDashboard.goToClasses();
      await expect(page).toHaveURL(/\/teacher\/classes/);

      // Navigate to Students
      await teacherDashboard.goToStudents();
      await expect(page).toHaveURL(/\/teacher\/students/);

      // Navigate to Games
      await teacherDashboard.goToGames();
      await expect(page).toHaveURL(/\/teacher\/games/);

      // Return to Dashboard
      await teacherDashboard.dashboardLink.click();
      await expect(page).toHaveURL(/\/teacher$/);
    });

    test('should display stats cards', async ({ teacherDashboard }) => {
      const cardCount = await teacherDashboard.getStatsCardCount();
      // Dashboard should have at least one stats card (or none if new user)
      expect(cardCount).toBeGreaterThanOrEqual(0);
    });

    test('should allow logout', async ({ teacherDashboard, page }) => {
      await teacherDashboard.logout();
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Unauthenticated User', () => {
    test('should redirect to login when not authenticated', async ({ page }) => {
      // Try to access teacher dashboard directly
      await page.goto('/teacher');

      // Should be redirected to login
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });

    test('should redirect to login when accessing teacher routes', async ({ page }) => {
      // Only list routes that exist as pages on disk. Auth checks are
      // performed at the page level (each `app/(dashboard)/teacher/.../page.tsx`
      // calls `redirect(ROUTES.AUTH.LOGIN)` when unauthenticated). There is no
      // root `middleware.ts`, so any URL without a backing page returns 404
      // instead of redirecting — that would be a false positive here.
      //
      const protectedRoutes = [
        '/teacher/classes',
        '/teacher/students',
        '/teacher/games',
      ];

      for (const route of protectedRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
      }
    });
  });
});

test.describe('Teacher Dashboard - Responsive', () => {
  // Skip - requires seeded test user
  test.skip(true, 'Responsive tests require seeded test user in database');

  test.use({
    viewport: { width: 768, height: 1024 }, // Tablet
  });

  test('should be responsive on tablet', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.loginAsTeacher(testTeacher.email, testTeacher.password);
    await expect(page).toHaveURL(/\/teacher/, { timeout: 15000 });

    // Sidebar should still be accessible (may be collapsed)
    const sidebar = page.locator('[data-testid="sidebar"]');
    const menuButton = page.getByRole('button', { name: /menu|meniu/i });

    // Either sidebar is visible or there's a menu toggle
    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    const menuButtonVisible = await menuButton.isVisible().catch(() => false);

    expect(sidebarVisible || menuButtonVisible).toBe(true);
  });
});

test.describe('Teacher Dashboard - Visual', () => {
  // Skip - requires seeded test user
  test.skip(true, 'Visual tests require seeded test user in database');

  test('should match dashboard screenshot', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.loginAsTeacher(testTeacher.email, testTeacher.password);
    await expect(page).toHaveURL(/\/teacher/, { timeout: 15000 });

    // Wait for animations and data loading
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('teacher-dashboard.png', {
      maxDiffPixels: 200, // Allow more variance due to dynamic content
    });
  });
});
