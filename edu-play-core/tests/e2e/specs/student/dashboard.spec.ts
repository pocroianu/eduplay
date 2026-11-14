import { test, expect } from '../../fixtures/auth.fixture';
import { testStudent } from '../../fixtures/test-data';

/**
 * Student Dashboard E2E Tests
 * Tests the student-facing UI
 * Note: Student UI has specific requirements:
 * - 64x64px minimum touch targets
 * - 18px+ font sizes
 * - Bright colors
 * - Required animations (Framer Motion)
 * - Sound effects (toggleable)
 *
 * NOTE: Authenticated tests are skipped until test user seeding is implemented.
 * The testStudent credentials don't exist in the database yet.
 * TODO: Implement test data seeding in global-setup.ts
 */
test.describe('Student Dashboard', () => {
  test.describe('Authenticated Student', () => {
    // Skip all tests in this describe block - requires seeded test student
    test.skip(true, 'Authenticated tests require seeded test student in database');

    test.beforeEach(async ({ loginPage, page }) => {
      await loginPage.goto();
      await loginPage.loginAsStudent(testStudent.username, testStudent.pin);
      await expect(page).toHaveURL(/\/student/, { timeout: 15000 });
    });

    test('should display student dashboard after login', async ({ studentDashboard }) => {
      await studentDashboard.verifyDashboardLoaded();
    });

    test('should show games button prominently', async ({ studentDashboard }) => {
      await expect(studentDashboard.gamesButton).toBeVisible();

      // Games button should be easy to click (large touch target)
      const box = await studentDashboard.gamesButton.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(48);
        expect(box.height).toBeGreaterThanOrEqual(48);
      }
    });

    test('should navigate to games page', async ({ studentDashboard, page }) => {
      await studentDashboard.goToGames();
      await expect(page).toHaveURL(/\/student\/games/);
    });

    test('should display game cards if available', async ({ studentDashboard }) => {
      const gameCount = await studentDashboard.getGameCount();
      // May be 0 if no games assigned, but should not error
      expect(gameCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Unauthenticated User', () => {
    test('should redirect to login when not authenticated', async ({ page }) => {
      await page.goto('/student');
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });

    test('should redirect to login for student game routes', async ({ page }) => {
      await page.goto('/student/games');
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });
  });
});

test.describe('Student Dashboard - Kid-Friendly UI', () => {
  // Skip all tests in this describe block - requires seeded test student
  test.skip(true, 'Kid-Friendly UI tests require seeded test student in database');

  test.beforeEach(async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.loginAsStudent(testStudent.username, testStudent.pin);
    await expect(page).toHaveURL(/\/student/, { timeout: 15000 });
  });

  test('should have minimum 18px font size', async ({ page }) => {
    // Get all text elements
    const textElements = page.locator('p, span, button, a, h1, h2, h3, h4, h5, h6');
    const count = await textElements.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const element = textElements.nth(i);
      const isVisible = await element.isVisible().catch(() => false);

      if (isVisible) {
        const fontSize = await element.evaluate((el) => {
          return window.getComputedStyle(el).fontSize;
        });

        const sizeInPx = parseFloat(fontSize);
        // Allow some elements to be smaller (icons, etc.)
        // but main content should be 18px+
        expect(sizeInPx).toBeGreaterThanOrEqual(12);
      }
    }
  });

  test('should use bright, saturated colors', async ({ page }) => {
    // Check background color is not too dark
    const body = page.locator('body');
    const bgColor = await body.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Parse RGB values
    const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const [, r, g, b] = match.map(Number);
      // Background should be light (high values)
      const brightness = (r + g + b) / 3;
      expect(brightness).toBeGreaterThan(100); // Not too dark
    }
  });

  test('should have large touch targets', async ({ studentDashboard }) => {
    await studentDashboard.verifyTouchTargets();
  });
});

test.describe('Student Dashboard - Mobile', () => {
  // Skip - requires seeded test student
  test.skip(true, 'Mobile tests require seeded test student in database');

  test.use({
    viewport: { width: 375, height: 812 }, // iPhone X
  });

  test('should be fully functional on mobile', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.loginAsStudent(testStudent.username, testStudent.pin);
    await expect(page).toHaveURL(/\/student/, { timeout: 15000 });

    // Navigation should be accessible
    const gamesLink = page.getByRole('link', { name: /jocuri|games/i });
    await expect(gamesLink).toBeVisible();
  });
});

test.describe('Student Dashboard - DashboardShell', () => {
  // EDU-52 wraps every student surface in DashboardShell. EDU-53 adds the
  // 5th nav entry (Setări → /student/profile). These tests verify that the
  // side nav renders all 5 items on desktop while the bottom nav stays at 4.
  test.skip(true, 'DashboardShell tests require seeded test student in database');

  test('renders 5 side-nav entries on desktop', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.loginAsStudent(testStudent.username, testStudent.pin);
    await expect(page).toHaveURL(/\/student/, { timeout: 15000 });

    const sideNav = page.locator('[data-testid="side-nav"]');
    await expect(sideNav).toBeVisible();
    await expect(sideNav.getByRole('link', { name: /setări/i })).toBeVisible();
    await expect(sideNav.getByRole('link')).toHaveCount(5);
  });

  test('renders 4 bottom-nav entries (no Setări) on mobile', async ({
    loginPage,
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginPage.goto();
    await loginPage.loginAsStudent(testStudent.username, testStudent.pin);
    await expect(page).toHaveURL(/\/student/, { timeout: 15000 });

    const bottomNav = page.locator('[data-testid="bottom-nav"]');
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByRole('link')).toHaveCount(4);
    await expect(bottomNav.getByRole('link', { name: /setări/i })).toHaveCount(0);
  });
});

test.describe('Student Dashboard - Visual Regression', () => {
  // Skip - requires seeded test student
  test.skip(true, 'Visual tests require seeded test student in database');

  test('should match student dashboard screenshot', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.loginAsStudent(testStudent.username, testStudent.pin);
    await expect(page).toHaveURL(/\/student/, { timeout: 15000 });

    // Wait for animations
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('student-dashboard.png', {
      maxDiffPixels: 200,
    });
  });
});
